/**
 * 文档目录 Hook
 * 从编辑器内容提取 h1-h6 标题，支持富文本模式和源码模式
 * - 富文本模式：从 DOM 查询 h1-h6 元素
 * - 源码模式：从 CodeMirror 解析 # 开头的行
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { EditorViewLike } from '../types';

export interface TocItem {
  /** 唯一标识 */
  id: string;
  /** 标题文本 */
  text: string;
  /** 标题级别 1-6 */
  level: number;
  /** 富文本模式：对应的 DOM 元素 */
  element?: HTMLElement;
  /** 源码模式：对应的行号（1-based） */
  lineNumber?: number;
}

interface UseDocumentTocOptions {
  /** 编辑器容器 ref（富文本模式查询 DOM） */
  containerRef: React.RefObject<HTMLElement | null>;
  /** CodeMirror EditorView ref（源码模式解析） */
  editorViewRef?: React.MutableRefObject<EditorViewLike | null>;
  /** 当前模式 */
  mode: 'rich-text' | 'source' | 'split';
  /** 是否启用 */
  enabled: boolean;
}

/** 从 DOM 提取 h1-h6 */
const extractFromDom = (container: HTMLElement): TocItem[] => {
  const headings = container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
  const items: TocItem[] = [];
  headings.forEach((el, idx) => {
    const level = parseInt(el.tagName.substring(1), 10);
    const text = el.textContent?.trim() || '';
    if (!text) return;
    // 确保元素有 id 用于跳转
    if (!el.id) {
      el.id = `toc-heading-${idx}-${text.slice(0, 10).replace(/\s/g, '-')}`;
    }
    items.push({ id: el.id, text, level, element: el });
  });
  return items;
};

/** 从 CodeMirror 源码提取 # 标题 */
const extractFromSource = (view: EditorViewLike): TocItem[] => {
  const items: TocItem[] = [];
  const doc = view.state.doc;
  const lineCount = doc.length;
  // 遍历所有行
  for (let i = 1; i <= lineCount; i++) {
    try {
      const line = doc.line(i);
      const match = line.text.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        items.push({
          id: `toc-line-${i}`,
          text,
          level,
          lineNumber: i,
        });
      }
    } catch {
      break;
    }
  }
  return items;
};

export const useDocumentToc = ({
  containerRef,
  editorViewRef,
  mode,
  enabled,
}: UseDocumentTocOptions) => {
  const [items, setItems] = useState<TocItem[]>([]);
  const rafRef = useRef<number | null>(null);

  const refresh = useCallback(() => {
    if (!enabled) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      // 分栏模式优先从预览 DOM 提取
      if (mode === 'rich-text' || mode === 'split') {
        const container = containerRef.current;
        if (container) {
          const domItems = extractFromDom(container);
          if (domItems.length > 0) {
            setItems(domItems);
            return;
          }
        }
      }
      // 源码模式或 DOM 无标题时从 CodeMirror 提取
      if ((mode === 'source' || mode === 'split') && editorViewRef?.current) {
        setItems(extractFromSource(editorViewRef.current));
      }
    });
  }, [enabled, mode, containerRef, editorViewRef]);

  // 初始提取 + 监听内容变化
  useEffect(() => {
    if (!enabled) {
      setItems([]);
      return;
    }
    refresh();

    // 富文本模式：MutationObserver 监听内容变化
    if (mode === 'rich-text' || mode === 'split') {
      const container = containerRef.current;
      if (container) {
        const observer = new MutationObserver(() => refresh());
        observer.observe(container, { childList: true, subtree: true, characterData: true });
        return () => observer.disconnect();
      }
    }
  }, [enabled, mode, containerRef, refresh]);

  /** 跳转到指定标题 */
  const scrollTo = useCallback(
    (item: TocItem) => {
      if (item.element) {
        item.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (item.lineNumber != null && editorViewRef?.current) {
        const view = editorViewRef.current;
        const line = view.state.doc.line(item.lineNumber);
        view.dispatch({
          selection: { anchor: line.from },
          effects: [],
        });
        view.focus();
        // 滚动到对应行
        const scrollDom = (view as any).scrollDOM as HTMLElement | undefined;
        if (scrollDom) {
          const lineHeight = 24; // 估算行高
          scrollDom.scrollTop = (item.lineNumber - 1) * lineHeight;
        }
      }
    },
    [editorViewRef],
  );

  return { items, refresh, scrollTo };
};
