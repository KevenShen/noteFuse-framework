// mock/Module/Doc/docAnnotation.repository.ts
// 文档批注数据访问层（Repository 模式）
// 职责：封装批注、版本、文档等存取细节
// 【数据分层】L1 MockTable（主存储）→ L2 MongoDB（二级缓存）→ L0 内存缓存（进程级）

import { redis } from '../../Core/redis';
import {
  docAnnotationTable,
  docInfoCache,
  docMongoCollection,
  docTable,
  docVersionMongoCollection,
  docVersionTable,
  type MockDocAnnotation,
  type MockDocVersion,
} from '../../Entities/doc';

// ============================================================================
// 模块级常量与内存缓存
// ============================================================================

/** 批注缓存 TTL：5 分钟 */
const ANNOTATION_CACHE_TTL = 5 * 60 * 1000;

/** 批注内存缓存（进程级 L0 缓存） */
const annotationCache = new Map<
  number,
  { data: MockDocAnnotation[]; timestamp: number }
>();

// ============================================================================
// 文档批注数据访问类
// ============================================================================

class DocAnnotationRepository {
  // ==================== 批注查询（L0 内存缓存 → L1 MockTable） ====================

  /**
   * 获取版本的批注列表（三级缓存：内存 → 数据库）
   * @param versionId 版本 ID
   * @returns 批注列表（按 marker_id 排序）
   */
  async getAnnotationsByVersionId(
    versionId: number,
  ): Promise<MockDocAnnotation[]> {
    // L0：内存缓存
    const cached = annotationCache.get(versionId);
    const now = Date.now();
    if (cached && now - cached.timestamp < ANNOTATION_CACHE_TTL) {
      return [...cached.data];
    }

    // L1：MockTable
    const allAnnotations = await docAnnotationTable.findAll();
    const versionAnnotations = allAnnotations
      .filter((a) => a.version_id === versionId)
      .sort((a, b) => (a.marker_id ?? 0) - (b.marker_id ?? 0));

    // 写入内存缓存
    annotationCache.set(versionId, {
      data: [...versionAnnotations],
      timestamp: now,
    });

    return versionAnnotations;
  }

  /**
   * 按 ID 查询批注
   * @param id 批注 ID
   * @returns 批注对象
   */
  async findById(id: number): Promise<MockDocAnnotation | null> {
    const result = await docAnnotationTable.findById(id);
    return result ?? null;
  }

  /**
   * 查询指定版本的所有批注
   * @param versionId 版本 ID
   * @returns 批注数组
   */
  async findByVersionId(versionId: number): Promise<MockDocAnnotation[]> {
    const allAnnotations = await docAnnotationTable.findAll();
    return allAnnotations.filter((a) => a.version_id === versionId);
  }

  // ==================== 批注写入 ====================

  /**
   * 创建批注
   * @param data 批注数据
   * @returns 创建的批注
   */
  async create(data: Partial<MockDocAnnotation>): Promise<MockDocAnnotation> {
    return docAnnotationTable.create(data as MockDocAnnotation);
  }

  /**
   * 更新批注
   * @param id 批注 ID
   * @param data 更新数据
   * @returns 更新后的批注
   */
  async update(
    id: number,
    data: Partial<MockDocAnnotation>,
  ): Promise<MockDocAnnotation | null> {
    const result = await docAnnotationTable.updateById(id, data);
    return result ?? null;
  }

  /**
   * 删除批注
   * @param id 批注 ID
   */
  async delete(id: number): Promise<void> {
    await docAnnotationTable.deleteById(id);
  }

  // ==================== 版本查询（三级降级：MongoDB → MockTable） ====================

  /**
   * 按 ID 查询版本（三级降级：MongoDB → MockTable）
   * @param id 版本 ID
   * @returns 版本对象
   */
  async findVersionById(id: number): Promise<MockDocVersion | null> {
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
   * 更新版本内容（MockTable + MongoDB 双写）
   * @param id 版本 ID
   * @param data 更新数据
   */
  async updateVersionContent(
    id: number,
    data: { content: string; update_time: number },
  ): Promise<void> {
    await docVersionTable.updateById(id, data);

    try {
      await docVersionMongoCollection.updateOne({ id }, { $set: data });
    } catch (error) {
      console.warn('[DocAnnotationRepository] 更新版本 MongoDB 失败:', error);
    }
  }

  // ==================== 文档操作 ====================

  /**
   * 更新文档修改时间（MockTable + MongoDB 双写）
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
      console.warn('[DocAnnotationRepository] 更新文档修改时间 MongoDB 失败:', error);
    }
  }

  // ==================== 缓存操作 ====================

  /**
   * 清除指定版本的批注内存缓存
   * @param versionId 版本 ID
   */
  clearAnnotationCache(versionId: number): void {
    annotationCache.delete(versionId);
  }

  /**
   * 清除所有批注内存缓存
   */
  clearAllAnnotationCache(): void {
    annotationCache.clear();
  }

  /**
   * 失效文档详情缓存（Redis）
   * @param docId 文档 ID
   */
  async invalidateDocCache(docId: number): Promise<void> {
    try {
      const pipeline = redis.pipeline();
      pipeline.del(`doc:info:${docId}`);
      pipeline.del(`doc:version:${docId}`);
      await pipeline.execAsync();
    } catch (error) {
      console.warn('[DocAnnotationRepository] 清除文档缓存失败:', error);
    }
  }
}

// ============================================================================
// 导出 Repository 实例
// ============================================================================

export const docAnnotationRepository = new DocAnnotationRepository();
