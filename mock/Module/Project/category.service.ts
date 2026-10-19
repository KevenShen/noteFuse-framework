// mock/Project/category.service.ts
// 分类服务层
// 职责：处理分类相关的核心业务逻辑，调用数据库（MockTable）和缓存（Redis）

import { BusinessError, ErrorCodes } from '../../Core';
import { redis } from '../../Core/redis';
import type { MockProject, MockProjectCategory } from '../../Entities/project';
import {
  categoryChainCache,
  categoryCountCache,
  categoryInfoCache,
  categoryMongoCollection,
  categoryTable,
  projectTable,
} from '../../Entities/project';
import type {
  BatchDeleteCategoriesRequest,
  BatchDeleteCategoriesResponse,
  BatchMoveCategoriesRequest,
  BatchMoveCategoriesResponse,
  CategoryWithStats,
  CreateCategoryRequest,
  DeleteCategoryResponse,
  SaveCategorySortRequest,
  SaveCategorySortResponse,
  UpdateCategoryRequest,
} from './category.dto';

// ============================================================================
// Redis 缓存前缀常量（模块级，所有函数和类方法共享）
// ============================================================================
const INFO_PREFIX = 'project:category:info:';
const ORDER_PREFIX = 'project:category:order:';
const COUNT_PREFIX = 'project:category:count:';
const CHAIN_PREFIX = 'project:category:chain:';
const PROJECTS_PREFIX = 'project:category:projects:';

// ============================================================================
// 分类缓存辅助函数
// ============================================================================
/**
 * Hash → 分类对象转换（辅助函数）
 *
 * 【作用】将 Redis Hash 存储的字符串数据转换成 MockProjectCategory 对象
 * 【处理】Number() 转换、空字符串转 undefined 等
 *
 * @param hashData Redis Hash 数据（所有字段值都是字符串）
 * @returns MockProjectCategory 对象
 */
function hashToCategory(hashData: Record<string, string>): MockProjectCategory {
  return {
    id: Number(hashData.id),
    name: hashData.name,
    parent_id: Number(hashData.parent_id),
    sort: Number(hashData.sort),
    icon: hashData.icon || undefined,
    description: hashData.description || undefined,
    create_time: Number(hashData.create_time),
  };
}

/**
 * 从缓存读取分类祖先链路
 * @param categoryId 分类 ID
 * @returns 祖先链路数据（缓存未命中时返回 null）
 */
async function getCategoryChainFromCache(categoryId: number): Promise<{
  chain: number[];
  depth: number;
  ancestors: number[];
  children: number[]; // 直接子节点 ID 列表（替代 children_count，用途更广）
} | null> {
  // 使用 Pipeline 批量读取，减少网络往返
  // 注意：categoryChainCache.prefix 未被 createCache 暴露，需使用硬编码前缀
  const pipeline = redis.pipeline();
  pipeline.hget(`${CHAIN_PREFIX}${categoryId}`, 'chain');
  pipeline.hget(`${CHAIN_PREFIX}${categoryId}`, 'ancestors');
  pipeline.hget(`${CHAIN_PREFIX}${categoryId}`, 'depth');
  pipeline.hget(`${CHAIN_PREFIX}${categoryId}`, 'children');
  const results = await pipeline.execAsync();

  const chainStr = results[0] as string | null;
  if (!chainStr) return null;

  return {
    chain: JSON.parse(chainStr),
    depth: Number(results[2] || 0),
    ancestors: JSON.parse((results[1] as string) || '[]'),
    children: JSON.parse((results[3] as string) || '[]'),
  };
}

// ==================== 分类移动时的链路递归更新和计数器差异计算 ====================

/**
 * 递归获取分类及其所有后代的 ID 列表
 * @param categoryId 分类 ID
 * @param allCategories 全部分类
 * @returns ID 列表（包含自身）
 */
function getDescendantIds(
  categoryId: number,
  allCategories: MockProjectCategory[],
): number[] {
  const ids = [categoryId];
  const children = allCategories.filter((c) => c.parent_id === categoryId);
  children.forEach((child) => {
    ids.push(...getDescendantIds(child.id, allCategories));
  });
  return ids;
}

/**
 * 计算分类的祖先 ID 列表（从根到父分类）
 * @param categoryId 分类 ID
 * @param allCategories 全部分类
 * @returns 祖先 ID 列表（不包含自身）
 */
function getAncestorIds(
  categoryId: number,
  allCategories: MockProjectCategory[],
): number[] {
  const ancestors: number[] = [];
  let current = allCategories.find((c) => c.id === categoryId);
  while (current && current.parent_id !== 0) {
    const parent = allCategories.find((c) => c.id === current!.parent_id);
    if (!parent) break;
    ancestors.unshift(parent.id);
    current = parent;
  }
  return ancestors;
}

/**
 * 计算分类及其所有后代的项目总数
 * @param categoryId 分类 ID
 * @param allCategories 全部分类
 * @param allProjects 全部文集
 * @returns 项目总数
 */
function calculateProjectCount(
  categoryId: number,
  allCategories: MockProjectCategory[],
  allProjects: MockProject[],
): number {
  const ids = getDescendantIds(categoryId, allCategories);
  return allProjects.filter((p) => ids.includes(p.project_category_id)).length;
}

/**
 * 递归更新分类及其所有后代的祖先链路缓存
 *
 * 【执行流程】
 * 1. 更新当前分类的链路（chain/depth/ancestors/children）
 * 2. 递归更新所有子分类的链路
 *
 * @param categoryId 分类 ID
 * @param allCategories 全部分类（已更新 parent_id 后的最新数据）
 * @returns 更新的链路数量
 */
function updateCategoryChainRecursive(
  categoryId: number,
  allCategories: MockProjectCategory[],
): number {
  let updatedCount = 0;

  // 计算当前分类的祖先链路
  const ancestors = getAncestorIds(categoryId, allCategories);
  const chain = [...ancestors, categoryId];
  const children = allCategories
    .filter((c) => c.parent_id === categoryId)
    .map((c) => c.id);

  // 更新缓存
  // 【字段设计】chain / ancestors / depth 存在推导关系，保留冗余是空间换时间：
  //   chain     = [...ancestors, categoryId]  （完整路径，含自身）
  //   ancestors = chain.slice(0, -1)          （仅祖先，不含自身）
  //   depth     = chain.length - 1            （祖先层数）
  // 读取时直接取字段，避免每次 JSON.parse + slice 计算
  categoryChainCache.hmset(String(categoryId), {
    chain: JSON.stringify(chain),
    depth: String(ancestors.length),
    ancestors: JSON.stringify(ancestors),
    children: JSON.stringify(children),
  });
  updatedCount++;

  // 递归更新子分类
  const childCategories = allCategories.filter(
    (c) => c.parent_id === categoryId,
  );
  childCategories.forEach((child) => {
    updatedCount += updateCategoryChainRecursive(child.id, allCategories);
  });

  return updatedCount;
}

/**
 * 计算分类移动前后的计数器差异，精确更新受影响的计数器
 *
 * 【核心原理】
 * 分类移动时，只有以下分类的计数器会变化：
 * 1. 旧祖先链路上的分类：计数器减少（移动的分类及其后代的项目数）
 * 2. 新祖先链路上的分类：计数器增加（移动的分类及其后代的项目数）
 * 3. 移动的分类自身及其后代：计数器不变（内部项目数不变）
 *
 * 【优化点】
 * - 不需要全量重新计算所有分类的计数器
 * - 只需要计算移动的子树的项目总数
 * - 对旧祖先做 DECRBY，对新祖先做 INCRBY
 *
 * @param movedIds 移动的分类 ID 列表
 * @param oldParentIds 移动前每个分类的父分类 ID 映射
 * @param targetParentId 目标父分类 ID
 * @param allCategories 全部分类（已更新 parent_id 后的最新数据）
 * @param allProjects 全部文集
 * @returns 更新的计数器数量
 */
function calculateAndApplyCounterDiff(
  movedIds: number[],
  oldParentIds: Map<number, number>,
  targetParentId: number,
  allCategories: MockProjectCategory[],
  allProjects: MockProject[],
): number {
  let updatedCount = 0;

  // 1. 计算每个移动分类及其后代的项目总数（子树大小）
  const subtreeSizes = new Map<number, number>();
  movedIds.forEach((id) => {
    const size = calculateProjectCount(id, allCategories, allProjects);
    subtreeSizes.set(id, size);
  });

  // 2. 收集所有受影响的祖先分类（旧祖先 + 新祖先）
  const affectedAncestors = new Set<number>();

  movedIds.forEach((id) => {
    const oldParentId = oldParentIds.get(id);
    if (oldParentId !== undefined && oldParentId !== 0) {
      // 旧祖先链路
      const oldAncestors = getAncestorIds(oldParentId, allCategories);
      oldAncestors.forEach((aid) => affectedAncestors.add(aid));
      affectedAncestors.add(oldParentId);
    }
  });

  if (targetParentId !== 0) {
    // 新祖先链路
    const newAncestors = getAncestorIds(targetParentId, allCategories);
    newAncestors.forEach((aid) => affectedAncestors.add(aid));
    affectedAncestors.add(targetParentId);
  }

  // 3. 对每个受影响的祖先分类，计算新的正确计数器值并更新
  affectedAncestors.forEach((ancestorId) => {
    const correctCount = calculateProjectCount(
      ancestorId,
      allCategories,
      allProjects,
    );
    const currentCount = categoryCountCache.get(String(ancestorId));

    if (currentCount !== null) {
      // 缓存命中，直接覆盖为正确值
      categoryCountCache.set(String(ancestorId), correctCount);
      updatedCount++;
    }
    // 缓存未命中时不操作，等待下次查询时从数据库重新加载
  });

  return updatedCount;
}

/**
 * 从 Redis 缓存获取分类列表
 *
 * 读取 4 类缓存：order（排序索引）+ info（详情）+ count（文集数）+ projects（文集 ID）
 * 使用 Pipeline 批量读取，1 次网络往返获取 N 个分类的全部数据
 *
 * @returns 分类列表，缓存不存在或不完整时返回 null
 */
async function getCategoryListFromCache(): Promise<CategoryWithStats[] | null> {
  // 1. 读取排序索引（单 key，直接读取无需 pipeline）
  const orderedIds = (await redis.lrange(`${ORDER_PREFIX}all`, 0, -1)) as
    | number[]
    | null;
  if (!orderedIds || orderedIds.length === 0) return null;

  // 2. 批量读取分类详情、计数器和文集 ID 集合
  const dataPipeline = redis.pipeline();
  for (const id of orderedIds) {
    dataPipeline.hgetAll(`${INFO_PREFIX}${id}`);
    dataPipeline.get(`${COUNT_PREFIX}${id}`);
    dataPipeline.smembers(`${PROJECTS_PREFIX}${id}`);
  }
  const dataResults = await dataPipeline.execAsync();

  // 3. 组装结果（每个分类 3 个结果：hash + count + project_ids）
  const result: CategoryWithStats[] = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const hashData = dataResults[i * 3] as Record<string, string> | null;
    if (!hashData || Object.keys(hashData).length === 0) return null;

    result.push({
      ...hashToCategory(hashData),
      project_count: Number(dataResults[i * 3 + 1] ?? 0),
      project_ids: (dataResults[i * 3 + 2] as number[]) || [],
    });
  }

  return result;
}

/**
 * 获取分类列表（带多级降级）
 *
 * 降级顺序：Redis 缓存 → MongoDB → MockTable 内存数据库
 * 所有层级统一返回 CategoryWithStats 格式（含 project_count + project_ids）
 * MongoDB 和数据库结果按 parent_id + sort 排序
 *
 * @returns 分类列表（永不返回 null，最差返回空数组）
 */
async function getAllCategoriesWithFallback(): Promise<CategoryWithStats[]> {
  // ========== 1. 优先从 Redis（L3）缓存获取 ==========
  try {
    const cachedCategories = await getCategoryListFromCache();
    if (cachedCategories && cachedCategories.length > 0) {
      return cachedCategories;
    }
  } catch (error) {
    console.warn('[CategoryCache] Redis 读取失败，降级到 MongoDB:', error);
  }

  // ========== 2. 降级到 MongoDB（L2）获取 ==========
  try {
    const mongoCategories = await categoryMongoCollection
      .find({})
      .sort({ parent_id: 1, sort: 1 })
      .toArray();

    if (mongoCategories && mongoCategories.length > 0) {
      // 统一返回带统计字段的分类数据
      return mongoCategories.map((cat) => ({
        ...cat,
        project_count: cat.project_count ?? 0,
        project_ids: cat.project_ids ?? [],
      }));
    }
  } catch (error) {
    console.warn('[CategoryCache] MongoDB 读取失败，降级到数据库:', error);
  }

  // ========== 3. 最后降级到数据库（MockTable）==========
  const dbCategories = await categoryTable.findAll();
  return (dbCategories ?? []).map((cat) => ({
    ...cat,
    project_count: 0,
    project_ids: [],
  }));
}

// ============================================================================
// 分类服务类
// ============================================================================

class CategoryService {
  /**
   * 根据 ID 获取分类（三级降级：Redis → MongoDB → 数据库）
   *
   * @param id 分类 ID
   * @returns 分类对象，不存在时返回 null
   */
  private async getCategoryById(id: number): Promise<CategoryWithStats | null> {
    // L3：Redis 缓存（单个 pipeline 同时获取详情 + 统计字段）
    const pipeline = redis.pipeline();
    pipeline.hgetAll(`${INFO_PREFIX}${id}`);
    pipeline.get(`${COUNT_PREFIX}${id}`);
    pipeline.smembers(`${PROJECTS_PREFIX}${id}`);
    const [categoryInfo, countStr, projectIds] = await pipeline.execAsync();

    if (categoryInfo && Object.keys(categoryInfo).length > 0) {
      return {
        ...hashToCategory(categoryInfo as Record<string, string>),
        project_count: Number(countStr) || 0,
        project_ids: (projectIds as string[]).map(Number),
      };
    }

    // L2：降级到 MongoDB（已包含 project_count 和 project_ids）
    const mongoCategory = await categoryMongoCollection.findOne({ id });
    if (mongoCategory) {
      return mongoCategory as CategoryWithStats;
    }

    // L1：兜底数据库（主存储，绝对最新）
    const dbCategory = await categoryTable.findById(id);
    if (!dbCategory) return null;
    return {
      ...dbCategory,
      project_count: Number(countStr) || 0,
      project_ids: (projectIds as string[]).map(Number),
    };
  }

  /**
   * 获取同级分类 ID 列表（排除指定分类）
   * - 非顶级：从父分类的 chain.children 获取
   * - 顶级：从 order:all List 中筛选 parent_id = 0
   *
   * @param parentId 父分类 ID（0 表示顶级）
   * @param excludeId 需要排除的分类 ID
   * @returns 同级分类 ID 数组
   */
  private async getSiblingCategoryIds(
    parentId: number,
    excludeId: number,
  ): Promise<number[]> {
    if (parentId !== 0) {
      const parentChain = await categoryChainCache.hgetAll(String(parentId));
      if (parentChain?.children) {
        return (JSON.parse(parentChain.children) as number[]).filter(
          (cid) => cid !== excludeId,
        );
      }
      return [];
    }

    // 顶级分类：从 order:all List 中筛选 parent_id = 0
    const orderedIds = (await redis.lrange(
      `${ORDER_PREFIX}all`,
      0,
      -1,
    )) as number[];
    if (orderedIds.length === 0) return [];

    const parentIdPipeline = redis.pipeline();
    for (const oid of orderedIds) {
      parentIdPipeline.hget(`${INFO_PREFIX}${oid}`, 'parent_id');
    }
    const parentIds = await parentIdPipeline.execAsync();
    return orderedIds.filter(
      (oid, i) => Number(parentIds[i]) === 0 && oid !== excludeId,
    );
  }

  /**
   * 获取分类列表
   *
   * 对外公开接口，内部调用 getAllCategoriesWithFallback 实现多级降级
   * 返回格式：CategoryWithStats（含 project_count + project_ids）
   *
   * @returns 分类列表
   */
  async getCategoryList(): Promise<CategoryWithStats[]> {
    return getAllCategoriesWithFallback();
  }

  /**
   * 创建分类（唯一创建逻辑）
   *
   * 【功能】自动计算 sort、校验父分类存在性和同级名称不重复、精确写入缓存
   *
   * 【数据读取】全部从 Redis 缓存读取，无 MongoDB 查询
   * - 父分类链路：categoryChainCache（含 children）
   * - 同级分类：parentChainData.children + categoryInfoCache Pipeline 批量获取
   *
   * 【排序插入位置】
   * - 优先从同级分类内存计算（反向遍历找最大的 sort < 新分类）
   * - 同级最小时从 order:all List 找第一个 parent_id >= parentId 的位置
   *
   * 【写入】Redis Pipeline + MongoDB insertOne 并行执行（Promise.all）
   *
   * @param data 请求参数
   * @returns 创建的分类（含 project_count + project_ids）
   */
  async createCategory(
    data: CreateCategoryRequest,
  ): Promise<CategoryWithStats> {
    const parentId = data.parent_id ?? 0;

    // ========== 1. 从 Redis 缓存获取所有需要的数据 ==========
    // - parentChainData：父分类的链路数据（含 children，用于判断存在性和获取同级分类 ID）
    // - siblingCategories：从 parentChainData.children 批量获取同级分类详情
    const parentChainData =
      parentId !== 0
        ? await categoryChainCache.hgetAll(String(parentId))
        : null;

    // 1.1 父分类存在性校验（通过链路缓存是否存在判断）
    if (parentId !== 0 && !parentChainData) {
      throw new BusinessError('父分类不存在');
    }

    // 1.2 从父分类的 children 获取同级分类 ID，批量从 info 缓存获取详情
    const siblingIds: number[] = parentChainData?.children
      ? JSON.parse(parentChainData.children)
      : [];
    const siblingPipeline = redis.pipeline();
    for (const id of siblingIds) {
      siblingPipeline.hgetAll(`${INFO_PREFIX}${id}`);
    }
    const siblingResults = await siblingPipeline.execAsync();
    const siblingCategories: MockProjectCategory[] = siblingResults
      .filter((hashData) => hashData && Object.keys(hashData).length > 0)
      .map((hashData) => hashToCategory(hashData as Record<string, string>))
      .sort((a, b) => a.sort - b.sort);

    // 1.2 同级名称重复校验
    if (siblingCategories.some((c) => c.name === data.name)) {
      throw new BusinessError(
        '同级分类下已存在相同名称的分类',
        ErrorCodes.Project.CATEGORY_NAME_EXISTS,
      );
    }

    // 1.3 自动计算 sort（取同级最大 sort + 1）
    const maxSort =
      siblingCategories.length > 0
        ? Math.max(...siblingCategories.map((c) => c.sort))
        : 0;

    // ========== 2. 创建分类（写入主数据库，create_time 由 beforeCreate 钩子自动设置）==========
    const newCategory = await categoryTable.create({
      name: data.name,
      parent_id: parentId,
      sort: data.sort ?? maxSort + 1,
      icon: data.icon,
      description: data.description,
    } as MockProjectCategory);

    // ========== 3. 计算缓存数据（纯内存计算，无 IO）==========
    // 3.1 计算祖先链路（使用已查询的 parentChainData）
    let ancestors: number[] = [];
    let depth = 0;
    let parentChildren: number[] = [];

    if (parentId !== 0 && parentChainData?.chain) {
      const parentChain = JSON.parse(parentChainData.chain) as number[];
      ancestors = [...parentChain];
      depth = Number(parentChainData.depth ?? parentChain.length - 1) + 1;
      // 从同一次 hgetAll 结果中获取 children，避免再次读取
      parentChildren = parentChainData.children
        ? JSON.parse(parentChainData.children)
        : [];
    }
    const chain = [...ancestors, newCategory.id];

    // 3.2 计算排序索引的准确插入位置
    // 排序规则：先按 parent_id 升序，再按 sort 升序
    let pivotId: number | null = null;
    let insertAtBeginning = false;

    // siblingCategories 已按 sort 升序排序，从后向前找第一个 sort < newCategory.sort 的分类作为 pivot
    // 优化：无需 filter 创建新数组，直接反向遍历，找到即停止
    for (let i = siblingCategories.length - 1; i >= 0; i--) {
      if (siblingCategories[i].sort < newCategory.sort) {
        pivotId = siblingCategories[i].id;
        break;
      }
    }

    if (pivotId === null) {
      // 新分类是同级最小的，或同级没有其他分类
      // 从 order:all Redis List（已按 parent_id+sort 有序）中找插入位置
      const orderedIds = (await redis.lrange(
        `${ORDER_PREFIX}all`,
        0,
        -1,
      )) as number[];

      if (orderedIds.length === 0) {
        // List 为空，插入到最前面
        insertAtBeginning = true;
      } else {
        // 统一逻辑：找第一个 parent_id >= parentId 的位置，插入到它前面
        // - 有同级分类：第一个同级分类的 parent_id = parentId，即插入到同级分组最前面
        // - 同级无分类：第一个 parent_id > parentId 的位置
        const infoPipeline = redis.pipeline();
        for (const id of orderedIds) {
          infoPipeline.hget(`${INFO_PREFIX}${id}`, 'parent_id');
        }
        const parentIdResults = await infoPipeline.execAsync();

        let insertIndex = orderedIds.length; // 默认插入到末尾
        for (let i = 0; i < orderedIds.length; i++) {
          if (Number(parentIdResults[i]) >= parentId) {
            insertIndex = i;
            break;
          }
        }
        if (insertIndex === 0) {
          insertAtBeginning = true;
        } else {
          pivotId = orderedIds[insertIndex - 1];
        }
      }
    }

    // ========== 5. 构建 Redis Pipeline ==========
    const pipeline = redis.pipeline();

    // 5.1 分类详情（Hash）
    pipeline.hmset(`${INFO_PREFIX}${newCategory.id}`, {
      id: String(newCategory.id),
      name: newCategory.name,
      parent_id: String(newCategory.parent_id),
      sort: String(newCategory.sort),
      icon: newCategory.icon || '',
      description: newCategory.description || '',
      create_time: String(newCategory.create_time),
    });

    // 5.2 排序索引（List）：使用 linsert 准确插入
    const orderKey = `${ORDER_PREFIX}all`;
    if (insertAtBeginning) {
      pipeline.lpush(orderKey, newCategory.id);
    } else if (pivotId !== null) {
      pipeline.linsert(orderKey, 'AFTER', pivotId, newCategory.id);
    } else {
      console.warn('[CategoryCache] 未找到插入位置，使用 rpush 兜底');
      pipeline.rpush(orderKey, newCategory.id);
    }

    // 5.3 祖先链路（Hash）：chain/ancestors/depth 冗余存储，空间换时间（读取时免 parse+slice）
    pipeline.hmset(`${CHAIN_PREFIX}${newCategory.id}`, {
      chain: JSON.stringify(chain),
      depth: String(depth),
      ancestors: JSON.stringify(ancestors),
      children: '[]', // 新创建的分类没有子分类
    });

    // 5.4 计数器（String）：新创建的分类 project_count 为 0
    pipeline.set(`${COUNT_PREFIX}${newCategory.id}`, 0);

    // 5.5 categoryProjectsCache（Set）：无需初始化
    //     新分类下无文集，Redis 中空 Set 会自动消失（key 不存在）；
    //     后续创建文集时 sadd 会自动创建 key，smembers 对不存在 key 返回空数组。

    // 5.6 更新父分类的 children（使用已读取的数据，避免再次读取）
    if (parentId !== 0 && !parentChildren.includes(newCategory.id)) {
      parentChildren.push(newCategory.id);
      pipeline.hset(
        `${CHAIN_PREFIX}${parentId}`,
        'children',
        JSON.stringify(parentChildren),
      );
    }

    // ========== 6. 并行执行 Redis 和 MongoDB 写入 ==========
    try {
      await Promise.all([
        // Redis 写入
        pipeline.execAsync(),
        // MongoDB 写入：插入新分类
        // 注：MongoDB 不存储子分类 ID，通过 parent_id 维护关系
        categoryMongoCollection.insertOne({
          ...newCategory,
          project_count: 0, // 新创建的分类没有文集
          project_ids: [], // 新创建的分类没有关联文集
        }),
      ]);
    } catch (error) {
      // 缓存写入失败，记录日志，等待定时重建修复
      // 不抛出错误，因为数据库已经写入成功
      console.error(
        '[CategoryCache] 创建分类缓存写入失败，将在下次定时重建时修复:',
        error,
      );
    }

    // ========== 7. 返回结果 ==========
    return { ...newCategory, project_count: 0, project_ids: [] };
  }

  /**
   * 更新分类（仅 name/icon/description；移动/排序由其他接口处理）
   * 无变化时抛出 NO_CHANGES 错误
   */
  async updateCategory(
    id: number,
    data: UpdateCategoryRequest,
  ): Promise<CategoryWithStats> {
    // ========== 1. 校验分类存在（三级降级：Redis → MongoDB → 数据库）==========
    const category = await this.getCategoryById(id);
    if (!category) {
      throw new BusinessError('分类不存在', 404);
    }

    const updateData: Partial<MockProjectCategory> = {};

    // ========== 2. 预计算变化字段（无变化时尽早返回，避免后续 IO）==========
    // 注：icon/description 统一转为字符串，确保 Redis hset 和 MongoDB 存储一致
    if (data.name !== undefined && data.name !== category.name) {
      updateData.name = data.name;
    }
    if (data.icon !== undefined && (data.icon || '') !== category.icon) {
      updateData.icon = data.icon || '';
    }
    if (
      data.description !== undefined &&
      (data.description || '') !== category.description
    ) {
      updateData.description = data.description || '';
    }

    // 无实际变化时抛出业务错误，前端可直接提示用户
    if (Object.keys(updateData).length === 0) {
      throw new BusinessError(
        '数据无变化，不需要修改',
        ErrorCodes.Project.NO_CHANGES,
      );
    }

    // ========== 3. 名称修改：校验同级不重复 ==========
    if (updateData.name !== undefined) {
      const siblingIds = await this.getSiblingCategoryIds(
        category.parent_id,
        id,
      );

      // Pipeline 批量获取同级分类详情
      const siblingPipeline = redis.pipeline();
      for (const sid of siblingIds) {
        siblingPipeline.hgetAll(`${INFO_PREFIX}${sid}`);
      }
      const siblingResults = await siblingPipeline.execAsync();
      const siblingCategories = siblingResults
        .filter((hashData) => hashData && Object.keys(hashData).length > 0)
        .map((hashData) => hashToCategory(hashData as Record<string, string>));

      if (siblingCategories.some((c) => c.name === updateData.name)) {
        throw new BusinessError(
          '同级分类下已存在相同名称的分类',
          ErrorCodes.Project.CATEGORY_NAME_EXISTS,
        );
      }
    }

    // ========== 4. 执行数据库更新 ==========
    const updatedCategory = await categoryTable.updateById(id, updateData);

    // ========== 5. 并行更新 Redis 和 MongoDB ==========
    try {
      await Promise.all([
        categoryInfoCache.hset(
          String(id),
          updateData as Record<string, string>,
        ),
        categoryMongoCollection.updateOne({ id }, { $set: updateData }),
      ]);
    } catch (error) {
      console.error(
        '[CategoryCache] 更新分类缓存写入失败，将在下次定时重建时修复:',
        error,
      );
    }

    // ========== 6. 返回带统计字段的完整分类数据 ==========
    // 统计字段不受 name/icon/description 更新影响，直接复用 getCategoryById 获取的数据
    return {
      ...updatedCategory!,
      project_count: category.project_count,
      project_ids: category.project_ids,
    } as CategoryWithStats;
  }

  /**
   * 删除单条分类（含校验：存在子分类或文集时禁止删除）
   *
   * 【实现】batchDeleteCategories 的单条包装，校验和删除逻辑见批量删除
   *
   * @param id 分类 ID
   * @returns 删除结果（含 deletedIds）
   */
  async deleteCategory(id: number): Promise<DeleteCategoryResponse> {
    return this.batchDeleteCategories({ ids: [id] });
  }

  /**
   * 批量删除分类（选中的子分类允许级联删除）
   * 校验不通过时抛出错误，提示第一个不可删除的分类
   */
  async batchDeleteCategories(
    data: BatchDeleteCategoriesRequest,
  ): Promise<BatchDeleteCategoriesResponse> {
    const idSet = new Set(data.ids.map(Number));
    const ids = Array.from(idSet);

    // ========== 1. 合并 Pipeline：同时获取 children（校验）+ ancestors（算parent_id）+ count（校验）==========
    const checkPipeline = redis.pipeline();
    ids.forEach((id) => {
      checkPipeline.hget(`${CHAIN_PREFIX}${id}`, 'children');
      checkPipeline.hget(`${CHAIN_PREFIX}${id}`, 'ancestors');
      checkPipeline.get(`${COUNT_PREFIX}${id}`);
    });
    const checkResults = await checkPipeline.execAsync();

    // ========== 2. 缓存未命中降级：只查询未命中的 ID 及其子分类 ==========
    const missIds: number[] = [];
    for (let i = 0; i < ids.length; i++) {
      if (
        checkResults[i * 3] === null ||
        checkResults[i * 3 + 1] === null ||
        checkResults[i * 3 + 2] === null
      ) {
        missIds.push(ids[i]);
      }
    }

    let mongoCountMap: Map<number, number> | null = null;
    let mongoChildrenMap: Map<number, number[]> | null = null;
    if (missIds.length > 0) {
      const mongoCategories = await categoryMongoCollection
        .find({
          $or: [{ id: { $in: missIds } }, { parent_id: { $in: missIds } }],
        })
        .project({ id: 1, parent_id: 1, project_count: 1 })
        .toArray();

      mongoCountMap = new Map();
      mongoChildrenMap = new Map();
      for (const cat of mongoCategories) {
        if (missIds.includes(cat.id)) {
          mongoCountMap.set(cat.id, cat.project_count ?? 0);
        }
        if (missIds.includes(cat.parent_id)) {
          const children = mongoChildrenMap.get(cat.parent_id) ?? [];
          children.push(cat.id);
          mongoChildrenMap.set(cat.parent_id, children);
        }
      }
    }

    // ========== 3. 校验 + 收集父分类（复用第一步已获取的 ancestors，无需再次 IO）==========
    const parentChildrenToRemove = new Map<number, number[]>();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const childrenStr = checkResults[i * 3] as string | null;
      const ancestorsStr = checkResults[i * 3 + 1] as string | null;
      const countStr = checkResults[i * 3 + 2] as string | null;

      // 3.1 子分类校验
      const children: number[] =
        childrenStr !== null
          ? JSON.parse(childrenStr)
          : mongoChildrenMap?.get(id) ?? [];
      if (children.some((cid) => !idSet.has(cid))) {
        throw new BusinessError(
          `分类ID:${id}，存在子分类，请先删除子分类`,
          ErrorCodes.Project.DELETE_HAS_CHILDREN,
          { failedId: id },
        );
      }

      // 3.2 文集数校验
      const projectCount =
        countStr !== null ? Number(countStr) : mongoCountMap?.get(id) ?? 0;
      if (projectCount > 0) {
        throw new BusinessError(
          `分类ID:${id}，该分类下存在文集，无法删除`,
          ErrorCodes.Project.DELETE_HAS_PROJECTS,
          { failedId: id },
        );
      }

      // 3.3 校验通过，收集父分类（从已获取的 ancestors 算 parent_id）
      const ancestors = ancestorsStr
        ? (JSON.parse(ancestorsStr) as number[])
        : [];
      const parentId =
        ancestors.length > 0 ? ancestors[ancestors.length - 1] : 0;
      if (parentId !== 0 && !idSet.has(parentId)) {
        const list = parentChildrenToRemove.get(parentId) ?? [];
        list.push(id);
        parentChildrenToRemove.set(parentId, list);
      }
    }
    const parentIds = [...parentChildrenToRemove.keys()];

    // ========== 4. 获取父分类的 children（用于过滤后写回）==========
    const parentPipeline = redis.pipeline();
    parentIds.forEach((pid) =>
      parentPipeline.hget(`${CHAIN_PREFIX}${pid}`, 'children'),
    );
    const parentResults = await parentPipeline.execAsync();
    const parentChildrenMap = new Map<number, number[]>();
    parentIds.forEach((pid, i) => {
      const childrenStr = parentResults[i] as string | null;
      parentChildrenMap.set(
        pid,
        childrenStr ? (JSON.parse(childrenStr) as number[]) : [],
      );
    });

    // ========== 5. 构建 Redis 删除/更新 Pipeline ==========
    const pipeline = redis.pipeline();

    // 5.1 从排序索引中删除
    ids.forEach((id) => pipeline.lrem(`${ORDER_PREFIX}all`, 0, id));

    // 5.2 删除详情/计数器/祖先链路/文集列表
    ids.forEach((id) => {
      pipeline.del(`${INFO_PREFIX}${id}`);
      pipeline.del(`${CHAIN_PREFIX}${id}`);
      pipeline.del(`${COUNT_PREFIX}${id}`);
      pipeline.del(`${PROJECTS_PREFIX}${id}`);
    });

    // 5.3 更新父分类的 children
    for (const [parentId, childIdsToRemove] of parentChildrenToRemove) {
      const currentChildren = parentChildrenMap.get(parentId) || [];
      const updatedChildren = currentChildren.filter(
        (cid) => !childIdsToRemove.includes(cid),
      );
      pipeline.hset(
        `${CHAIN_PREFIX}${parentId}`,
        'children',
        JSON.stringify(updatedChildren),
      );
    }

    // ========== 6. 并行执行所有删除操作（MockTable + MongoDB + Redis）==========
    try {
      const bulkDeleteOperations = ids.map((id) => ({ where: { id } }));
      await Promise.all([
        pipeline.execAsync(),
        categoryTable.bulkDelete(bulkDeleteOperations),
        categoryMongoCollection.deleteMany({ id: { $in: ids } }),
      ]);
    } catch (error) {
      console.error(
        '[CategoryCache] 批量删除缓存更新失败，将在下次定时重建时修复:',
        error,
      );
    }

    return { deletedIds: ids };
  }

  /**
   * 批量移动分类（防止移动到自己的子分类下）
   *
   * 【功能】
   * - 防止移动到自己的子分类下（循环检测）
   * - 批量更新数据库中的 parent_id
   * - 递归更新移动分类及其后代的祖先链路
   * - 计算计数器差异，精确更新受影响的祖先计数器
   * - 更新排序索引（Pipeline 重建）
   * - 同步更新 MongoDB（parent_id + 父分类 children）
   *
   * 【性能优化】
   * 1. 优先从 Redis（L3）获取分类数据，降级到 MongoDB（L2），最后数据库
   * 2. 批量更新数据库（bulkUpdate），减少循环 await
   * 3. 并行执行 MongoDB 更新（批量更新 parent_id + 批量更新父分类 children）
   * 4. 批量查询父分类信息（一次 find，不需要循环查询）
   * 5. 添加错误处理：数据库更新成功后，缓存失败不影响主流程，等待定时重建修复
   *
   * @param data 请求参数
   * @returns 移动结果
   */
  async batchMoveCategories(
    data: BatchMoveCategoriesRequest,
  ): Promise<BatchMoveCategoriesResponse> {
    const startTime = Date.now();
    const idSet = new Set(data.ids.map(Number));
    const ids = Array.from(idSet);
    const targetId = Number(data.target_parent_id);

    // ========== 1. 循环检测 + 获取旧 parent_id（合并缓存 pipeline，放在全量查询之前）==========
    // 循环检测：targetId 的祖先中不能有被移动的分类（否则会形成循环）
    // 旧 parent_id：从 ancestors 最后一个元素获取
    const oldParentIds = new Map<number, number>();
    if (targetId !== 0 || ids.length > 0) {
      const checkPipeline = redis.pipeline();
      // targetId 的 ancestors（用于循环检测），targetId=0 时不需要
      if (targetId !== 0) {
        checkPipeline.hget(`${CHAIN_PREFIX}${targetId}`, 'ancestors');
      }
      // 被移动分类的 ancestors（用于获取旧 parent_id）
      ids.forEach((id) =>
        checkPipeline.hget(`${CHAIN_PREFIX}${id}`, 'ancestors'),
      );
      const checkResults = await checkPipeline.execAsync();

      let resultIndex = 0;
      // 循环检测
      if (targetId !== 0) {
        const targetAncestorsStr = checkResults[resultIndex++] as string | null;
        const targetAncestors = targetAncestorsStr
          ? (JSON.parse(targetAncestorsStr) as number[])
          : [];
        if (targetAncestors.some((aid) => idSet.has(aid))) {
          throw new BusinessError('不能将分类移动到其自身的子分类下');
        }
      }
      // 获取旧 parent_id
      ids.forEach((id) => {
        const ancestorsStr = checkResults[resultIndex++] as string | null;
        const ancestors = ancestorsStr
          ? (JSON.parse(ancestorsStr) as number[])
          : [];
        const oldParentId =
          ancestors.length > 0 ? ancestors[ancestors.length - 1] : 0;
        oldParentIds.set(id, oldParentId);
      });
    }

    // ========== 2. 获取分类列表（优先 Redis，降级 MongoDB/数据库）==========
    // 统一返回带 project_count 和 project_ids 字段的分类数据，用于前端乐观更新后正确显示文集数
    const allCategories = await getAllCategoriesWithFallback();

    // 文集数据从数据库获取
    const allProjects = await projectTable.findAll();

    // ========== 3. 计算移动后的新 sort（保持被移动分类的相对顺序，追加到目标父分类末尾）==========
    // 3.1 目标父分类下现有的子分类（排除被移动的分类）
    const targetSiblings = allCategories.filter(
      (c) => c.parent_id === targetId && !idSet.has(c.id),
    );
    const maxSort = targetSiblings.reduce(
      (max, c) => Math.max(max, c.sort || 0),
      0,
    );
    // 3.2 按原始 sort 排序被移动分类，保持相对顺序
    const sortedMovingIds = [...ids].sort((a, b) => {
      const ca = allCategories.find((c) => c.id === a);
      const cb = allCategories.find((c) => c.id === b);
      return (ca?.sort || 0) - (cb?.sort || 0);
    });
    // 3.3 为每个被移动分类分配新的 sort
    const newSortMap = new Map<number, number>();
    sortedMovingIds.forEach((id, index) => {
      newSortMap.set(id, maxSort + index + 1);
    });

    // ========== 4. 批量更新数据库中的 parent_id 和 sort（使用 bulkUpdate，避免循环）==========
    const bulkUpdateOperations = ids.map((id) => ({
      where: { id },
      data: { parent_id: targetId, sort: newSortMap.get(id) },
    }));
    categoryTable.bulkUpdate(bulkUpdateOperations);

    // ========== 5. 直接在内存中更新分类数据（避免重复全量读取数据库）==========
    const updatedCategories = allCategories.map((c) =>
      idSet.has(c.id)
        ? { ...c, parent_id: targetId, sort: newSortMap.get(c.id) ?? c.sort }
        : c,
    );

    // ========== 6. 递归更新移动分类及其后代的祖先链路 ==========
    let updatedChains = 0;
    for (const id of idSet) {
      updatedChains += updateCategoryChainRecursive(id, updatedCategories);
    }

    // ========== 7. 计算计数器差异，精确更新受影响的祖先计数器 ==========
    const updatedCounters = calculateAndApplyCounterDiff(
      ids,
      oldParentIds,
      targetId,
      updatedCategories,
      allProjects,
    );

    // ========== 8. 更新排序索引（精确操作：删除被移动分类 + 插入到目标位置）+ 更新 Redis Hash ==========
    // 8.1 从排序索引中删除被移动分类，同时更新 Hash 中的 parent_id 和 sort
    const updatePipeline = redis.pipeline();
    ids.forEach((id) => updatePipeline.lrem(`${ORDER_PREFIX}all`, 0, id));
    ids.forEach((id) => {
      updatePipeline.hset(`${INFO_PREFIX}${id}`, 'parent_id', String(targetId));
      updatePipeline.hset(
        `${INFO_PREFIX}${id}`,
        'sort',
        String(newSortMap.get(id)),
      );
    });
    await updatePipeline.execAsync();

    // 8.2 获取当前排序索引，找到插入位置（第一个 parent_id > targetId 的分类之前）
    const orderedIds = (await redis.lrange(
      `${ORDER_PREFIX}all`,
      0,
      -1,
    )) as number[];

    if (orderedIds.length === 0) {
      // List 为空，直接按 sort 顺序追加
      const pushPipeline = redis.pipeline();
      sortedMovingIds.forEach((id) =>
        pushPipeline.rpush(`${ORDER_PREFIX}all`, id),
      );
      await pushPipeline.execAsync();
    } else {
      // 批量获取 parent_id，定位插入位置
      const parentIdPipeline = redis.pipeline();
      orderedIds.forEach((oid) =>
        parentIdPipeline.hget(`${INFO_PREFIX}${oid}`, 'parent_id'),
      );
      const parentIdResults = await parentIdPipeline.execAsync();

      let insertIndex = orderedIds.length; // 默认插入到末尾
      for (let i = 0; i < orderedIds.length; i++) {
        if (Number(parentIdResults[i]) > targetId) {
          insertIndex = i;
          break;
        }
      }

      // 8.3 按 sort 顺序精确插入
      const insertPipeline = redis.pipeline();
      if (insertIndex === 0) {
        // 插入到最前面（reverse 保证顺序正确）
        [...sortedMovingIds]
          .reverse()
          .forEach((id) => insertPipeline.lpush(`${ORDER_PREFIX}all`, id));
      } else {
        // 插入到 insertIndex-1 之后，逐个链式插入保持顺序
        let pivotId = orderedIds[insertIndex - 1];
        sortedMovingIds.forEach((id) => {
          insertPipeline.linsert(`${ORDER_PREFIX}all`, 'AFTER', pivotId, id);
          pivotId = id;
        });
      }
      await insertPipeline.execAsync();
    }

    // ========== 9. 收集受影响的分类 ID ==========
    const affectedIds = new Set<number>();
    idSet.forEach((id) => {
      // 移动的分类及其所有后代
      getDescendantIds(id, updatedCategories).forEach((did) =>
        affectedIds.add(did),
      );
      // 旧祖先
      const oldParentId = oldParentIds.get(id);
      if (oldParentId !== undefined) {
        getAncestorIds(oldParentId, updatedCategories).forEach((aid) =>
          affectedIds.add(aid),
        );
        if (oldParentId !== 0) affectedIds.add(oldParentId);
      }
    });
    // 新祖先
    if (targetId !== 0) {
      getAncestorIds(targetId, updatedCategories).forEach((aid) =>
        affectedIds.add(aid),
      );
      affectedIds.add(targetId);
    }

    const duration = Date.now() - startTime;

    console.log(
      `[CategoryCache] 分类移动完成: moved=${idSet.size}, ` +
        `target=${targetId}, updatedChains=${updatedChains}, ` +
        `updatedCounters=${updatedCounters}, affected=${affectedIds.size}, ` +
        `耗时=${duration}ms`,
    );

    // ========== 10. 并行执行 MongoDB 更新 ==========
    try {
      // 批量更新被移动分类的 parent_id 和 sort（MockMongoDB bulkWrite 格式）
      await categoryMongoCollection.bulkWrite(
        ids.map((id) => ({
          type: 'update' as const,
          filter: { id },
          update: {
            $set: {
              parent_id: targetId,
              sort: newSortMap.get(id),
            },
          },
        })),
      );
    } catch (error) {
      // MongoDB 更新失败，记录日志，等待定时重建修复
      // 不抛出错误，因为数据库和 Redis 已经更新成功
      console.error(
        '[CategoryCache] 分类移动 MongoDB 更新失败，将在下次定时重建时修复:',
        error,
      );
    }

    // 返回前同步最新的 project_count（calculateAndApplyCounterDiff 已更新缓存，但 updatedCategories 中还是旧值）
    // 注意：categoryCountCache.get 返回值可能为 null（缓存未命中），需做安全转换避免 NaN
    const categoriesWithLatestCount = updatedCategories.map((cat) => {
      const latestCount = categoryCountCache.get<number>(String(cat.id));
      const rawCount =
        latestCount !== null ? latestCount : (cat as any).project_count;
      const numCount = Number(rawCount);
      return {
        ...cat,
        project_count: isNaN(numCount) ? 0 : numCount,
      };
    });

    return {
      movedIds: ids,
      targetParentId: targetId,
      updatedChains,
      updatedCounters,
      affectedIds: Array.from(affectedIds),
      duration,
      // 返回更新后的全部分类列表（含最新 project_count，用于前端乐观更新）
      categories: categoriesWithLatestCount,
    };
  }

  /**
   * 保存分类排序（同级拖动排序，parent_id 不变）
   *
   * 【功能】
   * - 仅修改同级分类的 sort 字段
   * - 校验所有被拖动分类属于同一父分类
   * - 精确更新排序索引（删除同级分组 + 按新 sort 重新插入）
   *
   * 【性能优化】
   * 1. 全部从 Redis 缓存读取，无全量查询
   * 2. 数据库/Redis/MongoDB 均使用批量操作
   * 3. 排序索引精确更新，不全量重建
   *
   * @param data 请求参数
   */
  async saveCategorySort(
    data: SaveCategorySortRequest,
  ): Promise<SaveCategorySortResponse> {
    const ids = data.sorts.map((s) => s.id);

    // ========== 1. 从缓存批量获取分类信息（验证存在性 + 获取 parent_id）==========
    const infoPipeline = redis.pipeline();
    ids.forEach((id) => infoPipeline.hgetAll(`${INFO_PREFIX}${id}`));
    const infoResults = await infoPipeline.execAsync();

    const categories = infoResults
      .filter((hashData) => hashData && Object.keys(hashData).length > 0)
      .map((hashData) => hashToCategory(hashData as Record<string, string>));

    if (categories.length === 0) {
      throw new BusinessError(
        '分类不存在',
        ErrorCodes.Project.CATEGORY_NOT_FOUND,
      );
    }

    // ========== 2. 同级校验：所有分类的 parent_id 必须相同 ==========
    const parentId = categories[0].parent_id;
    if (!categories.every((c) => c.parent_id === parentId)) {
      throw new BusinessError(
        '只支持同级分类排序',
        ErrorCodes.Common.VALIDATION_FAILED,
      );
    }

    // ========== 3. 获取所有同级分类 ID（用于排序索引更新）==========
    let siblingIds: number[] = [];
    if (parentId !== 0) {
      // 非顶级：从 chain.children 获取
      const childrenStr = await redis.hget(
        `${CHAIN_PREFIX}${parentId}`,
        'children',
      );
      siblingIds = childrenStr ? (JSON.parse(childrenStr) as number[]) : [];
    } else {
      // 顶级：从 order:all List 筛选 parent_id = 0
      const orderedIds = (await redis.lrange(
        `${ORDER_PREFIX}all`,
        0,
        -1,
      )) as number[];
      if (orderedIds.length > 0) {
        const pidPipeline = redis.pipeline();
        orderedIds.forEach((oid) =>
          pidPipeline.hget(`${INFO_PREFIX}${oid}`, 'parent_id'),
        );
        const pidResults = await pidPipeline.execAsync();
        siblingIds = orderedIds.filter((oid, i) => Number(pidResults[i]) === 0);
      }
    }

    // ========== 4. 获取所有同级分类的当前 sort，应用新值后重新排序 ==========
    const sortPipeline = redis.pipeline();
    siblingIds.forEach((sid) =>
      sortPipeline.hget(`${INFO_PREFIX}${sid}`, 'sort'),
    );
    const sortResults = await sortPipeline.execAsync();

    const sortMap = new Map<number, number>();
    siblingIds.forEach((sid, i) => {
      sortMap.set(sid, Number(sortResults[i]) || 0);
    });
    // 应用新的 sort 值
    for (const item of data.sorts) {
      sortMap.set(item.id, item.sort);
    }
    // 按 sort 升序排列
    const sortedSiblingIds = [...siblingIds].sort(
      (a, b) => (sortMap.get(a) || 0) - (sortMap.get(b) || 0),
    );

    // ========== 5. 批量更新数据库 + Redis Hash ==========
    const dbUpdates = data.sorts.map((item) => ({
      where: { id: item.id },
      data: { sort: item.sort },
    }));
    categoryTable.bulkUpdate(dbUpdates);

    const hashPipeline = redis.pipeline();
    data.sorts.forEach((item) => {
      hashPipeline.hset(`${INFO_PREFIX}${item.id}`, 'sort', String(item.sort));
    });
    await hashPipeline.execAsync();

    // ========== 6. 更新排序索引：删除同级分组 + 按新顺序重新插入 ==========
    // 6.1 从 List 中删除所有同级分类
    const removePipeline = redis.pipeline();
    siblingIds.forEach((sid) =>
      removePipeline.lrem(`${ORDER_PREFIX}all`, 0, sid),
    );
    await removePipeline.execAsync();

    // 6.2 获取当前 List，定位插入位置（第一个 parent_id > parentId 的分类之前）
    const orderedIds = (await redis.lrange(
      `${ORDER_PREFIX}all`,
      0,
      -1,
    )) as number[];
    let insertIndex = orderedIds.length; // 默认末尾
    if (orderedIds.length > 0) {
      const pidPipeline = redis.pipeline();
      orderedIds.forEach((oid) =>
        pidPipeline.hget(`${INFO_PREFIX}${oid}`, 'parent_id'),
      );
      const pidResults = await pidPipeline.execAsync();
      for (let i = 0; i < orderedIds.length; i++) {
        if (Number(pidResults[i]) > parentId) {
          insertIndex = i;
          break;
        }
      }
    }

    // 6.3 按新顺序插入同级分类
    const insertPipeline = redis.pipeline();
    if (insertIndex === 0) {
      // 插入到最前面（reverse 保证顺序正确）
      [...sortedSiblingIds]
        .reverse()
        .forEach((id) => insertPipeline.lpush(`${ORDER_PREFIX}all`, id));
    } else {
      // 链式插入到 pivot 之后
      let pivotId = orderedIds[insertIndex - 1];
      sortedSiblingIds.forEach((id) => {
        insertPipeline.linsert(`${ORDER_PREFIX}all`, 'AFTER', pivotId, id);
        pivotId = id;
      });
    }
    await insertPipeline.execAsync();

    // ========== 7. 批量更新 MongoDB ==========
    try {
      const mongoUpdates = data.sorts.map((item) => ({
        type: 'update' as const,
        filter: { id: item.id },
        update: { $set: { sort: item.sort } },
      }));
      await categoryMongoCollection.bulkWrite(mongoUpdates);
    } catch (error) {
      console.error(
        '[CategoryCache] 保存排序 MongoDB 更新失败，将在下次定时重建时修复:',
        error,
      );
    }

    // ========== 8. 返回更新后的分类（从缓存获取最新数据）==========
    const resultPipeline = redis.pipeline();
    ids.forEach((id) => resultPipeline.hgetAll(`${INFO_PREFIX}${id}`));
    ids.forEach((id) => resultPipeline.get(`${COUNT_PREFIX}${id}`));
    const resultResults = await resultPipeline.execAsync();

    const updatedCategories = ids
      .map((id, i) => {
        const hashData = resultResults[i] as Record<string, string> | null;
        const countStr = resultResults[i + ids.length] as string | null;
        if (!hashData || Object.keys(hashData).length === 0) return null;
        return {
          ...hashToCategory(hashData),
          project_count: Number(countStr) || 0,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    return { categories: updatedCategories };
  }
}

export const categoryService = new CategoryService();
/**
 * 精确更新分类项目数计数器（文集新增/删除/移动时调用）
 *
 * 【性能优势】
 * - 只更新受影响的分类计数器（O(1) INCRBY 操作）
 * - 不需要全量清除缓存，不需要重新计算所有分类的项目数
 *
 * @param categoryId 分类 ID
 * @param delta 变化量（+1 新增，-1 删除）
 */
export async function updateCategoryCount(
  categoryId: number,
  delta: number,
): Promise<void> {
  // 读取祖先链路，获取需要更新的所有分类 ID（自身 + 所有祖先）
  const chainData = await getCategoryChainFromCache(categoryId);
  const idsToUpdate = chainData ? chainData.chain : [categoryId];

  // 使用 Pipeline 批量精确更新计数器
  // 注意：categoryCountCache.prefix 未被 createCache 暴露，需使用硬编码前缀
  const pipeline = redis.pipeline();
  for (const id of idsToUpdate) {
    pipeline.incrBy(`${COUNT_PREFIX}${id}`, delta);
  }
  await pipeline.execAsync();
}
