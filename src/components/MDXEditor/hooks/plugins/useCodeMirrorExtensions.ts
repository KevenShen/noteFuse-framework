/**
 * @file CodeMirror 扩展组装 Hook
 * @description 组装源码/diff 模式共用的 CodeMirror 扩展
 */
import {
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
} from '@codemirror/language';
import { keymap } from '@codemirror/view';
import type { MutableRefObject } from 'react';
import { useMemo } from 'react';
import type { EditorViewLike } from '../../types';
import {
  createEditorViewCapture,
  markdownKeymap,
} from '../../plugins';

/**
 * 组装 CodeMirror 扩展（源码/diff 模式共用）
 */
export const useCodeMirrorExtensions = (
  editorViewRef: MutableRefObject<EditorViewLike | null>,
) => {
  return useMemo(
    () => [
      markdownKeymap,
      createEditorViewCapture(editorViewRef),
      foldGutter(),
      keymap.of(foldKeymap),
      syntaxHighlighting(defaultHighlightStyle),
    ],
    [editorViewRef],
  );
};
