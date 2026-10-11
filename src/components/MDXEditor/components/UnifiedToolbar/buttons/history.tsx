/**
 * @file 撤销/重做按钮
 * @description 富文本模式使用 Lexical 命令（useRealm），源码/分栏模式使用 CodeMirror 命令
 *
 * 注意：useRealm 只能在 MDXEditor 内部调用，分栏模式下工具栏在 MDXEditor 外部渲染，
 * 因此拆分为两个子组件，根据 mode 条件渲染，入口组件提供容器样式。
 */
import { redo, undo } from '@codemirror/commands';
import { activeEditor$, useRealm } from '@mdxeditor/editor';
// @ts-ignore lexical@0.48 在 TS<5.2 时使用降级类型文件，运行时正常导出
import { REDO_COMMAND, UNDO_COMMAND } from 'lexical';
import React from 'react';
import type { EditorViewLike } from '../../types';
import { ToolbarBaseButton } from '../ToolbarButton';
import type { UndoRedoProps } from './types';

/** 富文本模式撤销重做 — 内部调用 useRealm，只能在 MDXEditor 上下文中渲染 */
const RichTextUndoRedo: React.FC = () => {
  const realm = useRealm();
  const exec = (command: typeof UNDO_COMMAND) => {
    const editor = realm.getValue(activeEditor$);
    if (editor) {
      editor.focus();
      editor.dispatchCommand(command, undefined);
    }
  };
  return (
    <>
      <ToolbarBaseButton title="撤销" onClick={() => exec(UNDO_COMMAND)}>
        ↩
      </ToolbarBaseButton>
      <ToolbarBaseButton title="重做" onClick={() => exec(REDO_COMMAND)}>
        ↪
      </ToolbarBaseButton>
    </>
  );
};

/** 源码/分栏模式撤销重做 — 不依赖 useRealm，可在 MDXEditor 外部渲染 */
const SourceUndoRedo: React.FC<{
  editorViewRef?: React.MutableRefObject<EditorViewLike | null>;
}> = ({ editorViewRef }) => {
  const exec = (command: (view: any) => boolean) => {
    const view = editorViewRef?.current;
    if (view) {
      view.focus();
      command(view);
    }
  };
  return (
    <>
      <ToolbarBaseButton title="撤销" onClick={() => exec(undo)}>
        ↩
      </ToolbarBaseButton>
      <ToolbarBaseButton title="重做" onClick={() => exec(redo)}>
        ↪
      </ToolbarBaseButton>
    </>
  );
};

/** 统一撤销/重做按钮入口（提供容器样式，内部根据模式选择子组件） */
export const UndoRedo: React.FC<UndoRedoProps> = ({ mode, editorViewRef }) => (
  <div className="undo-redo-group">
    {mode === 'source' ? (
      <SourceUndoRedo editorViewRef={editorViewRef} />
    ) : (
      <RichTextUndoRedo />
    )}
  </div>
);
