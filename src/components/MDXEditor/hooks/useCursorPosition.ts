/**
 * 光标位置跟踪 Hook
 * 兼容 CodeMirror 源码模式 + Lexical 富文本模式，防抖 + 去重
 */
import { useCallback, useEffect, useRef } from 'react';
import type { EditorCursorPos } from '../types';

/** 计算当前光标位置（纯 DOM 计算，无 hooks 依赖） */
function calcCursorPosition(): EditorCursorPos | null {
  const activeElement = document.activeElement;
  if (!activeElement) return null;

  const mdxEditorContainer = activeElement.closest('.mdxeditor');
  if (!mdxEditorContainer) return null;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const { anchorNode, anchorOffset, isCollapsed } = selection;
  if (!anchorNode) return null;

  // 源码 CodeMirror 模式
  const isCodeMirror =
    activeElement.classList.contains('cm-content') ||
    !!activeElement.closest('.cm-editor');

  if (isCodeMirror) {
    const currentLineEl =
      anchorNode.nodeType === Node.TEXT_NODE
        ? anchorNode.parentElement?.closest('.cm-line')
        : (anchorNode as HTMLElement).closest('.cm-line');
    if (!currentLineEl) return null;

    const lineParent = currentLineEl.parentElement;
    if (!lineParent) return null;
    const lines = Array.from(lineParent.querySelectorAll('.cm-line'));
    const lineNumber = lines.indexOf(currentLineEl) + 1;

    let columnOffset = 0;
    const walker = document.createTreeWalker(currentLineEl, NodeFilter.SHOW_TEXT);
    let textNode: Node | null = walker.nextNode();
    while (textNode) {
      if (textNode !== anchorNode) {
        columnOffset += textNode.textContent?.length || 0;
      } else {
        columnOffset += anchorOffset;
        break;
      }
      textNode = walker.nextNode();
    }

    return { mode: 'source', lineNumber, columnOffset, anchorOffset, isCollapsed };
  }

  // 富文本模式
  const editableRoot = mdxEditorContainer.querySelector('[contenteditable="true"]');
  if (!editableRoot || !editableRoot.contains(activeElement)) return null;

  let currentBlockNode: HTMLElement | null =
    anchorNode.nodeType === Node.TEXT_NODE
      ? anchorNode.parentElement
      : (anchorNode as HTMLElement);
  while (currentBlockNode && currentBlockNode.parentElement !== editableRoot) {
    currentBlockNode = currentBlockNode.parentElement;
  }

  let lineNumber = 1;
  if (currentBlockNode) {
    let prev = currentBlockNode.previousElementSibling;
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

/**
 * 光标位置跟踪 Hook
 * 监听全局 selectionchange 事件，防抖 100ms，去重相同位置
 */
export const useCursorPosition = ({ readOnly, onCursorChange }: UseCursorPositionOptions) => {
  const stateRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; lastPos: EditorCursorPos | null }>({
    timer: null,
    lastPos: null,
  });

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
