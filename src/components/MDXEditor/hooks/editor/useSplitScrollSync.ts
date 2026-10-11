/**
 * @file 分栏模式滚动同步 Hook
 * @description 基于标题锚点的分段滚动同步，替代原来的比例同步：
 *              - 从源码提取 h1-h6 标题列表（行号、级别、文本）
 *              - 左栏滚动时，找到当前可见区域最近的标题
 *              - 在预览区找到对应文本的标题元素，滚动到该位置
 *              - 无标题时回退到比例同步
 *
 * 解决问题：左右栏行高不一致（代码块、图片、列表等），比例同步导致错位
 */
import type { EditorView } from '@codemirror/view';
import { useCallback, useEffect, useRef } from 'react';
import type { EditorViewLike } from '../../types';

interface SourceHeading {
  /** 行号（1-based） */
  lineNumber: number;
  /** 标题级别 1-6 */
  level: number;
  /** 标题文本 */
  text: string;
}

interface UseSplitScrollSyncOptions {
  /** 左栏 CodeMirror EditorView 实例引用 */
  editorViewRef: React.MutableRefObject<EditorViewLike | null>;
  /** 右栏预览区滚动容器引用 */
  previewScrollRef: React.RefObject<HTMLDivElement | null>;
  /** 源码内容（用于提取标题） */
  value: string;
  /** 是否启用滚动同步 */
  enabled: boolean;
}

/** 从源码文本提取 h1-h6 标题（带代码块感知） */
function extractHeadingsFromSource(source: string): SourceHeading[] {
  const lines = source.split('\n');
  const headings: SourceHeading[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    // 检测 fenced code block 边界
    if (/^\s*(```|~~~)/.test(text)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const match = text.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      const level = match[1].length;
      const titleText = match[2].trim();
      if (titleText) {
        headings.push({ lineNumber: i + 1, level, text: titleText });
      }
    }
  }
  return headings;
}

/** 在预览区 DOM 中查找匹配的标题元素 */
function findPreviewHeading(
  container: HTMLElement,
  level: number,
  text: string,
): HTMLElement | null {
  const selector = `h${level}`;
  const headings = container.querySelectorAll<HTMLElement>(selector);
  for (const el of headings) {
    if (el.textContent?.trim() === text) {
      return el;
    }
  }
  return null;
}

/**
 * 分栏模式滚动同步 Hook
 *
 * 使用方式：
 * ```tsx
 * const { handleSourceScroll } = useSplitScrollSync({
 *   editorViewRef,
 *   previewScrollRef,
 *   value,
 *   enabled: scrollSync,
 * });
 * ```
 */
export function useSplitScrollSync({
  editorViewRef,
  previewScrollRef,
  value,
  enabled,
}: UseSplitScrollSyncOptions) {
  // 缓存标题列表（value 变化时更新）
  const headingsRef = useRef<SourceHeading[]>([]);
  // 防循环标记（预览区滚动触发时不反向同步）
  const isSyncingRef = useRef(false);

  // value 变化时重新提取标题
  useEffect(() => {
    headingsRef.current = extractHeadingsFromSource(value);
  }, [value]);

  /**
   * 左栏滚动处理：基于标题锚点同步右栏
   */
  const handleSourceScroll = useCallback(
    (ratio: number) => {
      if (!enabled || isSyncingRef.current) return;

      const previewEl = previewScrollRef.current;
      const view = editorViewRef.current as EditorView | null;
      if (!previewEl || !view) return;

      const headings = headingsRef.current;

      // 无标题时回退到比例同步
      if (headings.length === 0) {
        isSyncingRef.current = true;
        previewEl.scrollTop = ratio * (previewEl.scrollHeight - previewEl.clientHeight);
        requestAnimationFrame(() => {
          isSyncingRef.current = false;
        });
        return;
      }

      // 获取左栏当前滚动位置
      const scroller = view.scrollDOM;
      if (!scroller) return;
      const scrollTop = scroller.scrollTop;

      // 找到当前可见区域之前最近的标题
      // 使用 CodeMirror 的 lineBlockAtHeight 获取可见第一行的行号
      let currentLine = 1;
      try {
        const block = view.lineBlockAtHeight(scrollTop);
        if (block) {
          // block.from 是字符位置，转换为行号
          currentLine = view.state.doc.lineAt(block.from).number;
        }
      } catch {
        // lineBlockAtHeight 可能在某些状态下失败，回退到比例估算
        const totalLines = view.state.doc.lines;
        currentLine = Math.max(1, Math.floor(ratio * totalLines));
      }

      // 找到行号 <= currentLine 的最后一个标题（即当前可见区域之前最近的标题）
      let nearestHeading: SourceHeading | null = null;
      for (const h of headings) {
        if (h.lineNumber <= currentLine) {
          nearestHeading = h;
        } else {
          break;
        }
      }

      // 如果当前位置在第一个标题之前，滚动到顶部
      if (!nearestHeading) {
        isSyncingRef.current = true;
        previewEl.scrollTop = 0;
        requestAnimationFrame(() => {
          isSyncingRef.current = false;
        });
        return;
      }

      // 在预览区找到对应标题元素
      const headingEl = findPreviewHeading(
        previewEl,
        nearestHeading.level,
        nearestHeading.text,
      );

      if (headingEl) {
        // 计算标题元素相对于预览区滚动容器的位置
        const containerRect = previewEl.getBoundingClientRect();
        const elRect = headingEl.getBoundingClientRect();
        const relativeTop =
          elRect.top - containerRect.top + previewEl.scrollTop;

        isSyncingRef.current = true;
        // 滚动到标题位置，留 8px 顶部间距
        previewEl.scrollTop = Math.max(0, relativeTop - 8);
        requestAnimationFrame(() => {
          isSyncingRef.current = false;
        });
      } else {
        // 找不到对应标题元素时回退到比例同步
        isSyncingRef.current = true;
        previewEl.scrollTop =
          ratio * (previewEl.scrollHeight - previewEl.clientHeight);
        requestAnimationFrame(() => {
          isSyncingRef.current = false;
        });
      }
    },
    [enabled, editorViewRef, previewScrollRef],
  );

  return { handleSourceScroll };
}
