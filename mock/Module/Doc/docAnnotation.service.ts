/**
 * 文档批注管理服务层
 *
 * 【职责】
 * - 只处理文档批注相关的业务逻辑
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

// ==================== 批注内存缓存（L0） ====================

/** 批注缓存 TTL：5 分钟（毫秒） */
const ANNOTATION_CACHE_TTL = 5 * 60 * 1000;

/**
 * 批注内存缓存（进程级 L0 缓存）
 * key: versionId
 * value: { data: MockDocAnnotation[], timestamp: number }
 */
const annotationCache = new Map<number, { data: MockDocAnnotation[]; timestamp: number }>();

// ==================== 标记解析/合并工具函数 ====================

/** 标记行正则：<!-- ANN:{id} --> */
const MARKER_REGEX = /^\s*<!-- ANN:(\d+) -->\s*$/;

export function mergeAnnotations(content: string, annotations: any[]): string {
  const lines = content.split('\n');
  const result: string[] = [];

  // 构建 marker_id -> annotation 映射
  const annotationMap = new Map<number, any>();
  annotations.forEach((a) => annotationMap.set(a.marker_id, a));

  // 孤立批注（标记已被删除）
  const orphanAnnotations = annotations.filter((a) => a.is_orphan);

  for (const line of lines) {
    const markerMatch = line.match(MARKER_REGEX);

    if (markerMatch) {
      const markerId = parseInt(markerMatch[1], 10);
      const annotation = annotationMap.get(markerId);

      if (annotation && !annotation.is_orphan) {
        // 插入批注内容（用特殊样式包裹）
        result.push('');
        result.push(
          `<div class="doc-annotation-block" data-annotation-id="${annotation.id}">`,
        );
        result.push('');
        result.push(`> 📝 **批注**（${annotation.author_name}）`);
        result.push('');
        result.push(annotation.content);
        result.push('');
        result.push('</div>');
        result.push('');
      }
      // 孤立批注或找不到批注，跳过标记
    } else {
      result.push(line);
    }
  }

  // 孤立批注统一放到文末
  if (orphanAnnotations.length > 0) {
    result.push('');
    result.push('---');
    result.push('');
    result.push(
      '> ⚠️ **位置已失效的批注**（原文标记已被删除，请重新添加位置）',
    );
    result.push('');
    for (const ann of orphanAnnotations) {
      result.push(
        `<div class="doc-annotation-block orphan" data-annotation-id="${ann.id}">`,
      );
      result.push('');
      result.push(`> 📝 **批注**（${ann.author_name}）- 位置已失效`);
      result.push('');
      result.push(ann.content);
      result.push('');
      result.push('</div>');
      result.push('');
    }
  }

  return result.join('\n');
}

/**
 * 过滤标记，只显示纯原文（原文模式）
 */

export function filterMarkers(content: string): string {
  return content
    .split('\n')
    .filter((line) => !MARKER_REGEX.test(line))
    .join('\n');
}

/**
 * 检测哪些标记被删除，将对应批注标记为孤立批注
 */

export async function updateOrphanStatus(
  versionId: number,
  content: string,
): Promise<void> {
  // 提取当前内容中的所有标记 ID
  const existingMarkerIds = new Set<number>();
  content.split('\n').forEach((line) => {
    const match = line.match(MARKER_REGEX);
    if (match) {
      existingMarkerIds.add(parseInt(match[1], 10));
    }
  });

  // 查找该版本的所有批注
  const annotations = await docAnnotationTable.findAll();
  const versionAnnotations = annotations.filter(
    (a) => a.version_id === versionId,
  );

  // 将标记已被删除的批注标记为孤立
  for (const annotation of versionAnnotations) {
    if (
      annotation.marker_id != null &&
      !existingMarkerIds.has(annotation.marker_id)
    ) {
      if (!annotation.is_orphan) {
        await docAnnotationTable.updateById(annotation.id, { is_orphan: true });
      }
    } else if (annotation.is_orphan && annotation.marker_id != null) {
      // 标记重新出现，取消孤立状态
      await docAnnotationTable.updateById(annotation.id, { is_orphan: false });
    }
  }
}

// ==================== 文档分类管理（新增） ====================

/**
 * 获取文集下的文档分类列表
 *
 * 【三级降级架构】
 * 1. 尝试从 MongoDB 获取（L2 文档数据库）
 * 2. 降级到 Redis 缓存获取（L3 KV 缓存）
 *    - 从 docCategoryOrderCache 读取分类 ID 列表
 *    - 从 docCategoryInfoCache 批量读取分类详情
 * 3. 降级到 L1 数据库（MockTable）
 *
 * @param projectId 文集 ID
 * @returns 分类列表（按 parent_id + sort 排序）
 */

export function clearAnnotationCache(versionId: number): void {
  annotationCache.delete(versionId);
}

/**
 * 清除所有批注缓存
 */

export function clearAllAnnotationCache(): void {
  annotationCache.clear();
}

/**
 * 获取版本的批注列表
 *
 * 【三级缓存架构】
 * 1. L0：内存缓存（进程级，优先读取，微秒级）
 * 2. L1：MockTable（内存数据库，兜底，内存级）
 * 3. （预留）L2：MongoDB（文档数据库，支持复杂查询）
 * 4. （预留）L3：Redis（KV 缓存，支持分布式部署）
 *
 * 【Cache-Aside 模式】
 * - 读取：先查内存缓存，未命中则查数据库，然后写入缓存
 * - 写入：先更新数据库，然后删除缓存（下次读取时自动重建）
 *
 * 【性能优化】
 * - 使用内存缓存，减少数据库查询压力
 * - 缓存 TTL 5 分钟，自动过期重建
 * - 按 marker_id 排序，方便前端渲染
 *
 * @param versionId 版本 ID
 * @returns 批注列表（按 marker_id 排序）
 */

export async function getVersionAnnotations(
  versionId: number,
): Promise<MockDocAnnotation[]> {
  // ========== 1. 优先从内存缓存获取（L0） ==========
  const cached = annotationCache.get(versionId);
  const now = Date.now();
  if (cached && now - cached.timestamp < ANNOTATION_CACHE_TTL) {
    // 缓存命中，直接返回（返回副本，避免外部修改缓存数据）
    return [...cached.data];
  }

  // ========== 2. 缓存未命中，从 L1 数据库获取 ==========
  const allAnnotations = await docAnnotationTable.findAll();
  const versionAnnotations = allAnnotations
    .filter((a) => a.version_id === versionId)
    .sort((a, b) => (a.marker_id ?? 0) - (b.marker_id ?? 0));

  // ========== 3. 写入内存缓存（L0） ==========
  annotationCache.set(versionId, {
    data: [...versionAnnotations], // 存储副本，避免外部修改缓存数据
    timestamp: now,
  });

  return versionAnnotations;
}

/**
 * 添加批注（同时保存带标记的原文）
 *
 * 【三级数据架构】
 * 1. L1：MockTable（主存储，创建批注、更新版本内容和文档）
 * 2. L2：MongoDB（文档数据库，同步更新版本内容和文档）
 * 3. L3：Redis（KV 缓存，精确失效）
 *    - 文档详情：docInfoCache.del（删除缓存，下次读取时自动重建）
 *    - 文档版本：docVersionCache.del（删除缓存，下次读取时自动重建）
 *    - 批注缓存：clearAnnotationCache（清除内存缓存，下次读取时自动重建）
 *
 * 【Cache-Aside 模式】
 * - 写入：先更新数据库（L1 + L2），然后删除缓存（L3）
 * - 读取：先查缓存，未命中则查数据库，然后写入缓存
 *
 * 【添加流程】
 * 1. 参数校验（HTTP 层职责，这里保留兜底校验）
 * 2. 检查版本是否存在（优先 MongoDB，降级 L1）
 * 3. 更新版本原文（带标记）（L1 + L2）
 * 4. 创建新批注（L1）
 * 5. 更新文档的修改时间（L1 + L2）
 * 6. 精确失效 Redis 缓存和内存缓存（L3 + L0）
 *
 * 【性能优化】
 * - 使用 MongoDB 索引查询，避免全量扫描
 * - 使用 Redis Pipeline 批量删除缓存，减少网络 RTT
 *
 * @param versionId 版本 ID
 * @param data 批注数据
 * @returns 创建的批注和更新后的原文
 */

export async function addAnnotation(
  versionId: number,
  data: {
    marker_id: number;
    content: string;
    content_with_marker?: string;
    author_id?: number;
    author_name?: string;
  },
): Promise<{ annotation: MockDocAnnotation; content: string }> {
  // ========== 1. 参数校验（兜底校验，主要校验在控制器层） ==========
  if (data.marker_id == null || !data.content) {
    throw new BusinessError('请填写完整的批注信息');
  }

  // ========== 2. 检查版本是否存在（优先 MongoDB，降级 L1） ==========
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
      throw new BusinessError('版本不存在');
    }
    version = l1Version;
    docId = l1Version.doc_id;
  }

  const now = Date.now();
  const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });

  // ========== 3. 更新版本原文（带标记）（L1 + L2） ==========
  let updatedContent = version.content;
  if (data.content_with_marker) {
    updatedContent = data.content_with_marker;

    // 更新 L1 主存储
    await docVersionTable.updateById(versionId, {
      content: data.content_with_marker,
      update_time: now,
    });

    // 同步更新 MongoDB（L2）
    try {
      await docVersionMongoCollection.updateOne(
        { id: versionId },
        { $set: { content: data.content_with_marker, update_time: now } },
      );
    } catch (error) {
      console.warn('[DocMongo] 更新版本内容失败:', error);
    }
  }

  // ========== 4. 创建新批注（L1 主存储） ==========
  const newAnnotation = await docAnnotationTable.create({
    version_id: versionId,
    marker_id: Number(data.marker_id),
    author_id: data.author_id || 1,
    author_name: data.author_name || 'admin',
    content: data.content,
    created_at: nowStr,
    updated_at: nowStr,
    is_orphan: false,
    anchor_text: '',
    anchor_context_before: '',
    anchor_context_after: '',
    original_line_number: 0,
  } as MockDocAnnotation);

  // ========== 5. 更新文档的修改时间（L1 + L2） ==========
  await docTable.updateById(docId, { modify_time: now });
  try {
    await docMongoCollection.updateOne(
      { id: docId },
      { $set: { modify_time: now } },
    );
  } catch (error) {
    console.warn('[DocMongo] 更新文档修改时间失败:', error);
  }

  // ========== 6. 精确失效 Redis 缓存和内存缓存（L3 + L0） ==========
  try {
    // 使用 Pipeline 批量删除文档详情和版本缓存
    const cachePipeline = redis.pipeline();
    cachePipeline.del(`doc:info:${docId}`);
    cachePipeline.del(`doc:version:${docId}`);
    await cachePipeline.execAsync();
  } catch (error) {
    console.warn('[DocCache] 清除缓存失败:', error);
  }

  // 清除该版本的批注内存缓存（下次读取时自动重建）
  clearAnnotationCache(versionId);

  return { annotation: newAnnotation, content: updatedContent };
}

/**
 * 更新批注
 *
 * 【三级数据架构】
 * 1. L1：MockTable（主存储，更新批注内容和文档）
 * 2. L2：MongoDB（文档数据库，同步更新文档修改时间）
 * 3. L3：Redis（KV 缓存，精确失效）
 *    - 文档详情：docInfoCache.del（删除缓存，下次读取时自动重建）
 *    - 文档版本：docVersionCache.del（删除缓存，下次读取时自动重建）
 *    - 批注缓存：clearAnnotationCache（清除内存缓存，下次读取时自动重建）
 *
 * 【Cache-Aside 模式】
 * - 写入：先更新数据库（L1 + L2），然后删除缓存（L3）
 * - 读取：先查缓存，未命中则查数据库，然后写入缓存
 *
 * 【更新流程】
 * 1. 检查批注是否存在（L1）
 * 2. 更新批注内容（L1）
 * 3. 更新文档的修改时间（L1 + L2）
 * 4. 精确失效 Redis 缓存和内存缓存（L3 + L0）
 *
 * 【性能优化】
 * - 使用 Redis Pipeline 批量删除缓存，减少网络 RTT
 *
 * @param annotationId 批注 ID
 * @param content 批注内容
 * @returns 更新后的批注
 */

export async function updateAnnotation(
  annotationId: number,
  content: string,
): Promise<MockDocAnnotation> {
  // ========== 1. 检查批注是否存在（L1 主存储） ==========
  const annotation = await docAnnotationTable.findById(annotationId);
  if (!annotation) {
    throw new BusinessError('批注不存在');
  }

  const now = Date.now();
  const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });

  // ========== 2. 更新批注内容（L1 主存储） ==========
  const updatedAnnotation = await docAnnotationTable.updateById(annotationId, {
    content,
    updated_at: nowStr,
  });

  // ========== 3. 更新文档的修改时间（L1 + L2） ==========
  // 先获取版本信息，得到 docId
  const version = await docVersionTable.findById(annotation.version_id);
  if (version) {
    const docId = version.doc_id;

    // 更新 L1 主存储
    await docTable.updateById(docId, { modify_time: now });

    // 同步更新 MongoDB（L2）
    try {
      await docMongoCollection.updateOne(
        { id: docId },
        { $set: { modify_time: now } },
      );
    } catch (error) {
      console.warn('[DocMongo] 更新文档修改时间失败:', error);
    }

    // ========== 4. 精确失效 Redis 缓存和内存缓存（L3 + L0） ==========
    try {
      // 使用 Pipeline 批量删除文档详情和版本缓存
      const cachePipeline = redis.pipeline();
      cachePipeline.del(`doc:info:${docId}`);
      cachePipeline.del(`doc:version:${docId}`);
      await cachePipeline.execAsync();
    } catch (error) {
      console.warn('[DocCache] 清除缓存失败:', error);
    }
  }

  // 清除该版本的批注内存缓存（下次读取时自动重建）
  clearAnnotationCache(annotation.version_id);

  return updatedAnnotation!;
}

/**
 * 删除批注（同时删除原文中的标记）
 *
 * 【三级数据架构】
 * 1. L1：MockTable（主存储，删除批注、更新版本内容和文档）
 * 2. L2：MongoDB（文档数据库，同步更新版本内容和文档修改时间）
 * 3. L3：Redis（KV 缓存，精确失效）
 *    - 文档详情：docInfoCache.del（删除缓存，下次读取时自动重建）
 *    - 文档版本：docVersionCache.del（删除缓存，下次读取时自动重建）
 *    - 批注缓存：clearAnnotationCache（清除内存缓存，下次读取时自动重建）
 *
 * 【Cache-Aside 模式】
 * - 写入：先更新数据库（L1 + L2），然后删除缓存（L3）
 * - 读取：先查缓存，未命中则查数据库，然后写入缓存
 *
 * 【删除流程】
 * 1. 检查批注是否存在（L1）
 * 2. 更新版本原文（删除标记）（L1 + L2）
 * 3. 删除批注（L1）
 * 4. 更新文档的修改时间（L1 + L2）
 * 5. 精确失效 Redis 缓存和内存缓存（L3 + L0）
 *
 * 【性能优化】
 * - 使用 Redis Pipeline 批量删除缓存，减少网络 RTT
 *
 * @param annotationId 批注 ID
 * @param contentWithoutMarker 删除标记后的原文
 * @returns 删除结果
 */

export async function deleteAnnotation(
  annotationId: number,
  contentWithoutMarker?: string,
): Promise<{ id: number; content?: string }> {
  // ========== 1. 检查批注是否存在（L1 主存储） ==========
  const annotation = await docAnnotationTable.findById(annotationId);
  if (!annotation) {
    throw new BusinessError('批注不存在');
  }

  const now = Date.now();
  const versionId = annotation.version_id;

  // ========== 2. 更新版本原文（删除标记）（L1 + L2） ==========
  if (contentWithoutMarker) {
    // 更新 L1 主存储
    await docVersionTable.updateById(versionId, {
      content: contentWithoutMarker,
      update_time: now,
    });

    // 同步更新 MongoDB（L2）
    try {
      await docVersionMongoCollection.updateOne(
        { id: versionId },
        { $set: { content: contentWithoutMarker, update_time: now } },
      );
    } catch (error) {
      console.warn('[DocMongo] 更新版本内容失败:', error);
    }
  }

  // ========== 3. 删除批注（L1 主存储） ==========
  await docAnnotationTable.deleteById(annotationId);

  // ========== 4. 更新文档的修改时间（L1 + L2） ==========
  // 先获取版本信息，得到 docId
  const version = await docVersionTable.findById(versionId);
  if (version) {
    const docId = version.doc_id;

    // 更新 L1 主存储
    await docTable.updateById(docId, { modify_time: now });

    // 同步更新 MongoDB（L2）
    try {
      await docMongoCollection.updateOne(
        { id: docId },
        { $set: { modify_time: now } },
      );
    } catch (error) {
      console.warn('[DocMongo] 更新文档修改时间失败:', error);
    }

    // ========== 5. 精确失效 Redis 缓存和内存缓存（L3 + L0） ==========
    try {
      // 使用 Pipeline 批量删除文档详情和版本缓存
      const cachePipeline = redis.pipeline();
      cachePipeline.del(`doc:info:${docId}`);
      cachePipeline.del(`doc:version:${docId}`);
      await cachePipeline.execAsync();
    } catch (error) {
      console.warn('[DocCache] 清除缓存失败:', error);
    }
  }

  // 清除该版本的批注内存缓存（下次读取时自动重建）
  clearAnnotationCache(versionId);

  return { id: annotationId, content: contentWithoutMarker };
}
// ==================== 文档浏览历史 ====================

/**
 * 记录文档浏览历史
 *
 * @param docId 文档 ID
 * @param userId 用户 ID
 */

