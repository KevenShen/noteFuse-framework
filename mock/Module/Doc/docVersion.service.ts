/**
 * 文档版本管理服务层
 *
 * 【职责】
 * - 只处理文档版本相关的业务逻辑
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
import { updateOrphanStatus } from './docAnnotation.service';

export async function createDocVersion(
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
  // ========== 1. 检查文档是否存在（优先 MongoDB，降级 L1） ==========
  let docExists = false;
  try {
    // 优先从 MongoDB 获取
    const mongoDoc = await docMongoCollection.findOne({ id: docId });
    docExists = !!mongoDoc;
  } catch (error) {
    console.warn('[DocMongo] MongoDB 读取失败，降级到 L1:', error);
  }

  // MongoDB 未命中，降级到 L1 数据库
  if (!docExists) {
    const l1Doc = await docTable.findById(docId);
    if (!l1Doc) {
      throw new BusinessError('文档不存在', 404);
    }
    docExists = true;
  }

  // ========== 2. 获取当前版本并设为非当前（优先 MongoDB 索引查询，降级 L1） ==========
  let currentVersionId: number | null = null;
  try {
    // 优先从 MongoDB 获取当前版本（使用索引查询，避免全量扫描）
    const mongoCurrentVersion = await docVersionMongoCollection.findOne({
      doc_id: docId,
      is_current: true,
    });
    if (mongoCurrentVersion) {
      currentVersionId = mongoCurrentVersion.id;
    }
  } catch (error) {
    console.warn('[DocMongo] MongoDB 读取当前版本失败，降级到 L1:', error);
  }

  // MongoDB 未命中，降级到 L1 数据库
  if (currentVersionId === null) {
    const allVersions = await docVersionTable.findAll();
    const currentVersion = allVersions.find(
      (v) => v.doc_id === docId && v.is_current,
    );
    if (currentVersion) {
      currentVersionId = currentVersion.id;
    }
  }

  // 将当前版本设为非当前（L1）
  if (currentVersionId !== null) {
    await docVersionTable.updateById(currentVersionId, { is_current: false });
  }

  // ========== 3. 生成版本号（优先 MongoDB 聚合查询，降级 L1） ==========
  let versionCount = 0;
  try {
    // 优先从 MongoDB 聚合查询版本数量
    versionCount = await docVersionMongoCollection.countDocuments({ doc_id: docId });
  } catch (error) {
    console.warn('[DocMongo] MongoDB 统计版本数量失败，降级到 L1:', error);
    // 降级到 L1 数据库
    const allVersions = await docVersionTable.findAll();
    versionCount = allVersions.filter((v) => v.doc_id === docId).length;
  }

  const versionNum = versionCount + 1;
  const now = Date.now();

  // ========== 4. 创建新版本（L1 主存储） ==========
  const newVersion = await docVersionTable.create({
    doc_id: docId,
    version: data.version || data.version_name || `v${versionNum}.0`,
    status: (data.status || 'draft') as
      | 'draft'
      | 'published'
      | 'archived'
      | 'deprecated',
    is_current: true,
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

  // ========== 5. 更新文档修改时间（L1 主存储） ==========
  await docTable.updateById(docId, { modify_time: now });

  // ========== 6. 同步更新 MongoDB（L2） ==========
  try {
    // 插入新版本
    await docVersionMongoCollection.insertOne(newVersion);

    // 更新旧版本的 is_current 字段（如果有）
    if (currentVersionId !== null) {
      await docVersionMongoCollection.updateOne(
        { id: currentVersionId },
        { $set: { is_current: false } },
      );
    }

    // 更新文档修改时间
    await docMongoCollection.updateOne(
      { id: docId },
      { $set: { modify_time: now } },
    );
  } catch (error) {
    console.warn('[DocMongo] 写入 MongoDB 失败:', error);
  }

  // ========== 7. 精确失效 Redis 缓存（L3） ==========
  try {
    // 使用 Pipeline 批量删除文档详情和版本缓存
    const cachePipeline = redis.pipeline();
    cachePipeline.del(`doc:info:${docId}`);
    cachePipeline.del(`doc:version:${docId}`);
    await cachePipeline.execAsync();
  } catch (error) {
    console.warn('[DocCache] 清除缓存失败:', error);
  }

  return newVersion;
}

/**
 * 更新版本内容（支持 content、outline、remark）
 *
 * 【三级数据架构】
 * 1. L1：MockTable（主存储，更新版本和文档）
 * 2. L2：MongoDB（文档数据库，同步更新）
 * 3. L3：Redis（KV 缓存，精确失效）
 *    - 文档详情：docInfoCache.del（删除缓存，下次读取时自动重建）
 *    - 文档版本：docVersionCache.del（删除缓存，下次读取时自动重建）
 *
 * 【Cache-Aside 模式】
 * - 写入：先更新数据库（L1 + L2），然后删除缓存（L3）
 * - 读取：先查缓存，未命中则查数据库，然后写入缓存
 *
 * 【更新流程】
 * 1. 检查版本是否存在（优先 MongoDB，降级 L1）
 * 2. 更新版本内容（L1）
 * 3. 更新文档的修改时间（L1）
 * 4. 同步更新 MongoDB（L2）
 * 5. 精确失效 Redis 缓存（L3）
 *
 * 【性能优化】
 * - 使用 MongoDB 索引查询，避免全量扫描
 * - 使用 Redis Pipeline 批量删除缓存，减少网络 RTT
 *
 * @param versionId 版本 ID
 * @param data 更新数据
 * @returns 更新后的版本
 */

export async function updateDocVersion(
  versionId: number,
  data: { content?: string; outline?: string; remark?: string },
): Promise<MockDocVersion> {
  // ========== 1. 检查版本是否存在（优先 MongoDB，降级 L1） ==========
  let version: MockDocVersion | null = null;
  let docId = 0;

  try {
    // 优先从 MongoDB 获取
    const mongoVersion = await docVersionMongoCollection.findOne({ id: versionId });
    if (mongoVersion) {
      version = {
        id: mongoVersion.id,
        doc_id: mongoVersion.doc_id,
        version: mongoVersion.version,
        status: mongoVersion.status,
        is_current: mongoVersion.is_current,
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

  // MongoDB 未命中，降级到 L1 数据库
  if (!version) {
    const l1Version = await docVersionTable.findById(versionId);
    if (!l1Version) {
      throw new BusinessError('版本不存在', 404);
    }
    version = l1Version;
    docId = l1Version.doc_id;
  }

  const now = Date.now();

  // ========== 2. 更新版本内容（L1 主存储） ==========
  const updateData: Partial<MockDocVersion> = {};
  if (data.content !== undefined) updateData.content = data.content;
  if (data.outline !== undefined) updateData.outline = data.outline;
  if (data.remark !== undefined) updateData.remark = data.remark; // 修复：使用 !== undefined 判断，支持清空
  updateData.update_time = now;

  const updatedVersion = await docVersionTable.updateById(
    versionId,
    updateData,
  );

  // ========== 3. 更新文档的修改时间（L1 主存储） ==========
  await docTable.updateById(docId, { modify_time: now });

  // ========== 4. 同步更新 MongoDB（L2） ==========
  try {
    // 更新版本内容
    await docVersionMongoCollection.updateOne(
      { id: versionId },
      { $set: updateData },
    );

    // 更新文档的修改时间
    await docMongoCollection.updateOne(
      { id: docId },
      { $set: { modify_time: now } },
    );
  } catch (error) {
    console.warn('[DocMongo] 更新 MongoDB 失败:', error);
  }

  // ========== 5. 精确失效 Redis 缓存（L3） ==========
  try {
    // 使用 Pipeline 批量删除文档详情和版本缓存
    const cachePipeline = redis.pipeline();
    cachePipeline.del(`doc:info:${docId}`);
    cachePipeline.del(`doc:version:${docId}`);
    await cachePipeline.execAsync();
  } catch (error) {
    console.warn('[DocCache] 清除缓存失败:', error);
  }

  return updatedVersion!;
}

/**
 * 设为当前版本
 *
 * 【三级数据架构】
 * 1. L1：MockTable（主存储，更新版本状态和文档）
 * 2. L2：MongoDB（文档数据库，同步更新）
 * 3. L3：Redis（KV 缓存，精确失效）
 *    - 文档详情：docInfoCache.del（删除缓存，下次读取时自动重建）
 *    - 文档版本：docVersionCache.del（删除缓存，下次读取时自动重建）
 *
 * 【Cache-Aside 模式】
 * - 写入：先更新数据库（L1 + L2），然后删除缓存（L3）
 * - 读取：先查缓存，未命中则查数据库，然后写入缓存
 *
 * 【设置流程】
 * 1. 检查版本是否存在（优先 MongoDB，降级 L1）
 * 2. 获取当前版本并设为非当前（优先 MongoDB 索引查询，降级 L1）
 * 3. 设为当前版本（L1）
 * 4. 更新文档的修改时间（L1）
 * 5. 同步更新 MongoDB（L2）
 * 6. 精确失效 Redis 缓存（L3）
 *
 * 【性能优化】
 * - 使用 MongoDB 索引查询，避免全量扫描
 * - 使用 Redis Pipeline 批量删除缓存，减少网络 RTT
 *
 * @param versionId 版本 ID
 * @returns 更新后的版本
 */

export async function setCurrentVersion(
  versionId: number,
): Promise<MockDocVersion> {
  // ========== 1. 检查版本是否存在（优先 MongoDB，降级 L1） ==========
  let version: MockDocVersion | null = null;
  let docId = 0;

  try {
    // 优先从 MongoDB 获取
    const mongoVersion = await docVersionMongoCollection.findOne({ id: versionId });
    if (mongoVersion) {
      version = {
        id: mongoVersion.id,
        doc_id: mongoVersion.doc_id,
        version: mongoVersion.version,
        status: mongoVersion.status,
        is_current: mongoVersion.is_current,
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

  // MongoDB 未命中，降级到 L1 数据库
  if (!version) {
    const l1Version = await docVersionTable.findById(versionId);
    if (!l1Version) {
      throw new BusinessError('版本不存在', 404);
    }
    version = l1Version;
    docId = l1Version.doc_id;
  }

  const now = Date.now();

  // ========== 2. 获取当前版本并设为非当前（优先 MongoDB 索引查询，降级 L1） ==========
  let currentVersionId: number | null = null;
  try {
    // 优先从 MongoDB 获取当前版本（使用索引查询，避免全量扫描）
    const mongoCurrentVersion = await docVersionMongoCollection.findOne({
      doc_id: docId,
      is_current: true,
    });
    if (mongoCurrentVersion && mongoCurrentVersion.id !== versionId) {
      currentVersionId = mongoCurrentVersion.id;
    }
  } catch (error) {
    console.warn('[DocMongo] MongoDB 读取当前版本失败，降级到 L1:', error);
  }

  // MongoDB 未命中，降级到 L1 数据库
  if (currentVersionId === null) {
    const allVersions = await docVersionTable.findAll();
    const currentVersion = allVersions.find(
      (v) => v.doc_id === docId && v.is_current && v.id !== versionId,
    );
    if (currentVersion) {
      currentVersionId = currentVersion.id;
    }
  }

  // 将当前版本设为非当前（L1）
  if (currentVersionId !== null) {
    await docVersionTable.updateById(currentVersionId, { is_current: false });
  }

  // ========== 3. 设为当前版本（L1 主存储） ==========
  const updatedVersion = await docVersionTable.updateById(versionId, {
    is_current: true,
  });

  // ========== 4. 更新文档的修改时间（L1 主存储） ==========
  await docTable.updateById(docId, { modify_time: now });

  // ========== 5. 同步更新 MongoDB（L2） ==========
  try {
    // 将旧版本设为非当前（如果有）
    if (currentVersionId !== null) {
      await docVersionMongoCollection.updateOne(
        { id: currentVersionId },
        { $set: { is_current: false } },
      );
    }

    // 设为当前版本
    await docVersionMongoCollection.updateOne(
      { id: versionId },
      { $set: { is_current: true } },
    );

    // 更新文档的修改时间
    await docMongoCollection.updateOne(
      { id: docId },
      { $set: { modify_time: now } },
    );
  } catch (error) {
    console.warn('[DocMongo] 更新 MongoDB 失败:', error);
  }

  // ========== 6. 精确失效 Redis 缓存（L3） ==========
  try {
    // 使用 Pipeline 批量删除文档详情和版本缓存
    const cachePipeline = redis.pipeline();
    cachePipeline.del(`doc:info:${docId}`);
    cachePipeline.del(`doc:version:${docId}`);
    await cachePipeline.execAsync();
  } catch (error) {
    console.warn('[DocCache] 清除缓存失败:', error);
  }

  return updatedVersion!;
}

/**
 * 保存版本原文（带标记，同时检测孤立批注）
 *
 * 【三级数据架构】
 * 1. L1：MockTable（主存储，更新版本内容和文档）
 * 2. L2：MongoDB（文档数据库，同步更新）
 * 3. L3：Redis（KV 缓存，精确失效）
 *    - 文档详情：docInfoCache.del（删除缓存，下次读取时自动重建）
 *    - 文档版本：docVersionCache.del（删除缓存，下次读取时自动重建）
 *
 * 【Cache-Aside 模式】
 * - 写入：先更新数据库（L1 + L2），然后删除缓存（L3）
 * - 读取：先查缓存，未命中则查数据库，然后写入缓存
 *
 * 【保存流程】
 * 1. 检查版本是否存在（优先 MongoDB，降级 L1）
 * 2. 更新原文（L1）
 * 3. 检测哪些标记被删除，将对应批注标记为孤立批注
 * 4. 更新文档的修改时间（L1）
 * 5. 同步更新 MongoDB（L2）
 * 6. 精确失效 Redis 缓存（L3）
 *
 * 【性能优化】
 * - 使用 MongoDB 索引查询，避免全量扫描
 * - 使用 Redis Pipeline 批量删除缓存，减少网络 RTT
 *
 * @param versionId 版本 ID
 * @param content 原文内容
 * @returns 保存结果
 */

export async function saveVersionContent(
  versionId: number,
  content: string,
): Promise<{ id: number; content: string }> {
  // ========== 1. 检查版本是否存在（优先 MongoDB，降级 L1） ==========
  let version: MockDocVersion | null = null;
  let docId = 0;

  try {
    // 优先从 MongoDB 获取
    const mongoVersion = await docVersionMongoCollection.findOne({ id: versionId });
    if (mongoVersion) {
      version = {
        id: mongoVersion.id,
        doc_id: mongoVersion.doc_id,
        version: mongoVersion.version,
        status: mongoVersion.status,
        is_current: mongoVersion.is_current,
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

  // MongoDB 未命中，降级到 L1 数据库
  if (!version) {
    const l1Version = await docVersionTable.findById(versionId);
    if (!l1Version) {
      throw new BusinessError('版本不存在', 404);
    }
    version = l1Version;
    docId = l1Version.doc_id;
  }

  const now = Date.now();

  // ========== 2. 更新原文（L1 主存储） ==========
  await docVersionTable.updateById(versionId, {
    content,
    update_time: now,
  });

  // ========== 3. 检测哪些标记被删除，将对应批注标记为孤立批注 ==========
  await updateOrphanStatus(versionId, content);

  // ========== 4. 更新文档的修改时间（L1 主存储） ==========
  await docTable.updateById(docId, { modify_time: now });

  // ========== 5. 同步更新 MongoDB（L2） ==========
  try {
    // 更新版本内容
    await docVersionMongoCollection.updateOne(
      { id: versionId },
      { $set: { content, update_time: now } },
    );

    // 更新文档的修改时间
    await docMongoCollection.updateOne(
      { id: docId },
      { $set: { modify_time: now } },
    );
  } catch (error) {
    console.warn('[DocMongo] 更新 MongoDB 失败:', error);
  }

  // ========== 6. 精确失效 Redis 缓存（L3） ==========
  try {
    // 使用 Pipeline 批量删除文档详情和版本缓存
    const cachePipeline = redis.pipeline();
    cachePipeline.del(`doc:info:${docId}`);
    cachePipeline.del(`doc:version:${docId}`);
    await cachePipeline.execAsync();
  } catch (error) {
    console.warn('[DocCache] 清除缓存失败:', error);
  }

  return { id: versionId, content };
}

/**
 * 删除版本（级联删除批注，禁止删除当前版本）
 *
 * 【三级数据架构】
 * 1. L1：MockTable（主存储，删除版本和批注，更新文档）
 * 2. L2：MongoDB（文档数据库，同步删除）
 * 3. L3：Redis（KV 缓存，精确失效）
 *    - 文档详情：docInfoCache.del（删除缓存，下次读取时自动重建）
 *    - 文档版本：docVersionCache.del（删除缓存，下次读取时自动重建）
 *
 * 【Cache-Aside 模式】
 * - 写入：先更新数据库（L1 + L2），然后删除缓存（L3）
 * - 读取：先查缓存，未命中则查数据库，然后写入缓存
 *
 * 【删除流程】
 * 1. 检查版本是否存在（优先 MongoDB，降级 L1）
 * 2. 检查是否是当前版本，如果是则禁止删除
 * 3. 删除版本的批注（级联删除）
 * 4. 删除版本（L1）
 * 5. 更新文档的修改时间（L1）
 * 6. 同步删除 MongoDB 中的版本和批注
 * 7. 精确失效 Redis 缓存（L3）
 *
 * 【性能优化】
 * - 使用 MongoDB 索引查询，避免全量扫描
 * - 使用 Redis Pipeline 批量删除缓存，减少网络 RTT
 *
 * @param versionId 版本 ID
 * @returns 删除的版本 ID
 */

export async function deleteDocVersion(versionId: number): Promise<{ id: number }> {
  // ========== 1. 检查版本是否存在（优先 MongoDB，降级 L1） ==========
  let version: MockDocVersion | null = null;
  let docId = 0;

  try {
    // 优先从 MongoDB 获取
    const mongoVersion = await docVersionMongoCollection.findOne({ id: versionId });
    if (mongoVersion) {
      version = {
        id: mongoVersion.id,
        doc_id: mongoVersion.doc_id,
        version: mongoVersion.version,
        status: mongoVersion.status,
        is_current: mongoVersion.is_current,
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

  // MongoDB 未命中，降级到 L1 数据库
  if (!version) {
    const l1Version = await docVersionTable.findById(versionId);
    if (!l1Version) {
      throw new BusinessError('版本不存在', 404);
    }
    version = l1Version;
    docId = l1Version.doc_id;
  }

  // ========== 2. 检查是否是当前版本，如果是则禁止删除 ==========
  if (version.is_current) {
    throw new BusinessError('当前版本不能删除，请先设置其他版本为当前版本');
  }

  const now = Date.now();

  // ========== 3. 删除版本的批注（级联删除） ==========
  try {
    const allAnnotations = await docAnnotationTable.findAll();
    const versionAnnotations = allAnnotations.filter((a) => a.version_id === versionId);
    for (const annotation of versionAnnotations) {
      await docAnnotationTable.deleteById(annotation.id);
    }
    // 清除该版本的批注缓存
    clearAnnotationCache(versionId);
  } catch (error) {
    console.warn('[Doc] 删除版本批注失败:', error);
  }

  // ========== 4. 删除版本（L1 主存储） ==========
  await docVersionTable.deleteById(versionId);

  // ========== 5. 更新文档的修改时间（L1 主存储） ==========
  await docTable.updateById(docId, { modify_time: now });

  // ========== 6. 同步删除 MongoDB 中的版本和批注 ==========
  try {
    // 删除版本
    await docVersionMongoCollection.deleteOne({ id: versionId });

    // 删除版本的批注
    // 假设有 docAnnotationMongoCollection，如果没有则跳过
    // await docAnnotationMongoCollection.deleteMany({ version_id: versionId });

    // 更新文档的修改时间
    await docMongoCollection.updateOne(
      { id: docId },
      { $set: { modify_time: now } },
    );
  } catch (error) {
    console.warn('[DocMongo] 删除 MongoDB 失败:', error);
  }

  // ========== 7. 精确失效 Redis 缓存（L3） ==========
  try {
    // 使用 Pipeline 批量删除文档详情和版本缓存
    const cachePipeline = redis.pipeline();
    cachePipeline.del(`doc:info:${docId}`);
    cachePipeline.del(`doc:version:${docId}`);
    await cachePipeline.execAsync();
  } catch (error) {
    console.warn('[DocCache] 清除缓存失败:', error);
  }

  return { id: versionId };
}

// ==================== 文档批注管理 ====================

/**
 * 批注内存缓存（L0 缓存，进程级）
 *
 * 【缓存设计】
 * - Key: versionId（版本 ID）
 * - Value: 该版本的批注列表（按 marker_id 排序）
 * - TTL: 5 分钟（通过时间戳判断，过期后自动重建）
 *
 * 【为什么使用内存缓存】
 * - 批注数据相对较小，适合内存缓存
 * - 频繁读取（打开文档时读取批注），更新频率低
 * - 减少数据库查询压力，提高响应速度
 *
 * 【后续扩展】
 * - 可以扩展为 Redis 缓存（L3），支持分布式部署
 * - 可以扩展为 MongoDB 集合（L2），支持复杂查询和持久化
 */
const annotationCache = new Map<
  number,
  { data: MockDocAnnotation[]; timestamp: number }
>();

/** 批注缓存 TTL：5 分钟 */
const ANNOTATION_CACHE_TTL = 5 * 60 * 1000;

/**
 * 清除指定版本的批注缓存
 * @param versionId 版本 ID
 */

