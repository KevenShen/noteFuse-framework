// mock/Doc/docVersion.service.ts
// 文档版本管理服务层
// 职责：处理文档版本相关的业务逻辑

import { BusinessError } from '../../Core';
import type { MockDocVersion } from '../../Entities/doc';
import { clearAnnotationCache, updateOrphanStatus } from './docAnnotation.service';
import { docVersionRepository } from './docVersion.repository';

// ============================================================================
// 文档版本服务类
// ============================================================================

class DocVersionService {
  // ==================== 创建版本 ====================

  /**
   * 新建版本
   *
   * @param docId 文档 ID
   * @param data 版本数据
   * @returns 创建的新版本
   */
  async createDocVersion(
    docId: number,
    data: {
      content?: string;
      remark?: string;
      version_name?: string;
      version?: string;
      status?: string;
      base_version_id?: number;
      author_id?: number;
      author_name?: string;
    },
  ): Promise<MockDocVersion> {
    // 1. 检查文档是否存在
    const docExists = await docVersionRepository.docExists(docId);
    if (!docExists) {
      throw new BusinessError('文档不存在', 404);
    }

    // 2. 生成版本号
    const versionCount = await docVersionRepository.countByDocId(docId);
    const versionNum = versionCount + 1;
    const now = Date.now();

    // 3. 创建新版本（MockTable + MongoDB）
    const newVersion = await docVersionRepository.create({
      doc_id: docId,
      version: data.version || data.version_name || `v${versionNum}.0`,
      status: (data.status || 'draft') as
        | 'draft'
        | 'published'
        | 'archived'
        | 'deprecated',
      author_id: data.author_id || 1,
      author_name: data.author_name || 'admin',
      content: data.content || '',
      outline: '',
      remark: data.remark || '',
      base_version_id: data.base_version_id || null,
      created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
      create_time: now,
      update_time: now,
    } as Partial<MockDocVersion>);

    // 4. 更新文档当前版本 ID
    await docVersionRepository.updateCurrentVersion(docId, newVersion.id, now);

    // 5. 失效缓存
    await docVersionRepository.invalidateDocCache(docId);

    return newVersion;
  }

  // ==================== 更新版本 ====================

  /**
   * 更新版本内容（支持 content、outline、remark）
   *
   * @param versionId 版本 ID
   * @param data 更新数据
   * @returns 更新后的版本
   */
  async updateDocVersion(
    versionId: number,
    data: {
      content?: string;
      outline?: string;
      remark?: string;
      version?: string;
      status?: string;
    },
  ): Promise<MockDocVersion> {
    // 1. 查询版本
    const version = await docVersionRepository.findById(versionId);
    if (!version) {
      throw new BusinessError('版本不存在', 404);
    }

    const docId = version.doc_id;
    const now = Date.now();

    // 2. 构建更新数据
    const updateData: Partial<MockDocVersion> = {};
    if (data.content !== undefined) updateData.content = data.content;
    if (data.outline !== undefined) updateData.outline = data.outline;
    if (data.remark !== undefined) updateData.remark = data.remark;
    if (data.version !== undefined) updateData.version = data.version;
    if (data.status !== undefined) updateData.status = data.status;
    updateData.update_time = now;

    // 3. 更新版本（MockTable + MongoDB）
    const updatedVersion = await docVersionRepository.update(versionId, updateData);

    // 4. 更新文档修改时间
    await docVersionRepository.updateDocModifyTime(docId, now);

    // 5. 失效缓存
    await docVersionRepository.invalidateDocCache(docId);

    return updatedVersion!;
  }

  // ==================== 设为当前版本 ====================

  /**
   * 设为当前版本（只需更新 doc.current_version_id，1次写入）
   *
   * @param versionId 版本 ID
   * @returns 更新后的版本
   */
  async setCurrentVersion(versionId: number): Promise<MockDocVersion> {
    // 1. 查询版本
    const version = await docVersionRepository.findById(versionId);
    if (!version) {
      throw new BusinessError('版本不存在', 404);
    }

    const docId = version.doc_id;
    const now = Date.now();

    // 2. 更新文档当前版本 ID
    await docVersionRepository.updateCurrentVersion(docId, versionId, now);

    // 3. 失效缓存
    await docVersionRepository.invalidateDocCache(docId);

    return version;
  }

  // ==================== 保存版本原文 ====================

  /**
   * 保存版本原文（带标记，同时检测孤立批注）
   *
   * @param versionId 版本 ID
   * @param content 原文内容
   * @returns 保存结果
   */
  async saveVersionContent(
    versionId: number,
    content: string,
  ): Promise<{ id: number; content: string }> {
    // 1. 查询版本
    const version = await docVersionRepository.findById(versionId);
    if (!version) {
      throw new BusinessError('版本不存在', 404);
    }

    const docId = version.doc_id;
    const now = Date.now();

    // 2. 更新原文
    await docVersionRepository.update(versionId, {
      content,
      update_time: now,
    });

    // 3. 检测孤立批注
    await updateOrphanStatus(versionId, content);

    // 4. 更新文档修改时间
    await docVersionRepository.updateDocModifyTime(docId, now);

    // 5. 失效缓存
    await docVersionRepository.invalidateDocCache(docId);

    return { id: versionId, content };
  }

  // ==================== 删除版本 ====================

  /**
   * 删除版本（级联删除批注，禁止删除当前版本）
   *
   * @param versionId 版本 ID
   * @returns 删除的版本 ID
   */
  async deleteDocVersion(versionId: number): Promise<{ id: number }> {
    // 1. 查询版本
    const version = await docVersionRepository.findById(versionId);
    if (!version) {
      throw new BusinessError('版本不存在', 404);
    }

    const docId = version.doc_id;

    // 2. 检查是否是当前版本
    const currentVersionId = await docVersionRepository.getCurrentVersionId(docId);
    if (currentVersionId === versionId) {
      throw new BusinessError('当前版本不能删除，请先设置其他版本为当前版本');
    }

    const now = Date.now();

    // 3. 删除版本的批注（级联删除）
    try {
      await docVersionRepository.deleteAnnotationsByVersionId(versionId);
      clearAnnotationCache(versionId);
    } catch (error) {
      console.warn('[Doc] 删除版本批注失败:', error);
    }

    // 4. 删除版本
    await docVersionRepository.delete(versionId);

    // 5. 更新文档修改时间
    await docVersionRepository.updateDocModifyTime(docId, now);

    // 6. 失效缓存
    await docVersionRepository.invalidateDocCache(docId);

    return { id: versionId };
  }
}

// ============================================================================
// 导出服务实例
// ============================================================================

export const docVersionService = new DocVersionService();
