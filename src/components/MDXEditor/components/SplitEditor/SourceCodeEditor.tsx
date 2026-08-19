/**
 * 左栏源码编辑器（独立 CodeMirror 实例）
 * 用于 split 模式的左栏，最小化扩展配置，避免依赖 codemirror 聚合包
 */
import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, keymap } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { markdownKeymap, createEditorViewCapture } from '../../utils/codeMirror';

export interface SourceCodeEditorProps {
  /** 初始 markdown 内容 */
  value: string;
  /** 内容变化回调 */
  onChange: (value: string) => void;
  /** CodeMirror EditorView 实例引用（工具栏操作使用） */
  editorViewRef: React.MutableRefObject<EditorView | null>;
  /** 是否只读 */
  readOnly?: boolean;
  /** 滚动回调，传递滚动百分比 0-1 */
  onScroll?: (scrollRatio: number) => void;
}

const SourceCodeEditor: React.FC<SourceCodeEditorProps> = ({
  value,
  onChange,
  editorViewRef,
  readOnly = false,
  onScroll,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastValueRef = useRef<string>(value);
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const extensions = [
      markdownKeymap,
      createEditorViewCapture(editorViewRef),
      markdown(),
      lineNumbers(),
      foldGutter(),
      keymap.of(foldKeymap),
      syntaxHighlighting(defaultHighlightStyle),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newVal = update.state.doc.toString();
          lastValueRef.current = newVal;
          onChange(newVal);
        }
      }),
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    el.innerHTML = '';
    const view = new EditorView({
      parent: el,
      state: EditorState.create({ doc: value, extensions }),
    });
    viewRef.current = view;

    // 监听滚动事件，计算滚动百分比
    const handleScroll = () => {
      const scroller = view.scrollDOM;
      if (!scroller) return;
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      const ratio = maxScroll > 0 ? scroller.scrollTop / maxScroll : 0;
      onScrollRef.current?.(ratio);
    };
    view.scrollDOM.addEventListener('scroll', handleScroll);

    return () => {
      view.scrollDOM.removeEventListener('scroll', handleScroll);
      view.destroy();
      viewRef.current = null;
      editorViewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部 value 变化时同步（避免循环更新）
  useEffect(() => {
    if (value !== lastValueRef.current && viewRef.current) {
      lastValueRef.current = value;
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return <div ref={containerRef} className="split-source-editor" />;
};

export default SourceCodeEditor;
