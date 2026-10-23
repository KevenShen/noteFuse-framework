// mock/Project/project.service.ts
// 文集服务层
// 职责：处理文集相关的核心业务逻辑，数据访问通过 projectRepository 封装

import { BusinessError } from '../../Core';
import type { MockProject, MongoProject } from '../../Entities/project';
import type {
  CreateProjectRequest,
  DeleteProjectResponse,
  GetProjectListRequest,
  GetProjectListResponse,
  UpdateProjectRequest,
} from './project.dto';
import { projectRepository } from './project.repository';
// 从分类服务导入需要的辅助函数
import { categoryService } from './category.service';

// ============================================================================
// 文集服务类
// ============================================================================

class ProjectService {
  // ==================== 文集列表 ====================

  async getProjectList(
    data: GetProjectListRequest,
  ): Promise<GetProjectListResponse> {
    const {
      page = 1,
      page_size = 12,
      keyword = '',
      filter = 'all',
      project_category_id = 0,
      sort = 'update',
      user_id = 0,
    } = data;

    // ========== 1. 构建列表缓存 key ==========
    const listCacheKey = projectRepository.buildListCacheKey({
      categoryId: project_category_id,
      filter,
      sort,
      userId: user_id,
    });

    // ========== 2. 尝试从列表缓存获取排序后的 ID 列表 ==========
    let sortedProjectIds = await projectRepository.getListCache(listCacheKey);

    // ========== 3. 缓存未命中时，从底层计算并缓存 ==========
    if (sortedProjectIds.length === 0) {
      console.log('[ProjectCache] 列表缓存未命中，从基础数据计算');

      // 3.1 从分类缓存获取该分类下的文集 ID
      let categoryProjectIds: number[];
      if (project_category_id === -1) {
        categoryProjectIds = await projectRepository.getProjectIdsByCategory(0);
      } else {
        categoryProjectIds = await projectRepository.getProjectIdsByCategory(
          project_category_id,
        );
      }

      // 3.2 批量获取文集详情（Redis + MongoDB 分层）
      let projects = await projectRepository.findByIds(categoryProjectIds);

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

      // 置顶优先
      projects.sort((a, b) => {
        if (a.is_top !== b.is_top) return Number(b.is_top) - Number(a.is_top);
        return 0;
      });

      // 3.6 提取排序后的 ID 列表
      sortedProjectIds = projects.map((p) => p.id);

      // 3.7 写入列表缓存（只存 ID，不存完整数据）
      await projectRepository.setListCache(listCacheKey, sortedProjectIds);
    }

    // ========== 4. keyword 搜索（在 ID 列表基础上，获取详情后过滤）==========
    let finalProjectIds = sortedProjectIds;
    if (keyword) {
      const allProjects = await projectRepository.findByIds(sortedProjectIds);
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
    const list = await projectRepository.findByIds(pageIds);

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
    // ========== 1. 创建文集（MockTable + MongoDB + Redis 缓存，Repository 一次完成）==========
    const newProject = await projectRepository.create({
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
    });

    // ========== 2. 分类计数器更新 + 列表缓存失效 ==========
    try {
      const promises: Promise<any>[] = [];

      // 分类计数器（+1）：更新 MongoDB 计数器 + Redis 计数器
      if (newProject.project_category_id) {
        promises.push(
          projectRepository.incrementCategoryCount(
            newProject.project_category_id,
            1,
          ),
          categoryService.updateCategoryCount(
            newProject.project_category_id,
            1,
          ),
        );
      }

      // 列表缓存失效（新增时所有排序都受影响）
      promises.push(projectRepository.invalidateListCache(newProject));

      await Promise.all(promises);
    } catch (error) {
      console.warn(
        '[ProjectCache] 创建文集计数器/列表缓存更新失败，等待定时重建:',
        error,
      );
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
    const oldProject = await projectRepository.findById(id);
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
    const updatedProject = await projectRepository.update(id, updateData);

    // 计算变更的字段（用于精确失效列表缓存）
    const changedFields = Object.keys(updateData).filter(
      (key) =>
        oldProject[key as keyof MockProject] !==
        updatedProject![key as keyof MockProject],
    );
    if (changedFields.length > 0 && !changedFields.includes('modify_time')) {
      changedFields.push('modify_time');
    }

    // ========== 缓存和 MongoDB 同步更新（并行执行 + 错误兜底）==========
    try {
      const newCategoryId = updatedProject!.project_category_id;

      // 1. Redis 缓存操作（Pipeline）
      // 2. MongoDB 操作（Promise.all 并行）
      const mongoPromises: Promise<any>[] = [
        projectRepository.updateMongo(id, updateData),
      ];
      // 分类变更时，更新分类计数器
      if (newCategoryId !== oldCategoryId) {
        if (oldCategoryId) {
          mongoPromises.push(
            projectRepository.incrementCategoryCount(oldCategoryId, -1),
          );
        }
        if (newCategoryId) {
          mongoPromises.push(
            projectRepository.incrementCategoryCount(newCategoryId, 1),
          );
        }
      }

      // 3. 并行执行：Redis 缓存 + MongoDB + 分类计数器（祖先链）
      const allPromises: Promise<any>[] = [
        projectRepository.updateProjectCache(id, oldCategoryId, newCategoryId),
        ...mongoPromises,
      ];
      if (newCategoryId !== oldCategoryId) {
        if (oldCategoryId) {
          allPromises.push(
            categoryService.updateCategoryCount(oldCategoryId, -1),
          );
        }
        if (newCategoryId) {
          allPromises.push(
            categoryService.updateCategoryCount(newCategoryId, 1),
          );
        }
      }
      await Promise.all(allPromises);

      // 4. 精确失效列表缓存（旧分类 + 新分类）
      await projectRepository.invalidateListCache(oldProject, changedFields);
      if (newCategoryId !== oldCategoryId) {
        await projectRepository.invalidateListCache(
          updatedProject!,
          changedFields,
        );
      }
    } catch (error) {
      console.warn('[ProjectCache] 更新文集缓存失败，等待定时重建:', error);
    }

    // 返回完整的 MongoProject（含统计字段，详情缓存已删除，会从 MongoDB 重建）
    const fullProject = (await projectRepository.findByIds([id]))[0];
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
    const project = await projectRepository.findById(id);
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }

    const categoryId = project.project_category_id;

    await projectRepository.delete(id);

    // ========== 缓存和 MongoDB 同步更新（并行执行 + 错误兜底）==========
    try {
      // 1. Redis 缓存操作（Pipeline）
      // 2. MongoDB 操作（Promise.all 并行）
      const mongoPromises: Promise<any>[] = [projectRepository.deleteMongo(id)];
      // 分类计数器（-1）
      if (categoryId) {
        mongoPromises.push(
          projectRepository.incrementCategoryCount(categoryId, -1),
        );
      }

      // 3. 并行执行：Redis 缓存 + MongoDB + 分类计数器（祖先链）
      const allPromises: Promise<any>[] = [
        projectRepository.deleteProjectCache(id, categoryId),
        ...mongoPromises,
      ];
      if (categoryId) {
        allPromises.push(categoryService.updateCategoryCount(categoryId, -1));
      }
      await Promise.all(allPromises);

      // 4. 精确失效列表缓存（删除时所有排序都受影响）
      await projectRepository.invalidateListCache(project);
    } catch (error) {
      console.warn('[ProjectCache] 删除文集缓存失败，等待定时重建:', error);
    }

    return { deletedId: id };
  }
}

export const projectService = new ProjectService();
