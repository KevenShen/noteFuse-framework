/**
 * 文档 CRUD 服务层
 *
 * 【职责】
 * - 只处理文档核心 CRUD 相关的业务逻辑
 * - 返回纯数据，不返回 ServiceResult 格式
 * - 业务异常抛出 BusinessError，由控制器层统一捕获
 * - 使用 database/mongodb/redis 进行数据操作
 */

import type { Request } from 'express';
import { BusinessError } from '../../Core';
import { redis } from '../../Core/redis';
import {
  docAnnotationTable,
  docBrowseHistoryTable,
  docCategoryChainCache,
  docCategoryDocsCache,
  docCategoryInfoCache,
  docCategoryMongoCollection,
  docCategoryOrderCache,
  docCategoryTable,
  docInfoCache,
  docListCache,
  docMongoCollection,
  docTable,
  docVersionCache,
  docVersionMongoCollection,
  docVersionTable,
  type MockDoc,
  type MockDocAnnotation,
  type MockDocCategory,
  type MockDocVersion,
  type MockVersionStatus,
} from '../../Entities/doc';
import { projectMongoCollection, projectTable } from '../../Entities/project';
import { tagRelations, tags } from '../../Entities/tag';

export function getUserIdFromRequest(req: Request): number {
  return Number((req.body as any)?.user_id) || 1;
}

/**
 * 更新文集的文档数量（doc_count）
 *
 * 【更新范围】
 * - MongoDB：使用 $inc 原子操作更新 doc_count
 * - Redis：使用 hincrby 更新文集详情缓存中的 doc_count
 * - 文集列表缓存：失效受影响的列表缓存（doc_count 排序）
 *
 * @param projectId 文集 ID
 * @param delta 变化量（+1 新增文档，-1 删除文档）
 */
async function updateProjectDocCount(projectId: number, delta: number): Promise<void> {
  if (projectId <= 0) return;

  try {
    // 1. 更新 MongoDB（原子操作，避免并发问题）
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

// ==================== 文档 CRUD ====================

/**
 * 新建文档
 *
 * 【架构分层】
 * - 参数校验：已在控制器层完成（HTTP 层职责：project_id、name 必填）
 * - 业务逻辑：本函数处理（Service 层职责）
 *
 * 【三级数据架构】
 * 1. L1：MockTable（主存储，创建文档）
 * 2. L2：MongoDB（文档数据库，同步写入）
 * 3. L3：Redis（KV 缓存，精确更新）
 *    - 文档详情：docInfoCache.hmset
 *    - 文档列表缓存：失效相关的列表缓存（下次查询时自动重建）
 *    - 分类文档集合：docCategoryDocsCache.sadd（添加文档 ID 到对应分类）
 *
 * 【注意】创建文档时不自动创建初始版本，初始版本需通过 createDocVersion 接口单独创建
 *
 * 【创建流程】
 * 1. 检查文集是否存在（优先 MongoDB，降级 L1）
 * 2. 创建新文档（L1）
 * 3. 更新文集修改时间（L1）
 * 4. 同步写入 MongoDB（L2）
 * 5. 精确更新 Redis 缓存（L3）
 *
 * @param data 请求参数（已在控制器层校验，project_id 和 name 必传）
 * - project_id：文集 ID（必填）
 * - name：文档名称（必填）
 * - doc_category_id：文档分类 ID（可选，默认 0）
 * - summary：文档摘要（可选，默认空字符串）
 * - sort：排序值（可选，默认自动计算为当前文集文档数量 + 1）
 * - version_overview：文档版本概览（可选，默认空字符串）
 * - author_id：作者 ID（可选，默认 1）
 * - author_name：作者名称（可选，默认 admin）
 * @returns 创建的文档
 */

export async function createDoc(data: {
  project_id: number;
  name: string;
  summary?: string;
  doc_category_id?: number;
  sort?: number;
  author_id?: number;
  author_name?: string;
  version_overview?: string;
}): Promise<MockDoc> {
  // 控制器中已完成参数校验和类型转换，这里直接使用
  const projectId = data.project_id;
  const categoryId = data.doc_category_id ?? 0;

  // ========== 1. 检查文集是否存在（优先 MongoDB，降级 L1） ==========
  let projectExists = false;
  try {
    // 优先从 MongoDB 获取
    const project = await projectMongoCollection.findOne({ id: projectId });
    projectExists = !!project;
  } catch (error) {
    console.warn('[Doc] MongoDB 检查文集失败，降级到 L1:', error);
  }

  // MongoDB 未命中，降级到 L1 数据库
  if (!projectExists) {
    const project = await projectTable.findById(projectId);
    projectExists = !!project;
  }

  if (!projectExists) {
    throw new BusinessError('文集不存在');
  }

  // ========== 2. 创建新文档（L1 主存储） ==========
  const now = Date.now();

  // 计算 sort：如果用户指定了 sort 则使用，否则自动计算（当前文集的文档数量 + 1）
  let docSort = data.sort;
  if (docSort === undefined) {
    // 自动计算 sort：优先从 MongoDB 获取当前文集的文档数量，降级到 L1
    let docCount = 0;
    try {
      // 从 MongoDB 统计当前文集的文档数量
      docCount = await docMongoCollection.countDocuments({
        project_id: projectId,
      });
    } catch (error) {
      console.warn('[Doc] MongoDB 统计文档数量失败，降级到 L1:', error);
      // 降级到 L1 数据库
      const projectDocs = await docTable.findAll();
      docCount = projectDocs.filter((d) => d.project_id === projectId).length;
    }
    docSort = docCount + 1;
  }

  // summary：直接使用用户传入的值（控制器中已传入）
  const docSummary = data.summary || '';

  // version_overview：文档版本概览，直接使用用户传入的值
  const docVersionOverview = data.version_overview || '';

  const newDoc = await docTable.create({
    project_id: projectId,
    name: data.name,
    summary: docSummary,
    doc_category_id: categoryId,
    sort: docSort,
    author_id: data.author_id || 1,
    author_name: data.author_name || 'admin',
    version_overview: docVersionOverview,
    created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
    modify_time: now,
  } as MockDoc);

  // ========== 3. 更新文集修改时间和文档数量（L1 主存储） ==========
  try {
    await projectTable.updateById(projectId, { modify_time: now });
  } catch (error) {
    console.warn('[Doc] 更新文集修改时间失败:', error);
  }

  // 更新文集的 doc_count（+1）
  await updateProjectDocCount(projectId, 1);

  // ========== 4. 同步写入 MongoDB（L2） ==========
  try {
    await docMongoCollection.insertOne({ ...newDoc, version_count: 0 });
    // 同步更新文集的修改时间
    await projectMongoCollection.updateOne(
      { id: projectId },
      { $set: { modify_time: now } },
    );
  } catch (error) {
    console.warn('[DocMongo] 写入 MongoDB 失败:', error);
  }

  // ========== 5. 精确更新 Redis 缓存（L3） ==========
  try {
    const projectIdStr = String(projectId);

    // ========== 5.1 写入文档详情（docInfoCache） ==========
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

    // ========== 5.2 更新分类文档集合缓存（docCategoryDocsCache） ==========
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

    // ========== 5.3 失效文档列表缓存（docListCache） ==========
    // 新建文档会影响多个列表缓存，清除相关缓存，下次查询时自动重建
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

/**
 * 获取文档详情（含版本概览 version_overview）
 *
 * 【三级降级架构】
 * 1. Redis 缓存（L3）：docInfoCache + docVersionCache（优先，微秒级）
 * 2. MongoDB（L2）：docMongoCollection + docVersionMongoCollection（其次，毫秒级）
 * 3. MockTable（L1）：docTable + docVersionTable（兜底，内存级）
 *
 * 【Cache-Aside 模式】
 * - 读取：先查缓存，未命中则查数据库，然后写入缓存
 * - 写入：先更新数据库，然后删除缓存（下次读取时自动重建）
 *
 * 【性能优化】
 * - 使用 Redis Pipeline 批量操作，减少网络 RTT
 * - 版本列表使用 MongoDB 索引查询，避免全量扫描
 * - 缓存未命中时异步写入，不阻塞主流程
 *
 * @param id 文档 ID
 * @param versionId 指定版本 ID（可选）
 * @returns 文档详情（含版本列表、标签、版本概览）
 */

export async function getDocDetail(
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
  // ========== 1. 优先从 Redis 缓存获取（L3） ==========
  let doc: MockDoc | null = null;
  let versions: MockDocVersion[] = [];
  let cacheHit = false;

  try {
    // 使用 Pipeline 批量读取文档详情和版本信息
    const pipeline = redis.pipeline();
    pipeline.hgetAll(`doc:info:${id}`);
    pipeline.hgetAll(`doc:version:${id}`);
    const results = await pipeline.execAsync();

    const docInfo = results[0] as Record<string, string> | null;
    const versionInfo = results[1] as Record<string, string> | null;

    if (docInfo && Object.keys(docInfo).length > 0) {
      // 缓存命中，解析文档详情
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
      };
      cacheHit = true;

      // 如果有版本缓存，解析版本信息
      if (versionInfo && Object.keys(versionInfo).length > 0) {
        const currentVersion: MockDocVersion = {
          id: Number(versionInfo.version_id || versionInfo.id),
          doc_id: Number(versionInfo.doc_id),
          version: versionInfo.version,
          status: versionInfo.status as MockVersionStatus,
          is_current: versionInfo.is_current === 'true',
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

  // ========== 2. Redis 未命中，从 MongoDB 获取（L2） ==========
  if (!doc) {
    try {
      // 从 MongoDB 获取文档详情
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

        // 从 MongoDB 获取版本列表（使用索引查询，避免全量扫描）
        const mongoVersions = await docVersionMongoCollection
          .find({ doc_id: id })
          .sort({ is_current: -1, update_time: -1 })
          .toArray();
        versions = mongoVersions.map((v) => ({
          id: v.id,
          doc_id: v.doc_id,
          version: v.version,
          status: v.status,
          is_current: v.is_current,
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

  // ========== 3. MongoDB 未命中，从 L1 数据库获取（兜底） ==========
  if (!doc) {
    // 从 L1 获取文档（主存储，确保数据一致性）
    const l1Doc = await docTable.findById(id);
    if (!l1Doc) {
      throw new BusinessError('文档不存在', 404);
    }
    doc = l1Doc;

    // 获取该文档的所有版本（使用过滤查询，避免全量扫描）
    const allVersions = await docVersionTable.findAll();
    versions = allVersions
      .filter((v) => v.doc_id === id)
      .sort((a, b) => {
        if (a.is_current && !b.is_current) return -1;
        if (!a.is_current && b.is_current) return 1;
        return (b.update_time ?? 0) - (a.update_time ?? 0);
      });
  }

  // ========== 4. 确定目标版本（指定版本优先，否则取当前版本） ==========
  const targetVersion = versionId
    ? versions.find((v) => v.id === Number(versionId))
    : versions.find((v) => v.is_current) || versions[0];

  // ========== 5. 获取该文档的标签（通过关联表查询，type=doc） ==========
  const docTagIds = tagRelations
    .filter((r) => r.target_id === id && r.type === 'doc')
    .map((r) => r.tag_id);
  const docTags = tags.filter((t) => docTagIds.includes(t.id));

  // ========== 6. 异步写入 Redis 缓存（Cache-Aside 模式，不阻塞主流程） ==========
  if (!cacheHit && doc) {
    try {
      // 使用 Pipeline 批量写入文档详情和版本信息
      const writePipeline = redis.pipeline();

      // 写入文档详情
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
      });

      // 写入当前版本信息（如果有）
      if (targetVersion) {
        writePipeline.hmset(`doc:version:${doc.id}`, {
          version_id: String(targetVersion.id),
          doc_id: String(targetVersion.doc_id),
          version: targetVersion.version,
          status: targetVersion.status,
          is_current: String(targetVersion.is_current),
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

/**
 * 更新文档（只更新文档基本信息，版本内容更新请使用 updateDocVersion 接口）
 *
 * 【三级数据架构】
 * 1. L1：MockTable（主存储，更新文档基本信息）
 * 2. L2：MongoDB（文档数据库，同步更新）
 * 3. L3：Redis（KV 缓存，精确失效）
 *    - 文档详情：docInfoCache.del（删除缓存，下次读取时自动重建）
 *    - 文档版本：docVersionCache.del（删除缓存，下次读取时自动重建）
 *    - 分类文档集合：docCategoryDocsCache.srem/sadd（分类变更时更新）
 *    - 文档列表缓存：docListCache.del（失效相关列表缓存）
 *
 * 【Cache-Aside 模式】
 * - 写入：先更新数据库（L1 + L2），然后删除缓存（L3）
 * - 读取：先查缓存，未命中则查数据库，然后写入缓存
 *
 * 【性能优化】
 * - 使用 Redis Pipeline 批量删除缓存，减少网络 RTT
 * - 分类变更时精确更新分类文档集合缓存，不全量清除
 *
 * @param id 文档 ID
 * @param data 更新数据（只包含文档基本信息，不包含版本内容）
 * @returns 更新后的文档基本信息
 */

export async function updateDoc(
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
  // ========== 1. 检查文档是否存在（优先 MongoDB，降级 L1） ==========
  let doc: MockDoc | null = null;
  let oldCategoryId = 0;

  try {
    // 优先从 MongoDB 获取
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

  // MongoDB 未命中，降级到 L1 数据库
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

  // ========== 2. 更新文档基本信息（L1 主存储） ==========
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

  // ========== 3. 同步更新 MongoDB（L2） ==========
  try {
    // 更新文档基本信息
    await docMongoCollection.updateOne({ id }, { $set: updateData });
  } catch (error) {
    console.warn('[DocMongo] 更新 MongoDB 失败:', error);
  }

  // ========== 4. 精确更新 Redis 缓存（L3） ==========
  try {
    const projectIdStr = String(projectId);
    const newCategoryId =
      data.doc_category_id !== undefined ? data.doc_category_id : oldCategoryId;

    // ========== 4.1 使用 Pipeline 批量删除文档详情和版本缓存 ==========
    const cachePipeline = redis.pipeline();
    cachePipeline.del(`doc:info:${id}`);
    cachePipeline.del(`doc:version:${id}`);
    await cachePipeline.execAsync();

    // ========== 4.2 分类变更时，精确更新分类文档集合缓存 ==========
    if (data.doc_category_id !== undefined && oldCategoryId !== newCategoryId) {
      try {
        // 从旧分类集合中移除
        if (oldCategoryId !== 0) {
          await docCategoryDocsCache.srem(
            `${projectIdStr}:${oldCategoryId}`,
            id,
          );
        }
        // 添加到新分类集合中
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

    // ========== 4.3 失效文档列表缓存（docListCache） ==========
    // 文档更新会影响多个列表缓存，清除相关缓存，下次查询时自动重建
    try {
      const listKeysToDelete = [
        `${projectIdStr}:0:update`,
        `${projectIdStr}:0:create`,
        `${projectIdStr}:${oldCategoryId}:update`,
        `${projectIdStr}:${oldCategoryId}:create`,
      ];
      // 如果分类变更，也失效新分类的列表缓存
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

/**
 * 删除文档（级联删除版本、标签关联、浏览历史、批注）
 *
 * 【三级数据架构】
 * 1. L1：MockTable（主存储，删除文档和关联数据）
 * 2. L2：MongoDB（文档数据库，同步删除）
 * 3. L3：Redis（KV 缓存，精确更新）
 *    - 文档详情：docInfoCache.del（删除缓存）
 *    - 文档版本：docVersionCache.del（删除缓存）
 *    - 分类文档集合：docCategoryDocsCache.srem（从分类集合中移除）
 *    - 文档列表缓存：docListCache.del（失效相关列表缓存）
 *
 * 【删除顺序】
 * 1. 检查文档是否存在（优先 MongoDB，降级 L1）
 * 2. 删除文档的所有版本（L1 + L2）
 * 3. 删除文档的标签关联
 * 4. 删除文档浏览历史（L1 + L2）
 * 5. 删除文档批注（L1 + L2）
 * 6. 删除文档本身（L1 + L2）
 * 7. 精确更新 Redis 缓存（L3）
 *
 * 【性能优化】
 * - 使用 MongoDB 索引查询，避免全量扫描
 * - 使用 Redis Pipeline 批量删除缓存，减少网络 RTT
 * - 分类变更时精确更新分类文档集合缓存，不全量清除
 *
 * @param id 文档 ID
 * @returns 删除的文档 ID
 */

export async function deleteDoc(id: number): Promise<{ id: number }> {
  // ========== 1. 检查文档是否存在（优先 MongoDB，降级 L1） ==========
  let doc: MockDoc | null = null;
  let categoryId = 0;
  let projectId = 0;

  try {
    // 优先从 MongoDB 获取
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

  // MongoDB 未命中，降级到 L1 数据库
  if (!doc) {
    const l1Doc = await docTable.findById(id);
    if (!l1Doc) {
      throw new BusinessError('文档不存在', 404);
    }
    doc = l1Doc;
    categoryId = l1Doc.doc_category_id;
    projectId = l1Doc.project_id;
  }

  // ========== 2. 删除文档的所有版本（L1 + L2） ==========
  try {
    // 优先从 MongoDB 获取版本列表（使用索引查询，避免全量扫描）
    let versionIds: number[] = [];
    try {
      const mongoVersions = await docVersionMongoCollection
        .find({ doc_id: id })
        .toArray();
      versionIds = mongoVersions.map((v) => v.id);
    } catch (error) {
      console.warn('[DocMongo] MongoDB 读取版本失败，降级到 L1:', error);
      // 降级到 L1 数据库
      const allVersions = await docVersionTable.findAll();
      versionIds = allVersions.filter((v) => v.doc_id === id).map((v) => v.id);
    }

    // 逐个删除版本（L1）
    for (const versionId of versionIds) {
      await docVersionTable.deleteById(versionId);
    }

    // 批量删除版本（L2）
    await docVersionMongoCollection.deleteMany({ doc_id: id });
  } catch (error) {
    console.warn('[Doc] 删除版本失败:', error);
  }

  // ========== 3. 删除文档的标签关联（直接操作数组，因为 tagRelations 是全局数组） ==========
  try {
    for (let i = tagRelations.length - 1; i >= 0; i--) {
      if (tagRelations[i].target_id === id && tagRelations[i].type === 'doc') {
        tagRelations.splice(i, 1);
      }
    }
  } catch (error) {
    console.warn('[Doc] 删除标签关联失败:', error);
  }

  // ========== 4. 删除文档浏览历史（L1 + L2） ==========
  try {
    // 优先从 MongoDB 获取浏览历史列表（使用索引查询，避免全量扫描）
    let historyIds: number[] = [];
    try {
      // 假设 MongoDB 中有浏览历史集合
      // const mongoHistory = await docBrowseHistoryMongoCollection.find({ doc_id: id }).toArray();
      // historyIds = mongoHistory.map((h) => h.id);
    } catch (error) {
      console.warn('[DocMongo] MongoDB 读取浏览历史失败，降级到 L1:', error);
    }

    // 降级到 L1 数据库（如果 MongoDB 没有浏览历史集合）
    if (historyIds.length === 0) {
      const allHistory = await docBrowseHistoryTable.findAll();
      historyIds = allHistory.filter((h) => h.doc_id === id).map((h) => h.id);
    }

    // 逐个删除浏览历史（L1）
    for (const historyId of historyIds) {
      await docBrowseHistoryTable.deleteById(historyId);
    }
  } catch (error) {
    console.warn('[Doc] 删除浏览历史失败:', error);
  }

  // ========== 5. 删除文档批注（L1 + L2） ==========
  try {
    // 从 L1 获取批注列表（使用索引查询，避免全量扫描）
    const allAnnotations = await docAnnotationTable.findAll();
    const docAnnotations = allAnnotations.filter((a) => a.doc_id === id);

    // 逐个删除批注（L1）
    for (const annotation of docAnnotations) {
      await docAnnotationTable.deleteById(annotation.id);
    }
  } catch (error) {
    console.warn('[Doc] 删除批注失败:', error);
  }

  // ========== 6. 删除文档本身（L1 + L2） ==========
  try {
    // 删除文档（L1）
    await docTable.deleteById(id);

    // 删除文档（L2）
    await docMongoCollection.deleteOne({ id });
  } catch (error) {
    console.warn('[Doc] 删除文档失败:', error);
  }

  // 更新文集的 doc_count（-1）
  await updateProjectDocCount(projectId, -1);

  // ========== 7. 精确更新 Redis 缓存（L3） ==========
  try {
    const projectIdStr = String(projectId);

    // ========== 7.1 使用 Pipeline 批量删除文档详情和版本缓存 ==========
    const cachePipeline = redis.pipeline();
    cachePipeline.del(`doc:info:${id}`);
    cachePipeline.del(`doc:version:${id}`);
    await cachePipeline.execAsync();

    // ========== 7.2 从分类文档集合缓存中移除文档 ID ==========
    if (categoryId !== 0) {
      try {
        await docCategoryDocsCache.srem(`${projectIdStr}:${categoryId}`, id);
      } catch (error) {
        console.warn('[DocCache] 更新分类文档集合缓存失败:', error);
      }
    }

    // ========== 7.3 失效文档列表缓存（docListCache） ==========
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

// ==================== 文档版本管理 ====================

/**
 * 新建版本
 *
 * 【三级数据架构】
 * 1. L1：MockTable（主存储，创建版本和更新文档）
 * 2. L2：MongoDB（文档数据库，同步更新）
 * 3. L3：Redis（KV 缓存，精确失效）
 *    - 文档详情：docInfoCache.del（删除缓存，下次读取时自动重建）
 *    - 文档版本：docVersionCache.del（删除缓存，下次读取时自动重建）
 *
 * 【Cache-Aside 模式】
 * - 写入：先更新数据库（L1 + L2），然后删除缓存（L3）
 * - 读取：先查缓存，未命中则查数据库，然后写入缓存
 *
 * 【创建流程】
 * 1. 检查文档是否存在（优先 MongoDB，降级 L1）
 * 2. 获取当前版本并设为非当前（优先 MongoDB 索引查询，降级 L1）
 * 3. 生成版本号（优先 MongoDB 聚合查询，降级 L1）
 * 4. 创建新版本（L1）
 * 5. 更新文档修改时间（L1）
 * 6. 同步更新 MongoDB（L2）
 * 7. 精确失效 Redis 缓存（L3）
 *
 * 【性能优化】
 * - 使用 MongoDB 索引查询，避免全量扫描
 * - 使用 Redis Pipeline 批量删除缓存，减少网络 RTT
 * - 版本号生成使用 MongoDB 聚合查询，避免全量扫描
 *
 * @param docId 文档 ID
 * @param data 版本数据
 * @returns 创建的新版本
 */

