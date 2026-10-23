// mock/Module/Doc/docVersion.repository.ts
// 文档版本数据访问层（Repository 模式）
// 职责：封装版本、文档等存取细节
// 【数据分层】L1 MockTable（主存储）→ L2 MongoDB（二级缓存）→ L3 Redis（三级缓存）

import { redis } from '../../Core/redis';
import {
  docAnnotationTable,
  docMongoCollection,
  docTable,
  docVersionMongoCollection,
  docVersionTable,
  type MockDocVersion,
} from '../../Entities/doc';

// ============================================================================
// 文档版本数据访问类
// ============================================================================

class DocVersionRepository {
  // ==================== 版本查询（三级降级：MongoDB → MockTable） ====================

  /**
   * 按 ID 查询版本（三级降级：MongoDB → MockTable）
   * @param id 版本 ID
   * @returns 版本对象
   */
  async findById(id: number): Promise<MockDocVersion | null> {
    // L2：MongoDB
    try {
      const mongoVersion = await docVersionMongoCollection.findOne({ id });
      if (mongoVersion) {
        return mongoVersion as MockDocVersion;
      }
    } catch {
      // MongoDB 失败，降级到 MockTable
    }

    // L1：MockTable
    const result = await docVersionTable.findById(id);
    return result ?? null;
  }

  /**
   * 统计文档的版本数量
   * @param docId 文档 ID
   * @returns 版本数量
   */
  async countByDocId(docId: number): Promise<number> {
    try {
      return await docVersionMongoCollection.countDocuments({ doc_id: docId });
    } catch {
      // MongoDB 失败，降级到 MockTable
      const allVersions = await docVersionTable.findAll();
      return allVersions.filter((v) => v.doc_id === docId).length;
    }
  }

  // ==================== 版本写入（双写：MockTable + MongoDB） ====================

  /**
   * 创建版本（MockTable + MongoDB 双写）
   * @param data 版本数据
   * @returns 创建的版本
   */
  async create(data: Partial<MockDocVersion>): Promise<MockDocVersion> {
    const newVersion = await docVersionTable.create(data as MockDocVersion);

    try {
      await docVersionMongoCollection.insertOne(newVersion);
    } catch (error) {
      console.warn('[DocVersionRepository] 创建版本 MongoDB 失败:', error);
    }

    return newVersion;
  }

  /**
   * 更新版本（MockTable + MongoDB 双写）
   * @param id 版本 ID
   * @param data 更新数据
   * @returns 更新后的版本
   */
  async update(
    id: number,
    data: Partial<MockDocVersion>,
  ): Promise<MockDocVersion | null> {
    const updatedVersion = await docVersionTable.updateById(id, data);

    try {
      await docVersionMongoCollection.updateOne({ id }, { $set: data });
    } catch (error) {
      console.warn('[DocVersionRepository] 更新版本 MongoDB 失败:', error);
    }

    return updatedVersion ?? null;
  }

  /**
   * 删除版本（MockTable + MongoDB 双删）
   * @param id 版本 ID
   */
  async delete(id: number): Promise<void> {
    await docVersionTable.deleteById(id);

    try {
      await docVersionMongoCollection.deleteOne({ id });
    } catch (error) {
      console.warn('[DocVersionRepository] 删除版本 MongoDB 失败:', error);
    }
  }

  // ==================== 文档操作 ====================

  /**
   * 检查文档是否存在（三级降级：MongoDB → MockTable）
   * @param docId 文档 ID
   * @returns 是否存在
   */
  async docExists(docId: number): Promise<boolean> {
    try {
      const doc = await docMongoCollection.findOne({ id: docId });
      return !!doc;
    } catch {
      // MongoDB 失败，降级到 MockTable
    }
    const doc = await docTable.findById(docId);
    return !!doc;
  }

  /**
   * 查询文档的当前版本 ID
   * @param docId 文档 ID
   * @returns 当前版本 ID
   */
  async getCurrentVersionId(docId: number): Promise<number> {
    try {
      const doc = await docMongoCollection.findOne({ id: docId });
      if (doc) {
        return doc.current_version_id || 0;
      }
    } catch {
      // MongoDB 失败，降级到 MockTable
    }
    const doc = await docTable.findById(docId);
    return doc?.current_version_id || 0;
  }

  /**
   * 更新文档的当前版本 ID 和修改时间
   * @param docId 文档 ID
   * @param currentVersionId 当前版本 ID
   * @param modifyTime 修改时间
   */
  async updateCurrentVersion(
    docId: number,
    currentVersionId: number,
    modifyTime: number,
  ): Promise<void> {
    await docTable.updateById(docId, {
      current_version_id: currentVersionId,
      modify_time: modifyTime,
    });

    try {
      await docMongoCollection.updateOne(
        { id: docId },
        { $set: { current_version_id: currentVersionId, modify_time: modifyTime } },
      );
    } catch (error) {
      console.warn('[DocVersionRepository] 更新文档当前版本 MongoDB 失败:', error);
    }
  }

  /**
   * 更新文档的修改时间
   * @param docId 文档 ID
   * @param modifyTime 修改时间
   */
  async updateDocModifyTime(docId: number, modifyTime: number): Promise<void> {
    await docTable.updateById(docId, { modify_time: modifyTime });

    try {
      await docMongoCollection.updateOne(
        { id: docId },
        { $set: { modify_time: modifyTime } },
      );
    } catch (error) {
      console.warn('[DocVersionRepository] 更新文档修改时间 MongoDB 失败:', error);
    }
  }

  // ==================== 批注操作 ====================

  /**
   * 删除指定版本的所有批注
   * @param versionId 版本 ID
   */
  async deleteAnnotationsByVersionId(versionId: number): Promise<void> {
    const allAnnotations = await docAnnotationTable.findAll();
    const versionAnnotations = allAnnotations.filter((a) => a.version_id === versionId);
    for (const annotation of versionAnnotations) {
      await docAnnotationTable.deleteById(annotation.id);
    }
  }

  // ==================== Redis 缓存操作 ====================

  /**
   * 失效文档详情缓存
   * @param docId 文档 ID
   */
  async invalidateDocCache(docId: number): Promise<void> {
    try {
      const pipeline = redis.pipeline();
      pipeline.del(`doc:info:${docId}`);
      pipeline.del(`doc:version:${docId}`);
      await pipeline.execAsync();
    } catch (error) {
      console.warn('[DocVersionRepository] 清除文档缓存失败:', error);
    }
  }
}

// ============================================================================
// 导出 Repository 实例
// ============================================================================

export const docVersionRepository = new DocVersionRepository();
