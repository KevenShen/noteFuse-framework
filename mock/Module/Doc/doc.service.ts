// mock/Doc/doc.service.ts
// 文档 CRUD 服务层
// 职责：处理文档核心 CRUD 相关的业务逻辑

import type { Request } from 'express';
import { BusinessError } from '../../Core';
import type { MockDoc, MockDocVersion } from '../../Entities/doc';
import { tagRelations, tags } from '../../Entities/tag';
import { docRepository } from './doc.repository';

// ============================================================================
// 文档服务类
// ============================================================================

class DocService {
  // ==================== 私有辅助方法 ====================

  /** 从请求中提取用户 ID */
  private getUserIdFromRequest(req: Request): number {
    return Number((req.body as any)?.user_id) || 1;
  }

  /**
   * 更新文集的文档数量（doc_count）
   *
   * @param projectId 文集 ID
   * @param delta 变化量（+1 新增文档，-1 删除文档）
   */
  private async updateProjectDocCount(
    projectId: number,
    delta: number,
  ): Promise<void> {
    if (projectId <= 0) return;

    try {
      // 1. MongoDB 原子更新
      await docRepository.incrementProjectDocCount(projectId, delta);

      // 2. Redis 缓存更新
      await docRepository.updateProjectDocCountInRedis(projectId, delta);

      // 3. 失效文集列表缓存
      await docRepository.invalidateProjectListCache(projectId);
    } catch (error) {
      console.warn('[Doc] 更新文集 doc_count 失败:', error);
    }
  }

  // ==================== 创建文档 ====================

  /**
   * 新建文档
   *
   * @param data 请求参数
   * @returns 创建的文档
   */
  async createDoc(data: {
    project_id: number;
    name: string;
    summary?: string;
    doc_category_id?: number;
    sort?: number;
    author_id?: number;
    author_name?: string;
    version_overview?: string;
  }): Promise<MockDoc> {
    const projectId = data.project_id;
    const categoryId = data.doc_category_id ?? 0;

    // 1. 检查文集是否存在
    const projectExists = await docRepository.projectExists(projectId);
    if (!projectExists) {
      throw new BusinessError('文集不存在');
    }

    // 2. 计算 sort
    let docSort = data.sort;
    if (docSort === undefined) {
      const docCount = await docRepository.countByProjectId(projectId);
      docSort = docCount + 1;
    }

    // 3. 创建文档（MockTable + MongoDB，Repository 一次完成）
    const now = Date.now();
    const newDoc = await docRepository.create({
      project_id: projectId,
      name: data.name,
      summary: data.summary || '',
      doc_category_id: categoryId,
      sort: docSort,
      author_id: data.author_id || 1,
      author_name: data.author_name || 'admin',
      version_overview: data.version_overview || '',
      created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
      modify_time: now,
    } as MockDoc);

    // 4. 更新文集修改时间和文档数量
    await docRepository.updateProjectModifyTime(projectId, now);
    await this.updateProjectDocCount(projectId, 1);

    // 5. Redis 缓存初始化
    try {
      await docRepository.createDocCache(newDoc);
      await docRepository.invalidateDocListCache(projectId, categoryId);
    } catch (error) {
      console.warn('[DocCache] 创建文档缓存失败:', error);
    }

    return newDoc;
  }

  // ==================== 获取文档详情 ====================

  /**
   * 获取文档详情（含版本概览 version_overview）
   *
   * @param id 文档 ID
   * @param versionId 指定版本 ID（可选）
   * @returns 文档详情（含版本列表、标签、版本概览）
   */
  async getDocDetail(
    id: number,
    versionId?: number,
  ): Promise<{
    doc: MockDoc;
    version_overview?: string;
    author_id?: number;
    author_name?: string;
    current_version: MockDocVersion | null;
    versions?: MockDocVersion[];
    tags: any[];
  }> {
    // 1. 查询文档（三级降级：Redis → MongoDB → MockTable）
    const doc = await docRepository.findById(id);
    if (!doc) {
      throw new BusinessError('文档不存在', 404);
    }

    // 2. 查询版本列表
    const versions = await docRepository.findVersionsByDocId(id);

    // 3. 确定目标版本
    const targetVersion = versionId
      ? versions.find((v) => v.id === Number(versionId))
      : versions.find((v) => v.id === doc?.current_version_id) || versions[0];

    // 4. 获取该文档的标签
    const docTagIds = tagRelations
      .filter((r) => r.target_id === id && r.type === 'doc')
      .map((r) => r.tag_id);
    const docTags = tags.filter((t) => docTagIds.includes(t.id));

    return {
      doc,
      version_overview: doc?.version_overview,
      author_id: targetVersion?.author_id,
      author_name: targetVersion?.author_name,
      current_version: targetVersion || null,
      versions: versions.length > 0 ? versions : undefined,
      tags: docTags,
    };
  }

  // ==================== 更新文档 ====================

  /**
   * 更新文档（只更新文档基本信息）
   *
   * @param id 文档 ID
   * @param data 更新数据
   * @returns 更新后的文档基本信息
   */
  async updateDoc(
    id: number,
    data: {
      name?: string;
      summary?: string;
      doc_category_id?: number;
      sort?: number;
      version_overview?: string;
    },
  ): Promise<{
    id: number;
    name: string;
    summary: string;
    version_overview: string;
  }> {
    // 1. 查询文档（三级降级）
    const doc = await docRepository.findById(id);
    if (!doc) {
      throw new BusinessError('文档不存在', 404);
    }

    const oldCategoryId = doc.doc_category_id;
    const projectId = doc.project_id;
    const now = Date.now();

    // 2. 构造更新数据
    const updateData: Partial<MockDoc> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.summary !== undefined) updateData.summary = data.summary;
    if (data.doc_category_id !== undefined)
      updateData.doc_category_id = data.doc_category_id;
    if (data.sort !== undefined) updateData.sort = data.sort;
    if (data.version_overview !== undefined)
      updateData.version_overview = data.version_overview;
    updateData.modify_time = now;

    // 3. 更新文档（MockTable + MongoDB，Repository 一次完成）
    const updatedDoc = await docRepository.update(id, updateData);
    if (!updatedDoc) {
      throw new BusinessError('文档更新失败', 500);
    }

    // 4. 缓存更新
    try {
      // 删除详情缓存（下次读取时重建）
      await docRepository.deleteDocCache(id, projectId, oldCategoryId);

      // 分类变更时，失效新分类的列表缓存
      const newCategoryId =
        data.doc_category_id !== undefined
          ? data.doc_category_id
          : oldCategoryId;
      await docRepository.invalidateDocListCache(projectId, oldCategoryId);
      if (oldCategoryId !== newCategoryId) {
        await docRepository.invalidateDocListCache(projectId, newCategoryId);
      }
    } catch (error) {
      console.warn('[DocCache] 更新文档缓存失败:', error);
    }

    return {
      id: updatedDoc.id,
      name: updatedDoc.name,
      summary: updatedDoc.summary,
      version_overview: updatedDoc.version_overview,
    };
  }

  // ==================== 删除文档 ====================

  /**
   * 删除文档（级联删除版本、标签关联、浏览历史、批注）
   *
   * @param id 文档 ID
   * @returns 删除的文档 ID
   */
  async deleteDoc(id: number): Promise<{ id: number }> {
    // 1. 查询文档（三级降级）
    const doc = await docRepository.findById(id);
    if (!doc) {
      throw new BusinessError('文档不存在', 404);
    }

    const categoryId = doc.doc_category_id;
    const projectId = doc.project_id;

    // 2. 级联删除：版本 + 批注 + 浏览历史
    try {
      await docRepository.deleteVersionsByDocId(id);
      await docRepository.deleteAnnotationsByDocId(id);
      await docRepository.deleteBrowseHistoryByDocId(id);
    } catch (error) {
      console.warn('[Doc] 级联删除失败:', error);
    }

    // 3. 删除文档的标签关联
    try {
      for (let i = tagRelations.length - 1; i >= 0; i--) {
        if (
          tagRelations[i].target_id === id &&
          tagRelations[i].type === 'doc'
        ) {
          tagRelations.splice(i, 1);
        }
      }
    } catch (error) {
      console.warn('[Doc] 删除标签关联失败:', error);
    }

    // 4. 删除文档本身（MockTable + MongoDB）
    await docRepository.delete(id);

    // 5. 更新文集的 doc_count（-1）
    await this.updateProjectDocCount(projectId, -1);

    // 6. Redis 缓存清理
    try {
      await docRepository.deleteDocCache(id, projectId, categoryId);
      await docRepository.invalidateDocListCache(projectId, categoryId);
    } catch (error) {
      console.warn('[DocCache] 删除文档缓存失败:', error);
    }

    return { id };
  }
}

// ============================================================================
// 导出服务实例
// ============================================================================

export const docService = new DocService();
