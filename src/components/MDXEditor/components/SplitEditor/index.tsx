/**
 * 左右分栏编辑器（split 模式）
 * 左栏：CodeMirror 源码编辑器（可编辑）
 * 右栏：MDXEditor 富文本预览（只读，内联）
 *
 * 功能：左右栏内容实时同步（防抖）+ 滚动比例同步
 */
import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { EditorView } from '@codemirror/view';
import { MDXEditor, type MDXEditorMethods } from '@mdxeditor/editor';
import SourceCodeEditor from './SourceCodeEditor';
import { createBasePlugins } from '../../plugins';

export interface SplitEditorProps {
  value: string;
  onChange: (value: string) => void;
  editorViewRef: React.MutableRefObject<EditorView | null>;
  readOnly?: boolean;
  splitRatio?: number;
  scrollSync?: boolean;
}

/** 右栏只读预览（内联：仅分栏模式使用，无独立复用价值） */
const PreviewPane: React.FC<{ value: string }> = ({ value }) => {
  const editorRef = useRef<MDXEditorMethods | null>(null);
  const lastValueRef = useRef(value);
  const plugins = useMemo(() => createBasePlugins({ enableKeymap: false }), []);

  useEffect(() => {
    if (value !== lastValueRef.current && editorRef.current) {
      lastValueRef.current = value;
      editorRef.current.setMarkdown(value);
    }
  }, [value]);

  return (
    <div className="split-preview-editor">
      <MDXEditor
        ref={editorRef}
        readOnly
        markdown={value}
        plugins={plugins}
        contentEditableClassName="mdx-editor-content"
      />
    </div>
  );
};

const SplitEditor: React.FC<SplitEditorProps> = ({
  value,
  onChange,
  editorViewRef,
  readOnly = false,
  splitRatio = 0.5,
  scrollSync = true,
}) => {
  const [previewValue, setPreviewValue] = useState(value);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  /** 左栏内容变化 → 防抖更新右栏预览 */
  const handleSourceChange = useCallback(
    (newVal: string) => {
      onChange(newVal);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => setPreviewValue(newVal), 150);
    },
    [onChange],
  );

  /** 左栏滚动 → 比例同步右栏 */
  const handleSourceScroll = useCallback(
    (ratio: number) => {
      if (!scrollSync || isSyncingRef.current) return;
      const el = previewScrollRef.current;
      if (!el) return;
      isSyncingRef.current = true;
      el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    },
    [scrollSync],
  );

  return (
    <div className="split-editor-container">
      {/* 左栏：源码编辑器 */}
      <div className="split-editor-left" style={{ width: `${splitRatio * 100}%` }}>
        <div className="split-editor-pane-title">源码</div>
        <SourceCodeEditor
          value={value}
          onChange={handleSourceChange}
          editorViewRef={editorViewRef}
          readOnly={readOnly}
          onScroll={handleSourceScroll}
        />
      </div>

      <div className="split-editor-divider" />

      {/* 右栏：富文本预览 */}
      <div className="split-editor-right" style={{ width: `${(1 - splitRatio) * 100}%` }}>
        <div className="split-editor-pane-title">预览</div>
        <div ref={previewScrollRef} className="split-preview-scroll-container">
          <PreviewPane value={previewValue} />
        </div>
      </div>
    </div>
  );
};

export default SplitEditor;
