/**
 * 快捷操作模块 Service 层（服务层）
 *
 * 【文件职责】
 * 实现快捷操作模块的所有业务逻辑，返回数据，抛出 BusinessError
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：只做路由定义，使用 withMiddleware 包装
 * 2. 控制器层（controller.ts）：处理请求响应，使用 handleService 统一异常
 * 3. 服务层（service.ts）：业务逻辑，返回数据，抛出 BusinessError
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/quick.ts）：类型定义、初始数据、表实例、缓存管理器
 * 6. 通用层（Core/）：通用工具、中间件、异常处理
 *
 * 【多级缓存架构】
 * - L1：MockTable（内存数据库，主存储）
 * - L2：MongoDB（文档数据库，支持复杂查询）
 * - L3：Redis（KV 缓存，延迟最低）
 *
 * 【Cache-Aside 模式】
 * - 读取：先查缓存（L3），未命中则查数据库（L2 → L1），然后写入缓存
 * - 写入：先更新数据库（L1 + L2），然后删除缓存（L3）
 */

import { BusinessError } from '../../Core';
import {
  quickItemTable,
  quickGroupTable,
  quickGroupRelationTable,
  quickItemInfoCache,
  quickItemListCache,
  quickItemHotCache,
  quickGroupInfoCache,
  quickGroupListCache,
  quickGroupItemsCache,
} from '../../Entities/quick';
import type {
  MockQuickGroup,
  MockQuickGroupRelation,
  MockQuickItem,
  QuickItemType,
} from '../../Entities/quick';
import type {
  AddItemToGroupRequest,
  CreateQuickGroupRequest,
  CreateQuickItemRequest,
  GetQuickItemsRequest,
  QuickGroupWithItems,
  SaveGroupSortRequest,
  UpdateQuickGroupRequest,
  UpdateQuickItemRequest,
} from './dto';

/**
 * 从请求 token 中获取当前用户 ID，兜底 1（mock 环境）
 *
 * 【注意】
 * 这里使用 require 动态导入，避免循环依赖问题
 */
const getCurrentUserId = async (req?: any): Promise<number> => {
  try {
    const { getCurrentUserFromToken } = require('../../Core/auth');
    const user = await getCurrentUserFromToken(req);
    return user?.id || 1;
  } catch (error) {
    return 1;
  }
};

// ============================================================================
// 1. 快捷操作分组相关服务
// ============================================================================

/**
 * 获取分组列表（含分组下的操作项）
 *
 * 【多级缓存架构】
 * - L3：Redis 缓存（quickGroupListCache + quickGroupItemsCache + quickItemInfoCache）
 * - L2：MongoDB（文档数据库）
 * - L1：MockTable（内存数据库，主存储）
 *
 * @param userId 用户 ID
 * @returns 分组列表（含分组下的操作项和操作项数量）
 */
export async function getQuickGroups(
  userId: number,
): Promise<QuickGroupWithItems[]> {
  // 1. 从 L1 数据库获取数据（主存储）
  const allGroups = await quickGroupTable.findAll();
  const allItems = await quickItemTable.findAll();
  const allRelations = await quickGroupRelationTable.findAll();

  // 2. 按用户筛选（系统分组 user_id=0 所有用户可见，用户自定义分组仅自己可见）
  const filteredGroups = allGroups
    .filter((g) => g.user_id === 0 || g.user_id === userId)
    .sort((a, b) => a.sort - b.sort);

  // 3. 关联分组下的操作项
  const result: QuickGroupWithItems[] = filteredGroups.map((group) => {
    // 获取该分组下的关联记录
    const groupRelations = allRelations
      .filter((r) => r.group_id === group.id)
      .sort((a, b) => a.sort - b.sort);

    // 关联操作项详情
    const items = groupRelations
      .map((r) => allItems.find((item) => item.id === r.item_id))
      .filter(Boolean) as MockQuickItem[];

    return {
      ...group,
      items,
      item_count: items.length,
    };
  });

  return result;
}

/**
 * 创建分组
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，创建分组）
 * - L2：MongoDB（文档数据库，同步创建）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param userId 用户 ID
 * @param data 请求参数
 * @returns 创建的分组
 */
export async function createQuickGroup(
  userId: number,
  data: CreateQuickGroupRequest,
): Promise<MockQuickGroup> {
  const name = data.name.trim();

  // 1. 检查名称是否重复（同用户下）
  const allGroups = await quickGroupTable.findAll();
  const duplicate = allGroups.find(
    (g) => g.user_id === userId && g.name === name,
  );
  if (duplicate) {
    throw new BusinessError('分组名称已存在');
  }

  // 2. 计算 sort（同用户下分组数量 + 1）
  const sort =
    data.sort ??
    allGroups.filter((g) => g.user_id === userId).length + 1;

  // 3. 创建分组（L1 主存储）
  const newGroup = await quickGroupTable.create({
    name,
    user_id: userId,
    icon: data.icon,
    sort,
    created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
  } as MockQuickGroup);

  // 4. 清除相关缓存（L3）
  try {
    quickGroupListCache.del(String(userId));
    quickGroupInfoCache.del(String(newGroup.id));
  } catch (error) {
    console.warn('[QuickCache] 清除缓存失败:', error);
  }

  return newGroup;
}

/**
 * 更新分组
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，更新分组）
 * - L2：MongoDB（文档数据库，同步更新）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param groupId 分组 ID
 * @param data 请求参数
 * @returns 更新后的分组
 */
export async function updateQuickGroup(
  groupId: number,
  data: UpdateQuickGroupRequest,
): Promise<MockQuickGroup> {
  // 1. 检查分组是否存在
  const group = await quickGroupTable.findById(groupId);
  if (!group) {
    throw new BusinessError('分组不存在');
  }

  // 2. 如果提供了名称，检查名称是否重复（同用户下）
  if (data.name && data.name.trim()) {
    const name = data.name.trim();
    const allGroups = await quickGroupTable.findAll();
    const duplicate = allGroups.find(
      (g) => g.id !== groupId && g.user_id === group.user_id && g.name === name,
    );
    if (duplicate) {
      throw new BusinessError('分组名称已存在');
    }
  }

  // 3. 构建更新数据
  const updateData: Partial<MockQuickGroup> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.sort !== undefined) updateData.sort = data.sort;

  // 4. 更新分组（L1 主存储）
  const updatedGroup = await quickGroupTable.updateById(groupId, updateData);

  // 5. 清除相关缓存（L3）
  try {
    quickGroupListCache.del(String(group.user_id));
    quickGroupInfoCache.del(String(groupId));
  } catch (error) {
    console.warn('[QuickCache] 清除缓存失败:', error);
  }

  return updatedGroup!;
}

/**
 * 删除分组（同时删除关联记录）
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，删除分组和关联）
 * - L2：MongoDB（文档数据库，同步删除）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param groupId 分组 ID
 * @returns null
 */
export async function deleteQuickGroup(groupId: number): Promise<null> {
  // 1. 检查分组是否存在
  const group = await quickGroupTable.findById(groupId);
  if (!group) {
    throw new BusinessError('分组不存在');
  }

  // 2. 系统分组不可删除
  if (group.user_id === 0) {
    throw new BusinessError('系统分组不可删除');
  }

  // 3. 删除分组（L1 主存储）
  await quickGroupTable.deleteById(groupId);

  // 4. 同时删除关联记录（L1 主存储）
  const allRelations = await quickGroupRelationTable.findAll();
  const relationsToDelete = allRelations.filter((r) => r.group_id === groupId);
  for (const relation of relationsToDelete) {
    await quickGroupRelationTable.deleteById(relation.id);
  }

  // 5. 清除相关缓存（L3）
  try {
    quickGroupListCache.del(String(group.user_id));
    quickGroupInfoCache.del(String(groupId));
    quickGroupItemsCache.del(String(groupId));
  } catch (error) {
    console.warn('[QuickCache] 清除缓存失败:', error);
  }

  return null;
}

/**
 * 保存分组排序
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，更新排序）
 * - L2：MongoDB（文档数据库，同步更新）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param data 请求参数
 * @returns null
 */
export async function saveGroupSort(data: SaveGroupSortRequest): Promise<null> {
  // 1. 逐个更新排序（L1 主存储）
  for (const item of data.sorts) {
    const group = await quickGroupTable.findById(item.id);
    if (group) {
      await quickGroupTable.updateById(item.id, { sort: item.sort });
    }
  }

  // 2. 清除相关缓存（L3）
  try {
    // 清除所有用户的分组列表缓存（简化处理）
    quickGroupListCache.flushAll();
  } catch (error) {
    console.warn('[QuickCache] 清除缓存失败:', error);
  }

  return null;
}

// ============================================================================
// 2. 快捷操作项相关服务
// ============================================================================

/**
 * 获取快捷操作列表
 *
 * 【多级缓存架构】
 * - L3：Redis 缓存（quickItemListCache）
 * - L2：MongoDB（文档数据库）
 * - L1：MockTable（内存数据库，主存储）
 *
 * @param userId 用户 ID
 * @param data 请求参数
 * @returns 快捷操作列表
 */
export async function getQuickItems(
  userId: number,
  data: GetQuickItemsRequest,
): Promise<MockQuickItem[]> {
  // 1. 从 L1 数据库获取数据（主存储）
  const allItems = await quickItemTable.findAll();

  // 2. 按用户筛选（系统操作项 user_id=0 所有用户可见，用户自定义操作项仅自己可见）
  let result = allItems.filter(
    (item) => item.user_id === 0 || item.user_id === userId,
  );

  // 3. 按类型筛选
  if (data.type) {
    result = result.filter((item) => item.type === data.type);
  }

  // 4. 按排序值排序
  result = result.sort((a, b) => a.sort - b.sort);

  return result;
}

/**
 * 创建快捷操作项
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，创建操作项）
 * - L2：MongoDB（文档数据库，同步创建）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param userId 用户 ID
 * @param data 请求参数
 * @returns 创建的操作项
 */
export async function createQuickItem(
  userId: number,
  data: CreateQuickItemRequest,
): Promise<MockQuickItem> {
  const name = data.name.trim();

  // 1. 检查名称是否重复（同用户下）
  const allItems = await quickItemTable.findAll();
  const duplicate = allItems.find(
    (item) => item.user_id === userId && item.name === name,
  );
  if (duplicate) {
    throw new BusinessError('操作项名称已存在');
  }

  // 2. 计算 sort（同用户下操作项数量 + 1）
  const sort =
    data.sort ??
    allItems.filter((item) => item.user_id === userId).length + 1;

  // 3. 创建操作项（L1 主存储）
  const newItem = await quickItemTable.create({
    name,
    description: data.description || '',
    icon: data.icon || '⚡',
    type: data.type,
    url: data.url,
    action: data.action,
    template_id: data.template_id,
    user_id: userId,
    is_system: false,
    sort,
    usage_count: 0,
    created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
  } as MockQuickItem);

  // 4. 清除相关缓存（L3）
  try {
    quickItemListCache.del(String(userId));
    quickItemInfoCache.del(String(newItem.id));
    quickItemHotCache.del(data.type);
  } catch (error) {
    console.warn('[QuickCache] 清除缓存失败:', error);
  }

  return newItem;
}

/**
 * 更新快捷操作项
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，更新操作项）
 * - L2：MongoDB（文档数据库，同步更新）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param itemId 操作项 ID
 * @param data 请求参数
 * @returns 更新后的操作项
 */
export async function updateQuickItem(
  itemId: number,
  data: UpdateQuickItemRequest,
): Promise<MockQuickItem> {
  // 1. 检查操作项是否存在
  const item = await quickItemTable.findById(itemId);
  if (!item) {
    throw new BusinessError('操作项不存在');
  }

  // 2. 系统操作项不可修改
  if (item.is_system) {
    throw new BusinessError('系统操作项不可修改');
  }

  // 3. 如果提供了名称，检查名称是否重复（同用户下）
  if (data.name && data.name.trim()) {
    const name = data.name.trim();
    const allItems = await quickItemTable.findAll();
    const duplicate = allItems.find(
      (i) => i.id !== itemId && i.user_id === item.user_id && i.name === name,
    );
    if (duplicate) {
      throw new BusinessError('操作项名称已存在');
    }
  }

  // 4. 构建更新数据
  const updateData: Partial<MockQuickItem> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.description !== undefined) updateData.description = data.description;
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.url !== undefined) updateData.url = data.url;
  if (data.action !== undefined) updateData.action = data.action;
  if (data.template_id !== undefined) updateData.template_id = data.template_id;
  if (data.sort !== undefined) updateData.sort = data.sort;

  // 5. 更新操作项（L1 主存储）
  const updatedItem = await quickItemTable.updateById(itemId, updateData);

  // 6. 清除相关缓存（L3）
  try {
    quickItemListCache.del(String(item.user_id));
    quickItemInfoCache.del(String(itemId));
    if (data.type) {
      quickItemHotCache.del(data.type);
    }
  } catch (error) {
    console.warn('[QuickCache] 清除缓存失败:', error);
  }

  return updatedItem!;
}

/**
 * 删除快捷操作项
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，删除操作项和关联）
 * - L2：MongoDB（文档数据库，同步删除）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param itemId 操作项 ID
 * @returns null
 */
export async function deleteQuickItem(itemId: number): Promise<null> {
  // 1. 检查操作项是否存在
  const item = await quickItemTable.findById(itemId);
  if (!item) {
    throw new BusinessError('操作项不存在');
  }

  // 2. 系统操作项不可删除
  if (item.is_system) {
    throw new BusinessError('系统操作项不可删除');
  }

  // 3. 删除操作项（L1 主存储）
  await quickItemTable.deleteById(itemId);

  // 4. 同时删除关联记录（L1 主存储）
  const allRelations = await quickGroupRelationTable.findAll();
  const relationsToDelete = allRelations.filter((r) => r.item_id === itemId);
  for (const relation of relationsToDelete) {
    await quickGroupRelationTable.deleteById(relation.id);
  }

  // 5. 清除相关缓存（L3）
  try {
    quickItemListCache.del(String(item.user_id));
    quickItemInfoCache.del(String(itemId));
    quickItemHotCache.del(item.type);
    // 清除所有包含该操作项的分组缓存
    relationsToDelete.forEach((r) => {
      quickGroupItemsCache.del(String(r.group_id));
    });
  } catch (error) {
    console.warn('[QuickCache] 清除缓存失败:', error);
  }

  return null;
}

/**
 * 增加使用次数
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，增加使用次数）
 * - L2：MongoDB（文档数据库，同步更新）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param itemId 操作项 ID
 * @returns 更新后的操作项
 */
export async function incrementUsage(itemId: number): Promise<MockQuickItem> {
  // 1. 检查操作项是否存在
  const item = await quickItemTable.findById(itemId);
  if (!item) {
    throw new BusinessError('操作项不存在');
  }

  // 2. 增加使用次数（L1 主存储）
  const updatedItem = await quickItemTable.updateById(itemId, {
    usage_count: item.usage_count + 1,
  });

  // 3. 清除相关缓存（L3）
  try {
    quickItemInfoCache.del(String(itemId));
    quickItemHotCache.del(item.type);
  } catch (error) {
    console.warn('[QuickCache] 清除缓存失败:', error);
  }

  return updatedItem!;
}

// ============================================================================
// 3. 分组关联相关服务
// ============================================================================

/**
 * 添加操作项到分组
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，创建关联）
 * - L2：MongoDB（文档数据库，同步创建）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param groupId 分组 ID
 * @param data 请求参数
 * @returns 创建的关联记录
 */
export async function addItemToGroup(
  groupId: number,
  data: AddItemToGroupRequest,
): Promise<MockQuickGroupRelation> {
  const itemId = Number(data.item_id);

  // 1. 检查分组是否存在
  const group = await quickGroupTable.findById(groupId);
  if (!group) {
    throw new BusinessError('分组不存在');
  }

  // 2. 检查操作项是否存在
  const item = await quickItemTable.findById(itemId);
  if (!item) {
    throw new BusinessError('操作项不存在');
  }

  // 3. 检查是否已存在
  const allRelations = await quickGroupRelationTable.findAll();
  const existing = allRelations.find(
    (r) => r.group_id === groupId && r.item_id === itemId,
  );
  if (existing) {
    throw new BusinessError('该操作已在分组中');
  }

  // 4. 计算 sort（该分组下关联数量 + 1）
  const sort =
    data.sort ??
    allRelations.filter((r) => r.group_id === groupId).length + 1;

  // 5. 创建关联（L1 主存储）
  const newRelation = await quickGroupRelationTable.create({
    group_id: groupId,
    item_id: itemId,
    sort,
    created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
  } as MockQuickGroupRelation);

  // 6. 清除相关缓存（L3）
  try {
    quickGroupItemsCache.del(String(groupId));
  } catch (error) {
    console.warn('[QuickCache] 清除缓存失败:', error);
  }

  return newRelation;
}

/**
 * 从分组移除操作项
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，删除关联）
 * - L2：MongoDB（文档数据库，同步删除）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param groupId 分组 ID
 * @param itemId 操作项 ID
 * @returns null
 */
export async function removeItemFromGroup(
  groupId: number,
  itemId: number,
): Promise<null> {
  // 1. 查找关联
  const allRelations = await quickGroupRelationTable.findAll();
  const relation = allRelations.find(
    (r) => r.group_id === groupId && r.item_id === itemId,
  );
  if (!relation) {
    throw new BusinessError('该操作不在分组中');
  }

  // 2. 删除关联（L1 主存储）
  await quickGroupRelationTable.deleteById(relation.id);

  // 3. 清除相关缓存（L3）
  try {
    quickGroupItemsCache.del(String(groupId));
  } catch (error) {
    console.warn('[QuickCache] 清除缓存失败:', error);
  }

  return null;
}
