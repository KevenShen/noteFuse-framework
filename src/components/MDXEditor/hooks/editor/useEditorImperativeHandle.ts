/**
 * @file 编辑器实例暴露 Hook
 * @description 封装 useImperativeHandle，统一处理 getMarkdown/setMarkdown/insertMarkdown/focus 等方法
 *              根据当前视图模式（split/source/rich-text）智能选择 CodeMirror 或 MDXEditor 操作
 *              分栏模式下 getEditor 返回预览编辑器实例，使完整 API 可用
 */
import type { MDXEditorMethods } from '@mdxeditor/editor';
import type { MutableRefObject } from 'react';
import { useCallback, useImperativeHandle } from 'react';
import { scrollToAnchor } from '../../utils/scrollToAnchor';
import { insertMarkdownAtCursor } from '../../components/EditorTools/richTextInsert';
import type {
  EditorCursorPos,
  EditorViewLike,
  ExtendedViewMode,
  MDXEditorRef,
} from '../../types';

interface UseEditorImperativeHandleOptions {
  ref: React.Ref<MDXEditorRef>;
  /** 主编辑器实例（非分栏模式绑定 @mdxeditor/editor） */
  editorRef: MutableRefObject<MDXEditorMethods | null>;
  /** CodeMirror EditorView 实例（分栏/源码模式） */
  editorViewRef: MutableRefObject<EditorViewLike | null>;
  /** 分栏预览编辑器实例（分栏模式下的 @mdxeditor/editor） */
  previewEditorRef?: MutableRefObject<MDXEditorMethods | null>;
  cursorPosRef: MutableRefObject<EditorCursorPos>;
  currentViewMode: ExtendedViewMode;
}

/**
 * 判断是否为源码模式（split 或 source）
 */
function isSourceMode(mode: ExtendedViewMode): boolean {
  return mode === 'split' || mode === 'source';
}

export function useEditorImperativeHandle({
  ref,
  editorRef,
  editorViewRef,
  previewEditorRef,
  cursorPosRef,
  currentViewMode,
}: UseEditorImperativeHandleOptions) {
  // 获取 Markdown 内容
  const getMarkdown = useCallback(() => {
    if (currentViewMode === 'split') {
      return editorViewRef.current?.state.doc.toString() || '';
    }
    return editorRef.current?.getMarkdown() || '';
  }, [currentViewMode, editorRef, editorViewRef]);

  // 设置 Markdown 内容
  const setMarkdown = useCallback(
    (val: string) => {
      if (currentViewMode === 'split' && editorViewRef.current) {
        editorViewRef.current.dispatch({
          changes: {
            from: 0,
            to: editorViewRef.current.state.doc.length,
            insert: val,
          },
        });
        return;
      }
      editorRef.current?.setMarkdown(val);
    },
    [currentViewMode, editorRef, editorViewRef],
  );

  // 在光标处插入 Markdown
  const insertMarkdown = useCallback(
    (val: string) => {
      // 源码模式：使用 CodeMirror 插入
      if (isSourceMode(currentViewMode) && editorViewRef.current) {
        const view = editorViewRef.current;
        view.focus();
        view.dispatch({
          changes: {
            from: view.state.selection.main.from,
            insert: val,
          },
        });
        return;
      }
      // 富文本模式：使用 MDXEditor 插入
      insertMarkdownAtCursor(val, editorRef);
    },
    [currentViewMode, editorRef, editorViewRef],
  );

  // 聚焦编辑器
  const focus = useCallback(() => {
    if (currentViewMode === 'split') {
      editorViewRef.current?.focus();
      return;
    }
    editorRef.current?.focus();
  }, [currentViewMode, editorRef, editorViewRef]);

  // 获取编辑器实例（分栏模式返回预览编辑器，使完整 API 可用）
  const getEditor = useCallback((): MDXEditorMethods | null => {
    if (currentViewMode === 'split') {
      return previewEditorRef?.current || null;
    }
    return editorRef.current;
  }, [currentViewMode, editorRef, previewEditorRef]);

  useImperativeHandle(
    ref,
    () => ({
      getEditor,
      getMarkdown,
      setMarkdown,
      insertMarkdown,
      focus,
      getViewMode: () => currentViewMode,
      getCursorPosition: () => cursorPosRef.current,
      scrollToAnchor: (anchorId: string, offset: number = 0) =>
        scrollToAnchor(anchorId, offset),
    }),
    [
      currentViewMode,
      getMarkdown,
      setMarkdown,
      insertMarkdown,
      focus,
      getEditor,
      editorRef,
      cursorPosRef,
    ],
  );
}
