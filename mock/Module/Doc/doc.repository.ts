// mock/Module/Doc/doc.repository.ts
// 文档数据访问层（Repository 模式）
// 职责：封装数据库（MockTable）、MongoDB、Redis 缓存等存取细节
// 【设计原则】业务层只调用 Repository 接口，不直接操作存储层
// 【数据分层】L1 MockTable（主存储）→ L2 MongoDB（二级缓存）→ L3 Redis（三级缓存）

import { redis } from '../../Core/redis';
import {
  docAnnotationTable,
  docBrowseHistoryTable,
  docCategoryDocsCache,
  docInfoCache,
  docListCache,
  docMongoCollection,
  docTable,
  docVersionMongoCollection,
  docVersionTable,
  type MockDoc,
  type MockDocVersion,
} from '../../Entities/doc';
import { projectMongoCollection, projectTable } from '../../Entities/project';

// ============================================================================
// 文档数据访问类
// ============================================================================

class DocRepository {
  // ==================== 文档查询（三级降级：Redis → MongoDB → MockTable） ====================

  /**
   * 按 ID 查询文档（三级降级）
   * @param id 文档 ID
   * @returns 文档对象（不存在时返回 null）
   */
  async findById(id: number): Promise<MockDoc | null> {
    // L3：Redis 缓存
    try {
      const docInfo = await docInfoCache.hgetAll(String(id));
      if (docInfo && Object.keys(docInfo).length > 0) {
        return {
          id: Number(docInfo.id),
          project_id: Number(docInfo.project_id),
          name: docInfo.name,
          summary: docInfo.summary || '',
          doc_category_id: Number(docInfo.doc_category_id),
          sort: Number(docInfo.sort),
          author_id: Number(docInfo.author_id),
          author_name: docInfo.author_name || '',
          version_overview: docInfo.version_overview || '',
          modify_time: Number(docInfo.modify_time),
          created_at: docInfo.created_at || '',
          current_version_id: Number(docInfo.current_version_id) || 0,
        } as MockDoc;
      }
    } catch {
      // Redis 失败，降级到 MongoDB
    }

    // L2：MongoDB
    try {
      const mongoDoc = await docMongoCollection.findOne({ id });
      if (mongoDoc) {
        return mongoDoc as MockDoc;
      }
    } catch {
      // MongoDB 失败，降级到 MockTable
    }

    // L1：MockTable
    const result = await docTable.findById(id);
    return result ?? null;
  }

  /**
   * 统计指定文集中的文档数量
   * @param projectId 文集 ID
   * @returns 文档数量
   */
  async countByProjectId(projectId: number): Promise<number> {
    try {
      return await docMongoCollection.countDocuments({ project_id: projectId });
    } catch {
      // MongoDB 失败，降级到 MockTable
      const allDocs = await docTable.findAll();
      return allDocs.filter((d) => d.project_id === projectId).length;
    }
  }

  /**
   * 查询文档的所有版本（按更新时间倒序）
   * @param docId 文档 ID
   * @returns 版本数组
   */
  async findVersionsByDocId(docId: number): Promise<MockDocVersion[]> {
    try {
      const mongoVersions = await docVersionMongoCollection
        .find({ doc_id: docId })
        .sort({ update_time: -1 })
        .toArray();
      return mongoVersions as MockDocVersion[];
    } catch {
      // MongoDB 失败，降级到 MockTable
      const allVersions = await docVersionTable.findAll();
      return allVersions
        .filter((v) => v.doc_id === docId)
        .sort((a, b) => (b.update_time ?? 0) - (a.update_time ?? 0));
    }
  }

  // ==================== 文档写入（双写：MockTable + MongoDB） ====================

  /**
   * 创建文档（同时写入 L1 MockTable、L2 MongoDB，可选同步 L3 Redis 缓存）
   * @param data 文档数据
   * @param syncMongoAndCache 是否同步 MongoDB 和 Redis 缓存（默认 true）
   * @returns 创建的文档
   */
  async create(
    data: Partial<MockDoc>,
    syncMongoAndCache = true,
  ): Promise<MockDoc> {
    const newDoc = await docTable.create(data as MockDoc);

    if (syncMongoAndCache) {
      try {
        await docMongoCollection.insertOne({ ...newDoc, version_count: 0 });
      } catch (error) {
        console.warn('[DocRepository] 创建文档 MongoDB 失败，等待定时重建:', error);
      }
    }

    return newDoc;
  }

  /**
   * 更新文档（同时更新 L1 MockTable 和 L2 MongoDB）
   * @param id 文档 ID
   * @param data 更新数据
   * @returns 更新后的文档
   */
  async update(
    id: number,
    data: Partial<MockDoc>,
  ): Promise<MockDoc | null> {
    const updatedDoc = await docTable.updateById(id, data);

    try {
      await docMongoCollection.updateOne({ id }, { $set: data });
    } catch (error) {
      console.warn('[DocRepository] 更新文档 MongoDB 失败:', error);
    }

    return updatedDoc ?? null;
  }

  /**
   * 删除文档（同时删除 L1 MockTable 和 L2 MongoDB）
   * @param id 文档 ID
   */
  async delete(id: number): Promise<void> {
    await docTable.deleteById(id);
    try {
      await docMongoCollection.deleteOne({ id });
    } catch (error) {
      console.warn('[DocRepository] 删除文档 MongoDB 失败:', error);
    }
  }

  // ==================== 版本操作 ====================

  /**
   * 删除指定文档的所有版本
   * @param docId 文档 ID
   */
  async deleteVersionsByDocId(docId: number): Promise<void> {
    // L1: MockTable
    const allVersions = await docVersionTable.findAll();
    const versionIds = allVersions
      .filter((v) => v.doc_id === docId)
      .map((v) => v.id);
    for (const versionId of versionIds) {
      await docVersionTable.deleteById(versionId);
    }

    // L2: MongoDB
    try {
      await docVersionMongoCollection.deleteMany({ doc_id: docId });
    } catch (error) {
      console.warn('[DocRepository] 删除版本 MongoDB 失败:', error);
    }
  }

  // ==================== 批注操作 ====================

  /**
   * 删除指定文档的所有批注
   * @param docId 文档 ID
   */
  async deleteAnnotationsByDocId(docId: number): Promise<void> {
    const allAnnotations = await docAnnotationTable.findAll();
    const docAnnotations = allAnnotations.filter((a) => a.doc_id === docId);
    for (const annotation of docAnnotations) {
      await docAnnotationTable.deleteById(annotation.id);
    }
  }

  // ==================== 浏览历史操作 ====================

  /**
   * 删除指定文档的所有浏览历史
   * @param docId 文档 ID
   */
  async deleteBrowseHistoryByDocId(docId: number): Promise<void> {
    const allHistory = await docBrowseHistoryTable.findAll();
    const historyIds = allHistory
      .filter((h) => h.doc_id === docId)
      .map((h) => h.id);
    for (const historyId of historyIds) {
      await docBrowseHistoryTable.deleteById(historyId);
    }
  }

  // ==================== 文集相关操作 ====================

  /**
   * 检查文集是否存在（三级降级）
   * @param projectId 文集 ID
   * @returns 是否存在
   */
  async projectExists(projectId: number): Promise<boolean> {
    try {
      const project = await projectMongoCollection.findOne({ id: projectId });
      return !!project;
    } catch {
      // MongoDB 失败，降级到 MockTable
      const project = await projectTable.findById(projectId);
      return !!project;
    }
  }

  /**
   * 更新文集的修改时间
   * @param projectId 文集 ID
   * @param modifyTime 修改时间
   */
  async updateProjectModifyTime(projectId: number, modifyTime: number): Promise<void> {
    try {
      await projectTable.updateById(projectId, { modify_time: modifyTime });
    } catch (error) {
      console.warn('[DocRepository] 更新文集修改时间 MockTable 失败:', error);
    }

    try {
      await projectMongoCollection.updateOne(
        { id: projectId },
        { $set: { modify_time: modifyTime } },
      );
    } catch (error) {
      console.warn('[DocRepository] 更新文集修改时间 MongoDB 失败:', error);
    }
  }

  /**
   * 增加文集的文档数量（MongoDB 原子操作）
   * @param projectId 文集 ID
   * @param delta 变化量（+1 新增，-1 删除）
   */
  async incrementProjectDocCount(projectId: number, delta: number): Promise<void> {
    if (projectId <= 0) return;

    try {
      await projectMongoCollection.updateOne(
        { id: projectId },
        { $inc: { doc_count: delta } },
      );
    } catch (error) {
      console.warn('[DocRepository] 更新文集 doc_count MongoDB 失败:', error);
    }
  }

  /**
   * 查询文集信息
   * @param projectId 文集 ID
   * @returns 文集对象
   */
  async findProjectById(projectId: number): Promise<any> {
    try {
      const project = await projectMongoCollection.findOne({ id: projectId });
      if (project) return project;
    } catch {
      // MongoDB 失败，降级到 MockTable
    }
    return projectTable.findById(projectId);
  }

  // ==================== Redis 缓存操作 ====================

  /**
   * 创建文档缓存（详情 Hash + 分类文档集合）
   * @param doc 文档对象
   */
  async createDocCache(doc: MockDoc): Promise<void> {
    const pipeline = redis.pipeline();

    // 文档详情缓存
    pipeline.hmset(`doc:info:${doc.id}`, {
      id: String(doc.id),
      project_id: String(doc.project_id),
      name: doc.name,
      doc_category_id: String(doc.doc_category_id),
      sort: String(doc.sort),
      modify_time: String(doc.modify_time),
      summary: doc.summary || '',
      author_id: String(doc.author_id),
      author_name: doc.author_name || '',
      version_overview: doc.version_overview || '',
      created_at: doc.created_at,
    });

    // 分类文档集合缓存
    if (doc.doc_category_id !== 0) {
      pipeline.sadd(
        `${doc.project_id}:${doc.doc_category_id}`,
        String(doc.id),
      );
    }

    await pipeline.execAsync();
  }

  /**
   * 删除文档缓存（详情 + 版本 + 分类集合）
   * @param docId 文档 ID
   * @param projectId 文集 ID
   * @param categoryId 分类 ID
   */
  async deleteDocCache(docId: number, projectId: number, categoryId: number): Promise<void> {
    const pipeline = redis.pipeline();

    // 删除文档详情和版本缓存
    pipeline.del(`doc:info:${docId}`);
    pipeline.del(`doc:version:${docId}`);

    // 从分类文档集合中移除
    if (categoryId !== 0) {
      pipeline.srem(`${projectId}:${categoryId}`, String(docId));
    }

    await pipeline.execAsync();
  }

  /**
   * 失效文档列表缓存
   * @param projectId 文集 ID
   * @param categoryId 分类 ID
   */
  async invalidateDocListCache(projectId: number, categoryId: number): Promise<void> {
    const keysToDelete = [
      `${projectId}:0:update`,
      `${projectId}:0:create`,
      `${projectId}:${categoryId}:update`,
      `${projectId}:${categoryId}:create`,
    ];

    const pipeline = docListCache.pipeline();
    keysToDelete.forEach((key) => pipeline.del(key));
    await pipeline.execAsync();
  }

  /**
   * 更新 Redis 中的文集 doc_count
   * @param projectId 文集 ID
   * @param delta 变化量
   */
  async updateProjectDocCountInRedis(projectId: number, delta: number): Promise<void> {
    try {
      await redis.hincrby(`project:info:${projectId}`, 'doc_count', delta);
    } catch (error) {
      console.warn('[DocRepository] 更新 Redis doc_count 失败:', error);
    }
  }

  /**
   * 失效文集列表缓存（doc_count 排序可能受影响）
   * @param projectId 文集 ID
   */
  async invalidateProjectListCache(projectId: number): Promise<void> {
    try {
      const project = await this.findProjectById(projectId);
      if (project) {
        const categoryId = project.project_category_id || 0;
        const keysToDelete = [
          `project:list:${categoryId}:all:doc_count`,
          `project:list:0:all:doc_count`,
        ];
        const pipeline = redis.pipeline();
        keysToDelete.forEach((key) => pipeline.del(key));
        await pipeline.execAsync();
      }
    } catch (error) {
      console.warn('[DocRepository] 失效文集列表缓存失败:', error);
    }
  }
}

// ============================================================================
// 导出 Repository 实例
// ============================================================================

export const docRepository = new DocRepository();
