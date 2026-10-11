/**
 * 左栏源码编辑器（独立 CodeMirror 实例）
 * 用于 split 模式的左栏，最小化扩展配置，避免依赖 codemirror 聚合包
 *
 * 滚动条修复说明：
 * - CodeMirror 6 的 .cm-scroller 高度由内容决定，内容少时可能小于容器高度
 * - 通过主题扩展强制设置 .cm-editor 和 .cm-scroller 高度为 100%
 * - 初始化后多次调用 requestMeasure，确保容器布局完成后正确计算
 * - ResizeObserver 监听容器尺寸变化，自动重新测量
 * - 内容变化和窗口 focus 时也触发重新测量
 */
import { markdown } from '@codemirror/lang-markdown';
import {
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import React, { useEffect, useRef } from 'react';
import {
  createEditorViewCapture,
  markdownKeymap,
} from '../../plugins';
import type { EditorViewLike } from '../../types';

export interface SourceCodeEditorProps {
  /** 是否只读 */
  readOnly?: boolean;
  /** 初始 markdown 内容 */
  value: string;
  /** 内容变化回调 */
  onChange: (value: string) => void;
  /** CodeMirror EditorView 实例引用（工具栏操作使用） */
  editorViewRef: React.MutableRefObject<EditorViewLike | null>;
  /** 滚动回调，传递滚动百分比 0-1 */
  onScroll?: (scrollRatio: number) => void;
}

/**
 * CodeMirror 主题扩展：强制设置编辑器和滚动容器高度
 * 解决分栏模式下左栏滚动条不显示的问题
 */
const forceHeightTheme = EditorView.theme({
  '&': {
    height: '100%',
    overflow: 'hidden',
  },
  '.cm-scroller': {
    height: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    fontFamily: "'SF Mono', Menlo, Monaco, Consolas, 'Courier New', monospace",
  },
  '.cm-content': {
    minHeight: '100%',
    padding: '12px 0',
  },
  '.cm-gutters': {
    height: '100%',
  },
});

const SourceCodeEditor: React.FC<SourceCodeEditorProps> = ({
  readOnly = false,
  value,
  onChange,
  editorViewRef,
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
      forceHeightTheme, // 强制高度主题，解决滚动条问题
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newVal = update.state.doc.toString();
          lastValueRef.current = newVal;
          onChange(newVal);
          // 内容变化后重新测量，确保滚动条正确显示
          requestAnimationFrame(() => {
            viewRef.current?.requestMeasure();
          });
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
    // 立即绑定 editorViewRef，不依赖 updateListener（确保目录跳转同步滚动可用）
    editorViewRef.current = view;

    // ==================== 滚动条修复：多次触发重新测量 ====================
    // 场景：页面首次加载时，父容器 flex 布局可能尚未完成，导致 CodeMirror 滚动容器高度为0

    // 第1次：下一帧测量
    requestAnimationFrame(() => {
      view.requestMeasure();
    });

    // 第2次：50ms 后测量（确保布局完成）
    setTimeout(() => view.requestMeasure(), 50);

    // 第3次：200ms 后测量（双重保险，处理异步布局变化）
    setTimeout(() => view.requestMeasure(), 200);

    // 监听容器尺寸变化，自动重新测量（确保窗口 resize 或布局变化时滚动条正确）
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          view.requestMeasure();
          // 延迟一帧后再次测量，确保尺寸稳定
          requestAnimationFrame(() => view.requestMeasure());
        }
      }
    });
    resizeObserver.observe(el);

    // 监听窗口 focus，重新测量（处理浏览器标签页切换后滚动条丢失的问题）
    const handleWindowFocus = () => {
      view.requestMeasure();
      setTimeout(() => view.requestMeasure(), 50);
    };
    window.addEventListener('focus', handleWindowFocus);

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
      resizeObserver.disconnect();
      window.removeEventListener('focus', handleWindowFocus);
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
      // 外部内容变化后重新测量
      requestAnimationFrame(() => {
        viewRef.current?.requestMeasure();
      });
    }
  }, [value]);

  return <div ref={containerRef} className="split-source-editor" />;
};

export default SourceCodeEditor;
