// src/pages/Doc/utils/annotationUtils.ts
// 文档批注工具函数 - 标记解析、合并渲染、过滤标记

/** 标记行正则：<!-- ANN:{id} --> */
const MARKER_REGEX = /^\s*<!-- ANN:(\d+) -->\s*$/;

/**
 * 批注数据结构（前端使用）
 */
export interface AnnotationItem {
  id: number;
  version_id: number;
  marker_id: number;
  author_id: number;
  author_name: string;
  created_at: string;
  updated_at: string;
  is_orphan: boolean;
  content: string;
}

/**
 * 合并原文和批注（批注模式）
 * @param content 原文内容（包含标记）
 * @param annotations 该版本的批注列表
 * @returns 合并后的内容（用于渲染）
 */
export function mergeAnnotations(content: string, annotations: AnnotationItem[]): string {
  if (!content) return '';
  if (!annotations || annotations.length === 0) {
    // 没有批注时，直接过滤标记
    return filterMarkers(content);
  }

  const lines = content.split('\n');
  const result: string[] = [];

  // 构建 marker_id -> annotation 映射
  const annotationMap = new Map<number, AnnotationItem>();
  annotations.forEach((a) => annotationMap.set(a.marker_id, a));

  // 孤立批注（标记已被删除）
  const orphanAnnotations = annotations.filter((a) => a.is_orphan);

  for (const line of lines) {
    const markerMatch = line.match(MARKER_REGEX);

    if (markerMatch) {
      const markerId = parseInt(markerMatch[1], 10);
      const annotation = annotationMap.get(markerId);

      if (annotation && !annotation.is_orphan) {
        // 插入批注内容（用特殊样式包裹，包含编辑/删除按钮）
        result.push('');
        result.push(`<div class="doc-annotation-block" data-annotation-id="${annotation.id}">`);
        result.push('');
        result.push(`<div class="doc-annotation-header">`);
        result.push(`<span class="doc-annotation-title">📝 **批注**（${annotation.author_name}）</span>`);
        result.push(`<div class="doc-annotation-actions">`);
        result.push(`<button type="button" class="doc-annotation-btn doc-annotation-edit-btn" data-action="edit" data-annotation-id="${annotation.id}" title="编辑批注">编辑</button>`);
        result.push(`<button type="button" class="doc-annotation-btn doc-annotation-delete-btn" data-action="delete" data-annotation-id="${annotation.id}" title="删除批注">删除</button>`);
        result.push(`</div>`);
        result.push(`</div>`);
        result.push('');
        result.push(`<div class="doc-annotation-content">`);
        result.push('');
        result.push(annotation.content);
        result.push('');
        result.push(`</div>`);
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
    result.push('> ⚠️ **位置已失效的批注**（原文标记已被删除，请重新添加位置）');
    result.push('');
    for (const ann of orphanAnnotations) {
      result.push(`<div class="doc-annotation-block orphan" data-annotation-id="${ann.id}">`);
      result.push('');
      result.push(`<div class="doc-annotation-header">`);
      result.push(`<span class="doc-annotation-title">📝 **批注**（${ann.author_name}）- 位置已失效</span>`);
      result.push(`<div class="doc-annotation-actions">`);
      result.push(`<button type="button" class="doc-annotation-btn doc-annotation-edit-btn" data-action="edit" data-annotation-id="${ann.id}" title="编辑批注">编辑</button>`);
      result.push(`<button type="button" class="doc-annotation-btn doc-annotation-delete-btn" data-action="delete" data-annotation-id="${ann.id}" title="删除批注">删除</button>`);
      result.push(`</div>`);
      result.push(`</div>`);
      result.push('');
      result.push(`<div class="doc-annotation-content">`);
      result.push('');
      result.push(ann.content);
      result.push('');
      result.push(`</div>`);
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
  if (!content) return '';
  return content
    .split('\n')
    .filter((line) => !MARKER_REGEX.test(line))
    .join('\n');
}

/**
 * 从原文中提取所有标记 ID
 */
export function extractMarkerIds(content: string): number[] {
  if (!content) return [];
  const ids: number[] = [];
  content.split('\n').forEach((line) => {
    const match = line.match(MARKER_REGEX);
    if (match) {
      ids.push(parseInt(match[1], 10));
    }
  });
  return ids;
}

/**
 * 在指定行后插入标记
 * @param content 原文内容
 * @param lineIndex 行索引（0-based）
 * @param markerId 标记 ID
 * @returns 插入标记后的内容
 */
export function insertMarkerAfterLine(
  content: string,
  lineIndex: number,
  markerId: number,
): string {
  if (!content) return `<!-- ANN:${markerId} -->`;
  const lines = content.split('\n');
  const insertIndex = Math.min(Math.max(lineIndex + 1, 0), lines.length);
  lines.splice(insertIndex, 0, `<!-- ANN:${markerId} -->`);
  return lines.join('\n');
}

/**
 * 在包含标记的原文中，根据纯原文的行索引插入新标记
 * 【修复】添加新批注时，保留已有批注的标记，避免第一个批注失效
 *
 * 场景：AddAnnotationModal 显示的是过滤标记后的纯原文，用户选择的行索引基于纯原文
 * 但插入标记时需要在包含所有标记的原文中操作，因此需要跳过标记行找到正确位置
 *
 * @param contentWithMarkers 包含所有标记的原文
 * @param pureLineIndex 纯原文中的行索引（0-based）
 * @param markerId 新标记 ID
 * @returns 插入新标记后的内容（保留所有已有标记）
 */
export function insertMarkerAfterLineInContentWithMarkers(
  contentWithMarkers: string,
  pureLineIndex: number,
  markerId: number,
): string {
  if (!contentWithMarkers) return `<!-- ANN:${markerId} -->`;

  const lines = contentWithMarkers.split('\n');
  let pureLineCount = 0;  // 已遇到的非标记行数量
  let insertIndex = lines.length;  // 默认插入到末尾

  for (let i = 0; i < lines.length; i++) {
    const isMarker = MARKER_REGEX.test(lines[i]);
    if (!isMarker) {
      // 非标记行，纯原文行计数 +1
      if (pureLineCount === pureLineIndex) {
        // 找到了纯原文中第 pureLineIndex 行，在它之后插入
        insertIndex = i + 1;
        break;
      }
      pureLineCount++;
    }
  }

  // 插入新标记（不影响已有标记）
  lines.splice(insertIndex, 0, `<!-- ANN:${markerId} -->`);
  return lines.join('\n');
}

/**
 * 从原文中删除指定标记
 * @param content 原文内容
 * @param markerId 标记 ID
 * @returns 删除标记后的内容
 */
export function removeMarker(content: string, markerId: number): string {
  if (!content) return '';
  return content
    .split('\n')
    .filter((line) => {
      const match = line.match(MARKER_REGEX);
      if (match && parseInt(match[1], 10) === markerId) {
        return false;
      }
      return true;
    })
    .join('\n');
}

/**
 * 生成新的标记 ID
 * @param annotations 现有批注列表
 * @returns 新的标记 ID
 */
export function generateMarkerId(annotations: AnnotationItem[]): number {
  if (!annotations || annotations.length === 0) return 1;
  const maxId = annotations.reduce((max, a) => Math.max(max, a.marker_id), 0);
  return maxId + 1;
}


/**
 * 从 Markdown 内容中提取指定标题对应的章节内容
 * 用于聚焦阅读模式：只显示某个章节的内容
 *
 * @param content 完整的 Markdown 内容
 * @param title 章节标题（如 "快速开始"）
 * @returns 提取的章节内容（包含标题行），如果找不到则返回空字符串
 */
export function extractSectionByTitle(content: string, title: string): string {
  if (!content || !title) return '';

  const lines = content.split('\n');
  const result: string[] = [];
  let inSection = false;
  let sectionLevel = 0;  // 当前章节的标题级别（1-6）
  let codeBlockCount = 0;  // 代码块嵌套计数（确保代码块闭合）

  for (const line of lines) {
    // 匹配 Markdown 标题：# 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    // 匹配代码块开始/结束：```
    const codeBlockMatch = line.match(/^\s*```/);

    if (codeBlockMatch) {
      codeBlockCount++;
    }

    if (headingMatch && codeBlockCount % 2 === 0) {
      // 只在代码块外才识别标题
      const headingLevel = headingMatch[1].length;
      const headingText = headingMatch[2].trim();

      if (inSection) {
        // 已经在目标章节中，遇到同级或更高级别标题时结束
        if (headingLevel <= sectionLevel) {
          break;
        }
        // 子标题，继续包含
        result.push(line);
      } else if (headingText === title.trim()) {
        // 找到目标标题
        inSection = true;
        sectionLevel = headingLevel;
        result.push(line);
      }
    } else if (inSection) {
      // 在目标章节中，包含内容行（包括代码块内的标题）
      result.push(line);
    }
  }

  // 【修复】确保代码块闭合
  // 如果提取的内容中代码块未闭合（奇数个 ```），添加闭合标记
  const finalContent = result.join('\n').trim();
  const backtickCount = (finalContent.match(/```/g) || []).length;
  if (backtickCount % 2 !== 0) {
    return finalContent + '\n```';
  }

  return finalContent;
}
