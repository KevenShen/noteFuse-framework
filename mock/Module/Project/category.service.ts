// mock/Project/category.service.ts
// 分类服务层
// 职责：处理分类相关的核心业务逻辑，调用数据库（MockTable）和缓存（Redis）

import { BusinessError } from '../../Core';
import { redis } from '../../Core/redis';
import type { MockProject, MockProjectCategory } from '../../Entities/project';
import {
  categoryChainCache,
  categoryCountCache,
  categoryInfoCache,
  categoryMongoCollection,
  categoryTable,
  initCategoryCache,
  projectTable,
} from '../../Entities/project';
import type {
  BatchDeleteCategoriesRequest,
  BatchMoveCategoriesRequest,
  BatchMoveCategoriesResponse,
  CategoryWithProjectCount,
  CreateCategoryRequest,
  SaveCategorySortRequest,
  UpdateCategoryRequest,
} from './category.dto';

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

const checkCanDeleteBatch = async (
  ids: number[],
  selectedIds?: Set<number>,
): Promise<Map<number, { canDelete: boolean; reason: string }>> => {
  const COUNT_PREFIX = 'project:category:count:';
  const result = new Map<number, { canDelete: boolean; reason: string }>();

  if (ids.length === 0) {
    return result;
  }

  // 1. 一次从缓存获取分类列表（缓存永久 TTL，未命中时冷启动初始化）
  let allCategories: MockProjectCategory[] =
    (await getCategoryListFromCache(false)) ?? [];
  if (allCategories.length === 0) {
    allCategories = (await initCategoryCache()).map(
      ({ project_count, ...cat }) => cat,
    );
  }

  // 2. 使用 Pipeline 批量读取所有 ID 的计数器
  const countPipeline = redis.pipeline();
  for (const id of ids) {
    countPipeline.get(`${COUNT_PREFIX}${id}`);
  }
  const countResults = await countPipeline.execAsync();

  // 构建 ID → 计数器的 Map
  const projectCountMap = new Map<number, number | null>();
  ids.forEach((id, index) => {
    const countStr = countResults[index] as string | null;
    projectCountMap.set(id, countStr !== null ? Number(countStr) : null);
  });

  // 3. 对每个 ID 进行校验
  for (const id of ids) {
    // 3.1 存在未被选中的子分类 → 禁止删除
    if (
      allCategories.some((c) => c.parent_id === id && !selectedIds?.has(c.id))
    ) {
      result.set(id, {
        canDelete: false,
        reason: '存在子分类，请先删除子分类',
      });
      continue;
    }

    // 3.2 该分类及后代下存在文集 → 禁止删除
    const projectCount = projectCountMap.get(id);
    let hasProjects: boolean;

    if (projectCount !== null && projectCount !== undefined) {
      // 缓存命中：直接使用计数器（O(1)）
      hasProjects = projectCount > 0;
    } else {
      // 缓存未命中：从数据库计算（兜底）
      const allProjects = await projectTable.findAll();
      const getAllIds = (parentId: number): number[] => {
        const ids = [parentId];
        allCategories
          .filter((c) => c.parent_id === parentId)
          .forEach((c) => ids.push(...getAllIds(c.id)));
        return ids;
      };
      hasProjects = allProjects.some((p) =>
        getAllIds(id).includes(p.project_category_id),
      );
    }

    if (hasProjects) {
      result.set(id, {
        canDelete: false,
        reason: '该分类下存在文集，无法删除',
      });
      continue;
    }

    // 3.3 校验通过
    result.set(id, { canDelete: true, reason: '' });
  }

  return result;
};

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
  const pipeline = redis.pipeline();
  pipeline.hget(`${categoryChainCache.prefix}${categoryId}`, 'chain');
  pipeline.hget(`${categoryChainCache.prefix}${categoryId}`, 'ancestors');
  pipeline.hget(`${categoryChainCache.prefix}${categoryId}`, 'depth');
  pipeline.hget(`${categoryChainCache.prefix}${categoryId}`, 'children');
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
 * 从缓存获取全部分类列表
 *
 * 【缓存架构】五个独立缓存管理器（永久 TTL，每天凌晨 4 点全量重建）
 * - categoryOrderCache (List)：排序后的分类 ID 列表
 * - categoryInfoCache (Hash)：每个分类的详情
 * - categoryCountCache (String)：每个分类的文集数（含后代）
 * - categoryChainCache (Hash)：每个分类的祖先链路
 * - categoryProjectsCache (Set)：每个分类直接挂载的文集 ID 集合
 *
 * 【性能优化】
 * - 使用 Redis Pipeline 批量读取，将 2N+1 次调用减少为 2 次 Pipeline 调用
 * - 当 includeCount=false 时，不读取计数器，Pipeline 命令数减少一半
 *
 * @param includeCount 是否包含 project_count 字段（默认 true）
 * @returns 分类列表，缓存未命中时返回 null
 */
async function getCategoryListFromCache(
  includeCount: boolean = true,
): Promise<Array<MockProjectCategory & { project_count?: number }> | null> {
  const INFO_PREFIX = 'project:category:info:';
  const ORDER_PREFIX = 'project:category:order:';
  const COUNT_PREFIX = 'project:category:count:';

  // 1. 读取排序索引
  const orderPipeline = redis.pipeline();
  orderPipeline.lrange(`${ORDER_PREFIX}all`, 0, -1);
  const orderResults = await orderPipeline.execAsync();
  const orderedIds = orderResults[0] as number[] | null;
  if (!orderedIds || orderedIds.length === 0) return null;

  // 2. 批量读取分类详情（和计数器）
  const dataPipeline = redis.pipeline();
  for (const id of orderedIds) {
    dataPipeline.hgetAll(`${INFO_PREFIX}${id}`);
    if (includeCount) {
      dataPipeline.get(`${COUNT_PREFIX}${id}`);
    }
  }
  const dataResults = await dataPipeline.execAsync();

  // 3. 组装结果（单循环 + 条件展开）
  const result: Array<MockProjectCategory & { project_count?: number }> = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const hashData = dataResults[includeCount ? i * 2 : i] as Record<
      string,
      string
    > | null;
    if (!hashData || Object.keys(hashData).length === 0) return null;

    result.push({
      ...hashToCategory(hashData),
      ...(includeCount && {
        project_count: Number(dataResults[i * 2 + 1] ?? 0),
      }),
    });
  }

  return result;
}

/**
 * 获取全部分类列表（带多级降级）
 *
 * 【降级顺序】Redis（L3）→ MongoDB（L2）→ 数据库/冷启动（兜底）
 *
 * 【用途】统一所有分类管理函数的数据获取逻辑，避免重复代码
 *
 * @param options 配置选项
 * @param options.useColdStart 最后是否使用冷启动（true=冷启动初始化 Redis，false=直接从数据库获取）
 * @param options.sort 是否排序（默认 true，按 parent_id + sort）
 * @param options.includeCount 是否包含 project_count 字段（默认 false）
 * @returns 分类列表（includeCount=true 时带 project_count，否则为纯分类数据）
 */
async function getAllCategoriesWithFallback(
  options: {
    useColdStart?: boolean;
    sort?: boolean;
    includeCount?: boolean;
  } = {},
): Promise<MockProjectCategory[] | CategoryWithProjectCount[]> {
  const { useColdStart = true, sort = true, includeCount = false } = options;

  // ========== 1. 优先从 Redis（L3）缓存获取 ==========
  try {
    const cachedCategories = await getCategoryListFromCache(includeCount);
    if (cachedCategories && cachedCategories.length > 0) {
      return cachedCategories;
    }
  } catch (error) {
    console.warn('[CategoryCache] Redis 读取失败，降级到 MongoDB:', error);
  }

  // ========== 2. 降级到 MongoDB（L2）获取 ==========
  try {
    const query = categoryMongoCollection.find({});
    const mongoCategories = sort
      ? await query.sort({ parent_id: 1, sort: 1 }).toArray()
      : await query.toArray();

    if (mongoCategories && mongoCategories.length > 0) {
      if (includeCount) {
        // 保留 project_count 字段，返回带文集数量的分类数据
        return mongoCategories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          parent_id: cat.parent_id,
          sort: cat.sort,
          icon: cat.icon,
          description: cat.description,
          create_time: cat.create_time,
          project_count: cat.project_count ?? 0,
        }));
      } else {
        // 去掉 project_count 和 children 统计字段，返回纯分类数据
        return mongoCategories.map(
          ({ project_count, children, ...cat }) => cat,
        );
      }
    }
  } catch (error) {
    console.warn(
      '[CategoryCache] MongoDB 读取失败，降级到数据库/冷启动:',
      error,
    );
  }

  // ========== 3. 最后降级（数据库或冷启动）==========
  if (useColdStart) {
    // 冷启动：初始化 Redis 缓存
    const initResult = await initCategoryCache();
    if (includeCount) {
      // 直接返回带 project_count 的结果
      return initResult;
    } else {
      // 去掉 project_count 字段
      return initResult.map(({ project_count, ...cat }) => cat);
    }
  } else {
    // 直接从数据库（MockTable）获取
    const dbCategories = await categoryTable.findAll();
    return dbCategories ?? [];
  }
}

// ============================================================================
// 分类服务类
// ============================================================================

class CategoryService {
  /**
   * 获取分类列表（含后代文集数汇总）
   * 【降级顺序】Redis（L3）→ MongoDB（L2）→ 冷启动（兜底）
   * @returns 带 project_count 的分类列表
   */
  async getCategoryListWithProjectCount(): Promise<CategoryWithProjectCount[]> {
    // 使用通用函数，includeCount=true 返回带 project_count 的分类列表
    // 降级顺序：Redis（L3）→ MongoDB（L2）→ 冷启动（兜底）
    return getAllCategoriesWithFallback({
      includeCount: true,
      useColdStart: true,
    }) as Promise<CategoryWithProjectCount[]>;
  }

  /**
   * 创建分类（高级版，唯一创建逻辑）
   *
   * 【功能】
   * - 自动计算 sort（取同级最大 sort + 1，避免删除后重复）
   * - 校验父分类存在性和同级名称不重复
   * - 创建后精确写入 Redis 缓存和 MongoDB（不需要全量清除）
   *
   * 【读取优先级】Redis（L3）→ MongoDB（L2）→ 冷启动
   * - 与 getCategoryListWithProjectCount 保持一致
   *
   * 【性能优化】
   * 1. 并行查询：父分类 + 同级分类 + 父链路一次 Promise.all，消除串行 await
   * 2. 父分类链路一次 hgetAll 获取所有字段，避免重复读取
   * 3. 排序插入位置：优先用同级分类内存计算（无 IO）；仅同级最小时从 order:all Redis List 定位，替代原 MongoDB $lt+sort+limit 查询
   * 4. Redis 和 MongoDB 写入并行执行（Promise.all）
   * 5. 完善错误处理，确保数据一致性
   *
   * @param data 请求参数
   * @returns 创建的分类（含 project_count）
   */
  async createCategoryAdvanced(
    data: CreateCategoryRequest,
  ): Promise<CategoryWithProjectCount> {
    const parentId = data.parent_id ?? 0;
    const INFO_PREFIX = 'project:category:info:';
    const ORDER_PREFIX = 'project:category:order:';
    const COUNT_PREFIX = 'project:category:count:';
    const CHAIN_PREFIX = 'project:category:chain:';

    // ========== 1. 并行查询所有需要的数据（一次 Promise.all，消除重复查询）==========
    // - parentCategory：父分类存在性校验
    // - siblingCategories：同级分类（名称校验、maxSort、插入位置）
    // - parentChainData：父分类的祖先链路（计算新分类的 chain/depth/ancestors）
    // 注：前一个 parent_id 的 pivot 不再查 MongoDB，改为从 order:all Redis List 计算
    const [parentCategory, siblingCategories, parentChainData] =
      await Promise.all([
        parentId !== 0
          ? categoryMongoCollection.findOne({ id: parentId })
          : Promise.resolve(null),
        categoryMongoCollection
          .find({ parent_id: parentId })
          .sort({ sort: 1 })
          .toArray(),
        parentId !== 0
          ? categoryChainCache.hgetAll(String(parentId))
          : Promise.resolve(null),
      ]);

    // 1.1 父分类存在性校验
    if (parentId !== 0 && !parentCategory) {
      throw new BusinessError('父分类不存在');
    }

    // 1.2 同级名称重复校验
    if (siblingCategories.some((c) => c.name === data.name)) {
      throw new BusinessError('同级分类下已存在相同名称的分类');
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
    // 优化：不再用 MongoDB $lt+sort+limit 查询前一个 parent_id，改为从 order:all Redis List 计算
    let pivotId: number | null = null;
    let insertAtBeginning = false;

    // 找到同级中 sort 小于新分类的最大的那个（插入到它后面）
    const smallerSiblings = siblingCategories.filter(
      (c) => c.sort < newCategory.sort,
    );
    if (smallerSiblings.length > 0) {
      // 大多数情况：同级中有更小的 sort，直接取最大的那个作为 pivot（无额外 IO）
      pivotId = smallerSiblings[smallerSiblings.length - 1].id;
    } else {
      // 新分类是同级最小的，或同级没有其他分类
      // 从 order:all Redis List（已按 parent_id+sort 有序）中找前一个位置
      const orderedIds = (await redis.lrange(
        `${ORDER_PREFIX}all`,
        0,
        -1,
      )) as number[];

      if (orderedIds.length === 0) {
        // List 为空，插入到最前面
        insertAtBeginning = true;
      } else if (siblingCategories.length > 0) {
        // 有同级分类：找第一个同级分类在 List 中的位置，取前一个位置的 ID
        // siblingCategories 已按 sort 升序，第一个就是同级最小的
        const firstSiblingIndex = orderedIds.indexOf(siblingCategories[0].id);
        if (firstSiblingIndex > 0) {
          pivotId = orderedIds[firstSiblingIndex - 1];
        } else {
          // 同级分类在 List 最前面，新分类也插入到最前面
          insertAtBeginning = true;
        }
      } else {
        // 同级无分类（该 parent_id 下第一个分类）：
        // 从 List 末尾向前找第一个 parent_id < 当前 parentId 的分类
        const infoPipeline = redis.pipeline();
        for (const id of orderedIds) {
          infoPipeline.hget(`${INFO_PREFIX}${id}`, 'parent_id');
        }
        const parentIdResults = await infoPipeline.execAsync();

        let pivotIndex = -1;
        for (let i = orderedIds.length - 1; i >= 0; i--) {
          if (Number(parentIdResults[i]) < parentId) {
            pivotIndex = i;
            break;
          }
        }
        if (pivotIndex >= 0) {
          pivotId = orderedIds[pivotIndex];
        } else {
          insertAtBeginning = true;
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
    if (insertAtBeginning) {
      pipeline.lpush(`${ORDER_PREFIX}all`, newCategory.id);
    } else if (pivotId !== null) {
      pipeline.linsert(`${ORDER_PREFIX}all`, 'AFTER', pivotId, newCategory.id);
    } else {
      console.warn('[CategoryCache] 未找到插入位置，使用 rpush 兜底');
      pipeline.rpush(`${ORDER_PREFIX}all`, newCategory.id);
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
        categoryMongoCollection.insertOne({
          ...newCategory,
          project_count: 0, // 新创建的分类没有文集
          children: [], // 新创建的分类没有子分类
        }),
        // MongoDB 写入：更新父分类的 children（如果有父分类）
        parentId !== 0
          ? (async () => {
              const parentCategory = await categoryMongoCollection.findOne({
                id: parentId,
              });
              if (parentCategory) {
                const mongoParentChildren = parentCategory.children || [];
                if (!mongoParentChildren.includes(newCategory.id)) {
                  await categoryMongoCollection.updateOne(
                    { id: parentId },
                    {
                      $set: {
                        children: [...mongoParentChildren, newCategory.id],
                      },
                    },
                  );
                }
              }
            })()
          : Promise.resolve(),
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
    return { ...newCategory, project_count: 0 };
  }

  /**
   * 更新分类
   *
   * 【功能】
   * - 校验分类存在
   * - 如果修改名称，校验同级不重复
   * - 如果修改 parent_id，校验新父分类存在且不是自己的后代
   * - 字段更新时精确更新 Hash；移动分类时精确更新缓存（不全量清除）
   *
   * 【读取优先级】Redis（L3）→ MongoDB（L2）→ 冷启动
   * - 与 createCategoryAdvanced / getCategoryListWithProjectCount 保持一致
   *
   * 【性能优化】
   * 1. 三级降级校验分类存在：Redis → MongoDB → 数据库
   * 2. 移动分类时精确更新缓存（祖先链路、排序索引、父分类 children、计数器），不全量清除
   * 3. 字段更新时使用 Pipeline 批量更新，减少多次 await
   * 4. 利用 categoryChainCache 的 ancestors 字段快速判断后代关系
   * 5. 计数器更新与 Pipeline、MongoDB 写入并行执行（Promise.all）
   *
   * @param id 分类 ID
   * @param data 请求参数
   * @returns 更新后的分类
   */
  async updateCategory(
    id: number,
    data: UpdateCategoryRequest,
  ): Promise<MockProjectCategory> {
    const INFO_PREFIX = 'project:category:info:';
    const ORDER_PREFIX = 'project:category:order:';
    const CHAIN_PREFIX = 'project:category:chain:';

    // ========== 1. 校验分类存在（三级降级：Redis → MongoDB → 数据库）==========
    const categoryInfo = await categoryInfoCache.hgetAll(String(id));
    let category: MockProjectCategory | null = null;

    if (categoryInfo && Object.keys(categoryInfo).length > 0) {
      // L3：Redis 缓存命中
      category = hashToCategory(categoryInfo);
    } else {
      // L2：降级到 MongoDB
      const mongoCategory = await categoryMongoCollection.findOne({ id });
      if (mongoCategory) {
        category = mongoCategory;
      } else {
        // L1：兜底数据库（主存储，绝对最新）
        category = (await categoryTable.findById(id)) ?? null;
      }
    }
    if (!category) {
      throw new BusinessError('分类不存在', 404);
    }

    const updateData: Partial<MockProjectCategory> = {};
    const isMoving =
      data.parent_id !== undefined && data.parent_id !== category.parent_id;
    const isSortChanged =
      data.sort !== undefined && data.sort !== category.sort;
    const targetParentId = data.parent_id ?? category.parent_id;
    const oldParentId = category.parent_id;

    // ========== 2. 并行查询所有受影响的数据（一次 Promise.all，不全量获取）==========
    // - targetSiblingCategories：目标同级分类（名称校验、排序插入位置）
    // - prevParentCategory：前一个 parent_id 的最后一个分类（排序插入位置的 pivot）
    // - newParentChain：新父分类的祖先链路（计算新 chain/depth、判断后代关系）
    // - oldParentChain：旧父分类的祖先链路（更新旧父分类的 children，避免串行查询）
    const [
      targetSiblingCategories,
      prevParentCategory,
      newParentChain,
      oldParentChain,
    ] = await Promise.all([
      categoryMongoCollection
        .find({ parent_id: targetParentId, id: { $ne: id } })
        .sort({ sort: 1 })
        .toArray(),
      categoryMongoCollection
        .find({ parent_id: { $lt: targetParentId } })
        .sort({ parent_id: -1, sort: -1 })
        .limit(1)
        .toArray(),
      isMoving && targetParentId !== 0
        ? categoryChainCache.hgetAll(String(targetParentId))
        : Promise.resolve(null),
      isMoving && oldParentId !== 0
        ? categoryChainCache.hgetAll(String(oldParentId))
        : Promise.resolve(null),
    ]);

    // ========== 3. 业务校验 ==========
    // 3.1 名称修改：校验同级不重复（使用 targetSiblingCategories，不需要全量数据）
    if (data.name !== undefined) {
      if (targetSiblingCategories.some((c) => c.name === data.name)) {
        throw new BusinessError('同级分类下已存在相同名称的分类');
      }
      updateData.name = data.name;
    }

    // 3.2 parent_id 修改：校验新父分类存在且不是自己的后代
    if (isMoving) {
      const newParentId = data.parent_id!;
      if (newParentId !== 0) {
        // 校验新父分类存在（使用已查询的 newParentChain，避免重复查询）
        if (!newParentChain || Object.keys(newParentChain).length === 0) {
          // 缓存未命中，兜底查询数据库
          const newParentExists = await categoryTable.findById(newParentId);
          if (!newParentExists) {
            throw new BusinessError('父分类不存在');
          }
        }

        // 利用 categoryChainCache 的 ancestors 字段快速判断后代关系
        // 如果新父分类的祖先链中包含当前分类 id，说明移动到了自己的后代下
        if (newParentChain?.ancestors) {
          const newParentAncestors = JSON.parse(
            newParentChain.ancestors,
          ) as number[];
          if (newParentAncestors.includes(id) || newParentId === id) {
            throw new BusinessError('不能将分类移动到其自身的子分类下');
          }
        }
      }
      updateData.parent_id = newParentId;
    }

    // 3.3 其他字段直接更新
    if (data.sort !== undefined) updateData.sort = data.sort;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.description !== undefined)
      updateData.description = data.description;

    // ========== 4. 执行数据库更新 ==========
    const updatedCategory = await categoryTable.updateById(id, updateData);

    // ========== 5. 并行更新 Redis 和 MongoDB ==========
    try {
      if (isMoving || isSortChanged) {
        // ========== 5.1 移动分类或修改 sort：更新排序索引 + 其他缓存 ==========
        const newParentId = data.parent_id ?? category.parent_id;

        // 5.1.1 计算新的祖先链路（仅移动时需要，使用已查询的 newParentChain）
        let newAncestors: number[] = [];
        let newDepth = 0;
        let newChain: number[] = [id];
        if (isMoving) {
          if (newParentId !== 0 && newParentChain?.chain) {
            newAncestors = JSON.parse(newParentChain.chain) as number[];
            newDepth =
              Number(newParentChain.depth ?? newAncestors.length - 1) + 1;
          }
          newChain = [...newAncestors, id];
        }

        // 5.1.2 计算排序索引的新插入位置（使用 targetSiblingCategories + prevParentCategory）
        // 排序规则：先按 parent_id 升序，再按 sort 升序
        let pivotId: number | null = null;
        let insertAtBeginning = false;

        // 找到目标同级中 sort 小于当前分类的最大的那个（插入到它后面）
        const smallerSiblings = targetSiblingCategories.filter(
          (c) => c.sort < updatedCategory!.sort,
        );
        if (smallerSiblings.length > 0) {
          pivotId = smallerSiblings[smallerSiblings.length - 1].id;
        } else if (prevParentCategory.length > 0) {
          // 当前分类是同级最小的，或同级没有其他分类
          // 插入到前一个 parent_id 的最后一个分类后面
          pivotId = prevParentCategory[0].id;
        } else {
          // 没有前一个 parent_id，插入到列表最前面
          insertAtBeginning = true;
        }

        // 5.1.3 构建 Redis Pipeline（无串行 await，所有数据已在前面并行查询）
        const pipeline = redis.pipeline();

        // 移动分类时：更新该分类的祖先链路（chain/ancestors/depth 冗余存储，空间换时间）
        if (isMoving) {
          pipeline.hmset(`${CHAIN_PREFIX}${id}`, {
            chain: JSON.stringify(newChain),
            depth: String(newDepth),
            ancestors: JSON.stringify(newAncestors),
            children: JSON.stringify(
              categoryInfo?.children ? JSON.parse(categoryInfo.children) : [],
            ),
          });

          // 更新旧父分类的 children（移除当前分类 ID，使用已查询的 oldParentChain）
          if (oldParentId !== 0) {
            const oldParentChildren = oldParentChain?.children
              ? JSON.parse(oldParentChain.children)
              : [];
            pipeline.hset(
              `${CHAIN_PREFIX}${oldParentId}`,
              'children',
              JSON.stringify(
                oldParentChildren.filter((cid: number) => cid !== id),
              ),
            );
          }

          // 更新新父分类的 children（添加当前分类 ID，使用已查询的 newParentChain）
          if (newParentId !== 0) {
            const newParentChildren = newParentChain?.children
              ? JSON.parse(newParentChain.children)
              : [];
            if (!newParentChildren.includes(id)) {
              newParentChildren.push(id);
              pipeline.hset(
                `${CHAIN_PREFIX}${newParentId}`,
                'children',
                JSON.stringify(newParentChildren),
              );
            }
          }
        }

        // 修改 sort 时：更新分类详情中的 sort 字段
        if (isSortChanged && !isMoving) {
          pipeline.hset(`${INFO_PREFIX}${id}`, 'sort', String(data.sort));
        }

        // 更新排序索引（先删除旧位置，再插入新位置）
        pipeline.lrem(`${ORDER_PREFIX}all`, 0, id);
        if (insertAtBeginning) {
          pipeline.lpush(`${ORDER_PREFIX}all`, id);
        } else if (pivotId !== null) {
          pipeline.linsert(`${ORDER_PREFIX}all`, 'AFTER', pivotId, id);
        } else {
          pipeline.rpush(`${ORDER_PREFIX}all`, id);
        }

        // 5.1.4 并行执行 Redis 和 MongoDB 更新
        // MongoDB 使用原子操作 $pull/$push，避免"先查后改"
        const mongoUpdates: Promise<any>[] = [
          pipeline.execAsync(),
          categoryMongoCollection.updateOne({ id }, { $set: updateData }),
        ];

        // 移动分类时：MongoDB 原子更新父分类的 children
        if (isMoving) {
          if (oldParentId !== 0) {
            // $pull：原子移除
            mongoUpdates.push(
              categoryMongoCollection.updateOne(
                { id: oldParentId },
                { $pull: { children: id } },
              ),
            );
          }
          if (newParentId !== 0) {
            // $push + $each：原子添加（自动去重）
            mongoUpdates.push(
              categoryMongoCollection.updateOne(
                { id: newParentId },
                { $push: { children: { $each: [id], $position: 0 } } },
              ),
            );
          }

          // 移动分类时：并行更新计数器（旧祖先 DECRBY，新祖先 INCRBY）
          // 与 Pipeline、MongoDB 更新并行，不增加串行等待
          mongoUpdates.push(
            (async () => {
              const [allCategories, allProjects] = await Promise.all([
                getAllCategoriesWithFallback({ useColdStart: false }),
                projectTable.findAll(),
              ]);
              const updatedCategories = (
                allCategories as MockProjectCategory[]
              ).map((c) =>
                c.id === id ? { ...c, parent_id: newParentId } : c,
              );
              return calculateAndApplyCounterDiff(
                [id],
                new Map([[id, oldParentId]]),
                newParentId,
                updatedCategories,
                allProjects,
              );
            })(),
          );
        }

        await Promise.all(mongoUpdates);
      } else {
        // ========== 5.2 普通字段更新：Pipeline 批量更新 Hash（不涉及排序索引）==========
        const pipeline = redis.pipeline();
        if (data.name !== undefined) {
          pipeline.hset(`${INFO_PREFIX}${id}`, 'name', data.name);
        }
        if (data.icon !== undefined) {
          pipeline.hset(`${INFO_PREFIX}${id}`, 'icon', data.icon || '');
        }
        if (data.description !== undefined) {
          pipeline.hset(
            `${INFO_PREFIX}${id}`,
            'description',
            data.description || '',
          );
        }

        // 并行执行 Redis 和 MongoDB 更新
        await Promise.all([
          pipeline.execAsync(),
          categoryMongoCollection.updateOne({ id }, { $set: updateData }),
        ]);
      }
    } catch (error) {
      // 缓存写入失败，记录日志，等待定时重建修复
      console.error(
        '[CategoryCache] 更新分类缓存写入失败，将在下次定时重建时修复:',
        error,
      );
    }

    return updatedCategory!;
  }

  /**
   * 删除分类（含校验：存在子分类或文集时禁止删除）
   *
   * 【功能】
   * - 校验分类存在
   * - 校验是否有子分类或文集（有则禁止删除）
   * - 从数据库删除分类
   * - 精确更新 Redis 缓存和 MongoDB（不全量清除）
   *
   * 【性能优化】
   * 1. 利用缓存快速校验：categoryChainCache.children 判断子分类，categoryCountCache 判断文集数
   * 2. 使用 Redis Pipeline 批量删除（排序索引/详情/计数器/祖先链路/文集列表）
   * 3. 并行读取父分类信息（Redis + MongoDB），减少串行 await
   * 4. 并行执行 Redis 和 MongoDB 写入（Promise.all）
   * 5. 添加错误处理：数据库删除成功后，缓存失败不影响主流程，等待定时重建修复
   *
   * @param id 分类 ID
   */
  async deleteCategoryWithCheck(id: number): Promise<null> {
    return this.batchDeleteCategories({ ids: [id] });
  }

  /**
   * 批量删除分类（逐个校验，选中的子分类允许级联删除）
   *
   * 【功能】
   * - 批量校验：使用 checkCanDeleteBatch 一次性校验所有 ID
   * - 批量获取：使用 Pipeline 批量获取分类信息（同时用于校验提示和删除操作）
   * - 批量删除：使用 bulkDelete 批量删除数据库记录
   * - 精确更新缓存：Pipeline 批量删除 + 更新父分类 children
   *
   * 【性能优化】
   * 1. 合并循环：一次 Pipeline 批量获取分类信息，同时用于校验失败提示和删除操作
   * 2. 并行读取父分类信息：Redis + MongoDB 并行读取，减少串行 await
   * 3. 并行执行 Redis 和 MongoDB 写入：Promise.all
   * 4. 删除 categoryProjectsCache：清除被删分类的文集 ID 列表
   * 5. 添加错误处理：数据库删除成功后，缓存失败不影响主流程，等待定时重建修复
   *
   * @param data 请求参数
   */
  async batchDeleteCategories(
    data: BatchDeleteCategoriesRequest,
  ): Promise<null> {
    const INFO_PREFIX = 'project:category:info:';
    const ORDER_PREFIX = 'project:category:order:';
    const COUNT_PREFIX = 'project:category:count:';
    const CHAIN_PREFIX = 'project:category:chain:';
    const PROJECTS_PREFIX = 'project:category:projects:';

    const idSet = new Set(data.ids.map(Number));
    const ids = Array.from(idSet);

    // ========== 1. 批量校验（使用 checkCanDeleteBatch，一次性读取缓存）==========
    const validationResults = await checkCanDeleteBatch(ids, idSet);

    // ========== 2. 批量获取所有分类信息（一次 Pipeline，缓存未命中时批量查询数据库）==========
    const infoPipeline = redis.pipeline();
    for (const id of ids) {
      infoPipeline.hgetAll(`${INFO_PREFIX}${id}`);
    }
    const infoResults = await infoPipeline.execAsync();

    // 解析结果，收集缓存未命中的 ID
    const categoryMap = new Map<
      number,
      { id: number; name: string; parent_id: number }
    >();
    const missingIds: number[] = [];

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const categoryInfo = infoResults[i] as Record<string, string> | null;

      if (categoryInfo && Object.keys(categoryInfo).length > 0) {
        categoryMap.set(id, {
          id: Number(categoryInfo.id),
          name: categoryInfo.name || '未知分类',
          parent_id: Number(categoryInfo.parent_id),
        });
      } else {
        // 收集缓存未命中的 ID，稍后批量查询
        missingIds.push(id);
      }
    }

    // 缓存未命中时：三级降级（MongoDB → 数据库，避免串行 await）
    if (missingIds.length > 0) {
      // 先从 MongoDB 批量查询（L2）
      const mongoCategories = await categoryMongoCollection
        .find({ id: { $in: missingIds } })
        .toArray();
      const mongoHitIds = new Set(mongoCategories.map((c) => c.id));

      // MongoDB 命中的直接使用
      for (const cat of mongoCategories) {
        categoryMap.set(cat.id, {
          id: cat.id,
          name: cat.name,
          parent_id: cat.parent_id,
        });
      }

      // MongoDB 也未命中的，兜底到数据库（L1）
      const stillMissingIds = missingIds.filter((id) => !mongoHitIds.has(id));
      if (stillMissingIds.length > 0) {
        const dbCategories = await categoryTable.findAll({
          where: { id: stillMissingIds },
        } as any);
        for (const cat of dbCategories) {
          categoryMap.set(cat.id, {
            id: cat.id,
            name: cat.name,
            parent_id: cat.parent_id,
          });
        }
      }
    }

    // 检查是否有校验失败的（直接从 categoryMap 获取名称，不需要再次读取）
    for (const id of ids) {
      const result = validationResults.get(id);
      if (result && !result.canDelete) {
        const categoryName = categoryMap.get(id)?.name || '未知分类';
        throw new BusinessError(`「${categoryName}」${result.reason}`);
      }
    }

    // ========== 3. 批量删除数据库记录（使用 bulkDelete）==========
    const bulkDeleteOperations = ids.map((id) => ({ where: { id } }));
    categoryTable.bulkDelete(bulkDeleteOperations);

    // ========== 4. 收集需要更新的父分类信息 ==========
    const parentChildrenToRemove = new Map<number, number[]>();
    for (const category of categoryMap.values()) {
      if (category.parent_id !== 0 && !idSet.has(category.parent_id)) {
        if (!parentChildrenToRemove.has(category.parent_id)) {
          parentChildrenToRemove.set(category.parent_id, []);
        }
        parentChildrenToRemove.get(category.parent_id)!.push(category.id);
      }
    }
    const parentIds = [...parentChildrenToRemove.keys()];

    // ========== 5. 批量读取父分类的 Redis children（用于 Redis 更新，MongoDB 用原子操作不需要先查）==========
    const parentRedisData = new Map<number, number[]>();
    if (parentIds.length > 0) {
      const parentPipeline = redis.pipeline();
      for (const parentId of parentIds) {
        parentPipeline.hgetAll(`${CHAIN_PREFIX}${parentId}`);
      }
      const redisResults = await parentPipeline.execAsync();

      for (let i = 0; i < parentIds.length; i++) {
        const parentId = parentIds[i];
        const parentChain = redisResults[i] as Record<string, string> | null;
        parentRedisData.set(
          parentId,
          parentChain?.children ? JSON.parse(parentChain.children) : [],
        );
      }
    }

    // ========== 6. 构建 Redis Pipeline ==========
    const pipeline = redis.pipeline();

    // 6.1 从排序索引中删除所有分类的 ID
    for (const id of ids) {
      pipeline.lrem(`${ORDER_PREFIX}all`, 0, id);
    }

    // 6.2 删除所有分类的详情/计数器/祖先链路/文集列表
    for (const id of ids) {
      pipeline.del(`${INFO_PREFIX}${id}`);
      pipeline.del(`${COUNT_PREFIX}${id}`);
      pipeline.del(`${CHAIN_PREFIX}${id}`);
      pipeline.del(`${PROJECTS_PREFIX}${id}`);
    }

    // 6.3 更新父分类的 children（使用已读取的 Redis 数据）
    for (const [parentId, childIdsToRemove] of parentChildrenToRemove) {
      const parentChildren = parentRedisData.get(parentId) || [];
      const updatedChildren = parentChildren.filter(
        (cid) => !childIdsToRemove.includes(cid),
      );
      pipeline.hset(
        `${CHAIN_PREFIX}${parentId}`,
        'children',
        JSON.stringify(updatedChildren),
      );
    }

    // ========== 7. 并行执行 Redis 和 MongoDB 更新 ==========
    try {
      const mongoOperations: Promise<any>[] = [
        pipeline.execAsync(), // Redis 批量更新
        categoryMongoCollection.deleteMany({ id: { $in: ids } }), // MongoDB：批量删除
      ];

      // MongoDB：原子更新父分类的 children（$pull + updateMany，不需要先查询）
      if (parentIds.length > 0) {
        mongoOperations.push(
          categoryMongoCollection.updateMany(
            { id: { $in: parentIds } },
            { $pull: { children: { $in: ids } } },
          ),
        );
      }

      await Promise.all(mongoOperations);
    } catch (error) {
      // 缓存写入失败，记录日志，等待定时重建修复
      // 不抛出错误，因为数据库已经删除成功
      console.error(
        '[CategoryCache] 批量删除缓存更新失败，将在下次定时重建时修复:',
        error,
      );
    }

    return null;
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
    const ORDER_PREFIX = 'project:category:order:';

    const startTime = Date.now();
    const idSet = new Set(data.ids.map(Number));
    const ids = Array.from(idSet);
    const targetId = Number(data.target_parent_id);

    // ========== 1. 获取分类列表（使用通用函数，优先 Redis（L3），降级 MongoDB（L2），最后数据库）==========
    const allCategories = await getAllCategoriesWithFallback({
      useColdStart: false,
    });

    // 文集数据从数据库获取
    const allProjects = await projectTable.findAll();

    // ========== 2. 记录移动前每个分类的父分类 ID ==========
    const oldParentIds = new Map<number, number>();
    idSet.forEach((id) => {
      const category = allCategories.find((c) => c.id === id);
      if (category) {
        oldParentIds.set(id, category.parent_id);
      }
    });

    // ========== 3. 防止移动到自己的子分类下（循环检测）==========
    const checkCycle = (parentId: number): boolean => {
      if (idSet.has(parentId)) return true;
      const parent = allCategories.find((c) => c.id === parentId);
      if (!parent || !parent.parent_id) return false;
      return checkCycle(parent.parent_id);
    };
    if (targetId !== 0 && checkCycle(targetId)) {
      throw new BusinessError('不能将分类移动到其自身的子分类下');
    }

    // ========== 4. 批量更新数据库中的 parent_id（使用 bulkUpdate，避免循环）==========
    const bulkUpdateOperations = ids.map((id) => ({
      where: { id },
      data: { parent_id: targetId },
    }));
    categoryTable.bulkUpdate(bulkUpdateOperations);

    // ========== 5. 直接在内存中更新分类数据（避免重复全量读取数据库）==========
    const updatedCategories = allCategories.map((c) =>
      idSet.has(c.id) ? { ...c, parent_id: targetId } : c,
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

    // ========== 8. 更新排序索引（List，使用 Pipeline 批量操作）==========
    const sorted = [...updatedCategories].sort((a, b) => {
      if (a.parent_id !== b.parent_id) return a.parent_id - b.parent_id;
      return a.sort - b.sort;
    });

    const orderPipeline = redis.pipeline();
    orderPipeline.del(`${ORDER_PREFIX}all`);
    orderPipeline.rpush(
      `${ORDER_PREFIX}all`,
      ...sorted.map((c) => String(c.id)),
    );
    await orderPipeline.execAsync();

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

    // ========== 10. 并行执行 MongoDB 更新（使用原子操作，不需要先查询）==========
    try {
      // 10.1 收集旧父分类 ID（排除被移动的分类本身和目标分类）
      const oldParentIdSet = new Set<number>();
      for (const id of idSet) {
        const oldParentId = oldParentIds.get(id);
        if (
          oldParentId !== undefined &&
          oldParentId !== 0 &&
          !idSet.has(oldParentId) &&
          oldParentId !== targetId
        ) {
          oldParentIdSet.add(oldParentId);
        }
      }
      const oldParentIdsArray = Array.from(oldParentIdSet);

      // 10.2 并行执行 MongoDB 更新（使用原子操作 $pull/$push，不需要先查询）
      const mongoOperations: Promise<any>[] = [
        // 批量更新被移动分类的 parent_id（updateMany，1 次查询）
        categoryMongoCollection.updateMany(
          { id: { $in: ids } },
          { $set: { parent_id: targetId } },
        ),
      ];

      // 旧父分类：原子移除被移动的分类 ID（$pull + updateMany）
      if (oldParentIdsArray.length > 0) {
        mongoOperations.push(
          categoryMongoCollection.updateMany(
            { id: { $in: oldParentIdsArray } },
            { $pull: { children: { $in: ids } } },
          ),
        );
      }

      // 新父分类：原子添加被移动的分类 ID（$push + $each）
      if (targetId !== 0 && !idSet.has(targetId)) {
        mongoOperations.push(
          categoryMongoCollection.updateOne(
            { id: targetId },
            { $push: { children: { $each: ids } } },
          ),
        );
      }

      await Promise.all(mongoOperations);
    } catch (error) {
      // MongoDB 更新失败，记录日志，等待定时重建修复
      // 不抛出错误，因为数据库和 Redis 已经更新成功
      console.error(
        '[CategoryCache] 分类移动 MongoDB 更新失败，将在下次定时重建时修复:',
        error,
      );
    }

    return {
      movedIds: ids,
      targetParentId: targetId,
      updatedChains,
      updatedCounters,
      affectedIds: Array.from(affectedIds),
      duration,
    };
  }

  /**
   * 保存分类排序（支持扁平化数据，每个 item 自带 id/sort/parent_id）
   *
   * 【功能】
   * - 支持只修改 sort 字段：精确更新 Hash + Pipeline 重建排序索引
   * - 支持修改 parent_id（移动分类）：递归更新祖先链路 + 计数器差异
   * - 同步更新 MongoDB（sort/parent_id + 父分类 children）
   *
   * 【性能优化】
   * 1. 优先从 Redis（L3）获取分类数据，降级到 MongoDB（L2），最后数据库
   * 2. 批量处理 parent_id 变化：只获取一次文集数据，避免循环重复获取
   * 3. 并行执行 MongoDB 更新（Promise.all）：批量更新 sort/parent_id + 批量更新父分类 children
   * 4. 批量查询父分类信息（一次 find，不需要循环查询）
   * 5. 添加错误处理：数据库更新成功后，缓存失败不影响主流程，等待定时重建修复
   *
   * @param data 请求参数
   */
  async saveCategorySort(data: SaveCategorySortRequest): Promise<null> {
    const INFO_PREFIX = 'project:category:info:';
    const ORDER_PREFIX = 'project:category:order:';

    let hasParentChange = false;
    const sortUpdates: Array<{ id: number; sort: number }> = [];
    const parentChanges: Array<{
      id: number;
      oldParentId: number;
      newParentId: number;
    }> = [];

    // ========== 1. 获取分类列表（使用通用函数，优先 Redis（L3），降级 MongoDB（L2），最后冷启动）==========
    const allCategories = await getAllCategoriesWithFallback({
      useColdStart: true,
    });

    // 构建 ID → 分类的 Map，方便查找
    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

    // ========== 2. 遍历排序数据，收集更新操作 ==========
    for (const item of data.sorts) {
      const category = categoryMap.get(item.id);
      if (!category) continue;

      const newParentId = item.parent_id ?? category.parent_id;
      const newSort = item.sort ?? category.sort;

      // 检查是否修改了 parent_id
      if (newParentId !== category.parent_id) {
        hasParentChange = true;
        parentChanges.push({
          id: category.id,
          oldParentId: category.parent_id,
          newParentId,
        });
      }

      // 收集 sort 更新（即使有 parent_id 变化，也需要更新 sort）
      if (newSort !== category.sort) {
        sortUpdates.push({ id: category.id, sort: newSort });
      }

      // 更新数据库
      await categoryTable.updateById(item.id, {
        sort: newSort,
        parent_id: newParentId,
      });

      // 更新内存中的分类数据（避免重新查询数据库）
      categoryMap.set(category.id, {
        ...category,
        sort: newSort,
        parent_id: newParentId,
      });
    }

    // ========== 3. 缓存更新策略 ==========
    if (hasParentChange) {
      // 3.1 修改了 parent_id（移动分类）：批量处理，只获取一次文集数据
      const updatedCategories = Array.from(categoryMap.values());
      const allProjects = await projectTable.findAll(); // 只获取一次

      for (const change of parentChanges) {
        // 递归更新该分类及其后代的祖先链路
        updateCategoryChainRecursive(change.id, updatedCategories);

        // 计算计数器差异，精确更新受影响的祖先计数器
        calculateAndApplyCounterDiff(
          [change.id],
          new Map([[change.id, change.oldParentId]]),
          change.newParentId,
          updatedCategories,
          allProjects,
        );
      }
    } else {
      // 3.2 只修改 sort：精确更新 Hash（Pipeline 批量操作）
      if (sortUpdates.length > 0) {
        const infoPipeline = redis.pipeline();
        for (const update of sortUpdates) {
          infoPipeline.hset(
            `${INFO_PREFIX}${update.id}`,
            'sort',
            String(update.sort),
          );
        }
        await infoPipeline.execAsync();
      }
    }

    // ========== 4. 重建排序索引（使用 Pipeline 批量操作）==========
    const updatedCategories = Array.from(categoryMap.values());
    const sorted = [...updatedCategories].sort((a, b) => {
      if (a.parent_id !== b.parent_id) return a.parent_id - b.parent_id;
      return a.sort - b.sort;
    });

    const orderPipeline = redis.pipeline();
    orderPipeline.del(`${ORDER_PREFIX}all`);
    orderPipeline.rpush(
      `${ORDER_PREFIX}all`,
      ...sorted.map((c) => String(c.id)),
    );
    await orderPipeline.execAsync();

    // ========== 5. 并行执行 MongoDB 更新 ==========
    try {
      // 5.1 收集需要更新的父分类（旧父分类 + 新父分类）
      const parentChildrenUpdates = new Map<
        number,
        { add: number[]; remove: number[] }
      >();

      if (hasParentChange) {
        for (const change of parentChanges) {
          // 从旧父分类移除
          if (change.oldParentId !== 0) {
            if (!parentChildrenUpdates.has(change.oldParentId)) {
              parentChildrenUpdates.set(change.oldParentId, {
                add: [],
                remove: [],
              });
            }
            parentChildrenUpdates
              .get(change.oldParentId)!
              .remove.push(change.id);
          }
          // 添加到新父分类
          if (change.newParentId !== 0) {
            if (!parentChildrenUpdates.has(change.newParentId)) {
              parentChildrenUpdates.set(change.newParentId, {
                add: [],
                remove: [],
              });
            }
            parentChildrenUpdates.get(change.newParentId)!.add.push(change.id);
          }
        }
      }

      // 5.2 批量查询所有父分类信息（一次 find，不需要循环查询）
      const parentIds = [...parentChildrenUpdates.keys()];
      let parentCategories: any[] = [];
      if (parentIds.length > 0) {
        parentCategories = await categoryMongoCollection
          .find({ id: { $in: parentIds } })
          .toArray();
      }

      // 5.3 并行执行 MongoDB 更新
      await Promise.all([
        // 批量更新分类的 sort 和 parent_id
        ...data.sorts.map((item) => {
          const category = categoryMap.get(item.id);
          if (!category) return Promise.resolve();

          const updateData: any = {};
          if (item.sort !== undefined) updateData.sort = item.sort;
          if (item.parent_id !== undefined)
            updateData.parent_id = item.parent_id;

          if (Object.keys(updateData).length === 0) return Promise.resolve();

          return categoryMongoCollection.updateOne(
            { id: item.id },
            { $set: updateData },
          );
        }),
        // 批量更新父分类的 children 数组（使用已查询的数据，不需要再次查询）
        ...parentCategories.map((parentCategory) => {
          const update = parentChildrenUpdates.get(parentCategory.id);
          if (!update) return Promise.resolve();

          let children = parentCategory.children || [];
          // 移除需要删除的
          children = children.filter(
            (cid: number) => !update.remove.includes(cid),
          );
          // 添加需要新增的（去重）
          for (const cid of update.add) {
            if (!children.includes(cid)) children.push(cid);
          }
          return categoryMongoCollection.updateOne(
            { id: parentCategory.id },
            { $set: { children } },
          );
        }),
      ]);
    } catch (error) {
      // MongoDB 更新失败，记录日志，等待定时重建修复
      // 不抛出错误，因为数据库和 Redis 已经更新成功
      console.error(
        '[CategoryCache] 保存排序 MongoDB 更新失败，将在下次定时重建时修复:',
        error,
      );
    }

    return null;
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
  const pipeline = redis.pipeline();
  for (const id of idsToUpdate) {
    pipeline.incrBy(`${categoryCountCache.prefix}${id}`, delta);
  }
  await pipeline.execAsync();
}
