// mock/Doc/doc.service.ts
// 文档 CRUD 服务层
// 职责：处理文档核心 CRUD 相关的业务逻辑

import type { Request } from 'express';
import { BusinessError } from '../../Core';
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
  type MockVersionStatus,
} from '../../Entities/doc';
import { projectMongoCollection, projectTable } from '../../Entities/project';
import { tagRelations, tags } from '../../Entities/tag';

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
  private async updateProjectDocCount(projectId: number, delta: number): Promise<void> {
    if (projectId <= 0) return;

    try {
      // 1. 更新 MongoDB（原子操作）
      await projectMongoCollection.updateOne(
        { id: projectId },
        { $inc: { doc_count: delta } },
      );

      // 2. 更新 Redis 缓存中的 doc_count
      try {
        await redis.hincrby(`project:info:${projectId}`, 'doc_count', delta);
      } catch (redisError) {
        console.warn('[DocCache] 更新 Redis doc_count 失败:', redisError);
      }

      // 3. 失效文集列表缓存（doc_count 排序可能受影响）
      try {
        const project = await projectTable.findById(projectId);
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
      } catch (cacheError) {
        console.warn('[DocCache] 失效文集列表缓存失败:', cacheError);
      }
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
    let projectExists = false;
    try {
      const project = await projectMongoCollection.findOne({ id: projectId });
      projectExists = !!project;
    } catch (error) {
      console.warn('[Doc] MongoDB 检查文集失败，降级到 L1:', error);
    }

    if (!projectExists) {
      const project = await projectTable.findById(projectId);
      projectExists = !!project;
    }

    if (!projectExists) {
      throw new BusinessError('文集不存在');
    }

    // 2. 创建新文档
    const now = Date.now();

    // 计算 sort
    let docSort = data.sort;
    if (docSort === undefined) {
      let docCount = 0;
      try {
        docCount = await docMongoCollection.countDocuments({
          project_id: projectId,
        });
      } catch (error) {
        console.warn('[Doc] MongoDB 统计文档数量失败，降级到 L1:', error);
        const projectDocs = await docTable.findAll();
        docCount = projectDocs.filter((d) => d.project_id === projectId).length;
      }
      docSort = docCount + 1;
    }

    const newDoc = await docTable.create({
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

    // 3. 更新文集修改时间和文档数量
    try {
      await projectTable.updateById(projectId, { modify_time: now });
    } catch (error) {
      console.warn('[Doc] 更新文集修改时间失败:', error);
    }

    await this.updateProjectDocCount(projectId, 1);

    // 4. 同步写入 MongoDB
    try {
      await docMongoCollection.insertOne({ ...newDoc, version_count: 0 });
      await projectMongoCollection.updateOne(
        { id: projectId },
        { $set: { modify_time: now } },
      );
    } catch (error) {
      console.warn('[DocMongo] 写入 MongoDB 失败:', error);
    }

    // 5. 精确更新 Redis 缓存
    try {
      const projectIdStr = String(projectId);

      // 5.1 写入文档详情
      const infoPipeline = docInfoCache.pipeline();
      infoPipeline.hmset(String(newDoc.id), {
        id: String(newDoc.id),
        project_id: String(newDoc.project_id),
        name: newDoc.name,
        doc_category_id: String(newDoc.doc_category_id),
        sort: String(newDoc.sort),
        modify_time: String(newDoc.modify_time),
        summary: newDoc.summary || '',
        author_id: String(newDoc.author_id),
        author_name: newDoc.author_name || '',
        version_overview: newDoc.version_overview || '',
        created_at: newDoc.created_at,
      });
      await infoPipeline.execAsync();

      // 5.2 更新分类文档集合缓存
      if (categoryId !== 0) {
        try {
          await docCategoryDocsCache.sadd(
            `${projectIdStr}:${categoryId}`,
            newDoc.id,
          );
        } catch (error) {
          console.warn('[DocCache] 更新分类文档集合缓存失败:', error);
        }
      }

      // 5.3 失效文档列表缓存
      try {
        const listKeysToDelete = [
          `${projectIdStr}:0:update`,
          `${projectIdStr}:0:create`,
          `${projectIdStr}:${categoryId}:update`,
          `${projectIdStr}:${categoryId}:create`,
        ];
        const listPipeline = docListCache.pipeline();
        listKeysToDelete.forEach((key) => listPipeline.del(key));
        await listPipeline.execAsync();
      } catch (error) {
        console.warn('[DocCache] 失效文档列表缓存失败:', error);
      }
    } catch (error) {
      console.warn('[DocCache] 更新 Redis 缓存失败:', error);
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
    // 1. 优先从 Redis 缓存获取（L3）
    let doc: MockDoc | null = null;
    let versions: MockDocVersion[] = [];
    let cacheHit = false;

    try {
      const pipeline = redis.pipeline();
      pipeline.hgetAll(`doc:info:${id}`);
      pipeline.hgetAll(`doc:version:${id}`);
      const results = await pipeline.execAsync();

      const docInfo = results[0] as Record<string, string> | null;
      const versionInfo = results[1] as Record<string, string> | null;

      if (docInfo && Object.keys(docInfo).length > 0) {
        doc = {
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
        };
        cacheHit = true;

        if (versionInfo && Object.keys(versionInfo).length > 0) {
          const currentVersion: MockDocVersion = {
            id: Number(versionInfo.version_id || versionInfo.id),
            doc_id: Number(versionInfo.doc_id),
            version: versionInfo.version,
            status: versionInfo.status as MockVersionStatus,
            content: versionInfo.content || '',
            outline: versionInfo.outline || '',
            author_id: Number(versionInfo.author_id),
            author_name: versionInfo.author_name || '',
            remark: versionInfo.remark || '',
            created_at: versionInfo.created_at || '',
            create_time: versionInfo.create_time
              ? Number(versionInfo.create_time)
              : undefined,
            update_time: versionInfo.update_time
              ? Number(versionInfo.update_time)
              : undefined,
          };
          versions = [currentVersion];
        }
      }
    } catch (error) {
      console.warn('[DocCache] Redis 缓存读取失败，降级到 MongoDB:', error);
    }

    // 2. Redis 未命中，从 MongoDB 获取（L2）
    if (!doc) {
      try {
        const mongoDoc = await docMongoCollection.findOne({ id });
        if (mongoDoc) {
          doc = {
            id: mongoDoc.id,
            project_id: mongoDoc.project_id,
            name: mongoDoc.name,
            summary: mongoDoc.summary || '',
            doc_category_id: mongoDoc.doc_category_id,
            sort: mongoDoc.sort,
            author_id: mongoDoc.author_id,
            author_name: mongoDoc.author_name || '',
            version_overview: mongoDoc.version_overview || '',
            modify_time: mongoDoc.modify_time,
            created_at: mongoDoc.created_at || '',
            current_version_id: mongoDoc.current_version_id || 0,
          };

          const mongoVersions = await docVersionMongoCollection
            .find({ doc_id: id })
            .sort({ update_time: -1 })
            .toArray();
          versions = mongoVersions.map((v) => ({
            id: v.id,
            doc_id: v.doc_id,
            version: v.version,
            status: v.status,
            content: v.content || '',
            outline: v.outline || '',
            author_id: v.author_id,
            author_name: v.author_name || '',
            remark: v.remark || '',
            created_at: v.created_at || '',
            create_time: v.create_time,
            update_time: v.update_time,
          }));
        }
      } catch (error) {
        console.warn('[DocMongo] MongoDB 读取失败，降级到 L1 数据库:', error);
      }
    }

    // 3. MongoDB 未命中，从 L1 数据库获取（兜底）
    if (!doc) {
      const l1Doc = await docTable.findById(id);
      if (!l1Doc) {
        throw new BusinessError('文档不存在', 404);
      }
      doc = l1Doc;

      const allVersions = await docVersionTable.findAll();
      versions = allVersions
        .filter((v) => v.doc_id === id)
        .sort((a, b) => (b.update_time ?? 0) - (a.update_time ?? 0));
    }

    // 4. 确定目标版本
    const targetVersion = versionId
      ? versions.find((v) => v.id === Number(versionId))
      : versions.find((v) => v.id === doc?.current_version_id) || versions[0];

    // 5. 获取该文档的标签
    const docTagIds = tagRelations
      .filter((r) => r.target_id === id && r.type === 'doc')
      .map((r) => r.tag_id);
    const docTags = tags.filter((t) => docTagIds.includes(t.id));

    // 6. 异步写入 Redis 缓存
    if (!cacheHit && doc) {
      try {
        const writePipeline = redis.pipeline();

        writePipeline.hmset(`doc:info:${doc.id}`, {
          id: String(doc.id),
          project_id: String(doc.project_id),
          name: doc.name,
          summary: doc.summary || '',
          doc_category_id: String(doc.doc_category_id),
          sort: String(doc.sort),
          modify_time: String(doc.modify_time),
          author_id: String(doc.author_id),
          author_name: doc.author_name || '',
          version_overview: doc.version_overview || '',
          created_at: doc.created_at || '',
          current_version_id: String(doc.current_version_id || 0),
        });

        if (targetVersion) {
          writePipeline.hmset(`doc:version:${doc.id}`, {
            version_id: String(targetVersion.id),
            doc_id: String(targetVersion.doc_id),
            version: targetVersion.version,
            status: targetVersion.status,
            content: targetVersion.content || '',
            outline: targetVersion.outline || '',
            author_id: String(targetVersion.author_id),
            author_name: targetVersion.author_name || '',
            remark: targetVersion.remark || '',
            created_at: targetVersion.created_at || '',
            create_time: String(targetVersion.create_time || ''),
            update_time: String(targetVersion.update_time || ''),
          });
        }

        await writePipeline.execAsync();
      } catch (error) {
        console.warn('[DocCache] 写入 Redis 缓存失败:', error);
      }
    }

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
    // 1. 检查文档是否存在
    let doc: MockDoc | null = null;
    let oldCategoryId = 0;

    try {
      const mongoDoc = await docMongoCollection.findOne({ id });
      if (mongoDoc) {
        doc = {
          id: mongoDoc.id,
          project_id: mongoDoc.project_id,
          name: mongoDoc.name,
          summary: mongoDoc.summary || '',
          doc_category_id: mongoDoc.doc_category_id,
          sort: mongoDoc.sort,
          author_id: mongoDoc.author_id,
          author_name: mongoDoc.author_name || '',
          version_overview: mongoDoc.version_overview || '',
          modify_time: mongoDoc.modify_time,
          created_at: mongoDoc.created_at || '',
        };
        oldCategoryId = mongoDoc.doc_category_id;
      }
    } catch (error) {
      console.warn('[DocMongo] MongoDB 读取失败，降级到 L1:', error);
    }

    if (!doc) {
      const l1Doc = await docTable.findById(id);
      if (!l1Doc) {
        throw new BusinessError('文档不存在', 404);
      }
      doc = l1Doc;
      oldCategoryId = l1Doc.doc_category_id;
    }

    const projectId = doc.project_id;
    const now = Date.now();

    // 2. 更新文档基本信息
    const updateData: Partial<MockDoc> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.summary !== undefined) updateData.summary = data.summary;
    if (data.doc_category_id !== undefined)
      updateData.doc_category_id = data.doc_category_id;
    if (data.sort !== undefined) updateData.sort = data.sort;
    if (data.version_overview !== undefined)
      updateData.version_overview = data.version_overview;
    updateData.modify_time = now;

    const updatedDoc = await docTable.updateById(id, updateData);
    if (!updatedDoc) {
      throw new BusinessError('文档更新失败', 500);
    }

    // 3. 同步更新 MongoDB
    try {
      await docMongoCollection.updateOne({ id }, { $set: updateData });
    } catch (error) {
      console.warn('[DocMongo] 更新 MongoDB 失败:', error);
    }

    // 4. 精确更新 Redis 缓存
    try {
      const projectIdStr = String(projectId);
      const newCategoryId =
        data.doc_category_id !== undefined ? data.doc_category_id : oldCategoryId;

      // 4.1 批量删除文档详情和版本缓存
      const cachePipeline = redis.pipeline();
      cachePipeline.del(`doc:info:${id}`);
      cachePipeline.del(`doc:version:${id}`);
      await cachePipeline.execAsync();

      // 4.2 分类变更时，精确更新分类文档集合缓存
      if (data.doc_category_id !== undefined && oldCategoryId !== newCategoryId) {
        try {
          if (oldCategoryId !== 0) {
            await docCategoryDocsCache.srem(
              `${projectIdStr}:${oldCategoryId}`,
              id,
            );
          }
          if (newCategoryId !== 0) {
            await docCategoryDocsCache.sadd(
              `${projectIdStr}:${newCategoryId}`,
              id,
            );
          }
        } catch (error) {
          console.warn('[DocCache] 更新分类文档集合缓存失败:', error);
        }
      }

      // 4.3 失效文档列表缓存
      try {
        const listKeysToDelete = [
          `${projectIdStr}:0:update`,
          `${projectIdStr}:0:create`,
          `${projectIdStr}:${oldCategoryId}:update`,
          `${projectIdStr}:${oldCategoryId}:create`,
        ];
        if (oldCategoryId !== newCategoryId) {
          listKeysToDelete.push(`${projectIdStr}:${newCategoryId}:update`);
          listKeysToDelete.push(`${projectIdStr}:${newCategoryId}:create`);
        }
        const listPipeline = docListCache.pipeline();
        listKeysToDelete.forEach((key) => listPipeline.del(key));
        await listPipeline.execAsync();
      } catch (error) {
        console.warn('[DocCache] 失效文档列表缓存失败:', error);
      }
    } catch (error) {
      console.warn('[DocCache] 更新 Redis 缓存失败:', error);
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
    // 1. 检查文档是否存在
    let doc: MockDoc | null = null;
    let categoryId = 0;
    let projectId = 0;

    try {
      const mongoDoc = await docMongoCollection.findOne({ id });
      if (mongoDoc) {
        doc = {
          id: mongoDoc.id,
          project_id: mongoDoc.project_id,
          name: mongoDoc.name,
          summary: mongoDoc.summary || '',
          doc_category_id: mongoDoc.doc_category_id,
          sort: mongoDoc.sort,
          author_id: mongoDoc.author_id,
          author_name: mongoDoc.author_name || '',
          version_overview: mongoDoc.version_overview || '',
          modify_time: mongoDoc.modify_time,
          created_at: mongoDoc.created_at || '',
        };
        categoryId = mongoDoc.doc_category_id;
        projectId = mongoDoc.project_id;
      }
    } catch (error) {
      console.warn('[DocMongo] MongoDB 读取失败，降级到 L1:', error);
    }

    if (!doc) {
      const l1Doc = await docTable.findById(id);
      if (!l1Doc) {
        throw new BusinessError('文档不存在', 404);
      }
      doc = l1Doc;
      categoryId = l1Doc.doc_category_id;
      projectId = l1Doc.project_id;
    }

    // 2. 删除文档的所有版本
    try {
      let versionIds: number[] = [];
      try {
        const mongoVersions = await docVersionMongoCollection
          .find({ doc_id: id })
          .toArray();
        versionIds = mongoVersions.map((v) => v.id);
      } catch (error) {
        console.warn('[DocMongo] MongoDB 读取版本失败，降级到 L1:', error);
        const allVersions = await docVersionTable.findAll();
        versionIds = allVersions.filter((v) => v.doc_id === id).map((v) => v.id);
      }

      for (const versionId of versionIds) {
        await docVersionTable.deleteById(versionId);
      }

      await docVersionMongoCollection.deleteMany({ doc_id: id });
    } catch (error) {
      console.warn('[Doc] 删除版本失败:', error);
    }

    // 3. 删除文档的标签关联
    try {
      for (let i = tagRelations.length - 1; i >= 0; i--) {
        if (tagRelations[i].target_id === id && tagRelations[i].type === 'doc') {
          tagRelations.splice(i, 1);
        }
      }
    } catch (error) {
      console.warn('[Doc] 删除标签关联失败:', error);
    }

    // 4. 删除文档浏览历史
    try {
      let historyIds: number[] = [];
      if (historyIds.length === 0) {
        const allHistory = await docBrowseHistoryTable.findAll();
        historyIds = allHistory.filter((h) => h.doc_id === id).map((h) => h.id);
      }

      for (const historyId of historyIds) {
        await docBrowseHistoryTable.deleteById(historyId);
      }
    } catch (error) {
      console.warn('[Doc] 删除浏览历史失败:', error);
    }

    // 5. 删除文档批注
    try {
      const allAnnotations = await docAnnotationTable.findAll();
      const docAnnotations = allAnnotations.filter((a) => a.doc_id === id);

      for (const annotation of docAnnotations) {
        await docAnnotationTable.deleteById(annotation.id);
      }
    } catch (error) {
      console.warn('[Doc] 删除批注失败:', error);
    }

    // 6. 删除文档本身
    try {
      await docTable.deleteById(id);
      await docMongoCollection.deleteOne({ id });
    } catch (error) {
      console.warn('[Doc] 删除文档失败:', error);
    }

    // 更新文集的 doc_count（-1）
    await this.updateProjectDocCount(projectId, -1);

    // 7. 精确更新 Redis 缓存
    try {
      const projectIdStr = String(projectId);

      // 7.1 批量删除文档详情和版本缓存
      const cachePipeline = redis.pipeline();
      cachePipeline.del(`doc:info:${id}`);
      cachePipeline.del(`doc:version:${id}`);
      await cachePipeline.execAsync();

      // 7.2 从分类文档集合缓存中移除文档 ID
      if (categoryId !== 0) {
        try {
          await docCategoryDocsCache.srem(`${projectIdStr}:${categoryId}`, id);
        } catch (error) {
          console.warn('[DocCache] 更新分类文档集合缓存失败:', error);
        }
      }

      // 7.3 失效文档列表缓存
      try {
        const listKeysToDelete = [
          `${projectIdStr}:0:update`,
          `${projectIdStr}:0:create`,
          `${projectIdStr}:${categoryId}:update`,
          `${projectIdStr}:${categoryId}:create`,
        ];
        const listPipeline = docListCache.pipeline();
        listKeysToDelete.forEach((key) => listPipeline.del(key));
        await listPipeline.execAsync();
      } catch (error) {
        console.warn('[DocCache] 失效文档列表缓存失败:', error);
      }
    } catch (error) {
      console.warn('[DocCache] 更新 Redis 缓存失败:', error);
    }

    return { id };
  }
}

// ============================================================================
// 导出服务实例
// ============================================================================

export const docService = new DocService();
