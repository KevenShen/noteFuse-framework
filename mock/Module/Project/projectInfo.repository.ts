// mock/Module/Project/projectInfo.repository.ts
// 文集详情页子资源数据访问层（Repository）
// 职责：封装文档分类、文档列表、文档版本、AI 大纲、文集简介等子资源的数据存取

import { redis } from '../../Core/redis';
import {
  docCategoryTable,
  docTable,
  docVersionTable,
} from '../../Entities/doc';
import type { MockProject } from '../../Entities/project';
import {
  projectCache,
  projectMongoCollection,
  projectTable,
} from '../../Entities/project';
import { projectRepository } from './project.repository';

// ============================================================================
// AI 大纲内存存储
// ============================================================================

/**
 * AI 大纲内存存储
 * key: projectId, value: 大纲数据
 * （实际项目中应使用数据库存储，这里使用 Map 模拟）
 */
const aiOutlineStore = new Map<number, any>();

// ============================================================================
// 文集详情页子资源数据访问类
// ============================================================================

class ProjectInfoRepository {
  // ==================== 文集存在性检查 ====================

  /**
   * 检查文集是否存在（三级降级：Redis → MongoDB → MockTable）
   * 【复用】projectRepository.findById
   *
   * @param projectId 文集 ID
   * @returns 文集对象，不存在时返回 null
   */
  async findProject(projectId: number): Promise<MockProject | null> {
    return projectRepository.findById(projectId);
  }

  // ==================== 文档分类查询 ====================

  /**
   * 获取文集下的文档分类列表
   *
   * @param projectId 文集 ID
   * @returns 文档分类列表（按 sort 排序）
   */
  async findDocCategories(projectId: number): Promise<any[]> {
    const allCategories = await docCategoryTable.findAll();
    return allCategories
      .filter((c) => c.project_id === projectId)
      .sort((a, b) => a.sort - b.sort);
  }

  // ==================== 文档查询 ====================

  /**
   * 获取文集下的文档列表
   *
   * @param projectId 文集 ID
   * @returns 文档列表（按 sort 排序）
   */
  async findDocs(projectId: number): Promise<any[]> {
    const allDocs = await docTable.findAll();
    return allDocs
      .filter((d) => d.project_id === projectId)
      .sort((a, b) => a.sort - b.sort);
  }

  /**
   * 获取文集下的文档 ID 列表
   *
   * @param projectId 文集 ID
   * @returns 文档 ID 列表
   */
  async findDocIds(projectId: number): Promise<number[]> {
    const docs = await this.findDocs(projectId);
    return docs.map((d) => d.id);
  }

  // ==================== 文档版本查询 ====================

  /**
   * 获取文集下所有文档的版本列表
   *
   * @param projectId 文集 ID
   * @returns 文档版本列表
   */
  async findDocVersions(projectId: number): Promise<any[]> {
    const docIds = await this.findDocIds(projectId);
    const allVersions = await docVersionTable.findAll();
    return allVersions.filter((v) => docIds.includes(v.doc_id));
  }

  // ==================== AI 大纲存储 ====================

  /**
   * 获取文集的 AI 总结大纲
   *
   * @param projectId 文集 ID
   * @returns AI 大纲数据（不存在时返回 null）
   */
  getAiOutline(projectId: number): any | null {
    return aiOutlineStore.get(projectId) ?? null;
  }

  /**
   * 保存文集的 AI 总结大纲
   *
   * @param projectId 文集 ID
   * @param outline 大纲数据
   */
  saveAiOutline(projectId: number, outline: any): void {
    aiOutlineStore.set(projectId, outline);
  }

  // ==================== 文集简介更新 ====================

  /**
   * 更新文集简介（MockTable + MongoDB + 缓存删除，并行执行）
   *
   * @param id 文集 ID
   * @param intro 新的简介内容
   * @returns 更新后的文集
   */
  async updateIntro(id: number, intro: string): Promise<MockProject | null> {
    const updatedProject = await projectTable.updateById(id, { intro });

    // 缓存和 MongoDB 同步更新（并行执行 + 错误兜底）
    try {
      await Promise.all([
        // 删除文集详情缓存（下次读取时重建）
        projectCache.del(String(id)),
        // 更新 MongoDB 文集集合
        projectMongoCollection.updateOne({ id }, { $set: { intro } }),
      ]);
    } catch (error) {
      console.warn('[ProjectInfoRepository] 更新文集简介缓存失败:', error);
    }

    return updatedProject;
  }

  // ==================== 文集详情缓存操作 ====================

  /**
   * 删除文集详情缓存
   * @param id 文集 ID
   */
  async deleteInfoCache(id: number): Promise<void> {
    await redis.del(`project:info:${id}`);
  }
}

export const projectInfoRepository = new ProjectInfoRepository();
