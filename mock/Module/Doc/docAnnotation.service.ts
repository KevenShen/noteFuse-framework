// mock/Doc/docAnnotation.service.ts
// 文档批注管理服务层
// 职责：处理文档批注相关的业务逻辑

import { BusinessError } from '../../Core';
import type { MockDocAnnotation } from '../../Entities/doc';
import { docAnnotationRepository } from './docAnnotation.repository';

// ============================================================================
// 模块级常量与工具函数（被其他模块引用，保留为模块级导出）
// ============================================================================

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

  const annotations = await docAnnotationRepository.findByVersionId(versionId);

  for (const annotation of annotations) {
    if (
      annotation.marker_id != null &&
      !existingMarkerIds.has(annotation.marker_id)
    ) {
      if (!annotation.is_orphan) {
        await docAnnotationRepository.update(annotation.id, { is_orphan: true });
      }
    } else if (annotation.is_orphan && annotation.marker_id != null) {
      await docAnnotationRepository.update(annotation.id, { is_orphan: false });
    }
  }
}

/** 清除指定版本的批注缓存 */
export function clearAnnotationCache(versionId: number): void {
  docAnnotationRepository.clearAnnotationCache(versionId);
}

/** 清除所有批注缓存 */
export function clearAllAnnotationCache(): void {
  docAnnotationRepository.clearAllAnnotationCache();
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
    return docAnnotationRepository.getAnnotationsByVersionId(versionId);
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

    // 2. 查询版本（三级降级：MongoDB → MockTable）
    const version = await docAnnotationRepository.findVersionById(versionId);
    if (!version) {
      throw new BusinessError('版本不存在');
    }

    const docId = version.doc_id;
    const now = Date.now();
    const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });

    // 3. 更新版本原文（带标记）
    let updatedContent = version.content;
    if (data.content_with_marker) {
      updatedContent = data.content_with_marker;
      await docAnnotationRepository.updateVersionContent(versionId, {
        content: data.content_with_marker,
        update_time: now,
      });
    }

    // 4. 创建新批注
    const newAnnotation = await docAnnotationRepository.create({
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
    } as Partial<MockDocAnnotation>);

    // 5. 更新文档的修改时间
    await docAnnotationRepository.updateDocModifyTime(docId, now);

    // 6. 失效缓存
    await docAnnotationRepository.invalidateDocCache(docId);
    docAnnotationRepository.clearAnnotationCache(versionId);

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
    // 1. 查询批注
    const annotation = await docAnnotationRepository.findById(annotationId);
    if (!annotation) {
      throw new BusinessError('批注不存在');
    }

    const now = Date.now();
    const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });

    // 2. 更新批注内容
    const updatedAnnotation = await docAnnotationRepository.update(annotationId, {
      content,
      updated_at: nowStr,
    });

    // 3. 更新文档的修改时间 + 失效缓存
    const version = await docAnnotationRepository.findVersionById(annotation.version_id);
    if (version) {
      const docId = version.doc_id;
      await docAnnotationRepository.updateDocModifyTime(docId, now);
      await docAnnotationRepository.invalidateDocCache(docId);
    }

    docAnnotationRepository.clearAnnotationCache(annotation.version_id);

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
    // 1. 查询批注
    const annotation = await docAnnotationRepository.findById(annotationId);
    if (!annotation) {
      throw new BusinessError('批注不存在');
    }

    const now = Date.now();
    const versionId = annotation.version_id;

    // 2. 更新版本原文（删除标记）
    if (contentWithoutMarker) {
      await docAnnotationRepository.updateVersionContent(versionId, {
        content: contentWithoutMarker,
        update_time: now,
      });
    }

    // 3. 删除批注
    await docAnnotationRepository.delete(annotationId);

    // 4. 更新文档的修改时间 + 失效缓存
    const version = await docAnnotationRepository.findVersionById(versionId);
    if (version) {
      const docId = version.doc_id;
      await docAnnotationRepository.updateDocModifyTime(docId, now);
      await docAnnotationRepository.invalidateDocCache(docId);
    }

    docAnnotationRepository.clearAnnotationCache(versionId);

    return { id: annotationId, content: contentWithoutMarker };
  }
}

// ============================================================================
// 导出服务实例
// ============================================================================

export const docAnnotationService = new DocAnnotationService();
