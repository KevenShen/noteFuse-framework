// mock/Module/Project/project.repository.ts
// 文集数据访问层（Repository）
// 职责：封装数据库（MockTable）、MongoDB、Redis 缓存等存取细节，提供统一接口
// 与 category.repository.ts 保持一致的架构风格

import { redis } from '../../Core/redis';
import type { MockProject, MongoProject } from '../../Entities/project';
import {
  categoryChainCache,
  categoryMongoCollection,
  categoryOrderCache,
  categoryProjectsCache,
  projectListCache,
  projectMongoCollection,
  projectStatsCache,
  projectTable,
} from '../../Entities/project';

// ============================================================================
// 类型定义
// ============================================================================

/** 文集详情（含统计字段） */
export type ProjectWithStats = MongoProject;

/** 列表缓存 key 组成 */
export interface ListCacheKey {
  categoryId: number;
  filter: string;
  sort: string;
  userId?: number;
}

// ============================================================================
// 序列化辅助函数
// ============================================================================

/**
 * Hash 数据反序列化为文集对象
 * 【作用】将 Redis Hash 存储的字符串字段转换成 MockProject 对象
 */
function parseProject(hash: Record<string, string>): MockProject {
  return {
    id: Number(hash.id),
    name: hash.name,
    intro: hash.intro || '',
    icon: hash.icon || 'FolderOutlined',
    color: hash.color || '#1890ff',
    project_category_id: Number(hash.project_category_id),
    create_user_id: Number(hash.create_user_id),
    role: Number(hash.role),
    is_collaborator: hash.is_collaborator === '1',
    is_top: hash.is_top === '1',
    sort: Number(hash.sort),
    create_time: Number(hash.create_time),
    modify_time: Number(hash.modify_time),
  };
}

/**
 * 文集对象序列化为 Hash 数据
 */
function serializeProject(project: MockProject): Record<string, string> {
  return {
    id: String(project.id),
    name: project.name,
    intro: project.intro,
    icon: project.icon,
    color: project.color,
    project_category_id: String(project.project_category_id),
    create_user_id: String(project.create_user_id),
    role: String(project.role),
    is_collaborator: project.is_collaborator ? '1' : '0',
    is_top: project.is_top ? '1' : '0',
    sort: String(project.sort),
    create_time: String(project.create_time),
    modify_time: String(project.modify_time),
  };
}

// ============================================================================
// 文集数据访问类
// ============================================================================

class ProjectRepository {
  // ==================== 基础查询（三级降级） ====================

  /**
   * 根据 ID 获取文集详情（三级降级：Redis → MongoDB → MockTable）
   * 【返回】基础字段（不含 doc_count/doc_category_count 统计字段）
   * 【用途】update/delete 等只需要基础字段的场景
   *
   * @param id 文集 ID
   * @returns 文集对象，不存在时返回 null
   */
  async findById(id: number): Promise<MockProject | null> {
    // L3：Redis 详情缓存
    try {
      const cacheData = await redis.hgetAll(`project:info:${id}`);
      if (cacheData && Object.keys(cacheData).length > 0) {
        return parseProject(cacheData);
      }
    } catch (error) {
      console.warn(
        '[ProjectRepository] Redis 获取失败，降级到 MongoDB:',
        error,
      );
    }

    // L2：MongoDB（命中后回写 Redis 缓存，TTL 5 分钟）
    try {
      const mongoProject = await projectMongoCollection.findOne({ id });
      if (mongoProject) {
        const writePipeline = redis.pipeline();
        writePipeline.hmset(
          `project:info:${id}`,
          serializeProject(mongoProject),
        );
        writePipeline.expire(`project:info:${id}`, 300);
        await writePipeline.execAsync();
        return mongoProject;
      }
    } catch (error) {
      console.warn(
        '[ProjectRepository] MongoDB 获取失败，降级到数据库:',
        error,
      );
    }

    // L1：MockTable（兜底）
    return (await projectTable.findById(id)) ?? null;
  }

  /**
   * 批量获取文集详情（Redis + MongoDB 分层 + 统计字段合并）
   * 【流程】
   * 1. 批量从 Redis 详情缓存获取（Pipeline）
   * 2. 未命中的从 MongoDB 查询并回写缓存
   * 3. 批量从 projectStatsCache 获取统计字段
   * 4. 合并统计字段，按输入顺序返回
   *
   * @param projectIds 文集 ID 列表
   * @returns 文集详情列表（保持输入顺序，含统计字段）
   */
  async findByIds(projectIds: number[]): Promise<ProjectWithStats[]> {
    if (projectIds.length === 0) return [];

    const projects: Map<number, MockProject> = new Map();
    const missingIds: number[] = [];

    // ========== 1. 批量从 Redis 详情缓存获取 ==========
    try {
      const pipeline = redis.pipeline();
      for (const id of projectIds) {
        pipeline.hgetAll(`project:info:${id}`);
      }
      const results = await pipeline.execAsync();

      results.forEach((result, index) => {
        if (result && Object.keys(result).length > 0) {
          projects.set(projectIds[index], parseProject(result));
        } else {
          missingIds.push(projectIds[index]);
        }
      });
    } catch (error) {
      console.warn(
        '[ProjectRepository] 批量从 Redis 获取失败，全部降级到 MongoDB:',
        error,
      );
      missingIds.push(...projectIds);
    }

    // ========== 2. 未命中的从 MongoDB 查询并回写缓存 ==========
    if (missingIds.length > 0) {
      try {
        const dbProjects = await projectMongoCollection
          .find({ id: { $in: missingIds } })
          .toArray();

        const writePipeline = redis.pipeline();
        for (const project of dbProjects) {
          projects.set(project.id, project);
          writePipeline.hmset(
            `project:info:${project.id}`,
            serializeProject(project),
          );
          writePipeline.expire(`project:info:${project.id}`, 300);
        }
        await writePipeline.execAsync();
      } catch (error) {
        console.warn(
          '[ProjectRepository] 从 MongoDB 获取失败，降级到 MockTable:',
          error,
        );

        // 最后降级到 MockTable
        for (const id of missingIds) {
          const project = await projectTable.findById(id);
          if (project) {
            projects.set(id, project);
          }
        }
      }
    }

    // ========== 3. 批量从 projectStatsCache 获取统计字段 ==========
    const statsPipeline = redis.pipeline();
    for (const id of projectIds) {
      statsPipeline.hgetAll(`project:stats:${id}`);
    }
    const statsResults = await statsPipeline.execAsync();

    // ========== 4. 合并统计字段，按输入顺序返回 ==========
    return projectIds
      .map((id, index) => {
        const project = projects.get(id);
        if (!project) return null;
        const stats = statsResults[index] as Record<string, string> | null;
        return {
          ...project,
          doc_count: stats?.doc_count ? Number(stats.doc_count) : 0,
          doc_category_count: stats?.doc_category_count
            ? Number(stats.doc_category_count)
            : 0,
        };
      })
      .filter((p): p is ProjectWithStats => p !== null);
  }

  // ==================== 列表缓存操作 ====================
  /**
   * 构建列表缓存 key
   * @param params 缓存 key 组成参数
   * @returns 缓存 key 字符串
   */
  buildListCacheKey(params: ListCacheKey): string {
    return `${params.categoryId}:${params.filter}:${params.sort}${
      params.filter !== 'all' && params.userId !== undefined
        ? `:${params.userId}`
        : ''
    }`;
  }
  /**
   * 获取列表缓存（排序后的文集 ID 列表）
   * @param key 列表缓存 key
   * @returns 排序后的 ID 列表，未命中时返回空数组
   */
  async getListCache(key: string): Promise<number[]> {
    try {
      const cached = await projectListCache.get<number[]>(key);
      return cached && cached.length > 0 ? cached : [];
    } catch (error) {
      console.warn('[ProjectRepository] 列表缓存读取失败:', error);
      return [];
    }
  }

  /**
   * 设置列表缓存（只存 ID，不存完整数据）
   * @param key 列表缓存 key
   * @param ids 排序后的 ID 列表
   */
  async setListCache(key: string, ids: number[]): Promise<void> {
    try {
      await projectListCache.set(key, ids);
    } catch (error) {
      console.warn('[ProjectRepository] 列表缓存写入失败:', error);
    }
  }

  // ==================== 分类相关查询 ====================

  /**
   * 从缓存迭代获取后代分类 ID（BFS + Pipeline 批量）
   * 【优化】替代递归实现，每一层用 pipeline 批量获取，减少网络往返
   * 【性能】O(深度) 次 pipeline，分类最多三级所以最多 3 次网络往返
   *
   * @param categoryId 分类 ID
   * @returns 后代分类 ID 列表
   */
  async getDescendantCategoryIds(categoryId: number): Promise<number[]> {
    const descendants: number[] = [];

    try {
      // 第一层：获取根分类的 children
      const rootChain = await categoryChainCache.hgetAll(String(categoryId));
      if (!rootChain?.children) return descendants;

      let currentLevelIds = JSON.parse(rootChain.children) as number[];
      descendants.push(...currentLevelIds);

      // BFS 迭代：每一层用 pipeline 批量获取 children
      while (currentLevelIds.length > 0) {
        const pipeline = redis.pipeline();
        for (const id of currentLevelIds) {
          pipeline.hget(`${categoryChainCache.prefix}${id}`, 'children');
        }
        const results = await pipeline.execAsync();

        const nextLevelIds: number[] = [];
        for (const result of results) {
          if (result) {
            const children = JSON.parse(result as string) as number[];
            nextLevelIds.push(...children);
          }
        }

        descendants.push(...nextLevelIds);
        currentLevelIds = nextLevelIds;
      }
    } catch (error) {
      console.warn('[ProjectRepository] 获取后代分类失败:', error);
    }

    return descendants;
  }

  /**
   * 获取分类及其后代的所有文集 ID
   * 【数据来源】categoryProjectsCache（Set 结构，已预计算）
   * 【性能】O(1) Set 操作（sunion），避免遍历所有文集
   *
   * @param categoryId 分类 ID（0 表示全部分类）
   * @returns 文集 ID 列表
   */
  async getProjectIdsByCategory(categoryId: number): Promise<number[]> {
    // 全部分类（categoryId = 0）：合并所有分类的文集 ID
    if (categoryId === 0) {
      try {
        const allCategoryIds = await categoryOrderCache.lrange('all', 0, -1);
        if (allCategoryIds.length === 0) return [];

        const keys = allCategoryIds.map(
          (id: number | string) => `${categoryProjectsCache.prefix}${id}`,
        );
        const projectIds = await redis.sunion(...keys);
        return projectIds.map(Number);
      } catch (error) {
        console.warn('[ProjectRepository] 获取全部分类文集 ID 失败:', error);
        return [];
      }
    }

    // 指定分类：当前分类 + 所有后代分类
    try {
      const descendantIds = await this.getDescendantCategoryIds(categoryId);
      const allCategoryIds = [categoryId, ...descendantIds];

      const keys = allCategoryIds.map(
        (id) => `${categoryProjectsCache.prefix}${id}`,
      );
      const projectIds = await redis.sunion(...keys);
      return projectIds.map(Number);
    } catch (error) {
      console.warn('[ProjectRepository] 获取分类文集 ID 失败:', error);
      return [];
    }
  }

  /**
   * 获取受影响的分类 ID 列表
   * 【包含】全部分类(0) + 当前分类 + 所有祖先分类
   * 【数据来源】categoryChainCache.ancestors 字段（已预计算）
   *
   * @param categoryId 分类 ID
   * @returns 受影响的分类 ID 列表
   */
  async getAffectedCategoryIds(categoryId: number): Promise<number[]> {
    const affected = new Set<number>([0, categoryId]);

    try {
      const chainData = await categoryChainCache.hgetAll(String(categoryId));
      if (chainData && chainData.ancestors) {
        const ancestors = JSON.parse(chainData.ancestors) as number[];
        ancestors.forEach((id) => affected.add(id));
      }
    } catch (error) {
      console.warn(
        '[ProjectRepository] 获取祖先链路失败，仅使用当前分类:',
        error,
      );
    }

    return Array.from(affected);
  }

  // ==================== MockTable 写入操作 ====================

  /**
   * 创建文集（默认同步写入 L1 MockTable、L2 MongoDB、L3 Redis 缓存）
   * @param data 文集数据
   * @param syncMongoAndCache 是否同步 MongoDB 和 Redis 缓存（默认 true）
   * @returns 创建的文集
   */
  async create(
    data: Partial<MockProject>,
    syncMongoAndCache = true,
  ): Promise<MockProject> {
    const newProject = await projectTable.create(data as MockProject);

    if (syncMongoAndCache) {
      try {
        await Promise.all([
          // MongoDB 写入（含统计字段初始值）
          this.createMongo({
            ...newProject,
            doc_count: 0,
            doc_category_count: 0,
          }),
          // Redis 缓存初始化
          this.createProjectCache(newProject),
        ]);
      } catch (error) {
        // MongoDB/缓存写入失败，记录日志，等待定时重建修复（不影响 MockTable 已写入的结果）
        console.warn(
          '[ProjectRepository] 创建文集 MongoDB/缓存失败，等待定时重建:',
          error,
        );
      }
    }

    return newProject;
  }

  /**
   * 更新文集（MockTable）
   * @param id 文集 ID
   * @param data 更新数据
   * @returns 更新后的文集
   */
  async update(
    id: number,
    data: Partial<MockProject>,
  ): Promise<MockProject | null> {
    return projectTable.updateById(id, data);
  }

  /**
   * 删除文集（MockTable）
   * @param id 文集 ID
   */
  async delete(id: number): Promise<void> {
    await projectTable.deleteById(id);
  }

  // ==================== MongoDB 写入操作 ====================

  /**
   * MongoDB 插入文集
   * @param project 文集数据（含统计字段）
   */
  async createMongo(project: MongoProject): Promise<void> {
    await projectMongoCollection.insertOne(project);
  }

  /**
   * MongoDB 更新文集
   * @param id 文集 ID
   * @param data 更新数据
   */
  async updateMongo(id: number, data: Partial<MockProject>): Promise<void> {
    await projectMongoCollection.updateOne({ id }, { $set: data });
  }

  /**
   * MongoDB 删除文集
   * @param id 文集 ID
   */
  async deleteMongo(id: number): Promise<void> {
    await projectMongoCollection.deleteOne({ id });
  }

  /**
   * MongoDB 更新分类计数器
   * @param categoryId 分类 ID
   * @param delta 增量（+1 或 -1）
   */
  async incrementCategoryCount(
    categoryId: number,
    delta: number,
  ): Promise<void> {
    await categoryMongoCollection.updateOne(
      { id: categoryId },
      { $inc: { project_count: delta } },
    );
  }

  // ==================== 详情缓存操作 ====================

  /**
   * 设置文集详情缓存（Hash + TTL 5 分钟）
   * @param project 文集数据
   */
  async setInfoCache(project: MockProject): Promise<void> {
    const pipeline = redis.pipeline();
    pipeline.hmset(`project:info:${project.id}`, serializeProject(project));
    pipeline.expire(`project:info:${project.id}`, 300);
    await pipeline.execAsync();
  }

  /**
   * 删除文集详情缓存
   * @param id 文集 ID
   */
  async deleteInfoCache(id: number): Promise<void> {
    await redis.del(`project:info:${id}`);
  }

  // ==================== 统计缓存操作 ====================

  /**
   * 设置文集统计缓存（Hash）
   * @param id 文集 ID
   * @param stats 统计数据
   */
  async setStatsCache(
    id: number,
    stats: { doc_count: number; doc_category_count: number },
  ): Promise<void> {
    await projectStatsCache.hmset(String(id), {
      doc_count: String(stats.doc_count),
      doc_category_count: String(stats.doc_category_count),
    });
  }

  /**
   * 删除文集统计缓存
   * @param id 文集 ID
   */
  async deleteStatsCache(id: number): Promise<void> {
    await projectStatsCache.del(String(id));
  }

  // ==================== 分类文集集合操作 ====================

  /**
   * 添加文集到分类文集集合（Set）
   * @param categoryId 分类 ID
   * @param projectId 文集 ID
   */
  async addProjectToCategory(
    categoryId: number,
    projectId: number,
  ): Promise<void> {
    await categoryProjectsCache.sadd(String(categoryId), String(projectId));
  }

  /**
   * 从分类文集集合移除文集（Set）
   * @param categoryId 分类 ID
   * @param projectId 文集 ID
   */
  async removeProjectFromCategory(
    categoryId: number,
    projectId: number,
  ): Promise<void> {
    await categoryProjectsCache.srem(String(categoryId), String(projectId));
  }

  // ==================== 复合缓存操作 ====================

  /**
   * 创建文集时批量初始化缓存（Pipeline 单次网络往返）
   * 【覆盖】分类文集集合 + 详情缓存 + 统计缓存
   *
   * @param project 新创建的文集
   */
  async createProjectCache(project: MockProject): Promise<void> {
    const pipeline = redis.pipeline();

    // 分类文集 ID 缓存（Set）
    if (project.project_category_id) {
      pipeline.sadd(
        `${categoryProjectsCache.prefix}${project.project_category_id}`,
        project.id,
      );
    }

    // 文集详情缓存（Hash + TTL 5 分钟）
    pipeline.hmset(`project:info:${project.id}`, serializeProject(project));
    pipeline.expire(`project:info:${project.id}`, 300);

    // 文集统计缓存（Hash，初始为 0）
    pipeline.hmset(`project:stats:${project.id}`, {
      doc_count: '0',
      doc_category_count: '0',
    });

    await pipeline.execAsync();
  }

  /**
   * 更新文集时的缓存操作（Pipeline 单次网络往返）
   * 【覆盖】分类文集集合变更 + 详情缓存删除
   *
   * @param id 文集 ID
   * @param oldCategoryId 旧分类 ID
   * @param newCategoryId 新分类 ID
   */
  async updateProjectCache(
    id: number,
    oldCategoryId: number,
    newCategoryId: number,
  ): Promise<void> {
    const pipeline = redis.pipeline();

    // 分类变更时，更新分类文集 ID 缓存（Set）
    if (newCategoryId !== oldCategoryId) {
      if (oldCategoryId) {
        pipeline.srem(`${categoryProjectsCache.prefix}${oldCategoryId}`, id);
      }
      if (newCategoryId) {
        pipeline.sadd(`${categoryProjectsCache.prefix}${newCategoryId}`, id);
      }
    }

    // 删除文集详情缓存（下次读取时重建）
    pipeline.del(`project:info:${id}`);

    await pipeline.execAsync();
  }

  /**
   * 删除文集时的缓存操作（Pipeline 单次网络往返）
   * 【覆盖】分类文集集合移除 + 详情缓存删除 + 统计缓存删除
   *
   * @param id 文集 ID
   * @param categoryId 分类 ID
   */
  async deleteProjectCache(id: number, categoryId: number): Promise<void> {
    const pipeline = redis.pipeline();

    // 分类文集 ID 缓存（Set）：移除
    if (categoryId) {
      pipeline.srem(`${categoryProjectsCache.prefix}${categoryId}`, id);
    }

    // 文集详情缓存：删除
    pipeline.del(`project:info:${id}`);

    // 文集统计缓存：删除
    pipeline.del(`project:stats:${id}`);

    await pipeline.execAsync();
  }

  /**
   * 精确失效受影响的列表缓存
   * 【作用】根据文集的分类、筛选属性、变更字段，计算所有受影响的列表缓存 key 并批量删除
   * 【性能】O(分类数 × 筛选数 × 排序数)，通常 20~80 个 key，一次批量删除
   *
   * @param project 变更的文集
   * @param changedFields 变更的字段列表（新增/删除时不传）
   */
  async invalidateListCache(
    project: MockProject,
    changedFields?: string[],
  ): Promise<void> {
    try {
      // 1. 计算受影响的维度
      const affectedCategories = await this.getAffectedCategoryIds(
        project.project_category_id,
      );
      const affectedFilters = this.getAffectedFilters(project);
      const affectedSorts = this.getAffectedSorts(changedFields);

      // 2. 枚举所有受影响的 key
      const keysToDelete: string[] = [];
      for (const categoryId of affectedCategories) {
        for (const filter of affectedFilters) {
          for (const sort of affectedSorts) {
            if (filter === 'all') {
              keysToDelete.push(`project:list:${categoryId}:all:${sort}`);
            } else if (filter === 'mine') {
              keysToDelete.push(
                `project:list:${categoryId}:mine:${sort}:${project.create_user_id}`,
              );
            } else if (filter === 'collab') {
              keysToDelete.push(
                `project:list:${categoryId}:collab:${sort}:${project.create_user_id}`,
              );
            } else if (filter === 'private') {
              keysToDelete.push(
                `project:list:${categoryId}:private:${sort}:${project.create_user_id}`,
              );
            }
          }
        }
      }

      // 3. 批量删除（使用 Pipeline）
      if (keysToDelete.length > 0) {
        const pipeline = redis.pipeline();
        keysToDelete.forEach((key) => pipeline.del(key));
        await pipeline.execAsync();
        console.log(
          `[ProjectRepository] 精确失效列表缓存：${keysToDelete.length} 个 key`,
        );
      }
    } catch (error) {
      console.warn('[ProjectRepository] 列表缓存精确失效失败:', error);
    }
  }

  // ==================== 纯函数辅助方法 ====================

  /**
   * 获取受影响的筛选条件
   * 【筛选条件】all / mine / collab / private
   */
  private getAffectedFilters(project: MockProject): string[] {
    const filters = new Set<string>(['all']);

    if (project.create_user_id) {
      filters.add('mine');
    }
    if (project.is_collaborator) {
      filters.add('collab');
    }
    if (project.role === 1) {
      filters.add('private');
    }

    return Array.from(filters);
  }

  /**
   * 获取受影响的排序方式
   * 【排序方式】update / create / doc_count / name
   */
  private getAffectedSorts(changedFields?: string[]): string[] {
    const allSorts = ['update', 'create', 'doc_count', 'name'];

    // 新增/删除时，所有排序都受影响
    if (!changedFields || changedFields.length === 0) {
      return allSorts;
    }

    // 结构性字段变更 → 所有排序都受影响
    const structuralFields = [
      'project_category_id',
      'role',
      'create_user_id',
      'is_collaborator',
      'is_top',
    ];
    if (changedFields.some((f) => structuralFields.includes(f))) {
      return allSorts;
    }

    // 具体字段变更 → 只影响对应排序
    const affectedSorts: string[] = [];
    if (changedFields.includes('modify_time')) affectedSorts.push('update');
    if (changedFields.includes('create_time')) affectedSorts.push('create');
    if (changedFields.includes('name')) affectedSorts.push('name');
    if (changedFields.includes('doc_count')) affectedSorts.push('doc_count');

    return affectedSorts.length > 0 ? affectedSorts : allSorts;
  }
}

export const projectRepository = new ProjectRepository();
