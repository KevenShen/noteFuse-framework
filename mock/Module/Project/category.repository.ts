// mock/Module/Project/category.repository.ts
// 分类数据访问层（Repository 模式）
// 职责：封装数据库（MockTable）、MongoDB、Redis 缓存等存取细节
// 【设计原则】业务层只调用 Repository 接口，不直接操作存储层
// 【数据分层】L1 MockTable（主存储）→ L2 MongoDB（二级缓存）→ L3 Redis（三级缓存）

import { redis } from '../../Core/redis';
import type { MockProjectCategory } from '../../Entities/project';
import {
  categoryChainCache,
  categoryCountCache,
  categoryInfoCache,
  categoryMongoCollection,
  categoryOrderCache,
  categoryProjectsCache,
  categoryTable,
} from '../../Entities/project';
import type { CategoryWithStats } from './category.dto';

// ============================================================================
// 类型定义
// ============================================================================

/** 分类链路数据 */
export interface CategoryChainData {
  chain: number[];
  depth: number;
  ancestors: number[];
  children: number[];
}

/** 批量删除校验数据 */
export interface CategoryDeleteCheckData {
  /** Pipeline 原始返回结果（扁平数组：[chainHash0, count0, chainHash1, count1, ...]） */
  checkResults: any[];
  missIds: number[];
  mongoCountMap: Map<number, number> | null;
  mongoChildrenMap: Map<number, number[]> | null;
}

/** 创建分类缓存的参数（chain 和 parentChildren 含新分类 id 的部分由 create 内部计算） */
export interface CreateCategoryCacheOptions {
  insertAtBeginning: boolean;
  pivotId: number | null;
  depth: number;
  ancestors: number[];
  parentId: number;
  parentChildren: number[]; // 不含新分类 id，create 内部自动加入
}

/** 批量删除分类的缓存参数 */
export interface BatchDeleteCacheOptions {
  parentChildrenToRemove: Map<number, number[]>;
  parentChildrenMap: Map<number, number[]>;
}

// ============================================================================
// 分类数据访问类
// ============================================================================

class CategoryRepository {
  // ==================== 分类查询（三级降级：Redis → MongoDB → MockTable） ====================

  /**
   * 按 ID 查询分类（含统计字段，三级降级）
   * @param id 分类 ID
   * @returns 分类对象（含 project_count + project_ids，不存在时返回 null）
   */
  async findById(id: number): Promise<CategoryWithStats | null> {
    // L3：Redis Pipeline 批量获取详情 + 计数器 + 文集 ID
    try {
      const pipeline = redis.pipeline();
      pipeline.hgetAll(`${categoryInfoCache.prefix}${id}`);
      pipeline.get(`${categoryCountCache.prefix}${id}`);
      pipeline.smembers(`${categoryProjectsCache.prefix}${id}`);
      const results = await pipeline.execAsync();

      const hashData = results[0] as Record<string, string> | null;
      const countStr = results[1] as string | null;
      const projectIds = results[2] as string[];

      if (hashData && Object.keys(hashData).length > 0) {
        return {
          ...this.hashToCategory(hashData),
          project_count: Number(countStr || 0),
          project_ids: projectIds.map(Number),
        };
      }
    } catch {
      // Redis 失效，继续降级
    }

    // L2：MongoDB 查询
    try {
      const mongoCategory = await categoryMongoCollection.findOne({ id });
      if (mongoCategory) {
        return {
          ...mongoCategory,
          project_count: mongoCategory.project_count ?? 0,
          project_ids: mongoCategory.project_ids ?? [],
        };
      }
    } catch {
      // MongoDB 失效，继续降级
    }

    // L1：MockTable 兜底（使用 include 关联查询）
    const dbCategory = (await categoryTable.findById(id, {
      include: ['projects'],
    })) as any;
    if (!dbCategory) return null;
    return {
      ...dbCategory,
      project_count: (dbCategory.projects || []).length,
      project_ids: (dbCategory.projects || []).map((p: any) => p.id),
    };
  }

  /**
   * 批量查询分类（含统计字段，三级降级，已按 sort 排序）
   * @param ids 分类 ID 数组
   * @returns 分类对象数组（含 project_count + project_ids）
   */
  async findByIds(ids: number[]): Promise<CategoryWithStats[]> {
    if (ids.length === 0) return [];

    let redisAvailable = true;
    const cachedCategories: CategoryWithStats[] = [];
    const missIds: number[] = [];

    // L3：Redis Pipeline 批量获取
    try {
      const pipeline = redis.pipeline();
      for (const id of ids) {
        pipeline.hgetAll(`${categoryInfoCache.prefix}${id}`);
        pipeline.get(`${categoryCountCache.prefix}${id}`);
        pipeline.smembers(`${categoryProjectsCache.prefix}${id}`);
      }
      const results = await pipeline.execAsync();

      for (let i = 0; i < ids.length; i++) {
        const hashData = results[i * 3] as Record<string, string> | null;
        const countStr = results[i * 3 + 1] as string | null;
        const projectIds = results[i * 3 + 2] as string[];

        if (hashData && Object.keys(hashData).length > 0) {
          cachedCategories.push({
            ...this.hashToCategory(hashData),
            project_count: Number(countStr || 0),
            project_ids: projectIds.map(Number),
          });
        } else {
          missIds.push(ids[i]);
        }
      }
    } catch {
      redisAvailable = false;
    }

    // Redis 全部命中：直接返回缓存数据，无需降级
    if (redisAvailable && missIds.length === 0) {
      return cachedCategories.sort((a, b) => a.sort - b.sort);
    }

    // L2：MongoDB 查询（缓存击穿只查 missIds，Redis 完全失效则全量查）
    try {
      const query = redisAvailable ? { id: { $in: missIds } } : {};
      const mongoCategories = await categoryMongoCollection
        .find(query)
        .sort({ sort: 1 })
        .toArray();

      if (mongoCategories.length > 0) {
        const mongoResult = mongoCategories.map((cat) => ({
          ...cat,
          project_count: cat.project_count ?? 0,
          project_ids: cat.project_ids ?? [],
        }));

        // 合并缓存 + MongoDB（缓存优先）
        const resultMap = new Map<number, CategoryWithStats>(
          [...mongoResult, ...cachedCategories].map((c) => [c.id, c]),
        );
        return ids
          .map((id) => resultMap.get(id))
          .filter((c): c is CategoryWithStats => c !== undefined)
          .sort((a, b) => a.sort - b.sort);
      }
    } catch {
      // MongoDB 失效，继续降级
    }

    // L1：MockTable 兜底（使用 include 关联查询，按 ids 过滤）
    const dbCategories = (await categoryTable.find(
      { id: { $in: ids } },
      { include: ['projects'] },
    )) as any[];
    return dbCategories
      .map((c) => ({
        ...c,
        project_count: (c.projects || []).length,
        project_ids: (c.projects || []).map((p: any) => p.id),
      }))
      .sort((a, b) => a.sort - b.sort);
  }

  /**
   * 查询全部分类（含统计字段，三级降级 + 缓存击穿优化）
   * @returns 分类对象数组（含 project_count + project_ids，按排序索引顺序）
   */
  async findAll(): Promise<CategoryWithStats[]> {
    let redisAvailable = true;
    const cachedCategories: CategoryWithStats[] = [];
    const missIds: number[] = [];

    // L3：Redis 排序索引 + Pipeline 批量获取
    try {
      const orderedIds = await this.getOrderList();

      if (orderedIds.length > 0) {
        const pipeline = redis.pipeline();
        for (const id of orderedIds) {
          pipeline.hgetAll(`${categoryInfoCache.prefix}${id}`);
          pipeline.get(`${categoryCountCache.prefix}${id}`);
          pipeline.smembers(`${categoryProjectsCache.prefix}${id}`);
        }
        const results = await pipeline.execAsync();

        for (let i = 0; i < orderedIds.length; i++) {
          const hashData = results[i * 3] as Record<string, string> | null;
          const countStr = results[i * 3 + 1] as string | null;
          const projectIds = results[i * 3 + 2] as string[];

          if (hashData && Object.keys(hashData).length > 0) {
            cachedCategories.push({
              ...this.hashToCategory(hashData),
              project_count: Number(countStr || 0),
              project_ids: projectIds.map(Number),
            });
          } else {
            missIds.push(orderedIds[i]);
          }
        }
      } else {
        redisAvailable = false;
      }
    } catch {
      redisAvailable = false;
    }

    // Redis 全部命中：直接返回缓存数据（已按 orderedIds 顺序，即 parent_id + sort 有序）
    if (redisAvailable && missIds.length === 0) {
      return cachedCategories;
    }

    // L2：MongoDB 查询（缓存击穿只查 missIds，Redis 完全失效则全量查）
    try {
      const query = redisAvailable ? { id: { $in: missIds } } : {};
      const mongoCategories = await categoryMongoCollection
        .find(query)
        .sort({ parent_id: 1, sort: 1 })
        .toArray();

      if (mongoCategories.length > 0) {
        const mongoResult = mongoCategories.map((cat) => ({
          ...cat,
          project_count: cat.project_count ?? 0,
          project_ids: cat.project_ids ?? [],
        }));

        // 合并缓存 + MongoDB（缓存优先）
        const resultMap = new Map<number, CategoryWithStats>(
          [...mongoResult, ...cachedCategories].map((c) => [c.id, c]),
        );
        return Array.from(resultMap.values()).sort((a, b) => a.sort - b.sort);
      }
    } catch {
      // MongoDB 失效，继续降级
    }

    // L1：MockTable 兜底（使用 include 关联查询）
    const dbCategories = (await categoryTable.findAll({
      include: ['projects'],
    })) as any[];
    return dbCategories.map((c) => ({
      ...c,
      project_count: (c.projects || []).length,
      project_ids: (c.projects || []).map((p: any) => p.id),
    }));
  }

  // ==================== 分类写入（双写：MockTable + MongoDB） ====================

  /**
   * 创建分类（同时写入 L1 MockTable、L2 MongoDB，可选同步创建 L3 Redis 缓存）
   * @param data 分类数据
   * @param cacheOptions 缓存参数（提供则自动创建缓存，chain 和 parentChildren 内部自动计算）
   * @returns 创建后的分类对象
   */
  async create(
    data: Partial<MockProjectCategory>,
    cacheOptions?: CreateCategoryCacheOptions,
  ): Promise<MockProjectCategory> {
    const newCategory = await categoryTable.create(data);
    // MongoDB 显式写入统计字段（新分类无文集，project_count=0, project_ids=[]）
    await categoryMongoCollection.insertOne({
      ...newCategory,
      project_count: 0,
      project_ids: [],
    });

    // 同步创建缓存（如果提供了缓存参数）
    if (cacheOptions) {
      try {
        // 内部计算 chain 和 parentChildren（加入新分类 id）
        const chain = [...cacheOptions.ancestors, newCategory.id];
        const parentChildren = [...cacheOptions.parentChildren];
        if (
          cacheOptions.parentId !== 0 &&
          !parentChildren.includes(newCategory.id)
        ) {
          parentChildren.push(newCategory.id);
        }
        await this.createCategoryCache(newCategory, {
          ...cacheOptions,
          chain,
          parentChildren,
        });
      } catch (error) {
        // 缓存写入失败，记录日志，等待定时重建修复（不影响数据库已写入的结果）
        console.error(
          '[CategoryRepository] 创建分类缓存写入失败，将在下次定时重建时修复:',
          error,
        );
      }
    }

    return newCategory;
  }

  /**
   * 更新分类（同时更新 L1 MockTable 和 L2 MongoDB，可选同步更新 L3 Redis 缓存）
   * @param id 分类 ID
   * @param data 更新数据
   * @param updateCache 是否同步更新 Redis 缓存（默认 false）
   * @returns 更新后的分类对象
   */
  async update(
    id: number,
    data: Partial<MockProjectCategory>,
    updateCache = false,
  ): Promise<MockProjectCategory | null> {
    const [updatedCategory] = await Promise.all([
      categoryTable.updateById(id, data),
      categoryMongoCollection.updateOne({ id }, { $set: data }),
    ]);

    // 同步更新缓存（如果指定）
    if (updateCache && updatedCategory) {
      try {
        await this.updateInfoCache(id, data as Record<string, string | number>);
      } catch (error) {
        // 缓存更新失败，记录日志，等待定时重建修复（不影响数据库已写入的结果）
        console.error(
          '[CategoryRepository] 更新分类缓存失败，将在下次定时重建时修复:',
          error,
        );
      }
    }

    return updatedCategory ?? null;
  }

  /**
   * 删除分类（同时删除 L1 MockTable 和 L2 MongoDB）
   * @param id 分类 ID
   */
  async delete(id: number): Promise<void> {
    await Promise.all([
      categoryTable.deleteById(id),
      categoryMongoCollection.deleteOne({ id }),
    ]);
  }

  /**
   * 批量删除分类（同时删除 L1 MockTable 和 L2 MongoDB，可选同步删除 L3 Redis 缓存）
   * @param ids 分类 ID 数组
   * @param cacheOptions 缓存删除参数（提供则自动删除缓存，包括排序索引、详情、链路、计数器、父分类 children）
   */
  async batchDelete(
    ids: number[],
    cacheOptions?: BatchDeleteCacheOptions,
  ): Promise<void> {
    await Promise.all([
      categoryTable.deleteMany({ id: { $in: ids } }),
      categoryMongoCollection.deleteMany({ id: { $in: ids } }),
    ]);

    // 同步删除缓存（如果提供了缓存参数）
    if (cacheOptions) {
      try {
        await this.deleteCategoriesCache(
          ids,
          cacheOptions.parentChildrenToRemove,
          cacheOptions.parentChildrenMap,
        );
      } catch (error) {
        // 缓存删除失败，记录日志，等待定时重建修复（不影响数据库已删除的结果）
        console.error(
          '[CategoryRepository] 批量删除分类缓存失败，将在下次定时重建时修复:',
          error,
        );
      }
    }
  }

  /**
   * 批量更新 MongoDB（用于批量移动等场景）
   * @param operations bulkWrite 操作数组
   */
  async bulkWriteMongo(
    operations: Array<{
      type: 'update' | 'insert' | 'delete' | 'replace';
      filter?: any;
      update?: any;
      document?: any;
      replacement?: any;
      upsert?: boolean;
      multi?: boolean;
    }>,
  ): Promise<void> {
    // 项目 mock MongoDB 的 BulkOperation 原生即带 type 字段，直接透传无需转换
    await categoryMongoCollection.bulkWrite(operations);
  }

  /**
   * 批量更新 MockTable
   * @param updates 更新操作数组（where + data）
   */
  async bulkUpdateTable(
    updates: Array<{ where: Record<string, any>; data: Record<string, any> }>,
  ): Promise<void> {
    await categoryTable.bulkUpdate(updates);
  }

  // ==================== Redis 缓存操作 ====================

  /**
   * 创建分类时批量初始化缓存（Pipeline 单次网络往返）
   * 【覆盖】分类详情 + 排序索引 + 链路数据 + 计数器 + 父分类 children 更新
   *
   * @param category 新创建的分类数据
   * @param options 缓存构建选项
   */
  async createCategoryCache(
    category: MockProjectCategory,
    options: {
      insertAtBeginning: boolean;
      pivotId: number | null;
      chain: number[];
      depth: number;
      ancestors: number[];
      parentId: number;
      parentChildren: number[];
    },
  ): Promise<void> {
    const pipeline = redis.pipeline();

    // 分类详情（Hash）
    pipeline.hmset(`${categoryInfoCache.prefix}${category.id}`, {
      id: String(category.id),
      name: category.name,
      parent_id: String(category.parent_id),
      sort: String(category.sort),
      icon: category.icon || '',
      description: category.description || '',
      create_time: String(category.create_time),
    });

    // 排序索引（List）：lpush / linsert / rpush
    const orderKey = `${categoryOrderCache.prefix}all`;
    if (options.insertAtBeginning) {
      pipeline.lpush(orderKey, category.id);
    } else if (options.pivotId !== null) {
      pipeline.linsert(orderKey, 'AFTER', options.pivotId, category.id);
    } else {
      console.warn('[CategoryRepository] 未找到插入位置，使用 rpush 兜底');
      pipeline.rpush(orderKey, category.id);
    }

    // 链路数据（Hash）
    pipeline.hmset(`${categoryChainCache.prefix}${category.id}`, {
      chain: JSON.stringify(options.chain),
      depth: String(options.depth),
      ancestors: JSON.stringify(options.ancestors),
      children: '[]',
    });

    // 计数器（String）：新分类 project_count 为 0
    pipeline.set(`${categoryCountCache.prefix}${category.id}`, 0);

    // 更新父分类的 children
    if (options.parentId !== 0) {
      pipeline.hset(
        `${categoryChainCache.prefix}${options.parentId}`,
        'children',
        JSON.stringify(options.parentChildren),
      );
    }

    await pipeline.execAsync();
  }

  /**
   * 批量删除分类缓存（Pipeline 单次网络往返）
   * 【覆盖】排序索引移除 + 详情/计数器/链路/文集集合删除 + 父分类 children 更新
   *
   * @param ids 待删除的分类 ID 列表
   * @param parentChildrenToRemove 父分类 → 需要移除的子分类 ID 列表
   * @param parentChildrenMap 父分类 → 当前 children 列表（用于过滤后写回）
   */
  async deleteCategoriesCache(
    ids: number[],
    parentChildrenToRemove: Map<number, number[]>,
    parentChildrenMap: Map<number, number[]>,
  ): Promise<void> {
    const pipeline = redis.pipeline();

    // 从排序索引中删除
    ids.forEach((id) =>
      pipeline.lrem(`${categoryOrderCache.prefix}all`, 0, id),
    );

    // 删除详情/计数器/祖先链路/文集列表
    ids.forEach((id) => {
      pipeline.del(`${categoryInfoCache.prefix}${id}`);
      pipeline.del(`${categoryChainCache.prefix}${id}`);
      pipeline.del(`${categoryCountCache.prefix}${id}`);
      pipeline.del(`${categoryProjectsCache.prefix}${id}`);
    });

    // 更新父分类的 children
    for (const [parentId, childIdsToRemove] of parentChildrenToRemove) {
      const currentChildren = parentChildrenMap.get(parentId) || [];
      const updatedChildren = currentChildren.filter(
        (cid) => !childIdsToRemove.includes(cid),
      );
      pipeline.hset(
        `${categoryChainCache.prefix}${parentId}`,
        'children',
        JSON.stringify(updatedChildren),
      );
    }

    await pipeline.execAsync();
  }

  /**
   * 保存分类排序的缓存更新（Pipeline + 排序索引重排）
   * 【覆盖】info hash sort 更新 + order:all 删除旧位置 + 按新顺序重新插入
   *
   * @param sorts 要更新的分类排序（id + sort）
   * @param siblingIds 同级分类 ID 列表（用于从排序索引中删除）
   * @param sortedSiblingIds 按 sort 升序排列的同级分类 ID 列表（用于重新插入）
   * @param parentId 父分类 ID（用于定位插入位置）
   */
  async updateSortCache(
    sorts: Array<{ id: number; sort: number }>,
    siblingIds: number[],
    sortedSiblingIds: number[],
    parentId: number,
  ): Promise<void> {
    // ========== 第一步：更新 info hash sort + 从 order:all 删除同级分类 ==========
    const writePipeline = redis.pipeline();
    sorts.forEach((item) => {
      writePipeline.hset(
        `${categoryInfoCache.prefix}${item.id}`,
        'sort',
        String(item.sort),
      );
    });
    siblingIds.forEach((sid) =>
      writePipeline.lrem(`${categoryOrderCache.prefix}all`, 0, sid),
    );
    await writePipeline.execAsync();

    // ========== 第二步：定位插入位置（第一个 parent_id > parentId 的分类之前）==========
    const orderedIds = await this.getOrderList();
    let insertIndex = orderedIds.length;
    if (orderedIds.length > 0) {
      const parentIds = await this.getParentIdsByIds(orderedIds);
      for (let i = 0; i < orderedIds.length; i++) {
        if ((parentIds[i] ?? 0) > parentId) {
          insertIndex = i;
          break;
        }
      }
    }

    // ========== 第三步：按新顺序重新插入 ==========
    const insertPipeline = redis.pipeline();
    if (insertIndex === 0) {
      // 插入到最前面（reverse 保证顺序正确）
      [...sortedSiblingIds]
        .reverse()
        .forEach((id) =>
          insertPipeline.lpush(`${categoryOrderCache.prefix}all`, id),
        );
    } else {
      // 链式插入到 pivot 之后
      let pivotId = orderedIds[insertIndex - 1];
      sortedSiblingIds.forEach((id) => {
        insertPipeline.linsert(
          `${categoryOrderCache.prefix}all`,
          'AFTER',
          pivotId,
          id,
        );
        pivotId = id;
      });
    }
    await insertPipeline.execAsync();
  }

  /**
   * 批量移动分类在排序索引中的位置（用于 batchMoveCategories）
   * 【执行流程】
   * 1. 从排序索引中删除被移动分类
   * 2. 更新 Hash 中的 parent_id 和 sort（两个字段）
   * 3. 找到插入位置（第一个 parent_id > targetId 的分类之前）
   * 4. 按 sort 顺序精确插入
   *
   * 【与 updateSortCache 的区别】
   * - updateSortCache：同级拖动排序，只更新 sort，不更新 parent_id
   * - moveCategoriesInOrderList：跨级移动，同时更新 parent_id 和 sort
   *
   * @param ids 被移动的分类 ID 列表
   * @param targetId 目标父分类 ID
   * @param newSortMap 新 sort 值映射（id → sort）
   * @param sortedMovingIds 按 sort 排序后的被移动分类 ID 列表
   */
  async moveCategoriesInOrderList(
    ids: number[],
    targetId: number,
    newSortMap: Map<number, number>,
    sortedMovingIds: number[],
  ): Promise<void> {
    // ========== 第一步：删除排序索引 + 更新 Hash（parent_id + sort）==========
    const updatePipeline = redis.pipeline();
    ids.forEach((id) =>
      updatePipeline.lrem(`${categoryOrderCache.prefix}all`, 0, id),
    );
    ids.forEach((id) => {
      updatePipeline.hset(
        `${categoryInfoCache.prefix}${id}`,
        'parent_id',
        String(targetId),
      );
      updatePipeline.hset(
        `${categoryInfoCache.prefix}${id}`,
        'sort',
        String(newSortMap.get(id)),
      );
    });
    await updatePipeline.execAsync();

    // ========== 第二步：定位插入位置（第一个 parent_id > targetId 的分类之前）==========
    const orderedIds = await this.getOrderList();
    let insertIndex = orderedIds.length; // 默认插入到末尾
    if (orderedIds.length > 0) {
      const parentIds = await this.getParentIdsByIds(orderedIds);
      for (let i = 0; i < orderedIds.length; i++) {
        if ((parentIds[i] ?? 0) > targetId) {
          insertIndex = i;
          break;
        }
      }
    }

    // ========== 第三步：按 sort 顺序精确插入 ==========
    const insertPipeline = redis.pipeline();
    if (orderedIds.length === 0) {
      // List 为空，直接按 sort 顺序追加
      sortedMovingIds.forEach((id) =>
        insertPipeline.rpush(`${categoryOrderCache.prefix}all`, id),
      );
    } else if (insertIndex === 0) {
      // 插入到最前面（reverse 保证顺序正确）
      [...sortedMovingIds]
        .reverse()
        .forEach((id) =>
          insertPipeline.lpush(`${categoryOrderCache.prefix}all`, id),
        );
    } else {
      // 插入到 insertIndex-1 之后，逐个链式插入保持顺序
      let pivotId = orderedIds[insertIndex - 1];
      sortedMovingIds.forEach((id) => {
        insertPipeline.linsert(
          `${categoryOrderCache.prefix}all`,
          'AFTER',
          pivotId,
          id,
        );
        pivotId = id;
      });
    }
    await insertPipeline.execAsync();
  }

  /**
   * 部分更新分类详情缓存（只更新指定字段）
   * 【用途】updateCategory 等场景只需更新 name/icon/description 等部分字段
   *
   * @param id 分类 ID
   * @param updateData 要更新的字段（值会自动转为字符串）
   */
  async updateInfoCache(
    id: number,
    updateData: Record<string, string | number>,
  ): Promise<void> {
    const stringData: Record<string, string> = {};
    for (const [key, value] of Object.entries(updateData)) {
      stringData[key] = String(value);
    }
    await categoryInfoCache.hset(String(id), stringData);
  }

  // ==================== 链路数据操作 ====================

  /**
   * 批量设置分类链路数据（Pipeline 批量写入）
   * @param data Array<{ id, chainData }>
   */
  async batchSetChainCache(
    data: Array<{ id: number; chainData: CategoryChainData }>,
  ): Promise<void> {
    if (data.length === 0) return;
    const pipeline = redis.pipeline();
    for (const { id, chainData } of data) {
      pipeline.hmset(`${categoryChainCache.prefix}${id}`, {
        chain: JSON.stringify(chainData.chain),
        depth: String(chainData.depth),
        ancestors: JSON.stringify(chainData.ancestors),
        children: JSON.stringify(chainData.children),
      });
    }
    await pipeline.execAsync();
  }

  /**
   * 获取单个分类链路数据（三级降级）
   * 【返回字段】chain / depth / ancestors / children
   * 【使用场景】需要完整链路数据的场景（循环检测、深度计算等）
   *
   * @param categoryId 分类 ID
   * @returns 链路数据（分类不存在时返回 null）
   */
  async findChainById(categoryId: number): Promise<CategoryChainData | null> {
    // ========== L3：优先从 Redis 缓存获取 ==========
    try {
      const chainHash = await categoryChainCache.hgetAll(String(categoryId));
      if (chainHash?.chain) {
        return {
          chain: JSON.parse(chainHash.chain),
          depth: Number(chainHash.depth || 0),
          ancestors: JSON.parse(chainHash.ancestors || '[]'),
          children: JSON.parse(chainHash.children || '[]'),
        };
      }
    } catch (error) {
      console.warn(
        '[CategoryRepository] 链路 Redis 读取失败，降级计算:',
        error,
      );
    }

    // ========== L2/L1：按需获取相关分类，内存计算链路 ==========
    let currentCategory: MockProjectCategory | null = null;
    let childCategories: MockProjectCategory[] = [];
    let ancestorCategories: MockProjectCategory[] = [];

    try {
      // L2：MongoDB 一次查询获取当前分类 + 子分类（or 条件）
      const mongoResults = await this.findFromMongo({
        $or: [{ id: categoryId }, { parent_id: categoryId }],
      });
      currentCategory = mongoResults.find((c) => c.id === categoryId) ?? null;
      childCategories = mongoResults.filter((c) => c.parent_id === categoryId);

      if (!currentCategory) return null;

      // 获取祖先（最多三级：父 + 祖父）
      if (currentCategory.parent_id !== 0) {
        const parent = await this.findOneFromMongo({
          id: currentCategory.parent_id,
        });
        if (parent) {
          ancestorCategories.unshift(parent);
          if (parent.parent_id !== 0) {
            const grandparent = await this.findOneFromMongo({
              id: parent.parent_id,
            });
            if (grandparent) ancestorCategories.unshift(grandparent);
          }
        }
      }
    } catch {
      // L1：MockTable 兜底（按需查询，与 MongoDB 一致）
      try {
        const tableResults = await this.findFromTable({
          $or: [{ id: categoryId }, { parent_id: categoryId }],
        });
        const current = tableResults.find((c) => c.id === categoryId);
        if (!current) return null;
        const tableChildren = tableResults.filter(
          (c) => c.parent_id === categoryId,
        );

        // 获取祖先（最多三级：父 + 祖父）
        const ancestors: number[] = [];
        if (current.parent_id !== 0) {
          const parent = await this.findByIdFromTable(current.parent_id);
          if (parent) {
            ancestors.unshift(parent.id);
            if (parent.parent_id !== 0) {
              const grandparent = await this.findByIdFromTable(
                parent.parent_id,
              );
              if (grandparent) ancestors.unshift(grandparent.id);
            }
          }
        }

        const children = (tableChildren ?? []).map((c) => c.id);
        const result: CategoryChainData = {
          chain: [...ancestors, categoryId],
          depth: ancestors.length,
          ancestors,
          children,
        };

        // 缓存回写
        try {
          categoryChainCache.hmset(String(categoryId), {
            chain: JSON.stringify(result.chain),
            depth: String(result.depth),
            ancestors: JSON.stringify(result.ancestors),
            children: JSON.stringify(result.children),
          });
        } catch (e) {
          console.warn('[CategoryRepository] 链路缓存回写失败:', e);
        }

        return result;
      } catch {
        return null;
      }
    }

    // 内存计算：祖先链路
    const ancestors = ancestorCategories.map((c) => c.id);
    // 内存计算：直接子节点
    const children = childCategories.map((c) => c.id);

    const result: CategoryChainData = {
      chain: [...ancestors, categoryId],
      depth: ancestors.length,
      ancestors,
      children,
    };

    // 缓存回写：防止下次再次击穿
    try {
      categoryChainCache.hmset(String(categoryId), {
        chain: JSON.stringify(result.chain),
        depth: String(result.depth),
        ancestors: JSON.stringify(result.ancestors),
        children: JSON.stringify(result.children),
      });
    } catch (error) {
      console.warn('[CategoryRepository] 链路缓存回写失败:', error);
    }

    return result;
  }

  /**
   * 批量获取分类链路数据（三级降级：Redis → MongoDB → MockTable）
   * 【优化】
   * - L3：Redis Pipeline 批量 hgetAll，1 次网络往返获取所有分类的链路数据
   * - L2/L1：批量查询未命中分类及其子分类 + 祖先，内存计算链路（避免循环查询）
   *
   * @param categoryIds 分类 ID 列表
   * @returns 分类 ID -> 链路数据 的 Map（不存在的分类不包含在 Map 中）
   */
  async findChainsByIds(
    categoryIds: number[],
  ): Promise<Map<number, CategoryChainData>> {
    const result = new Map<number, CategoryChainData>();
    const missIds: number[] = [];

    // ========== L3：Redis Pipeline 批量获取 ==========
    try {
      const chainPipeline = redis.pipeline();
      categoryIds.forEach((id) =>
        chainPipeline.hgetAll(`${categoryChainCache.prefix}${id}`),
      );
      const chainResults = await chainPipeline.execAsync();

      categoryIds.forEach((id, i) => {
        const chainHash = chainResults[i] as Record<string, string> | null;
        if (chainHash?.chain) {
          result.set(id, {
            chain: JSON.parse(chainHash.chain),
            depth: Number(chainHash.depth || 0),
            ancestors: JSON.parse(chainHash.ancestors || '[]'),
            children: JSON.parse(chainHash.children || '[]'),
          });
        } else {
          missIds.push(id);
        }
      });
    } catch (error) {
      console.warn(
        '[CategoryRepository] 批量链路 Redis 读取失败，全部降级:',
        error,
      );
      missIds.push(...categoryIds);
    }

    if (missIds.length === 0) return result;

    // ========== L2/L1：批量查询 + 内存计算链路（避免循环查询）==========
    let allCategories: MockProjectCategory[] = [];
    try {
      // L2：MongoDB 批量查询
      allCategories = await this.findFromMongo({
        $or: [{ id: { $in: missIds } }, { parent_id: { $in: missIds } }],
      });
    } catch {
      // L1：MockTable 兜底
      allCategories = await this.findFromTable({
        $or: [{ id: { $in: missIds } }, { parent_id: { $in: missIds } }],
      });
    }

    // 收集需要查询的祖先 ID（未命中分类的 parent_id，最多三级：父 + 祖父）
    const ancestorIds = new Set<number>();
    for (const cat of allCategories) {
      if (missIds.includes(cat.id) && cat.parent_id !== 0) {
        ancestorIds.add(cat.parent_id);
      }
    }
    // 再收集祖父 ID
    if (ancestorIds.size > 0) {
      let ancestors: MockProjectCategory[] = [];
      try {
        ancestors = await this.findFromMongo({
          id: { $in: [...ancestorIds] },
        });
      } catch {
        ancestors = await this.findFromTable({
          id: { $in: [...ancestorIds] },
        });
      }
      for (const cat of ancestors) {
        if (cat.parent_id !== 0) ancestorIds.add(cat.parent_id);
      }
      allCategories.push(...ancestors);
      // 查询祖父
      const grandparentIds = [...ancestorIds].filter(
        (id) => !allCategories.some((c) => c.id === id),
      );
      if (grandparentIds.length > 0) {
        let grandparents: MockProjectCategory[] = [];
        try {
          grandparents = await this.findFromMongo({
            id: { $in: grandparentIds },
          });
        } catch {
          grandparents = await this.findFromTable({
            id: { $in: grandparentIds },
          });
        }
        allCategories.push(...grandparents);
      }
    }

    // 内存计算每个未命中分类的链路
    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
    const rewriteData: Array<{ id: number; chainData: CategoryChainData }> = [];
    for (const id of missIds) {
      const cat = categoryMap.get(id);
      if (!cat) continue;

      // 计算祖先链路（最多两级：父 + 祖父）
      const ancestors: number[] = [];
      let parentId = cat.parent_id;
      while (parentId !== 0) {
        const parent = categoryMap.get(parentId);
        if (!parent) break;
        ancestors.unshift(parent.id);
        parentId = parent.parent_id;
      }

      // 计算直接子节点
      const children = allCategories
        .filter((c) => c.parent_id === id)
        .map((c) => c.id);

      const chainData: CategoryChainData = {
        chain: [...ancestors, id],
        depth: ancestors.length,
        ancestors,
        children,
      };
      result.set(id, chainData);
      rewriteData.push({ id, chainData });
    }

    // 批量缓存回写（Pipeline，1 次网络往返）
    if (rewriteData.length > 0) {
      try {
        const rewritePipeline = redis.pipeline();
        for (const { id, chainData } of rewriteData) {
          rewritePipeline.hmset(`${categoryChainCache.prefix}${id}`, {
            chain: JSON.stringify(chainData.chain),
            depth: String(chainData.depth),
            ancestors: JSON.stringify(chainData.ancestors),
            children: JSON.stringify(chainData.children),
          });
        }
        await rewritePipeline.execAsync();
      } catch (e) {
        console.warn('[CategoryRepository] 批量链路缓存回写失败:', e);
      }
    }

    return result;
  }

  // ==================== 排序索引操作 ====================
  /**
   * 批量删除前的校验数据获取（三级降级：Redis → MongoDB → MockTable）
   * 【功能】
   * 1. Pipeline 批量获取 chain（children+ancestors）和 count
   * 2. 检测缓存未命中的 ID，降级到 MongoDB 查询
   * 3. MongoDB 失效时降级到 MockTable（联结 projectTable 计算 project_count）
   * 4. 构建 countMap 和 childrenMap 用于校验
   *
   * @param ids 待删除的分类 ID 列表
   * @returns 校验数据（checkResults + missIds + mongoCountMap + mongoChildrenMap）
   */
  async getDeleteCheckData(ids: number[]): Promise<CategoryDeleteCheckData> {
    // ========== L3：Redis Pipeline 批量获取 chain + count ==========
    let checkResults: CategoryDeleteCheckData['checkResults'] = [];
    let redisAvailable = true;
    const missIds: number[] = [];

    try {
      const checkPipeline = redis.pipeline();
      ids.forEach((id) => {
        checkPipeline.hgetAll(`${categoryChainCache.prefix}${id}`);
        checkPipeline.get(`${categoryCountCache.prefix}${id}`);
      });
      checkResults = await checkPipeline.execAsync();

      // 收集缓存未命中的 ID（在 try 块内，与 findAll 风格一致）
      for (let i = 0; i < ids.length; i++) {
        const chainHash = checkResults[i * 2] as Record<string, string> | null;
        const countStr = checkResults[i * 2 + 1] as string | null;
        if (
          !chainHash ||
          Object.keys(chainHash).length === 0 ||
          countStr === null
        ) {
          missIds.push(ids[i]);
        }
      }
    } catch (error) {
      redisAvailable = false;
      missIds.push(...ids); // Redis 失败时全部视为未命中
      console.warn(
        '[CategoryRepository] getDeleteCheckData Redis 失败，降级到 MongoDB:',
        error,
      );
    }

    let mongoCountMap: Map<number, number> | null = null;
    let mongoChildrenMap: Map<number, number[]> | null = null;

    if (missIds.length > 0) {
      // ========== L2：降级到 MongoDB 查询 ==========
      // 击穿时只查 missIds；Redis 失效时全量查
      const query = redisAvailable
        ? { $or: [{ id: { $in: missIds } }, { parent_id: { $in: missIds } }] }
        : {};
      try {
        const mongoCategories = await categoryMongoCollection
          .find(query)
          .project({ id: 1, parent_id: 1, project_count: 1 })
          .toArray();
        if (mongoCategories && mongoCategories.length > 0) {
          mongoCountMap = new Map();
          mongoChildrenMap = new Map();
          for (const cat of mongoCategories) {
            if (redisAvailable) {
              // 击穿场景：只收集 missIds 相关数据
              if (missIds.includes(cat.id)) {
                mongoCountMap.set(cat.id, cat.project_count ?? 0);
              }
              if (missIds.includes(cat.parent_id)) {
                const children = mongoChildrenMap.get(cat.parent_id) ?? [];
                children.push(cat.id);
                mongoChildrenMap.set(cat.parent_id, children);
              }
            } else {
              // Redis 失效场景：全量收集
              mongoCountMap.set(cat.id, cat.project_count ?? 0);
              if (cat.parent_id !== 0) {
                const children = mongoChildrenMap.get(cat.parent_id) ?? [];
                children.push(cat.id);
                mongoChildrenMap.set(cat.parent_id, children);
              }
            }
          }
        }
      } catch (error) {
        console.warn(
          '[CategoryRepository] getDeleteCheckData MongoDB 失败，降级到 MockTable:',
          error,
        );
      }

      // ========== L1：MongoDB 失效或为空时，降级到 MockTable（全量查询）==========
      if (!mongoCountMap || !mongoChildrenMap) {
        const dbCategories = (await categoryTable.findAll({
          include: ['projects'],
        })) as any[];
        mongoCountMap = new Map();
        mongoChildrenMap = new Map();
        for (const cat of dbCategories ?? []) {
          mongoCountMap.set(cat.id, (cat.projects || []).length);
          if (cat.parent_id !== 0) {
            const children = mongoChildrenMap.get(cat.parent_id) ?? [];
            children.push(cat.id);
            mongoChildrenMap.set(cat.parent_id, children);
          }
        }
      }
    }

    return { checkResults, missIds, mongoCountMap, mongoChildrenMap };
  }
  /**
   * 获取全部分类排序索引
   * @returns 分类 ID 数组（按排序顺序）
   */
  async getOrderList(): Promise<number[]> {
    return (await categoryOrderCache.lrange('all', 0, -1)) as number[];
  }

  /**
   * 批量获取分类的 parent_id（Pipeline 单次网络往返）
   * 【用途】排序索引插入位置计算等只需 parent_id 字段的场景
   *
   * @param ids 分类 ID 列表
   * @returns parent_id 数组（与 ids 顺序一致，未命中为 null）
   */
  async getParentIdsByIds(ids: number[]): Promise<(number | null)[]> {
    if (ids.length === 0) return [];
    const pipeline = redis.pipeline();
    for (const id of ids) {
      pipeline.hget(`${categoryInfoCache.prefix}${id}`, 'parent_id');
    }
    const results = await pipeline.execAsync();
    return results.map((val) => (val !== null ? Number(val) : null));
  }

  /**
   * 批量获取分类的 sort 字段（Pipeline 单次网络往返）
   * 【用途】saveCategorySort 等需要批量读取 sort 值的场景
   *
   * @param ids 分类 ID 列表
   * @returns 分类 ID → sort 值的 Map（未命中默认为 0）
   */
  async getSortsByIds(ids: number[]): Promise<Map<number, number>> {
    const sortMap = new Map<number, number>();
    if (ids.length === 0) return sortMap;
    const pipeline = redis.pipeline();
    for (const id of ids) {
      pipeline.hget(`${categoryInfoCache.prefix}${id}`, 'sort');
    }
    const results = await pipeline.execAsync();
    ids.forEach((id, i) => {
      sortMap.set(id, Number(results[i]) || 0);
    });
    return sortMap;
  }

  /**
   * 批量获取分类的 project_count 计数器（Pipeline 单次网络往返）
   * 【用途】batchMoveCategories 等需要批量读取计数器的场景
   *
   * @param ids 分类 ID 列表
   * @returns 分类 ID → project_count 的 Map（未命中默认为 0）
   */
  async getCountsByIds(ids: number[]): Promise<Map<number, number>> {
    const countMap = new Map<number, number>();
    if (ids.length === 0) return countMap;
    const pipeline = redis.pipeline();
    for (const id of ids) {
      pipeline.get(`${categoryCountCache.prefix}${id}`);
    }
    const results = await pipeline.execAsync();
    ids.forEach((id, i) => {
      countMap.set(id, Number(results[i]) || 0);
    });
    return countMap;
  }

  /**
   * 批量设置分类的 project_count 计数器（Pipeline 单次网络往返）
   * 【用途】batchMoveCategories 等需要批量更新计数器的场景
   *
   * @param data 数组，每项包含 id 和 count
   */
  async batchSetCountCache(
    data: Array<{ id: number; count: number }>,
  ): Promise<void> {
    if (data.length === 0) return;
    const pipeline = redis.pipeline();
    for (const { id, count } of data) {
      pipeline.set(`${categoryCountCache.prefix}${id}`, String(count));
    }
    await pipeline.execAsync();
  }

  /**
   * 批量增减分类的 project_count 计数器（使用 incrby 原子操作，无需先读取当前值）
   * 【用途】batchMoveCategories 等需要精确增减计数器的场景
   * 【优势】相比"先读再写"减少一次 IO，且 incrby 是原子操作，并发安全
   *
   * @param data 数组，每项包含 id 和 delta（正数增加，负数减少）
   */
  async batchIncrCountCache(
    data: Array<{ id: number; delta: number }>,
  ): Promise<void> {
    if (data.length === 0) return;
    const pipeline = redis.pipeline();
    for (const { id, delta } of data) {
      if (delta !== 0) {
        pipeline.incrBy(`${categoryCountCache.prefix}${id}`, delta);
      }
    }
    await pipeline.execAsync();
  }

  /**
   * 获取同级分类 ID 列表（排除指定分类）
   * 【多级降级】
   * - 非顶级 L3：调用 findChainById 获取 children（复用三级降级）
   * - 顶级 L3：Redis order:all 筛选 parent_id = 0
   * - L2：MongoDB find({parent_id})
   * - L1：MockTable find({parent_id})
   *
   * @param parentId 父分类 ID（0 表示顶级）
   * @param excludeId 需要排除的分类 ID（传 -1 表示不排除）
   * @returns 同级分类 ID 数组
   */
  async findSiblingIds(parentId: number, excludeId: number): Promise<number[]> {
    // ========== L3：优先从 Redis 缓存获取 ==========
    try {
      if (parentId !== 0) {
        // 非顶级：调用 findChainById 获取 children（复用三级降级）
        const parentChain = await this.findChainById(parentId);
        if (parentChain?.children && parentChain.children.length > 0) {
          return parentChain.children.filter((cid) => cid !== excludeId);
        }
        // children 为空或获取失败，继续降级到 L2/L1
      } else {
        // 顶级：从 order:all List 中筛选 parent_id = 0
        const orderedIds = await this.getOrderList();
        if (orderedIds.length > 0) {
          const parentIds = await this.getParentIdsByIds(orderedIds);
          return orderedIds.filter(
            (oid, i) => parentIds[i] === 0 && oid !== excludeId,
          );
        }
      }
    } catch (error) {
      console.warn(
        '[CategoryRepository] findSiblingIds Redis 读取失败，降级:',
        error,
      );
    }

    // ========== L2：降级到 MongoDB（统一用 parentId 参数）==========
    try {
      const mongoCategories = await this.findFromMongo(
        { parent_id: parentId },
        undefined,
        { id: 1 },
      );
      if (mongoCategories && mongoCategories.length > 0) {
        return mongoCategories
          .map((cat) => cat.id)
          .filter((id) => id !== excludeId);
      }
    } catch (error) {
      console.warn(
        '[CategoryRepository] findSiblingIds MongoDB 读取失败，降级到数据库:',
        error,
      );
    }

    // ========== L1：最后降级到 MockTable（统一用 parentId 参数）==========
    const dbCategories = await this.findFromTable({ parent_id: parentId });
    return (dbCategories ?? [])
      .map((cat) => cat.id)
      .filter((id) => id !== excludeId);
  }

  // ==================== MongoDB 直接操作 ====================

  /**
   * 从 MongoDB 查询分类
   * @param query 查询条件
   * @param sort 排序条件
   * @param project 投影字段
   * @returns 分类数组
   */
  async findFromMongo(query: any, sort?: any, project?: any): Promise<any[]> {
    let cursor = categoryMongoCollection.find(query);
    if (sort) cursor = cursor.sort(sort);
    if (project) cursor = cursor.project(project);
    return cursor.toArray();
  }

  // ==================== MockTable 直接操作 ====================

  /**
   * 从 MockTable 查询全部分类
   * @param options 查询选项（支持 include）
   * @returns 分类数组
   */
  async findAllFromTable(options?: any): Promise<any[]> {
    return categoryTable.findAll(options);
  }

  /**
   * 从 MockTable 条件查询分类
   * @param condition 查询条件
   * @param options 查询选项（支持 include）
   * @returns 分类数组
   */
  async findFromTable(condition: any, options?: any): Promise<any[]> {
    return categoryTable.find(condition, options);
  }

  /**
   * 从 MockTable 按 ID 查询分类
   * @param id 分类 ID
   * @param options 查询选项（支持 include）
   * @returns 分类对象（不存在时返回 undefined）
   */
  async findByIdFromTable(id: number, options?: any): Promise<any> {
    return categoryTable.findById(id, options);
  }

  // ==================== 工具函数 ====================

  /**
   * Hash → 分类对象转换
   * @param hashData Redis Hash 数据
   * @returns MockProjectCategory 对象
   */
  private hashToCategory(
    hashData: Record<string, string>,
  ): MockProjectCategory {
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
}

// ============================================================================
// 导出 Repository 实例
// ============================================================================
export const categoryRepository = new CategoryRepository();
