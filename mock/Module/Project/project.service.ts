// mock/Project/project.service.ts
// 文集服务层
// 职责：处理文集相关的核心业务逻辑，调用数据库（MockTable）和缓存（Redis）

import { BusinessError } from '../../Core';
import { redis } from '../../Core/redis';
import type { MockProject, MongoProject } from '../../Entities/project';
import {
  categoryChainCache,
  categoryMongoCollection,
  categoryOrderCache,
  projectListCache,
  projectMongoCollection,
  projectTable,
} from '../../Entities/project';
import type {
  CreateProjectRequest,
  DeleteProjectResponse,
  GetProjectListRequest,
  GetProjectListResponse,
  UpdateProjectRequest,
} from './project.dto';
// 从分类服务导入需要的辅助函数
import { updateCategoryCount } from './category.service';

// ============================================================================
// 文集列表缓存辅助函数
// ============================================================================

/**
 * Hash 数据反序列化为文集对象
 * 【作用】将 Redis Hash 存储的字符串字段转换成 MockProject 对象
 * 【注意】处理空字符串、数值转换、布尔转换
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
/**
 * 从缓存递归获取后代分类 ID
 * 【作用】利用 categoryChainCache.children 字段，递归获取某分类的所有后代分类 ID
 * 【性能】O(N)，N 为后代分类数量，每个分类 O(1) 读取
 */
async function getDescendantIdsFromCache(
  categoryId: number,
): Promise<number[]> {
  const descendants: number[] = [];

  try {
    const chainData = await categoryChainCache.hgetAll(String(categoryId));
    if (!chainData || !chainData.children) return descendants;

    const children = JSON.parse(chainData.children) as number[];
    for (const childId of children) {
      descendants.push(childId);
      // 递归获取子分类的后代
      const grandChildren = await getDescendantIdsFromCache(childId);
      descendants.push(...grandChildren);
    }
  } catch (error) {
    console.warn('[ProjectCache] 获取后代分类失败:', error);
  }

  return descendants;
}
/**
 * 获取分类及其后代的所有文集 ID
 * 【作用】合并当前分类和所有后代分类的文集 ID（使用 sunion）
 * 【数据来源】categoryProjectsCache（Set 结构，已预计算）
 * 【性能】O(1) Set 操作，避免遍历所有文集
 */
async function getProjectIdsByCategory(categoryId: number): Promise<number[]> {
  // 全部分类（categoryId = 0）：合并所有分类的文集 ID
  if (categoryId === 0) {
    try {
      // 获取所有分类 ID（从排序索引）
      const allCategoryIds = await categoryOrderCache.lrange('all', 0, -1);
      if (allCategoryIds.length === 0) return [];

      // 使用 sunion 合并所有分类的文集 ID
      const keys = allCategoryIds.map(
        (id: number | string) => `project:category:projects:${id}`,
      );
      const projectIds = await redis.sunion(...keys);
      return projectIds.map(Number);
    } catch (error) {
      console.warn('[ProjectCache] 获取全部分类文集 ID 失败:', error);
      return [];
    }
  }

  // 指定分类：当前分类 + 所有后代分类
  try {
    const descendantIds = await getDescendantIdsFromCache(categoryId);
    const allCategoryIds = [categoryId, ...descendantIds];

    // 使用 sunion 合并
    const keys = allCategoryIds.map((id) => `project:category:projects:${id}`);
    const projectIds = await redis.sunion(...keys);
    return projectIds.map(Number);
  } catch (error) {
    console.warn('[ProjectCache] 获取分类文集 ID 失败:', error);
    return [];
  }
}
/**
 * 批量获取文集详情（Redis + MongoDB 分层）
 * 【作用】批量获取文集详情，优先从 Redis 缓存，未命中的从 MongoDB 补全
 * 【流程】
 * 1. 批量从 Redis 缓存获取（Pipeline）
 * 2. 未命中的从 MongoDB 查询
 * 3. 查询结果写入 Redis 缓存（TTL 5 分钟）
 * 【性能】将 N 次单独查询减少为 2 次批量操作
 *
 * @param projectIds 文集 ID 列表
 * @returns 文集详情列表（保持输入顺序）
 */
async function batchGetProjectInfo(
  projectIds: number[],
): Promise<MongoProject[]> {
  if (projectIds.length === 0) return [];

  const projects: Map<number, MockProject> = new Map();
  const missingIds: number[] = [];

  // ========== 1. 批量从 Redis 详情缓存获取（不含 doc_count）==========
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
      '[ProjectCache] 批量从 Redis 获取失败，全部降级到 MongoDB:',
      error,
    );
    missingIds.push(...projectIds);
  }

  // ========== 2. 未命中的从 MongoDB 查询 ==========
  if (missingIds.length > 0) {
    try {
      const dbProjects = await projectMongoCollection
        .find({ id: { $in: missingIds } })
        .toArray();

      // 查询结果写入 Redis 详情缓存（TTL 5 分钟，不含 doc_count）
      const writePipeline = redis.pipeline();
      for (const project of dbProjects) {
        projects.set(project.id, project); // MongoProject 可赋值给 MockProject
        writePipeline.hmset(
          `project:info:${project.id}`,
          serializeProject(project),
        );
        writePipeline.expire(`project:info:${project.id}`, 300);
      }
      await writePipeline.execAsync();
    } catch (error) {
      console.warn('[ProjectCache] 从 MongoDB 获取失败，降级到数据库:', error);

      // 最后降级到数据库（L1，不含 doc_count）
      for (const id of missingIds) {
        const project = await projectTable.findById(id);
        if (project) {
          projects.set(id, project);
        }
      }
    }
  }

  // ========== 3. 批量从 projectStatsCache 获取统计字段（权威来源）==========
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
    .filter((p): p is MongoProject => p !== null);
}

/**
 * 获取文集详情（三级降级：Redis 缓存 → MongoDB → 数据库表）
 * 【返回】基础字段（不含 doc_count/doc_category_count 统计字段）
 * 【用途】update/delete 等只需要基础字段的场景
 * 【与 batchGetProjectInfo 区别】不获取统计字段，少一次 Redis 读取
 */
async function getProjectById(id: number): Promise<MockProject | null> {
  // L3：Redis 详情缓存
  try {
    const cacheData = await redis.hgetAll(`project:info:${id}`);
    if (cacheData && Object.keys(cacheData).length > 0) {
      return parseProject(cacheData);
    }
  } catch (error) {
    console.warn('[ProjectCache] Redis 获取失败，降级到 MongoDB:', error);
  }

  // L2：MongoDB（命中后回写 Redis 缓存）
  try {
    const mongoProject = await projectMongoCollection.findOne({ id });
    if (mongoProject) {
      const writePipeline = redis.pipeline();
      writePipeline.hmset(`project:info:${id}`, serializeProject(mongoProject));
      writePipeline.expire(`project:info:${id}`, 300);
      await writePipeline.execAsync();
      return mongoProject; // MongoProject 可赋值给 MockProject
    }
  } catch (error) {
    console.warn('[ProjectCache] MongoDB 获取失败，降级到数据库:', error);
  }

  // L1：数据库表（兜底）
  return (await projectTable.findById(id)) ?? null;
}

/**
 * 获取受影响的分类 ID 列表
 * 【作用】当文集变更时，计算哪些分类的列表缓存会受影响
 * 【包含】全部分类(0) + 当前分类 + 所有祖先分类
 * 【数据来源】categoryChainCache.ancestors 字段（已预计算）
 */
async function getAffectedCategoryIds(categoryId: number): Promise<number[]> {
  const affected = new Set<number>([0, categoryId]); // 全部分类 + 当前分类

  try {
    // 从缓存获取祖先链路
    const chainData = await categoryChainCache.hgetAll(String(categoryId));
    if (chainData && chainData.ancestors) {
      const ancestors = JSON.parse(chainData.ancestors) as number[];
      ancestors.forEach((id) => affected.add(id));
    }
  } catch (error) {
    console.warn('[ProjectCache] 获取祖先链路失败，仅使用当前分类:', error);
  }

  return Array.from(affected);
}

/**
 * 获取受影响的筛选条件
 * 【作用】根据文集属性，判断哪些筛选条件的列表缓存会受影响
 * 【筛选条件】all / mine / collab / private
 */
function getAffectedFilters(project: MockProject): string[] {
  const filters = new Set<string>(['all']); // all 总是受影响

  if (project.create_user_id) {
    filters.add('mine'); // 我的文集
  }
  if (project.is_collaborator) {
    filters.add('collab'); // 协作文集
  }
  if (project.role === 1) {
    filters.add('private'); // 私有文档
  }

  return Array.from(filters);
}

/**
 * 获取受影响的排序方式
 * 【作用】根据变更的字段，判断哪些排序方式的列表缓存会受影响
 * 【排序方式】update / create / doc_count / name
 * 【规则】
 * - 新增/删除时：所有排序都受影响
 * - 结构性字段变更（分类/角色/创建者/协作）：所有排序都受影响
 * - 具体字段变更：只影响对应排序
 */
function getAffectedSorts(changedFields?: string[]): string[] {
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
  // doc_count 通常由文档数量变化触发，这里也包含
  if (changedFields.includes('doc_count')) affectedSorts.push('doc_count');

  return affectedSorts.length > 0 ? affectedSorts : allSorts;
}

/**
 * 精确失效受影响的列表缓存
 * 【作用】根据文集的分类、筛选属性、变更字段，计算所有受影响的列表缓存 key 并批量删除
 * 【性能】O(分类数 × 筛选数 × 排序数)，通常 20~80 个 key，一次批量删除
 * 【Key 格式】project:list:{categoryId}:{filter}:{sort}[:userId]
 *
 * @param project 变更的文集
 * @param changedFields 变更的字段列表（新增/删除时不传）
 */
export async function invalidateProjectListCache(
  project: MockProject,
  changedFields?: string[],
): Promise<void> {
  try {
    // 1. 计算受影响的维度
    const affectedCategories = await getAffectedCategoryIds(
      project.project_category_id,
    );
    const affectedFilters = getAffectedFilters(project);
    const affectedSorts = getAffectedSorts(changedFields);

    // 2. 枚举所有受影响的 key
    const keysToDelete: string[] = [];
    for (const categoryId of affectedCategories) {
      for (const filter of affectedFilters) {
        for (const sort of affectedSorts) {
          if (filter === 'all') {
            // 全局缓存（无 userId）
            keysToDelete.push(`project:list:${categoryId}:all:${sort}`);
          } else if (filter === 'mine') {
            // 我的文集（按创建者）
            keysToDelete.push(
              `project:list:${categoryId}:mine:${sort}:${project.create_user_id}`,
            );
          } else if (filter === 'collab') {
            // 协作文集（简化：按创建者，实际项目可遍历协作者列表）
            keysToDelete.push(
              `project:list:${categoryId}:collab:${sort}:${project.create_user_id}`,
            );
          } else if (filter === 'private') {
            // 私有文档（按创建者）
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
        `[ProjectCache] 精确失效列表缓存：${keysToDelete.length} 个 key`,
      );
    }
  } catch (error) {
    // 缓存失效失败不影响主流程，等待定时重建兜底
    console.warn('[ProjectCache] 列表缓存精确失效失败:', error);
  }
}

/**
 * 批量校验分类是否可删除（数组模式，一次性读取缓存，减少网络传输）
 *
 * 【性能优化】
 * - 分类列表：只读取一次缓存
 * - 计数器：使用 Pipeline 批量读取所有 ID 的计数器
 * - 避免循环调用 checkCanDelete 导致的 N 次缓存读取
 *
 * @param ids 分类 ID 数组
 * @param selectedIds 批量删除时已选中的 ID 集合（选中的子分类允许级联删除）
 * @returns 每个 ID 的校验结果 Map
 */

// ============================================================================
// 文集服务类
// ============================================================================

class ProjectService {
  // ==================== 文集列表 ====================

  async getProjectList(
    data: GetProjectListRequest,
  ): Promise<GetProjectListResponse> {
    // 直接解构使用，参数已由 controller 层设置默认值并完成类型转换
    // 此处再次设置默认值，确保 TypeScript 类型安全（接口字段为可选）
    const {
      page = 1,
      page_size = 12,
      keyword = '',
      filter = 'all',
      project_category_id = 0,
      sort = 'update',
      user_id = 0,
    } = data;

    // ========== 1. 构建列表缓存 key（不含分页参数和 keyword）==========
    // Key 格式：project:list:{categoryId}:{filter}:{sort}[:userId]
    const listCacheKey = `${project_category_id}:${filter}:${sort}${
      filter !== 'all' ? `:${user_id}` : ''
    }`;

    // ========== 2. 尝试从列表缓存获取排序后的 ID 列表 ==========
    let sortedProjectIds: number[] = [];
    try {
      const cached = await projectListCache.get<number[]>(listCacheKey);
      if (cached && cached.length > 0) {
        sortedProjectIds = cached;
      }
    } catch (error) {
      console.warn('[ProjectCache] 列表缓存读取失败:', error);
    }

    // ========== 3. 缓存未命中时，从底层计算并缓存 ==========
    if (sortedProjectIds.length === 0) {
      console.log('[ProjectCache] 列表缓存未命中，从基础数据计算');

      // 3.1 从分类缓存获取该分类下的文集 ID（第 2 层）
      let categoryProjectIds: number[];
      if (project_category_id === -1) {
        // 未分类：只获取 project_category_id 为 0 或未设置的文集
        categoryProjectIds = await getProjectIdsByCategory(0);
      } else {
        categoryProjectIds = await getProjectIdsByCategory(project_category_id);
      }

      // 3.2 批量获取文集详情（第 3 层：Redis + MongoDB）
      let projects = await batchGetProjectInfo(categoryProjectIds);

      // 3.3 统一私有可见性过滤
      projects = projects.filter(
        (p) => p.role === 0 || p.create_user_id === user_id,
      );

      // 3.4 按 filter 进一步过滤
      if (filter === 'mine') {
        projects = projects.filter(
          (p) => p.create_user_id === user_id && !p.is_collaborator,
        );
      } else if (filter === 'collab') {
        projects = projects.filter((p) => p.is_collaborator);
      } else if (filter === 'private') {
        projects = projects.filter(
          (p) => p.role === 1 && p.create_user_id === user_id,
        );
      }

      // 3.5 排序（置顶优先 + 指定排序方式）
      const zhCollator = new Intl.Collator('zh-CN', {
        sensitivity: 'accent',
      });

      // 先按指定方式排序
      switch (sort) {
        case 'update':
          projects.sort((a, b) => b.modify_time - a.modify_time);
          break;
        case 'create':
          projects.sort((a, b) => b.create_time - a.create_time);
          break;
        case 'name':
          projects.sort((a, b) => zhCollator.compare(a.name, b.name));
          break;
      }

      // 置顶优先（在指定排序基础上，置顶的排前面）
      projects.sort((a, b) => {
        if (a.is_top !== b.is_top) return Number(b.is_top) - Number(a.is_top);
        return 0;
      });

      // 3.6 提取排序后的 ID 列表
      sortedProjectIds = projects.map((p) => p.id);

      // 3.7 写入列表缓存（只存 ID，不存完整数据）
      try {
        await projectListCache.set(listCacheKey, sortedProjectIds);
      } catch (error) {
        console.warn('[ProjectCache] 列表缓存写入失败:', error);
      }
    }

    // ========== 4. keyword 搜索（在 ID 列表基础上，获取详情后过滤）==========
    // 注意：keyword 不参与缓存，因为关键词变化太频繁
    let finalProjectIds = sortedProjectIds;
    if (keyword) {
      // 需要获取详情才能进行关键词搜索
      const allProjects = await batchGetProjectInfo(sortedProjectIds);
      const filtered = allProjects.filter(
        (p) => p.name.includes(keyword) || p.intro.includes(keyword),
      );
      finalProjectIds = filtered.map((p) => p.id);
    }

    // ========== 5. 分页 ==========
    const total = finalProjectIds.length;
    const start = (page - 1) * page_size;
    const pageIds = finalProjectIds.slice(start, start + page_size);

    // ========== 6. 批量获取当前页的文集详情 ==========
    const list = await batchGetProjectInfo(pageIds);

    return {
      list,
      total,
      page,
      page_size,
    };
  }

  // ==================== 创建文集 ====================

  /**
   * 创建文集
   * @param data 请求参数
   * @param createUserId 创建者用户 ID
   * @returns 创建的文集
   */
  async createProject(
    data: CreateProjectRequest,
    createUserId: number = 1,
  ): Promise<MongoProject> {
    // create_time / modify_time 由 beforeCreate 钩子自动设置
    const newProject = await projectTable.create({
      name: data.name,
      intro: data.intro || '',
      icon: data.icon || 'FolderOutlined',
      color: data.color || '#1890ff',
      role: data.role ?? 0,
      is_top: data.is_top ?? false,
      project_category_id: data.project_category_id || 0,
      is_collaborator: data.is_collaborator ?? false,
      sort: data.sort ?? 0,
      create_user_id: createUserId,
    } as MockProject);

    // ========== 缓存和 MongoDB 同步更新（并行执行 + 错误兜底）==========
    try {
      // 1. Redis 操作合并到 Pipeline（减少网络往返）
      const redisPipeline = redis.pipeline();
      // 1.1 分类文集 ID 缓存（Set）
      if (newProject.project_category_id) {
        redisPipeline.sadd(
          `project:category:projects:${newProject.project_category_id}`,
          newProject.id,
        );
      }
      // 1.2 文集详情缓存（Hash + TTL 5 分钟，不含 doc_count）
      redisPipeline.hmset(
        `project:info:${newProject.id}`,
        serializeProject(newProject),
      );
      redisPipeline.expire(`project:info:${newProject.id}`, 300);
      // 1.3 文集统计缓存（Hash，doc_count/doc_category_count 初始为 0）
      redisPipeline.hmset(`project:stats:${newProject.id}`, {
        doc_count: '0',
        doc_category_count: '0',
      });

      // 2. MongoDB 操作（Promise.all 并行）
      const mongoPromises: Promise<any>[] = [
        // 2.1 文集集合
        projectMongoCollection.insertOne({
          ...newProject,
          doc_count: 0,
          doc_category_count: 0,
        }),
      ];
      // 2.2 分类计数器（+1）
      if (newProject.project_category_id) {
        mongoPromises.push(
          categoryMongoCollection.updateOne(
            { id: newProject.project_category_id },
            { $inc: { project_count: 1 } },
          ),
        );
      }

      // 3. 并行执行：Redis Pipeline + MongoDB + 分类计数器（祖先链）
      const allPromises: Promise<any>[] = [
        redisPipeline.execAsync(),
        ...mongoPromises,
      ];
      if (newProject.project_category_id) {
        allPromises.push(
          updateCategoryCount(newProject.project_category_id, 1),
        );
      }
      await Promise.all(allPromises);

      // 4. 精确失效列表缓存（新增时所有排序都受影响）
      await invalidateProjectListCache(newProject);
    } catch (error) {
      // 缓存更新失败不影响主流程，等待定时重建兜底
      console.warn('[ProjectCache] 创建文集缓存更新失败，等待定时重建:', error);
    }

    return { ...newProject, doc_count: 0, doc_category_count: 0 };
  }

  // ==================== 更新文集 ====================

  /**
   * 更新文集
   * @param id 文集 ID
   * @param data 请求参数
   * @returns 更新后的文集
   */
  async updateProject(
    id: number,
    data: UpdateProjectRequest,
  ): Promise<MongoProject> {
    const oldProject = await getProjectById(id);
    if (!oldProject) {
      throw new BusinessError('文集不存在', 404);
    }

    const oldCategoryId = oldProject.project_category_id;

    const updateData: Partial<MockProject> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.intro !== undefined) updateData.intro = data.intro;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.project_category_id !== undefined)
      updateData.project_category_id = data.project_category_id;
    if (data.is_top !== undefined) updateData.is_top = data.is_top;
    if (data.is_collaborator !== undefined)
      updateData.is_collaborator = data.is_collaborator;
    if (data.sort !== undefined) updateData.sort = data.sort;

    // modify_time 由 beforeUpdate 钩子自动设置
    const updatedProject = await projectTable.updateById(id, updateData);

    // 计算变更的字段（用于精确失效列表缓存）
    const changedFields = Object.keys(updateData).filter(
      (key) =>
        oldProject[key as keyof MockProject] !==
        updatedProject![key as keyof MockProject],
    );
    // modify_time 总是会变更，加入变更字段
    if (changedFields.length > 0 && !changedFields.includes('modify_time')) {
      changedFields.push('modify_time');
    }

    // ========== 缓存和 MongoDB 同步更新（并行执行 + 错误兜底）==========
    try {
      const newCategoryId = updatedProject!.project_category_id;

      // 1. Redis 操作合并到 Pipeline（减少网络往返）
      const redisPipeline = redis.pipeline();
      // 1.1 分类变更时，更新分类文集 ID 缓存（Set）
      if (newCategoryId !== oldCategoryId) {
        if (oldCategoryId) {
          redisPipeline.srem(`project:category:projects:${oldCategoryId}`, id);
        }
        if (newCategoryId) {
          redisPipeline.sadd(`project:category:projects:${newCategoryId}`, id);
        }
      }
      // 1.2 删除文集详情缓存（下次读取时重建）
      redisPipeline.del(`project:info:${id}`);

      // 2. MongoDB 操作（Promise.all 并行）
      const mongoPromises: Promise<any>[] = [
        projectMongoCollection.updateOne({ id }, { $set: updateData }),
      ];
      // 分类变更时，更新分类计数器
      if (newCategoryId !== oldCategoryId) {
        if (oldCategoryId) {
          mongoPromises.push(
            categoryMongoCollection.updateOne(
              { id: oldCategoryId },
              { $inc: { project_count: -1 } },
            ),
          );
        }
        if (newCategoryId) {
          mongoPromises.push(
            categoryMongoCollection.updateOne(
              { id: newCategoryId },
              { $inc: { project_count: 1 } },
            ),
          );
        }
      }

      // 3. 并行执行：Redis Pipeline + MongoDB + 分类计数器（祖先链）
      const allPromises: Promise<any>[] = [
        redisPipeline.execAsync(),
        ...mongoPromises,
      ];
      if (newCategoryId !== oldCategoryId) {
        if (oldCategoryId) {
          allPromises.push(updateCategoryCount(oldCategoryId, -1));
        }
        if (newCategoryId) {
          allPromises.push(updateCategoryCount(newCategoryId, 1));
        }
      }
      await Promise.all(allPromises);

      // 4. 精确失效列表缓存（旧分类 + 新分类）
      await invalidateProjectListCache(oldProject, changedFields);
      if (newCategoryId !== oldCategoryId) {
        await invalidateProjectListCache(updatedProject!, changedFields);
      }
    } catch (error) {
      // 缓存更新失败不影响主流程，等待定时重建兜底
      console.warn('[ProjectCache] 更新文集缓存失败，等待定时重建:', error);
    }

    // 返回完整的 MongoProject（含统计字段，详情缓存已删除，会从 MongoDB 重建）
    const fullProject = (await batchGetProjectInfo([id]))[0];
    return (
      fullProject ?? {
        ...updatedProject!,
        doc_count: 0,
        doc_category_count: 0,
      }
    );
  }

  // ==================== 删除文集 ====================

  /**
   * 删除文集
   * @param id 文集 ID
   */
  async deleteProject(id: number): Promise<DeleteProjectResponse> {
    const project = await getProjectById(id);
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }

    const categoryId = project.project_category_id;

    await projectTable.deleteById(id);

    // ========== 缓存和 MongoDB 同步更新（并行执行 + 错误兜底）==========
    try {
      // 1. Redis 操作合并到 Pipeline（减少网络往返）
      const redisPipeline = redis.pipeline();
      // 1.1 分类文集 ID 缓存（Set）：移除
      if (categoryId) {
        redisPipeline.srem(`project:category:projects:${categoryId}`, id);
      }
      // 1.2 文集详情缓存：删除
      redisPipeline.del(`project:info:${id}`);
      // 1.3 文集统计缓存：删除
      redisPipeline.del(`project:stats:${id}`);

      // 2. MongoDB 操作（Promise.all 并行）
      const mongoPromises: Promise<any>[] = [
        projectMongoCollection.deleteOne({ id }),
      ];
      // 分类计数器（-1）
      if (categoryId) {
        mongoPromises.push(
          categoryMongoCollection.updateOne(
            { id: categoryId },
            { $inc: { project_count: -1 } },
          ),
        );
      }

      // 3. 并行执行：Redis Pipeline + MongoDB + 分类计数器（祖先链）
      const allPromises: Promise<any>[] = [
        redisPipeline.execAsync(),
        ...mongoPromises,
      ];
      if (categoryId) {
        allPromises.push(updateCategoryCount(categoryId, -1));
      }
      await Promise.all(allPromises);

      // 4. 精确失效列表缓存（删除时所有排序都受影响）
      await invalidateProjectListCache(project);
    } catch (error) {
      // 缓存更新失败不影响主流程，等待定时重建兜底
      console.warn('[ProjectCache] 删除文集缓存失败，等待定时重建:', error);
    }

    return { deletedId: id };
  }
}

export const projectService = new ProjectService();
