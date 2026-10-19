// mock/Doc/docAnnotation.service.ts
// 文档批注管理服务层
// 职责：处理文档批注相关的业务逻辑

import { BusinessError } from '../../Core';
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
// 模块级常量与工具函数（被其他模块引用，保留为模块级导出）
// ============================================================================

/** 批注缓存 TTL：5 分钟（毫秒） */
const ANNOTATION_CACHE_TTL = 5 * 60 * 1000;

/** 批注内存缓存（进程级 L0 缓存） */
const annotationCache = new Map<number, { data: MockDocAnnotation[]; timestamp: number }>();

/** 标记行正则：<!-- ANN:{id} --> */
const MARKER_REGEX = /^\s*<!-- ANN:(\d+) -->\s*$/;

/** 合并批注到原文（渲染用） */
export function mergeAnnotations(content: string, annotations: any[]): string {
  const lines = content.split('\n');
  const result: string[] = [];

  const annotationMap = new Map<number, any>();
  annotations.forEach((a) => annotationMap.set(a.marker_id, a));

  const orphanAnnotations = annotations.filter((a) => a.is_orphan);

  for (const line of lines) {
    const markerMatch = line.match(MARKER_REGEX);

    if (markerMatch) {
      const markerId = parseInt(markerMatch[1], 10);
      const annotation = annotationMap.get(markerId);

      if (annotation && !annotation.is_orphan) {
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
    } else {
      result.push(line);
    }
  }

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

/** 过滤标记，只显示纯原文（原文模式） */
export function filterMarkers(content: string): string {
  return content
    .split('\n')
    .filter((line) => !MARKER_REGEX.test(line))
    .join('\n');
}

/** 检测哪些标记被删除，将对应批注标记为孤立批注 */
export async function updateOrphanStatus(
  versionId: number,
  content: string,
): Promise<void> {
  const existingMarkerIds = new Set<number>();
  content.split('\n').forEach((line) => {
    const match = line.match(MARKER_REGEX);
    if (match) {
      existingMarkerIds.add(parseInt(match[1], 10));
    }
  });

  const annotations = await docAnnotationTable.findAll();
  const versionAnnotations = annotations.filter(
    (a) => a.version_id === versionId,
  );

  for (const annotation of versionAnnotations) {
    if (
      annotation.marker_id != null &&
      !existingMarkerIds.has(annotation.marker_id)
    ) {
      if (!annotation.is_orphan) {
        await docAnnotationTable.updateById(annotation.id, { is_orphan: true });
      }
    } else if (annotation.is_orphan && annotation.marker_id != null) {
      await docAnnotationTable.updateById(annotation.id, { is_orphan: false });
    }
  }
}

/** 清除指定版本的批注缓存 */
export function clearAnnotationCache(versionId: number): void {
  annotationCache.delete(versionId);
}

/** 清除所有批注缓存 */
export function clearAllAnnotationCache(): void {
  annotationCache.clear();
}

// ============================================================================
// 文档批注服务类
// ============================================================================

class DocAnnotationService {
  // ==================== 获取批注 ====================

  /**
   * 获取版本的批注列表（三级缓存：内存 → 数据库）
   *
   * @param versionId 版本 ID
   * @returns 批注列表（按 marker_id 排序）
   */
  async getVersionAnnotations(versionId: number): Promise<MockDocAnnotation[]> {
    // 1. 优先从内存缓存获取（L0）
    const cached = annotationCache.get(versionId);
    const now = Date.now();
    if (cached && now - cached.timestamp < ANNOTATION_CACHE_TTL) {
      return [...cached.data];
    }

    // 2. 缓存未命中，从 L1 数据库获取
    const allAnnotations = await docAnnotationTable.findAll();
    const versionAnnotations = allAnnotations
      .filter((a) => a.version_id === versionId)
      .sort((a, b) => (a.marker_id ?? 0) - (b.marker_id ?? 0));

    // 3. 写入内存缓存（L0）
    annotationCache.set(versionId, {
      data: [...versionAnnotations],
      timestamp: now,
    });

    return versionAnnotations;
  }

  // ==================== 添加批注 ====================

  /**
   * 添加批注（同时保存带标记的原文）
   *
   * @param versionId 版本 ID
   * @param data 批注数据
   * @returns 创建的批注和更新后的原文
   */
  async addAnnotation(
    versionId: number,
    data: {
      marker_id: number;
      content: string;
      content_with_marker?: string;
      author_id?: number;
      author_name?: string;
    },
  ): Promise<{ annotation: MockDocAnnotation; content: string }> {
    // 1. 参数校验
    if (data.marker_id == null || !data.content) {
      throw new BusinessError('请填写完整的批注信息');
    }

    // 2. 检查版本是否存在（优先 MongoDB，降级 L1）
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
        throw new BusinessError('版本不存在');
      }
      version = l1Version;
      docId = l1Version.doc_id;
    }

    const now = Date.now();
    const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });

    // 3. 更新版本原文（带标记）
    let updatedContent = version.content;
    if (data.content_with_marker) {
      updatedContent = data.content_with_marker;

      await docVersionTable.updateById(versionId, {
        content: data.content_with_marker,
        update_time: now,
      });

      try {
        await docVersionMongoCollection.updateOne(
          { id: versionId },
          { $set: { content: data.content_with_marker, update_time: now } },
        );
      } catch (error) {
        console.warn('[DocMongo] 更新版本内容失败:', error);
      }
    }

    // 4. 创建新批注（L1 主存储）
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

    // 5. 更新文档的修改时间
    await docTable.updateById(docId, { modify_time: now });
    try {
      await docMongoCollection.updateOne(
        { id: docId },
        { $set: { modify_time: now } },
      );
    } catch (error) {
      console.warn('[DocMongo] 更新文档修改时间失败:', error);
    }

    // 6. 精确失效 Redis 缓存和内存缓存
    try {
      const cachePipeline = redis.pipeline();
      cachePipeline.del(`doc:info:${docId}`);
      cachePipeline.del(`doc:version:${docId}`);
      await cachePipeline.execAsync();
    } catch (error) {
      console.warn('[DocCache] 清除缓存失败:', error);
    }

    clearAnnotationCache(versionId);

    return { annotation: newAnnotation, content: updatedContent };
  }

  // ==================== 更新批注 ====================

  /**
   * 更新批注
   *
   * @param annotationId 批注 ID
   * @param content 批注内容
   * @returns 更新后的批注
   */
  async updateAnnotation(
    annotationId: number,
    content: string,
  ): Promise<MockDocAnnotation> {
    // 1. 检查批注是否存在
    const annotation = await docAnnotationTable.findById(annotationId);
    if (!annotation) {
      throw new BusinessError('批注不存在');
    }

    const now = Date.now();
    const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });

    // 2. 更新批注内容
    const updatedAnnotation = await docAnnotationTable.updateById(annotationId, {
      content,
      updated_at: nowStr,
    });

    // 3. 更新文档的修改时间
    const version = await docVersionTable.findById(annotation.version_id);
    if (version) {
      const docId = version.doc_id;

      await docTable.updateById(docId, { modify_time: now });

      try {
        await docMongoCollection.updateOne(
          { id: docId },
          { $set: { modify_time: now } },
        );
      } catch (error) {
        console.warn('[DocMongo] 更新文档修改时间失败:', error);
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
    }

    clearAnnotationCache(annotation.version_id);

    return updatedAnnotation!;
  }

  // ==================== 删除批注 ====================

  /**
   * 删除批注（同时删除原文中的标记）
   *
   * @param annotationId 批注 ID
   * @param contentWithoutMarker 删除标记后的原文
   * @returns 删除结果
   */
  async deleteAnnotation(
    annotationId: number,
    contentWithoutMarker?: string,
  ): Promise<{ id: number; content?: string }> {
    // 1. 检查批注是否存在
    const annotation = await docAnnotationTable.findById(annotationId);
    if (!annotation) {
      throw new BusinessError('批注不存在');
    }

    const now = Date.now();
    const versionId = annotation.version_id;

    // 2. 更新版本原文（删除标记）
    if (contentWithoutMarker) {
      await docVersionTable.updateById(versionId, {
        content: contentWithoutMarker,
        update_time: now,
      });

      try {
        await docVersionMongoCollection.updateOne(
          { id: versionId },
          { $set: { content: contentWithoutMarker, update_time: now } },
        );
      } catch (error) {
        console.warn('[DocMongo] 更新版本内容失败:', error);
      }
    }

    // 3. 删除批注
    await docAnnotationTable.deleteById(annotationId);

    // 4. 更新文档的修改时间
    const version = await docVersionTable.findById(versionId);
    if (version) {
      const docId = version.doc_id;

      await docTable.updateById(docId, { modify_time: now });

      try {
        await docMongoCollection.updateOne(
          { id: docId },
          { $set: { modify_time: now } },
        );
      } catch (error) {
        console.warn('[DocMongo] 更新文档修改时间失败:', error);
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
    }

    clearAnnotationCache(versionId);

    return { id: annotationId, content: contentWithoutMarker };
  }
}

// ============================================================================
// 导出服务实例
// ============================================================================

export const docAnnotationService = new DocAnnotationService();
