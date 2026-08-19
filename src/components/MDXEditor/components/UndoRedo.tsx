/**
 * 撤销/重做按钮（双模式统一）
 * - 富文本模式：通过 useRealm + activeEditor$ 调用 Lexical UNDO_COMMAND/REDO_COMMAND
 * - 源码模式：通过 @codemirror/commands 的 undo/redo 操作 EditorView
 *
 * 注意：useRealm 只能在 MDXEditor 内部调用，分栏模式下工具栏在 MDXEditor 外部渲染，
 * 因此拆分为两个子组件，根据 mode 条件渲染，避免在源码/分栏模式下调用 useRealm。
 */
import React from 'react';
import { useRealm, activeEditor$ } from '@mdxeditor/editor';
// @ts-ignore lexical@0.48 在 TS<5.2 时使用降级类型文件，运行时正常导出
import { UNDO_COMMAND, REDO_COMMAND } from 'lexical';
import { undo, redo } from '@codemirror/commands';
import { ToolbarBaseButton } from './ToolbarButton';

export interface UndoRedoProps {
  /** 当前编辑模式 */
  mode: 'rich-text' | 'source';
  /** CodeMirror EditorView 引用（源码模式使用） */
  editorViewRef?: React.MutableRefObject<any>;
}

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
      <ToolbarBaseButton title="撤销" onClick={() => exec(UNDO_COMMAND)}>↩</ToolbarBaseButton>
      <ToolbarBaseButton title="重做" onClick={() => exec(REDO_COMMAND)}>↪</ToolbarBaseButton>
    </>
  );
};

/** 源码/分栏模式撤销重做 — 不依赖 useRealm，可在 MDXEditor 外部渲染 */
const SourceUndoRedo: React.FC<{ editorViewRef?: React.MutableRefObject<any> }> = ({
  editorViewRef,
}) => {
  const exec = (command: (view: any) => boolean) => {
    const view = editorViewRef?.current;
    if (view) {
      view.focus();
      command(view);
    }
  };

  return (
    <>
      <ToolbarBaseButton title="撤销" onClick={() => exec(undo)}>↩</ToolbarBaseButton>
      <ToolbarBaseButton title="重做" onClick={() => exec(redo)}>↪</ToolbarBaseButton>
    </>
  );
};

const UndoRedo: React.FC<UndoRedoProps> = ({ mode, editorViewRef }) => {
  if (mode === 'source') {
    return <SourceUndoRedo editorViewRef={editorViewRef} />;
  }
  return <RichTextUndoRedo />;
};

export default UndoRedo;
