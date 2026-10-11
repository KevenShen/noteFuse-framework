// mock/Project/projectInfo.service.ts
// 文集详情页子资源服务层
// 职责：处理文集详情页子资源相关的核心业务逻辑
// 包含：文档分类、文档列表、文档版本、AI 大纲、文集简介等子资源接口

import { BusinessError } from '../../Core';
import { redis } from '../../Core/redis';
import { docCategories, docVersions, docs } from '../../Entities/doc';
import type { MockProject } from '../../Entities/project';
import {
  projectCache,
  projectMongoCollection,
  projectTable,
} from '../../Entities/project';
// 从文集体服务导入需要的辅助函数
import { invalidateProjectListCache } from './project.service';

/**
 * AI 大纲内存存储
 * key: projectId, value: 大纲数据
 * （实际项目中应使用数据库存储，这里使用 Map 模拟）
 */
const aiOutlineStore = new Map<number, any>();

/**
 * 三级缓存降级获取文集信息
 *
 * 【读取优先级】
 * 1. Redis 缓存（L3）：project:info:{id}，TTL 5分钟
 * 2. MongoDB（L2）：projectMongoCollection
 * 3. 数据库（L1）：projectTable（兜底）
 *
 * 【缓存策略】
 * - Cache-Aside 模式，未命中时从下层获取并写入上层缓存
 * - 写入 Redis 时设置 5 分钟 TTL
 *
 * @param projectId 文集 ID
 * @returns 文集信息（不存在时返回 null）
 */
async function getProjectWithFallback(projectId: number): Promise<MockProject | null> {
  // ========== 1. 尝试从 Redis 缓存获取 ==========
  try {
    const cached = await redis.hgetAll(`project:info:${projectId}`);
    if (cached && Object.keys(cached).length > 0) {
      return {
        id: Number(cached.id),
        name: cached.name,
        intro: cached.intro || '',
        icon: cached.icon || 'FolderOutlined',
        color: cached.color || '#1890ff',
        project_category_id: Number(cached.project_category_id),
        create_user_id: Number(cached.create_user_id),
        role: Number(cached.role),
        is_collaborator: cached.is_collaborator === '1',
        is_top: cached.is_top === '1',
        sort: Number(cached.sort),
        create_time: Number(cached.create_time),
        modify_time: Number(cached.modify_time),
        doc_count: cached.doc_count !== undefined ? Number(cached.doc_count) : 0,
      };
    }
  } catch (error) {
    console.warn('[ProjectInfo] Redis 缓存读取失败，降级到 MongoDB:', error);
  }

  // ========== 2. 从 MongoDB 获取 ==========
  try {
    const mongoProject = await projectMongoCollection.findOne({ id: projectId });
    if (mongoProject) {
      // 写入 Redis 缓存（TTL 5 分钟）
      try {
        const pipeline = redis.pipeline();
        pipeline.hmset(`project:info:${projectId}`, {
          id: String(mongoProject.id),
          name: mongoProject.name,
          intro: mongoProject.intro || '',
          icon: mongoProject.icon || 'FolderOutlined',
          color: mongoProject.color || '#1890ff',
          project_category_id: String(mongoProject.project_category_id),
          create_user_id: String(mongoProject.create_user_id),
          role: String(mongoProject.role),
          is_collaborator: mongoProject.is_collaborator ? '1' : '0',
          is_top: mongoProject.is_top ? '1' : '0',
          sort: String(mongoProject.sort),
          create_time: String(mongoProject.create_time),
          modify_time: String(mongoProject.modify_time),
          doc_count: String(mongoProject.doc_count ?? 0),
        });
        pipeline.expire(`project:info:${projectId}`, 300);
        await pipeline.execAsync();
      } catch (cacheError) {
        console.warn('[ProjectInfo] 写入 Redis 缓存失败:', cacheError);
      }
      return mongoProject as MockProject;
    }
  } catch (error) {
    console.warn('[ProjectInfo] MongoDB 读取失败，降级到数据库:', error);
  }

  // ========== 3. 降级到数据库（L1） ==========
  try {
    const dbProject = projectTable.findById(projectId);
    if (dbProject) {
      return dbProject;
    }
  } catch (error) {
    console.warn('[ProjectInfo] 数据库读取失败:', error);
  }

  return null;
}

// ============================================================================
// 文集详情页子资源服务类
// ============================================================================

class ProjectInfoService {
  // ==================== 文档分类 ====================

  /**
   * 获取文集下的文档分类列表
   *
   * 【性能优化】
   * - 使用三级缓存降级检查文集存在性：Redis → MongoDB → 数据库
   * - 避免每次都直接查询数据库
   *
   * @param projectId 文集 ID
   * @returns 文档分类列表（扁平化，按 sort 排序）
   */
  async getProjectCategories(projectId: number): Promise<any[]> {
    const project = await getProjectWithFallback(projectId);
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }
    return docCategories
      .filter((c) => c.project_id === projectId)
      .sort((a, b) => a.sort - b.sort);
  }

  // ==================== 文档列表 ====================

  /**
   * 获取文集下的文档列表
   * @param projectId 文集 ID
   * @returns 文档列表（扁平化，按 sort 排序）
   */
  getProjectDocs(projectId: number): any[] {
    const project = projectTable.findById(projectId);
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }
    return docs
      .filter((d) => d.project_id === projectId)
      .sort((a, b) => a.sort - b.sort);
  }

  // ==================== 文档版本 ====================

  /**
   * 获取文集下所有文档的版本列表
   * @param projectId 文集 ID
   * @returns 文档版本列表（扁平化）
   */
  getProjectDocVersions(projectId: number): any[] {
    const project = projectTable.findById(projectId);
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }
    // 获取该文集下所有文档的 ID
    const docIds = docs
      .filter((d) => d.project_id === projectId)
      .map((d) => d.id);
    // 返回这些文档的所有版本
    return docVersions.filter((v) => docIds.includes(v.doc_id));
  }

  // ==================== AI 总结大纲 ====================

  /**
   * 获取文集的 AI 总结大纲
   * @param projectId 文集 ID
   * @returns AI 大纲数据（不存在时返回 null）
   */
  getAiOutline(projectId: number): any | null {
    const project = projectTable.findById(projectId);
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }
    // 从内存存储中获取大纲
    const outline = aiOutlineStore.get(projectId);
    if (outline) {
      return outline;
    }
    // 不存在时返回 null（前端会显示"生成大纲"按钮）
    return null;
  }

  /**
   * 生成文集的 AI 总结大纲
   * @param projectId 文集 ID
   * @returns 生成的 AI 大纲数据
   */
  generateAiOutline(projectId: number): any {
    const project = projectTable.findById(projectId);
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }
    // 获取该文集下的文档列表
    const docList = docs
      .filter((d) => d.project_id === projectId)
      .sort((a, b) => a.sort - b.sort);

    if (docList.length === 0) {
      throw new BusinessError('文集下暂无文档，无法生成大纲');
    }

    // 获取该文集下的文档分类
    const categoryList = docCategories
      .filter((c) => c.project_id === projectId)
      .sort((a, b) => a.sort - b.sort);

    // 按文档分类组织章节
    const chapters: any[] = [];

    if (categoryList.length > 0) {
      // 有分类时，按分类组织章节
      categoryList.forEach((category) => {
        const categoryDocs = docList.filter(
          (d) => d.doc_category_id === category.id,
        );
        if (categoryDocs.length > 0) {
          chapters.push({
            title: category.name,
            desc: `包含 ${categoryDocs.length} 篇文档`,
            docs: categoryDocs.map((d) => d.name),
          });
        }
      });
      // 未分类的文档
      const uncategorizedDocs = docList.filter(
        (d) => !d.doc_category_id || d.doc_category_id === 0,
      );
      if (uncategorizedDocs.length > 0) {
        chapters.push({
          title: '未分类',
          desc: `包含 ${uncategorizedDocs.length} 篇未分类文档`,
          docs: uncategorizedDocs.map((d) => d.name),
        });
      }
    } else {
      // 无分类时，每篇文档作为一个章节
      docList.forEach((doc) => {
        chapters.push({
          title: doc.name,
          desc: doc.summary || '暂无描述',
          docs: [doc.name],
        });
      });
    }

    // 生成大纲数据（与前端 AiOutline 类型一致）
    const outline = {
      project_id: projectId,
      summary: `本文集「${project.name}」共包含 ${docList.length} 篇文档，${
        categoryList.length > 0 ? `分为 ${categoryList.length} 个分类，` : ''
      }涵盖项目介绍、核心概念、API 文档等内容。本文档由 AI 自动生成，仅供参考。`,
      chapters,
      created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
      updated_at: new Date().toLocaleString('zh-CN', { hour12: false }),
    };

    // 保存到内存存储
    aiOutlineStore.set(projectId, outline);

    return outline;
  }

  /**
   * 保存文集的 AI 总结大纲
   * @param projectId 文集 ID
   * @param summary 大纲摘要
   * @param chapters 大纲章节
   * @returns 保存后的 AI 大纲数据
   */
  saveAiOutline(projectId: number, summary: string, chapters: any[]): any {
    const project = projectTable.findById(projectId);
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }
    const existing = aiOutlineStore.get(projectId);
    const outline = {
      project_id: projectId,
      summary,
      chapters,
      created_at:
        existing?.created_at ||
        new Date().toLocaleString('zh-CN', { hour12: false }),
      updated_at: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    // 保存到内存存储
    aiOutlineStore.set(projectId, outline);
    return outline;
  }

  // ==================== 文集简介 ====================

  /**
   * 更新文集简介
   * @param id 文集 ID
   * @param intro 新的简介内容
   * @returns 更新后的文集
   */
  async updateProjectIntro(id: number, intro: string): Promise<MockProject> {
    const oldProject = await projectTable.findById(id);
    if (!oldProject) {
      throw new BusinessError('文集不存在', 404);
    }
    const updatedProject = await projectTable.updateById(id, { intro });

    // 缓存和 MongoDB 同步更新（并行执行 + 错误兜底）
    try {
      await Promise.all([
        // 1. 删除文集详情缓存（下次读取时重建）
        projectCache.del(String(id)),
        // 2. 更新 MongoDB 文集集合
        projectMongoCollection.updateOne({ id }, { $set: { intro } }),
      ]);

      // 3. 精确失效列表缓存（intro 变更不影响排序，只影响 all 筛选的展示）
      await invalidateProjectListCache(updatedProject!, ['intro']);
    } catch (error) {
      console.warn('[ProjectCache] 更新文集简介缓存失败:', error);
    }

    return updatedProject!;
  }
}

export const projectInfoService = new ProjectInfoService();
