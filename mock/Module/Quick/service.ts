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
import type {
  MockQuickGroup,
  MockQuickGroupRelation,
  MockQuickItem,
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
import { quickRepository } from './repository';

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
  // 1. 获取数据
  const allGroups = await quickRepository.findAllGroups();
  const allItems = await quickRepository.findAllItems();
  const allRelations = await quickRepository.findAllRelations();

  // 2. 按用户筛选
  const filteredGroups = allGroups
    .filter((g) => g.user_id === 0 || g.user_id === userId)
    .sort((a, b) => a.sort - b.sort);

  // 3. 关联分组下的操作项
  const result: QuickGroupWithItems[] = filteredGroups.map((group) => {
    const groupRelations = allRelations
      .filter((r) => r.group_id === group.id)
      .sort((a, b) => a.sort - b.sort);

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

  // 1. 检查名称是否重复
  const allGroups = await quickRepository.findAllGroups();
  const duplicate = allGroups.find(
    (g) => g.user_id === userId && g.name === name,
  );
  if (duplicate) {
    throw new BusinessError('分组名称已存在');
  }

  // 2. 计算 sort
  const sort =
    data.sort ??
    allGroups.filter((g) => g.user_id === userId).length + 1;

  // 3. 创建分组
  const newGroup = await quickRepository.createGroup({
    name,
    user_id: userId,
    icon: data.icon,
    sort,
    created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
  } as Partial<MockQuickGroup>);

  // 4. 清除缓存
  await quickRepository.clearGroupListCache(userId);
  await quickRepository.clearGroupInfoCache(newGroup.id);

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
  const group = await quickRepository.findGroupById(groupId);
  if (!group) {
    throw new BusinessError('分组不存在');
  }

  // 2. 如果提供了名称，检查名称是否重复
  if (data.name && data.name.trim()) {
    const name = data.name.trim();
    const allGroups = await quickRepository.findAllGroups();
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

  // 4. 更新分组
  const updatedGroup = await quickRepository.updateGroup(groupId, updateData);

  // 5. 清除缓存
  await quickRepository.clearGroupListCache(group.user_id);
  await quickRepository.clearGroupInfoCache(groupId);

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
  const group = await quickRepository.findGroupById(groupId);
  if (!group) {
    throw new BusinessError('分组不存在');
  }

  // 2. 系统分组不可删除
  if (group.user_id === 0) {
    throw new BusinessError('系统分组不可删除');
  }

  // 3. 删除分组
  await quickRepository.deleteGroup(groupId);

  // 4. 删除关联记录
  const allRelations = await quickRepository.findAllRelations();
  const relationsToDelete = allRelations.filter((r) => r.group_id === groupId);
  for (const relation of relationsToDelete) {
    await quickRepository.deleteRelation(relation.id);
  }

  // 5. 清除缓存
  await quickRepository.clearGroupListCache(group.user_id);
  await quickRepository.clearGroupInfoCache(groupId);
  await quickRepository.clearGroupItemsCache(groupId);

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
  // 1. 逐个更新排序
  for (const item of data.sorts) {
    const group = await quickRepository.findGroupById(item.id);
    if (group) {
      await quickRepository.updateGroup(item.id, { sort: item.sort });
    }
  }

  // 2. 清空分组列表缓存
  await quickRepository.flushGroupListCache();

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
  // 1. 获取数据
  const allItems = await quickRepository.findAllItems();

  // 2. 按用户筛选
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

  // 1. 检查名称是否重复
  const allItems = await quickRepository.findAllItems();
  const duplicate = allItems.find(
    (item) => item.user_id === userId && item.name === name,
  );
  if (duplicate) {
    throw new BusinessError('操作项名称已存在');
  }

  // 2. 计算 sort
  const sort =
    data.sort ??
    allItems.filter((item) => item.user_id === userId).length + 1;

  // 3. 创建操作项
  const newItem = await quickRepository.createItem({
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
  } as Partial<MockQuickItem>);

  // 4. 清除缓存
  await quickRepository.clearItemListCache(userId);
  await quickRepository.clearItemInfoCache(newItem.id);
  await quickRepository.clearItemHotCache(data.type);

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
  const item = await quickRepository.findItemById(itemId);
  if (!item) {
    throw new BusinessError('操作项不存在');
  }

  // 2. 系统操作项不可修改
  if (item.is_system) {
    throw new BusinessError('系统操作项不可修改');
  }

  // 3. 如果提供了名称，检查名称是否重复
  if (data.name && data.name.trim()) {
    const name = data.name.trim();
    const allItems = await quickRepository.findAllItems();
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

  // 5. 更新操作项
  const updatedItem = await quickRepository.updateItem(itemId, updateData);

  // 6. 清除缓存
  await quickRepository.clearItemListCache(item.user_id);
  await quickRepository.clearItemInfoCache(itemId);
  if (data.type) {
    await quickRepository.clearItemHotCache(data.type);
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
  const item = await quickRepository.findItemById(itemId);
  if (!item) {
    throw new BusinessError('操作项不存在');
  }

  // 2. 系统操作项不可删除
  if (item.is_system) {
    throw new BusinessError('系统操作项不可删除');
  }

  // 3. 删除操作项
  await quickRepository.deleteItem(itemId);

  // 4. 删除关联记录
  const allRelations = await quickRepository.findAllRelations();
  const relationsToDelete = allRelations.filter((r) => r.item_id === itemId);
  for (const relation of relationsToDelete) {
    await quickRepository.deleteRelation(relation.id);
  }

  // 5. 清除缓存
  await quickRepository.clearItemListCache(item.user_id);
  await quickRepository.clearItemInfoCache(itemId);
  await quickRepository.clearItemHotCache(item.type);
  for (const r of relationsToDelete) {
    await quickRepository.clearGroupItemsCache(r.group_id);
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
  const item = await quickRepository.findItemById(itemId);
  if (!item) {
    throw new BusinessError('操作项不存在');
  }

  // 2. 增加使用次数
  const updatedItem = await quickRepository.updateItem(itemId, {
    usage_count: item.usage_count + 1,
  });

  // 3. 清除缓存
  await quickRepository.clearItemInfoCache(itemId);
  await quickRepository.clearItemHotCache(item.type);

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
  const group = await quickRepository.findGroupById(groupId);
  if (!group) {
    throw new BusinessError('分组不存在');
  }

  // 2. 检查操作项是否存在
  const item = await quickRepository.findItemById(itemId);
  if (!item) {
    throw new BusinessError('操作项不存在');
  }

  // 3. 检查是否已存在
  const allRelations = await quickRepository.findAllRelations();
  const existing = allRelations.find(
    (r) => r.group_id === groupId && r.item_id === itemId,
  );
  if (existing) {
    throw new BusinessError('该操作已在分组中');
  }

  // 4. 计算 sort
  const sort =
    data.sort ??
    allRelations.filter((r) => r.group_id === groupId).length + 1;

  // 5. 创建关联
  const newRelation = await quickRepository.createRelation({
    group_id: groupId,
    item_id: itemId,
    sort,
    created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
  } as Partial<MockQuickGroupRelation>);

  // 6. 清除缓存
  await quickRepository.clearGroupItemsCache(groupId);

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
  const allRelations = await quickRepository.findAllRelations();
  const relation = allRelations.find(
    (r) => r.group_id === groupId && r.item_id === itemId,
  );
  if (!relation) {
    throw new BusinessError('该操作不在分组中');
  }

  // 2. 删除关联
  await quickRepository.deleteRelation(relation.id);

  // 3. 清除缓存
  await quickRepository.clearGroupItemsCache(groupId);

  return null;
}
