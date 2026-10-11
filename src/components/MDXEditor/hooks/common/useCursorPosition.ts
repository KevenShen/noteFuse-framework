/**
 * 光标位置跟踪 Hook
 * 兼容 CodeMirror 源码模式 + Lexical 富文本模式，防抖 + 去重
 */
import { useCallback, useEffect, useRef } from 'react';
import type { EditorCursorPos } from '../../types';

/** 计算当前光标位置（纯 DOM 计算） */
function calcCursorPosition(): EditorCursorPos | null {
  const activeElement = document.activeElement;
  if (!activeElement) return null;

  const mdxEditor = activeElement.closest('.mdxeditor');
  if (!mdxEditor) return null;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const { anchorNode, anchorOffset, isCollapsed } = selection;
  if (!anchorNode) return null;

  // 源码 CodeMirror 模式
  if (activeElement.classList.contains('cm-content') || activeElement.closest('.cm-editor')) {
    const lineEl = (anchorNode.nodeType === Node.TEXT_NODE
      ? anchorNode.parentElement
      : (anchorNode as HTMLElement)
    )?.closest('.cm-line');
    if (!lineEl) return null;

    // 行号：用 previousElementSibling 遍历（比 querySelectorAll+indexOf 高效）
    let lineNumber = 1;
    let prev = lineEl.previousElementSibling;
    while (prev) {
      lineNumber++;
      prev = prev.previousElementSibling;
    }

    // 列偏移：遍历行内文本节点，累加至 anchorNode
    let columnOffset = 0;
    const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      if (node === anchorNode) {
        columnOffset += anchorOffset;
        break;
      }
      columnOffset += node.textContent?.length || 0;
      node = walker.nextNode();
    }

    return { mode: 'source', lineNumber, columnOffset, anchorOffset, isCollapsed };
  }

  // 富文本模式
  const editableRoot = mdxEditor.querySelector('[contenteditable="true"]');
  if (!editableRoot || !editableRoot.contains(activeElement)) return null;

  // 找到当前块级元素（editableRoot 的直接子元素）
  let block: HTMLElement | null =
    anchorNode.nodeType === Node.TEXT_NODE
      ? anchorNode.parentElement
      : (anchorNode as HTMLElement);
  while (block && block.parentElement !== editableRoot) {
    block = block.parentElement;
  }

  // 行号：遍历 previousElementSibling
  let lineNumber = 1;
  if (block) {
    let prev = block.previousElementSibling;
    while (prev) {
      lineNumber++;
      prev = prev.previousElementSibling;
    }
  }

  return {
    mode: 'rich-text',
    lineNumber,
    columnOffset: anchorOffset,
    anchorOffset,
    isCollapsed,
    nodeTagName: anchorNode.parentElement?.tagName,
  };
}

interface UseCursorPositionOptions {
  readOnly?: boolean;
  onCursorChange?: (pos: EditorCursorPos) => void;
}

/** 光标位置跟踪 Hook：监听 selectionchange，防抖 100ms，去重相同位置 */
export const useCursorPosition = ({ readOnly, onCursorChange }: UseCursorPositionOptions) => {
  const stateRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    lastPos: EditorCursorPos | null;
  }>({ timer: null, lastPos: null });

  const calcPos = useCallback(calcCursorPosition, []);

  useEffect(() => {
    if (readOnly) return;
    const state = stateRef.current;

    const handleSelection = () => {
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        const pos = calcPos();
        if (!pos) return;
        const last = state.lastPos;
        // 去重：位置完全相同时不触发回调
        if (
          last &&
          last.lineNumber === pos.lineNumber &&
          last.columnOffset === pos.columnOffset &&
          last.isCollapsed === pos.isCollapsed &&
          last.mode === pos.mode
        ) {
          return;
        }
        state.lastPos = pos;
        onCursorChange?.(pos);
      }, 100);
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
      if (state.timer) clearTimeout(state.timer);
    };
  }, [readOnly, calcPos, onCursorChange]);
};
