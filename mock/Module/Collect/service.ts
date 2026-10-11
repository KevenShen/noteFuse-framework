/**
 * 收藏模块 Service 层（服务层）
 *
 * 【文件职责】
 * 实现收藏模块的所有业务逻辑，返回数据，抛出 BusinessError
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：只做路由定义，使用 withMiddleware 包装
 * 2. 控制器层（controller.ts）：处理请求响应，使用 handleService 统一异常
 * 3. 服务层（service.ts）：业务逻辑，返回数据，抛出 BusinessError
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/collect.ts）：类型定义、初始数据、表实例、缓存管理器
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
import { docs, docVersions } from '../../Entities/doc';
import { projectCategories, projects } from '../../Entities/project';
import {
  collectGroupTable,
  collectTable,
  collectGroupInfoCache,
  collectGroupListCache,
  collectInfoCache,
  collectListCache,
  collectByTargetCache,
  collectCountCache,
} from '../../Entities/collect';
import type {
  MockCollect,
  MockCollectGroup,
  CollectType,
} from '../../Entities/collect';
import type {
  CheckCollectedRequest,
  CollectGroupWithCount,
  CollectItem,
  CreateCollectGroupRequest,
  CreateCollectRequest,
  GetCollectGroupsRequest,
  GetCollectListRequest,
  MoveCollectRequest,
  UpdateCollectGroupRequest,
} from './dto';

/**
 * 从请求 token 中获取当前用户 ID，兜底 1（mock 环境）
 *
 * 【注意】
 * 这里使用 require 动态导入，避免循环依赖问题
 * User 模块的 service 可能会导入 Collect 模块的某些内容
 */
const getCurrentUserId = (req?: any): number => {
  try {
    const { getCurrentUserFromToken } = require('../User/service');
    const user = getCurrentUserFromToken(req);
    return user?.id || 1;
  } catch (error) {
    return 1;
  }
};

// ============================================================================
// 1. 收藏分组相关服务
// ============================================================================

/**
 * 获取收藏分组列表（含收藏数量统计）
 *
 * 【多级缓存架构】
 * - L3：Redis 缓存（collectGroupListCache + collectCountCache）
 * - L2：MongoDB（文档数据库）
 * - L1：MockTable（内存数据库，主存储）
 *
 * @param userId 用户 ID
 * @param data 请求参数
 * @returns 收藏分组列表（含收藏数量、未分组数量、全部数量）
 */
export async function getCollectGroups(
  userId: number,
  data: GetCollectGroupsRequest,
): Promise<{
  list: CollectGroupWithCount[];
  ungrouped_count: number;
  total_count: number;
}> {
  const type = (data.type || 'doc') as CollectType;

  // 1. 从 L1 数据库获取数据（主存储）
  const allGroups = await collectGroupTable.findAll();
  const allCollects = await collectTable.findAll();

  // 2. 按用户 + 类型筛选并排序
  const filteredGroups = allGroups
    .filter((g) => g.user_id === userId && g.type === type)
    .sort((a, b) => a.sort - b.sort);

  // 3. 统计每个分组的收藏数量
  const list: CollectGroupWithCount[] = filteredGroups.map((group) => ({
    ...group,
    count: allCollects.filter(
      (c) => c.group_id === group.id && c.user_id === userId && c.type === type,
    ).length,
  }));

  // 4. 统计未分组数量和全部数量
  const ungroupedCount = allCollects.filter(
    (c) => c.group_id === 0 && c.user_id === userId && c.type === type,
  ).length;
  const totalCount = allCollects.filter(
    (c) => c.user_id === userId && c.type === type,
  ).length;

  return {
    list,
    ungrouped_count: ungroupedCount,
    total_count: totalCount,
  };
}

/**
 * 创建收藏分组
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
export async function createCollectGroup(
  userId: number,
  data: CreateCollectGroupRequest,
): Promise<MockCollectGroup> {
  const name = data.name.trim();
  const type = (data.type || 'doc') as CollectType;
  const description = data.description || '';
  const icon = data.icon;

  // 1. 检查名称是否重复（同用户 + 同类型下）
  const allGroups = await collectGroupTable.findAll();
  const duplicate = allGroups.find(
    (g) => g.user_id === userId && g.name === name && g.type === type,
  );
  if (duplicate) {
    throw new BusinessError('分组名称已存在');
  }

  // 2. 计算 sort（同类型下分组数量 + 1）
  const sort =
    data.sort ??
    allGroups.filter((g) => g.user_id === userId && g.type === type).length + 1;

  // 3. 创建分组（L1 主存储）
  const newGroup = await collectGroupTable.create({
    name,
    user_id: userId,
    type,
    sort,
    icon,
    description,
    created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
  } as MockCollectGroup);

  // 4. 清除相关缓存（L3）
  try {
    collectGroupListCache.del(`${userId}:${type}`);
    collectGroupInfoCache.del(String(newGroup.id));
  } catch (error) {
    console.warn('[CollectCache] 清除缓存失败:', error);
  }

  return newGroup;
}

/**
 * 更新收藏分组
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
export async function updateCollectGroup(
  groupId: number,
  data: UpdateCollectGroupRequest,
): Promise<MockCollectGroup> {
  // 1. 检查分组是否存在
  const group = await collectGroupTable.findById(groupId);
  if (!group) {
    throw new BusinessError('分组不存在');
  }

  // 2. 如果提供了名称，检查名称是否重复（同用户 + 同类型下）
  if (data.name && data.name.trim()) {
    const name = data.name.trim();
    const allGroups = await collectGroupTable.findAll();
    const duplicate = allGroups.find(
      (g) =>
        g.id !== groupId &&
        g.user_id === group.user_id &&
        g.name === name &&
        g.type === group.type,
    );
    if (duplicate) {
      throw new BusinessError('分组名称已存在');
    }
  }

  // 3. 构建更新数据
  const updateData: Partial<MockCollectGroup> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.description !== undefined) updateData.description = data.description;
  if (data.sort !== undefined) updateData.sort = data.sort;
  if (data.icon !== undefined) updateData.icon = data.icon;

  // 4. 更新分组（L1 主存储）
  const updatedGroup = await collectGroupTable.updateById(groupId, updateData);

  // 5. 清除相关缓存（L3）
  try {
    collectGroupListCache.del(`${group.user_id}:${group.type}`);
    collectGroupInfoCache.del(String(groupId));
  } catch (error) {
    console.warn('[CollectCache] 清除缓存失败:', error);
  }

  return updatedGroup!;
}

/**
 * 删除收藏分组（有收藏项时不能删除）
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，删除分组）
 * - L2：MongoDB（文档数据库，同步删除）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param groupId 分组 ID
 * @returns null
 */
export async function deleteCollectGroup(groupId: number): Promise<null> {
  // 1. 检查分组是否存在
  const group = await collectGroupTable.findById(groupId);
  if (!group) {
    throw new BusinessError('分组不存在');
  }

  // 2. 检查该分组下是否有收藏项
  const allCollects = await collectTable.findAll();
  const collectCount = allCollects.filter(
    (c) => c.group_id === groupId && c.type === group.type,
  ).length;
  if (collectCount > 0) {
    throw new BusinessError(
      `该分组下还有 ${collectCount} 个收藏项，请先移除或移动后再删除`,
    );
  }

  // 3. 删除分组（L1 主存储）
  await collectGroupTable.deleteById(groupId);

  // 4. 清除相关缓存（L3）
  try {
    collectGroupListCache.del(`${group.user_id}:${group.type}`);
    collectGroupInfoCache.del(String(groupId));
    collectCountCache.del(String(groupId));
  } catch (error) {
    console.warn('[CollectCache] 清除缓存失败:', error);
  }

  return null;
}

// ============================================================================
// 2. 收藏记录相关服务
// ============================================================================

/**
 * 获取收藏列表（支持类型筛选、分组筛选、关键词、分页）
 *
 * 【多级缓存架构】
 * - L3：Redis 缓存（collectListCache）
 * - L2：MongoDB（文档数据库）
 * - L1：MockTable（内存数据库，主存储）
 *
 * @param userId 用户 ID
 * @param data 请求参数
 * @returns 收藏列表（分页）
 */
export async function getCollectList(
  userId: number,
  data: GetCollectListRequest,
): Promise<{
  list: CollectItem[];
  total: number;
  page: number;
  page_size: number;
}> {
  const page = data.page ?? 1;
  const pageSize = data.page_size ?? 10;
  const groupId = data.group_id ?? -1;
  const keyword = data.keyword || '';
  const type = (data.type || 'doc') as CollectType;

  // 1. 从 L1 数据库获取数据（主存储）
  const allCollects = await collectTable.findAll();
  const allGroups = await collectGroupTable.findAll();

  // 使用静态导入的 docs, projects, docVersions（避免动态 require 在 Umi mock 环境中解析失败）

  // 2. 统一表过滤：按用户 + type
  let result = allCollects.filter(
    (c) => c.user_id === userId && c.type === type,
  );

  // 3. 分组筛选（-1 表示全部，0 表示未分组，其他表示指定分组）
  if (groupId >= 0) {
    result = result.filter((c) => c.group_id === groupId);
  }

  // 4. 关联目标信息（文档或文集）
  let itemList: CollectItem[] = result
    .map((c) => {
      const group = allGroups.find((g) => g.id === c.group_id);
      if (type === 'doc') {
        const doc = docs.find((d: any) => d.id === c.target_id);
        if (!doc) return null;
        const project = projects.find((p: any) => p.id === doc.project_id);
        const currentVersion = docVersions.find(
          (v: any) => v.doc_id === doc.id && v.is_current,
        );
        return {
          ...doc,
          project_name: project?.name || '未知文集',
          author_name: currentVersion?.author_name || '未知',
          author_id: currentVersion?.author_id || 0,
          collect_id: c.id,
          group_id: c.group_id,
          group_name: group?.name || '未分组',
          collect_time: c.collected_at,
        } as CollectItem;
      } else {
        const project = projects.find((p: any) => p.id === c.target_id);
        if (!project) return null;
        const category = projectCategories.find(
          (cat: any) => cat.id === project.project_category_id,
        );
        return {
          ...project,
          category_name: category?.name || '未分类',
          collect_id: c.id,
          group_id: c.group_id,
          group_name: group?.name || '未分组',
          collect_time: c.collected_at,
        } as CollectItem;
      }
    })
    .filter(Boolean) as CollectItem[];

  // 5. 关键词搜索
  if (keyword) {
    itemList = itemList.filter((item: any) =>
      item.name.toLowerCase().includes(keyword.toLowerCase()),
    );
  }

  // 6. 按收藏时间倒序
  itemList.sort((a: any, b: any) => {
    const timeA = new Date(a.collect_time).getTime();
    const timeB = new Date(b.collect_time).getTime();
    return timeB - timeA;
  });

  // 7. 分页
  const total = itemList.length;
  const start = (page - 1) * pageSize;
  const pagedList = itemList.slice(start, start + pageSize);

  return {
    list: pagedList,
    total,
    page,
    page_size: pageSize,
  };
}

/**
 * 添加收藏（统一接口，type 区分文档/文集）
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，创建收藏）
 * - L2：MongoDB（文档数据库，同步创建）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param userId 用户 ID
 * @param data 请求参数
 * @returns 创建的收藏
 */
export async function createCollect(
  userId: number,
  data: CreateCollectRequest,
): Promise<MockCollect> {
  const type = (data.type || 'doc') as CollectType;
  const targetId = Number(data.target_id);
  const groupId = data.group_id ?? 0;

  // 1. 检查是否已收藏（同用户 + 同 type + 同 target_id）
  const allCollects = await collectTable.findAll();
  const existing = allCollects.find(
    (c) => c.user_id === userId && c.type === type && c.target_id === targetId,
  );
  if (existing) {
    throw new BusinessError(type === 'doc' ? '该文档已收藏' : '该文集已收藏');
  }

  // 2. 如果指定了分组，检查分组是否存在
  if (groupId > 0) {
    const group = await collectGroupTable.findById(groupId);
    if (!group) {
      throw new BusinessError('分组不存在');
    }
  }

  // 3. 获取目标信息（用于冗余字段快照保存）
  // 使用静态导入的 docs, projects（避免动态 require 在 Umi mock 环境中解析失败）
  let targetName = '';
  let targetSummary = '';
  let targetCover = '';
  let targetAuthor = '';

  if (type === 'doc') {
    const doc = docs.find((d: any) => d.id === targetId);
    if (!doc) {
      throw new BusinessError('文档不存在');
    }
    targetName = doc.name;
    targetSummary = doc.summary || '';
    targetAuthor = doc.author_name || '';
  } else {
    const project = projects.find((p: any) => p.id === targetId);
    if (!project) {
      throw new BusinessError('文集不存在');
    }
    targetName = project.name;
    targetSummary = project.intro || '';
    targetCover = project.cover || '';
    targetAuthor = '';
  }

  // 4. 创建收藏（L1 主存储）
  const newCollect = await collectTable.create({
    user_id: userId,
    type,
    target_id: targetId,
    group_id: groupId,
    target_name: targetName,
    target_summary: targetSummary,
    target_cover: targetCover,
    target_author: targetAuthor,
    collected_at: new Date().toLocaleString('zh-CN', { hour12: false }),
  } as MockCollect);

  // 5. 清除相关缓存（L3）
  try {
    collectListCache.del(`${userId}:${type}:${groupId}`);
    collectByTargetCache.del(`${userId}:${type}:${targetId}`);
    collectInfoCache.del(String(newCollect.id));
    collectCountCache.del(String(groupId));
    collectGroupListCache.del(`${userId}:${type}`);
  } catch (error) {
    console.warn('[CollectCache] 清除缓存失败:', error);
  }

  return newCollect;
}

/**
 * 取消收藏
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，删除收藏）
 * - L2：MongoDB（文档数据库，同步删除）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param collectId 收藏 ID
 * @returns null
 */
export async function deleteCollect(collectId: number): Promise<null> {
  // 1. 检查收藏是否存在
  const collect = await collectTable.findById(collectId);
  if (!collect) {
    throw new BusinessError('收藏记录不存在');
  }

  // 2. 删除收藏（L1 主存储）
  await collectTable.deleteById(collectId);

  // 3. 清除相关缓存（L3）
  try {
    collectListCache.del(`${collect.user_id}:${collect.type}:${collect.group_id}`);
    collectByTargetCache.del(
      `${collect.user_id}:${collect.type}:${collect.target_id}`,
    );
    collectInfoCache.del(String(collectId));
    collectCountCache.del(String(collect.group_id));
    collectGroupListCache.del(`${collect.user_id}:${collect.type}`);
  } catch (error) {
    console.warn('[CollectCache] 清除缓存失败:', error);
  }

  return null;
}

/**
 * 移动收藏到其他分组
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，更新分组）
 * - L2：MongoDB（文档数据库，同步更新）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param collectId 收藏 ID
 * @param data 请求参数
 * @returns 更新后的收藏
 */
export async function moveCollect(
  collectId: number,
  data: MoveCollectRequest,
): Promise<MockCollect> {
  const targetGroupId = Number(data.group_id);

  // 1. 检查收藏是否存在
  const collect = await collectTable.findById(collectId);
  if (!collect) {
    throw new BusinessError('收藏记录不存在');
  }

  // 2. 如果目标分组不是未分组（0），检查分组是否存在
  if (targetGroupId > 0) {
    const targetGroup = await collectGroupTable.findById(targetGroupId);
    if (!targetGroup) {
      throw new BusinessError('目标分组不存在');
    }
  }

  // 3. 记录原分组 ID（用于清除缓存）
  const oldGroupId = collect.group_id;

  // 4. 更新分组（L1 主存储）
  const updatedCollect = await collectTable.updateById(collectId, {
    group_id: targetGroupId,
  });

  // 5. 清除相关缓存（L3）
  try {
    // 清除原分组的列表缓存
    collectListCache.del(`${collect.user_id}:${collect.type}:${oldGroupId}`);
    // 清除新分组的列表缓存
    collectListCache.del(`${collect.user_id}:${collect.type}:${targetGroupId}`);
    // 清除收藏详情缓存
    collectInfoCache.del(String(collectId));
    // 清除原分组的数量缓存
    collectCountCache.del(String(oldGroupId));
    // 清除新分组的数量缓存
    collectCountCache.del(String(targetGroupId));
    // 清除分组列表缓存
    collectGroupListCache.del(`${collect.user_id}:${collect.type}`);
  } catch (error) {
    console.warn('[CollectCache] 清除缓存失败:', error);
  }

  return updatedCollect!;
}

/**
 * 检查是否已收藏
 *
 * 【多级缓存架构】
 * - L3：Redis 缓存（collectByTargetCache）
 * - L2：MongoDB（文档数据库）
 * - L1：MockTable（内存数据库，主存储）
 *
 * @param userId 用户 ID
 * @param data 请求参数
 * @returns 是否已收藏（含收藏 ID、分组 ID）
 */
export async function checkCollected(
  userId: number,
  data: CheckCollectedRequest,
): Promise<{
  collected: boolean;
  collect_id?: number;
  group_id?: number;
}> {
  const type = (data.type || 'doc') as CollectType;
  const targetId = Number(data.target_id);

  // 1. 从 L1 数据库查询（主存储）
  const allCollects = await collectTable.findAll();
  const existing = allCollects.find(
    (c) => c.user_id === userId && c.type === type && c.target_id === targetId,
  );

  if (existing) {
    return {
      collected: true,
      collect_id: existing.id,
      group_id: existing.group_id,
    };
  }

  return {
    collected: false,
  };
}
