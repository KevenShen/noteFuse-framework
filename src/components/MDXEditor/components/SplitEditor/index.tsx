/**
 * 左右分栏编辑器（split 模式）
 * 左栏：CodeMirror 源码编辑器（可编辑）
 * 右栏：MDXEditor 富文本预览（只读，内联）
 *
 * 功能：
 * - 左右栏内容实时同步（防抖 150ms）
 * - 基于标题锚点的分段滚动同步（替代比例同步，解决行高不一致导致的错位）
 *
 * 对外暴露：editorViewRef（源码编辑器）+ previewEditorRef（预览编辑器）
 */
import type { MDXEditorMethods } from '@mdxeditor/editor';
import type { EditorViewLike } from '../../types';
import React, { useCallback, useRef, useState } from 'react';
import { useSplitScrollSync } from '../../hooks';
import PreviewPane from './PreviewPane';
import SourceCodeEditor from './SourceCodeEditor';

export interface SplitEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** 左栏 CodeMirror EditorView 实例引用 */
  editorViewRef: React.MutableRefObject<EditorViewLike | null>;
  /** 右栏预览编辑器实例引用（分栏模式下访问完整 API） */
  previewEditorRef?: React.MutableRefObject<MDXEditorMethods | null>;
  readOnly?: boolean;
  splitRatio?: number;
  /** 是否启用滚动同步（默认 true） */
  scrollSync?: boolean;
}

/** 左栏CodeMirror 源码编辑器（可编辑）（内联：仅分栏模式使用） */
const SplitEditor: React.FC<SplitEditorProps> = ({
  readOnly = false,
  value,
  onChange,
  editorViewRef,
  previewEditorRef,
  splitRatio = 0.5,
  scrollSync = true,
}) => {
  const [previewValue, setPreviewValue] = useState(value);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);

  // 基于标题锚点的分段滚动同步
  const { handleSourceScroll } = useSplitScrollSync({
    editorViewRef,
    previewScrollRef,
    value,
    enabled: scrollSync,
  });

  /** 左栏内容变化 → 防抖更新右栏预览 */
  const handleSourceChange = useCallback(
    (newVal: string) => {
      onChange(newVal);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => setPreviewValue(newVal), 150);
    },
    [onChange],
  );

  return (
    <div className="split-editor-container">
      {/* 左栏：源码编辑器 */}
      <div
        className="split-editor-left"
        style={{ width: `${splitRatio * 100}%` }}
      >
        <div className="split-editor-pane-title">源码</div>
        <SourceCodeEditor
          readOnly={readOnly}
          value={value}
          onChange={handleSourceChange}
          editorViewRef={editorViewRef}
          onScroll={handleSourceScroll}
        />
      </div>

      <div className="split-editor-divider" />

      {/* 右栏：富文本预览 */}
      <div
        className="split-editor-right"
        style={{ width: `${(1 - splitRatio) * 100}%` }}
      >
        <div className="split-editor-pane-title">预览</div>
        <div ref={previewScrollRef} className="split-preview-scroll-container">
          <PreviewPane ref={previewEditorRef} value={previewValue} />
        </div>
      </div>
    </div>
  );
};

export default SplitEditor;
