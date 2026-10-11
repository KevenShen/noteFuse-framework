/**
 * 文档目录 Hook
 * 从编辑器内容提取 h1-h6 标题，支持富文本模式和源码模式
 * - 富文本模式：从 DOM 查询 h1-h6 元素
 * - 源码模式：从 CodeMirror 解析 # 开头的行
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import type { EditorViewLike } from '../../types';

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

/** 从 CodeMirror 源码 DOM 提取 # 标题（不依赖 editorViewRef） */
const extractFromSourceDom = (container: HTMLElement): TocItem[] => {
  const lines = container.querySelectorAll('.cm-line');
  const items: TocItem[] = [];
  lines.forEach((lineEl, idx) => {
    const text = lineEl.textContent || '';
    const match = text.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      const level = match[1].length;
      const titleText = match[2].trim();
      if (!titleText) return;
      items.push({
        id: `toc-src-line-${idx + 1}`,
        text: titleText,
        level,
        lineNumber: idx + 1,
        element: lineEl as HTMLElement,
      });
    }
  });
  return items;
};

/** 从 CodeMirror EditorView state 提取 # 标题（不受虚拟滚动影响，全量遍历） */
const extractFromSource = (view: EditorViewLike): TocItem[] => {
  const items: TocItem[] = [];
  const doc = view.state.doc;
  let inCodeBlock = false;
  // doc.length 是字符数，用 try-catch 越界时 break，可正确遍历所有行
  for (let i = 1; i <= doc.length; i++) {
    try {
      const line = doc.line(i);
      const text = line.text;
      // 检测 fenced code block 边界（``` 或 ~~~）
      if (/^\s*(```|~~~)/.test(text)) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      // 代码块内的 # 是注释，不是标题
      if (inCodeBlock) continue;
      const match = text.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        const level = match[1].length;
        const titleText = match[2].trim();
        if (!titleText) continue;
        items.push({
          id: `toc-line-${i}`,
          text: titleText,
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

/** 在源码中按标题文本+层级查找行号（带代码块感知，用于分栏模式同步滚动） */
const findSourceLineByHeading = (
  view: EditorViewLike,
  level: number,
  text: string,
): number => {
  const doc = view.state.doc;
  const prefix = '#'.repeat(level) + ' ';
  let inCodeBlock = false;
  for (let i = 1; i <= doc.length; i++) {
    try {
      const lineText = doc.line(i).text;
      if (/^\s*(```|~~~)/.test(lineText)) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;
      if (lineText.startsWith(prefix) && lineText.slice(prefix.length).trim() === text) {
        return i;
      }
    } catch {
      break;
    }
  }
  return -1;
};

export const useDocumentToc = ({
  containerRef,
  editorViewRef,
  mode,
  enabled,
}: UseDocumentTocOptions) => {
  const [items, setItems] = useState<TocItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    // 防抖 300ms：避免初次渲染大量 DOM 变更时反复提取
    timerRef.current = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;

      // 富文本/分栏模式：从 DOM 提取 h1-h6
      if (mode === 'rich-text' || mode === 'split') {
        const domItems = extractFromDom(container);
        if (domItems.length > 0) {
          setItems(domItems);
          return;
        }
      }

      // 源码/分栏模式：优先从 editorViewRef state 提取（不受虚拟滚动影响，全量准确）
      if (mode === 'source' || mode === 'split') {
        if (editorViewRef?.current) {
          const sourceItems = extractFromSource(editorViewRef.current);
          if (sourceItems.length > 0) {
            setItems(sourceItems);
            return;
          }
        }
        // fallback：从 DOM 提取（editorViewRef 不可用时，可能不完整）
        const sourceDomItems = extractFromSourceDom(container);
        if (sourceDomItems.length > 0) {
          setItems(sourceDomItems);
          return;
        }
      }
    }, 300);
  }, [enabled, mode, containerRef, editorViewRef]);

  // 初始提取 + 监听内容变化（所有模式都监听容器 DOM 变化）
  useEffect(() => {
    if (!enabled) {
      setItems([]);
      return;
    }
    refresh();

    // 用 MutationObserver 监听编辑器容器 DOM 变化
    // 富文本模式：contenteditable 内容变化
    // 源码模式：CodeMirror DOM 内容变化
    // 分栏模式：预览区内容变化
    // 【性能优化】只在标题相关 DOM 变化时触发刷新，避免每次输入都重算目录
    const container = containerRef.current;
    if (container) {
      /** 检查节点是否包含标题相关内容 */
      const checkHeadingNode = (node: Node): boolean => {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const el = node as HTMLElement;
        // 标题元素本身
        if (/^H[1-6]$/.test(el.tagName)) return true;
        // 包含标题元素的子节点
        if (el.querySelector && el.querySelector('h1,h2,h3,h4,h5,h6')) return true;
        // 源码模式：CodeMirror 的 .cm-line 中包含 # 标题
        if (el.classList?.contains('cm-line')) {
          const text = el.textContent || '';
          if (/^(#{1,6})\s+/.test(text)) return true;
        }
        return false;
      };

      const observer = new MutationObserver((mutations) => {
        let hasHeadingChange = false;

        for (const mutation of mutations) {
          // 1. 检查新增/删除的节点中是否包含标题元素
          if (mutation.type === 'childList') {
            for (const node of Array.from(mutation.addedNodes)) {
              if (checkHeadingNode(node)) {
                hasHeadingChange = true;
                break;
              }
            }
            if (!hasHeadingChange) {
              for (const node of Array.from(mutation.removedNodes)) {
                if (checkHeadingNode(node)) {
                  hasHeadingChange = true;
                  break;
                }
              }
            }
          }

          // 2. 检查文本变化是否发生在标题元素内
          if (!hasHeadingChange && mutation.type === 'characterData') {
            let parent: HTMLElement | null = mutation.target.parentElement;
            while (parent && parent !== container) {
              if (/^H[1-6]$/.test(parent.tagName)) {
                hasHeadingChange = true;
                break;
              }
              parent = parent.parentElement;
            }
          }

          if (hasHeadingChange) break;
        }

        // 只有标题相关变化才触发目录刷新
        if (hasHeadingChange) {
          refresh();
        }
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      return () => {
        observer.disconnect();
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [enabled, mode, containerRef, refresh]);

  /** 动态获取工具栏高度 + 间距（避免硬编码） */
  const getToolbarOffset = useCallback((): number => {
    const container = containerRef.current;
    if (!container) return 0;
    const toolbar = container.querySelector('.mdxeditor-toolbar');
    if (toolbar) {
      return toolbar.getBoundingClientRect().height + 16;
    }
    // 只读模式或工具栏隐藏时，不需要偏移
    return 0;
  }, [containerRef]);

  /** 跳转到指定标题（精确计算滚动位置，避开顶部工具栏） */
  const scrollTo = useCallback(
    (item: TocItem) => {
      // 源码模式：滚动容器是 CodeMirror 内部 .cm-scroller，工具栏在外部，只需小间距
      // 富文本/分栏预览模式：滚动容器是 .mdx-editor-main-area，工具栏可能 sticky，需动态偏移
      const offset = mode === 'source' ? 16 : getToolbarOffset();

      // ---------- 源码模式：从 editorViewRef state 提取的标题（无 element） ----------
      // 用 EditorView.scrollIntoView effect，指定 y:'start' 滚到顶部，yMargin 为间距
      // 不改变光标位置，CodeMirror 内部处理虚拟滚动
      if (!item.element) {
        if (item.lineNumber != null && editorViewRef?.current) {
          const view = editorViewRef.current;
          const line = view.state.doc.line(item.lineNumber);
          view.dispatch({
            effects: EditorView.scrollIntoView(line.from, {
              y: 'start',
              yMargin: offset,
            }),
          });
        }
        return;
      }

      // ---------- 富文本/分栏预览模式：有 DOM element ----------
      const el = item.element;

      // 优先查找编辑器主区域滚动容器（MDXEditor 内部结构复杂，父级链可能找不到）
      const container = containerRef.current;
      let scrollContainer: HTMLElement | null =
        container?.querySelector('.mdx-editor-main-area') || null;

      // 兜底：从元素父级链往上找可滚动容器
      if (!scrollContainer) {
        let parent: HTMLElement | null = el.parentElement;
        while (parent) {
          const { overflowY } = getComputedStyle(parent);
          if (overflowY === 'auto' || overflowY === 'scroll') {
            scrollContainer = parent;
            break;
          }
          parent = parent.parentElement;
        }
      }

      if (!scrollContainer) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      // 计算元素相对于滚动容器内容顶部的位置
      const containerRect = scrollContainer.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const relativeTop = elRect.top - containerRect.top + scrollContainer.scrollTop;

      // 减去工具栏偏移，平滑滚动预览区
      const targetTop = Math.max(0, relativeTop - offset);
      scrollContainer.scrollTo({ top: targetTop, behavior: 'smooth' });

      // ---------- 分栏模式：同步滚动源码区 ----------
      // editorViewRef.current 存在说明是分栏模式（源码区有独立 CodeMirror）
      if (editorViewRef?.current) {
        const sourceLine = findSourceLineByHeading(
          editorViewRef.current,
          item.level,
          item.text,
        );
        if (sourceLine > 0) {
          const view = editorViewRef.current;
          const line = view.state.doc.line(sourceLine);
          view.dispatch({
            effects: EditorView.scrollIntoView(line.from, {
              y: 'start',
              yMargin: 16,
            }),
          });
        }
      }
    },
    [editorViewRef, getToolbarOffset, containerRef, mode],
  );

  return { items, refresh, scrollTo };
};
