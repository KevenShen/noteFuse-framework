/**
 * @file 工具栏模式辅助函数
 * @description 富文本/源码模式的通用操作函数，供工厂函数和按钮模块复用
 */
import type { MDXEditorMethods } from '@mdxeditor/editor';
import type { MutableRefObject, RefObject } from 'react';
import type { EditorViewLike } from '../../types';

/** 富文本模式：包裹选中文本 */
export const wrapRich = (
  editorRef: RefObject<MDXEditorMethods | null>,
  before: string,
  after: string,
  placeholder = '文本',
) => {
  const selected = window.getSelection()?.toString() || placeholder;
  editorRef.current?.focus();
  editorRef.current?.insertMarkdown(`${before}${selected}${after}`);
};

/** 富文本模式：在光标处插入内容 */
export const insertRich = (
  editorRef: RefObject<MDXEditorMethods | null>,
  content: string,
) => {
  editorRef.current?.focus();
  editorRef.current?.insertMarkdown(content);
};

/** 源码模式：执行 CodeMirror 操作 */
export const execSource = (
  ref: MutableRefObject<EditorViewLike | null>,
  fn: (view: EditorViewLike) => void,
) => {
  const view = ref.current;
  if (view) fn(view);
};

/** 源码模式：在光标处插入文本 */
export const insertAtCursor = (
  ref: MutableRefObject<EditorViewLike | null>,
  text: string,
) => {
  execSource(ref, (v) => {
    v.dispatch({
      changes: { from: v.state.selection.main.from, insert: text },
    });
  });
};

/** 生成标题前缀（h1→'# ', p→''） */
export const headingPrefix = (key: string): string =>
  key === 'p' ? '' : `${'#'.repeat(parseInt(key.replace('h', ''), 10))} `;
