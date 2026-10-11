/**
 * CodeMirror 扩展配置
 * - createEditorViewCapture: 捕获 EditorView 实例到 ref
 * - markdownKeymap: Markdown 编辑快捷键
 *
 * 从 components/EditorHandle/codeMirror.ts 迁移，非组件逻辑应放在 plugins/ 目录
 */
import type { Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import type { EditorViewLike } from '../types';
import {
  insertHeading,
  insertLinePrefix,
  insertLink,
  toggleLinePrefix,
  wrapSelection,
} from '../components/EditorTools/markdownInsert';

/** 将真实 EditorView 转为最小类型 */
const asMinimal = (v: EditorView) => v as unknown as EditorViewLike;

/**
 * 捕获 EditorView 实例的扩展
 * 通过 updateListener 在视图更新时保存实例到 ref
 */
export const createEditorViewCapture = (
  ref: React.MutableRefObject<EditorViewLike | null>,
): Extension =>
  EditorView.updateListener.of((update) => {
    if (update.view !== ref.current) {
      ref.current = update.view as unknown as EditorViewLike;
    }
  });

/**
 * Markdown 编辑快捷键
 */
export const markdownKeymap: Extension = keymap.of([
  // 文本格式
  { key: 'Mod-b', run: (v) => wrapSelection(asMinimal(v), '**', '**') },
  { key: 'Mod-i', run: (v) => wrapSelection(asMinimal(v), '*', '*') },
  { key: 'Mod-e', run: (v) => wrapSelection(asMinimal(v), '`', '`') },
  { key: 'Mod-Shift-s', run: (v) => wrapSelection(asMinimal(v), '~~', '~~') },
  // 标题
  { key: 'Alt-1', run: (v) => insertHeading(asMinimal(v), 1) },
  { key: 'Alt-2', run: (v) => insertHeading(asMinimal(v), 2) },
  { key: 'Alt-3', run: (v) => insertHeading(asMinimal(v), 3) },
  // 列表
  { key: 'Mod-Shift-7', run: (v) => toggleLinePrefix(asMinimal(v), '- ') },
  { key: 'Mod-Shift-8', run: (v) => insertLinePrefix(asMinimal(v), '1. ') },
  { key: 'Mod-Shift-9', run: (v) => toggleLinePrefix(asMinimal(v), '- [ ] ') },
  // 引用
  { key: 'Mod-Shift-.', run: (v) => toggleLinePrefix(asMinimal(v), '> ') },
  // 链接
  { key: 'Mod-k', run: (v) => insertLink(asMinimal(v)) },
]);
