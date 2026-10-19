// mock/Doc/docVersion.service.ts
// 文档版本管理服务层
// 职责：处理文档版本相关的业务逻辑

import { BusinessError } from '../../Core';
import { redis } from '../../Core/redis';
import {
  docAnnotationTable,
  docMongoCollection,
  docTable,
  docVersionMongoCollection,
  docVersionTable,
  type MockDocVersion,
} from '../../Entities/doc';
import { clearAnnotationCache, updateOrphanStatus } from './docAnnotation.service';

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
    let docExists = false;
    try {
      const mongoDoc = await docMongoCollection.findOne({ id: docId });
      docExists = !!mongoDoc;
    } catch (error) {
      console.warn('[DocMongo] MongoDB 读取失败，降级到 L1:', error);
    }

    if (!docExists) {
      const l1Doc = await docTable.findById(docId);
      if (!l1Doc) {
        throw new BusinessError('文档不存在', 404);
      }
      docExists = true;
    }

    // 2. 生成版本号
    let versionCount = 0;
    try {
      versionCount = await docVersionMongoCollection.countDocuments({ doc_id: docId });
    } catch (error) {
      console.warn('[DocMongo] MongoDB 统计版本数量失败，降级到 L1:', error);
      const allVersions = await docVersionTable.findAll();
      versionCount = allVersions.filter((v) => v.doc_id === docId).length;
    }

    const versionNum = versionCount + 1;
    const now = Date.now();

    // 3. 创建新版本
    const newVersion = await docVersionTable.create({
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
    } as MockDocVersion);

    // 4. 更新文档当前版本 ID 和修改时间
    await docTable.updateById(docId, {
      current_version_id: newVersion.id,
      modify_time: now,
    });

    // 5. 同步更新 MongoDB
    try {
      await docVersionMongoCollection.insertOne(newVersion);
      await docMongoCollection.updateOne(
        { id: docId },
        { $set: { current_version_id: newVersion.id, modify_time: now } },
      );
    } catch (error) {
      console.warn('[DocMongo] 写入 MongoDB 失败:', error);
    }

    // 6. 精确失效 Redis 缓存
    try {
      const cachePipeline = redis.pipeline();
      cachePipeline.del(`doc:info:${docId}`);
      cachePipeline.del(`doc:version:${docId}`);
      await cachePipeline.execAsync();
    } catch (error) {
      console.warn('[DocCache] 清除缓存失败:', error);
    }

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
    // 1. 检查版本是否存在
    let version: MockDocVersion | null = null;
    let docId = 0;

    try {
      const mongoVersion = await docVersionMongoCollection.findOne({ id: versionId });
      if (mongoVersion) {
        version = {
          id: mongoVersion.id,
          doc_id: mongoVersion.doc_id,
          version: mongoVersion.version,
          status: mongoVersion.status,
          content: mongoVersion.content || '',
          outline: mongoVersion.outline || '',
          author_id: mongoVersion.author_id,
          author_name: mongoVersion.author_name || '',
          remark: mongoVersion.remark || '',
          created_at: mongoVersion.created_at || '',
          create_time: mongoVersion.create_time,
          update_time: mongoVersion.update_time,
        };
        docId = mongoVersion.doc_id;
      }
    } catch (error) {
      console.warn('[DocMongo] MongoDB 读取失败，降级到 L1:', error);
    }

    if (!version) {
      const l1Version = await docVersionTable.findById(versionId);
      if (!l1Version) {
        throw new BusinessError('版本不存在', 404);
      }
      version = l1Version;
      docId = l1Version.doc_id;
    }

    const now = Date.now();

    // 2. 更新版本内容
    const updateData: Partial<MockDocVersion> = {};
    if (data.content !== undefined) updateData.content = data.content;
    if (data.outline !== undefined) updateData.outline = data.outline;
    if (data.remark !== undefined) updateData.remark = data.remark;
    if (data.version !== undefined) updateData.version = data.version;
    if (data.status !== undefined) updateData.status = data.status;
    updateData.update_time = now;

    const updatedVersion = await docVersionTable.updateById(
      versionId,
      updateData,
    );

    // 3. 更新文档的修改时间
    await docTable.updateById(docId, { modify_time: now });

    // 4. 同步更新 MongoDB
    try {
      await docVersionMongoCollection.updateOne(
        { id: versionId },
        { $set: updateData },
      );
      await docMongoCollection.updateOne(
        { id: docId },
        { $set: { modify_time: now } },
      );
    } catch (error) {
      console.warn('[DocMongo] 更新 MongoDB 失败:', error);
    }

    // 5. 精确失效 Redis 缓存
    try {
      const cachePipeline = redis.pipeline();
      cachePipeline.del(`doc:info:${docId}`);
      cachePipeline.del(`doc:version:${docId}`);
      await cachePipeline.execAsync();
    } catch (error) {
      console.warn('[DocCache] 清除缓存失败:', error);
    }

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
    // 1. 检查版本是否存在
    let version: MockDocVersion | null = null;
    let docId = 0;

    try {
      const mongoVersion = await docVersionMongoCollection.findOne({ id: versionId });
      if (mongoVersion) {
        version = {
          id: mongoVersion.id,
          doc_id: mongoVersion.doc_id,
          version: mongoVersion.version,
          status: mongoVersion.status,
          content: mongoVersion.content || '',
          outline: mongoVersion.outline || '',
          author_id: mongoVersion.author_id,
          author_name: mongoVersion.author_name || '',
          remark: mongoVersion.remark || '',
          created_at: mongoVersion.created_at || '',
          create_time: mongoVersion.create_time,
          update_time: mongoVersion.update_time,
        };
        docId = mongoVersion.doc_id;
      }
    } catch (error) {
      console.warn('[DocMongo] MongoDB 读取失败，降级到 L1:', error);
    }

    if (!version) {
      const l1Version = await docVersionTable.findById(versionId);
      if (!l1Version) {
        throw new BusinessError('版本不存在', 404);
      }
      version = l1Version;
      docId = l1Version.doc_id;
    }

    const now = Date.now();

    // 2. 更新文档当前版本 ID（只需1次写入）
    await docTable.updateById(docId, {
      current_version_id: versionId,
      modify_time: now,
    });

    // 3. 同步更新 MongoDB
    try {
      await docMongoCollection.updateOne(
        { id: docId },
        { $set: { current_version_id: versionId, modify_time: now } },
      );
    } catch (error) {
      console.warn('[DocMongo] 更新 MongoDB 失败:', error);
    }

    // 4. 精确失效 Redis 缓存
    try {
      const cachePipeline = redis.pipeline();
      cachePipeline.del(`doc:info:${docId}`);
      cachePipeline.del(`doc:version:${docId}`);
      await cachePipeline.execAsync();
    } catch (error) {
      console.warn('[DocCache] 清除缓存失败:', error);
    }

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
    // 1. 检查版本是否存在
    let version: MockDocVersion | null = null;
    let docId = 0;

    try {
      const mongoVersion = await docVersionMongoCollection.findOne({ id: versionId });
      if (mongoVersion) {
        version = {
          id: mongoVersion.id,
          doc_id: mongoVersion.doc_id,
          version: mongoVersion.version,
          status: mongoVersion.status,
          content: mongoVersion.content || '',
          outline: mongoVersion.outline || '',
          author_id: mongoVersion.author_id,
          author_name: mongoVersion.author_name || '',
          remark: mongoVersion.remark || '',
          created_at: mongoVersion.created_at || '',
          create_time: mongoVersion.create_time,
          update_time: mongoVersion.update_time,
        };
        docId = mongoVersion.doc_id;
      }
    } catch (error) {
      console.warn('[DocMongo] MongoDB 读取失败，降级到 L1:', error);
    }

    if (!version) {
      const l1Version = await docVersionTable.findById(versionId);
      if (!l1Version) {
        throw new BusinessError('版本不存在', 404);
      }
      version = l1Version;
      docId = l1Version.doc_id;
    }

    const now = Date.now();

    // 2. 更新原文
    await docVersionTable.updateById(versionId, {
      content,
      update_time: now,
    });

    // 3. 检测哪些标记被删除，将对应批注标记为孤立批注
    await updateOrphanStatus(versionId, content);

    // 4. 更新文档的修改时间
    await docTable.updateById(docId, { modify_time: now });

    // 5. 同步更新 MongoDB
    try {
      await docVersionMongoCollection.updateOne(
        { id: versionId },
        { $set: { content, update_time: now } },
      );
      await docMongoCollection.updateOne(
        { id: docId },
        { $set: { modify_time: now } },
      );
    } catch (error) {
      console.warn('[DocMongo] 更新 MongoDB 失败:', error);
    }

    // 6. 精确失效 Redis 缓存
    try {
      const cachePipeline = redis.pipeline();
      cachePipeline.del(`doc:info:${docId}`);
      cachePipeline.del(`doc:version:${docId}`);
      await cachePipeline.execAsync();
    } catch (error) {
      console.warn('[DocCache] 清除缓存失败:', error);
    }

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
    // 1. 检查版本是否存在
    let version: MockDocVersion | null = null;
    let docId = 0;

    try {
      const mongoVersion = await docVersionMongoCollection.findOne({ id: versionId });
      if (mongoVersion) {
        version = {
          id: mongoVersion.id,
          doc_id: mongoVersion.doc_id,
          version: mongoVersion.version,
          status: mongoVersion.status,
          content: mongoVersion.content || '',
          outline: mongoVersion.outline || '',
          author_id: mongoVersion.author_id,
          author_name: mongoVersion.author_name || '',
          remark: mongoVersion.remark || '',
          created_at: mongoVersion.created_at || '',
          create_time: mongoVersion.create_time,
          update_time: mongoVersion.update_time,
        };
        docId = mongoVersion.doc_id;
      }
    } catch (error) {
      console.warn('[DocMongo] MongoDB 读取失败，降级到 L1:', error);
    }

    if (!version) {
      const l1Version = await docVersionTable.findById(versionId);
      if (!l1Version) {
        throw new BusinessError('版本不存在', 404);
      }
      version = l1Version;
      docId = l1Version.doc_id;
    }

    // 2. 检查是否是当前版本（从文档的 current_version_id 判断）
    let currentVersionId = 0;
    try {
      const mongoDoc = await docMongoCollection.findOne({ id: docId });
      if (mongoDoc) {
        currentVersionId = mongoDoc.current_version_id || 0;
      }
    } catch (error) {
      console.warn('[DocMongo] MongoDB 读取文档失败，降级到 L1:', error);
    }
    if (currentVersionId === 0) {
      const l1Doc = await docTable.findById(docId);
      currentVersionId = l1Doc?.current_version_id || 0;
    }

    if (currentVersionId === versionId) {
      throw new BusinessError('当前版本不能删除，请先设置其他版本为当前版本');
    }

    const now = Date.now();

    // 3. 删除版本的批注（级联删除）
    try {
      const allAnnotations = await docAnnotationTable.findAll();
      const versionAnnotations = allAnnotations.filter((a) => a.version_id === versionId);
      for (const annotation of versionAnnotations) {
        await docAnnotationTable.deleteById(annotation.id);
      }
      clearAnnotationCache(versionId);
    } catch (error) {
      console.warn('[Doc] 删除版本批注失败:', error);
    }

    // 4. 删除版本
    await docVersionTable.deleteById(versionId);

    // 5. 更新文档的修改时间
    await docTable.updateById(docId, { modify_time: now });

    // 6. 同步删除 MongoDB 中的版本
    try {
      await docVersionMongoCollection.deleteOne({ id: versionId });
      await docMongoCollection.updateOne(
        { id: docId },
        { $set: { modify_time: now } },
      );
    } catch (error) {
      console.warn('[DocMongo] 删除 MongoDB 失败:', error);
    }

    // 7. 精确失效 Redis 缓存
    try {
      const cachePipeline = redis.pipeline();
      cachePipeline.del(`doc:info:${docId}`);
      cachePipeline.del(`doc:version:${docId}`);
      await cachePipeline.execAsync();
    } catch (error) {
      console.warn('[DocCache] 清除缓存失败:', error);
    }

    return { id: versionId };
  }
}

// ============================================================================
// 导出服务实例
// ============================================================================

export const docVersionService = new DocVersionService();
