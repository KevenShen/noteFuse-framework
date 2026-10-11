/**
 * 右栏只读预览组件
 * 仅分栏模式使用，无独立复用价值
 * 使用独立 MDXEditor 实例，通过 ref 同步 value 避免重渲染
 * 对外暴露 editorRef，使分栏模式下也能访问完整的编辑器 API
 */
import { MDXEditor, type MDXEditorMethods } from '@mdxeditor/editor';
import React, { forwardRef, useEffect, useMemo, useRef } from 'react';
import { createBasePlugins } from '../../plugins';

export interface PreviewPaneProps {
  /** markdown 内容 */
  value: string;
}

const PreviewPane = forwardRef<MDXEditorMethods, PreviewPaneProps>(
  ({ value }, ref) => {
    const innerRef = useRef<MDXEditorMethods | null>(null);
    const lastValueRef = useRef(value);
    const plugins = useMemo(
      () => createBasePlugins({ enableKeymap: false }),
      [],
    );

    // 同步外部 ref 与内部 ref
    useEffect(() => {
      if (typeof ref === 'function') {
        ref(innerRef.current);
      } else if (ref) {
        (ref as React.MutableRefObject<MDXEditorMethods | null>).current =
          innerRef.current;
      }
    }, [ref]);

    // 外部 value 变化时同步（避免重渲染，通过 ref 直接设置）
    useEffect(() => {
      if (value !== lastValueRef.current && innerRef.current) {
        lastValueRef.current = value;
        innerRef.current.setMarkdown(value);
      }
    }, [value]);

    return (
      <div className="split-preview-editor">
        <MDXEditor
          ref={innerRef}
          readOnly
          markdown={value}
          plugins={plugins}
          contentEditableClassName="mdx-editor-content"
        />
      </div>
    );
  },
);

PreviewPane.displayName = 'PreviewPane';

export default PreviewPane;
