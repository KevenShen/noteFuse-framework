/**
 * @file MDXEditor 富文本/Markdown 编辑器主组件
 * @description 基于 @mdxeditor/editor 二次封装，支持富文本/源码/Diff/分栏四种模式
 *              统一工具栏：富文本模式操作 Lexical，源码模式操作 CodeMirror
 */
import {
  MDXEditor,
  diffSourcePlugin,
  toolbarPlugin,
  type MDXEditorMethods,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { keymap } from '@codemirror/view';
import { foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import './index.less';

import { UnifiedToolbar, DocumentToc } from './components';
import SplitEditor from './components/SplitEditor';
import { defaultToolbarButtons } from './constants';
import { createBasePlugins } from './plugins';
import type {
  EditorCursorPos,
  ExtendedViewMode,
  MDXEditorProps,
  MDXEditorRef,
} from './types';
import {
  createEditorViewCapture,
  insertMarkdownAtCursor,
  markdownKeymap,
} from './utils';
import { useEditorSync } from './hooks/useEditorSync';
import { useTooltipTranslate } from './hooks/useTooltipTranslate';

const MDXEditorComponent = forwardRef<MDXEditorRef, MDXEditorProps>(
  (props, ref) => {
    const {
      value,
      autoFocus = true,
      readOnly = false,
      height = '100vh',
      placeholder,
      showToolbar = true,
      toolbarButtons,
      customToolbarContent,
      extraPlugins = [],
      className = '',
      onChange,
      onBlur,
      onViewModeChange,
      defaultViewMode = 'rich-text',
      splitRatio = 0.5,
      showToc = false,
    } = props;

    // ---------- Refs ----------
    const editorRef = useRef<MDXEditorMethods | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const editorViewRef = useRef<any>(null);
    const cursorPosRef = useRef<EditorCursorPos>({
      mode: 'rich-text',
      lineNumber: 0,
      columnOffset: 0,
      anchorOffset: 0,
      isCollapsed: true,
    });

    // ---------- 视图模式 ----------
    const [currentViewMode, setCurrentViewMode] =
      useState<ExtendedViewMode>(defaultViewMode);

    // ---------- 文档目录 ----------
    const [tocVisible, setTocVisible] = useState(showToc);
    useEffect(() => setTocVisible(showToc), [showToc]);

    const handleModeChange = useCallback(
      (mode: ExtendedViewMode) => {
        setCurrentViewMode(mode);
        onViewModeChange?.(mode);
      },
      [onViewModeChange],
    );

    const handleCursorChange = useCallback((pos: EditorCursorPos) => {
      cursorPosRef.current = { ...cursorPosRef.current, ...pos };
    }, []);

    // ---------- 值同步 + 粘贴处理 ----------
    const { internalValue, handleChange } = useEditorSync({
      value,
      editorRef,
      wrapperRef,
      onChange,
    });

    // ---------- Tooltip 中文翻译（只监听编辑器容器） ----------
    useTooltipTranslate({ enabled: showToolbar, containerRef: wrapperRef });

    // ---------- 失焦回调 ----------
    const handleBlur = useCallback(() => onBlur?.(), [onBlur]);

    // ---------- 对外暴露实例 ----------
    useImperativeHandle(
      ref,
      () => ({
        getEditor: () => editorRef.current,
        getMarkdown: () => editorRef.current?.getMarkdown() || '',
        setMarkdown: (val: string) => {
          editorRef.current?.setMarkdown(val);
        },
        insertMarkdown: (val: string) => insertMarkdownAtCursor(val, editorRef),
        focus: () => editorRef.current?.focus(),
        getViewMode: () => currentViewMode,
        getCursorPosition: () => cursorPosRef.current,
      }),
      [currentViewMode],
    );

    // ---------- 工具栏按钮配置 ----------
    const activeButtons = useMemo(
      () => toolbarButtons ?? defaultToolbarButtons,
      [toolbarButtons],
    );

    // ---------- 工具栏元素（split 模式独立渲染，非 split 模式由 toolbarPlugin 渲染） ----------
    const renderToolbar = useCallback(
      () => (
        <UnifiedToolbar
          activeButtons={activeButtons}
          editorRef={editorRef}
          editorViewRef={editorViewRef}
          customToolbarContent={customToolbarContent}
          readOnly={readOnly}
          handleCursorChange={handleCursorChange}
          handleModeChange={handleModeChange}
          currentViewMode={currentViewMode}
          tocVisible={tocVisible}
          onToggleToc={() => setTocVisible((v) => !v)}
        />
      ),
      [
        activeButtons,
        customToolbarContent,
        readOnly,
        handleCursorChange,
        handleModeChange,
        currentViewMode,
        tocVisible,
      ],
    );

    // ---------- 插件组装 ----------
    const plugins = useMemo(() => {
      const base = createBasePlugins({ extra: extraPlugins });
      base.push(
        diffSourcePlugin({
          diffMarkdown: internalValue,
          viewMode: 'rich-text',
          codeMirrorExtensions: [
            markdownKeymap,
            createEditorViewCapture(editorViewRef),
            foldGutter(),
            keymap.of(foldKeymap),
            syntaxHighlighting(defaultHighlightStyle),
          ],
        }),
      );
      if (showToolbar) {
        base.push(toolbarPlugin({ toolbarContents: renderToolbar }));
      }
      return base;
    }, [showToolbar, extraPlugins, internalValue, renderToolbar]);

    // ---------- 渲染 ----------
    const isSplitMode = currentViewMode === 'split';
    const tocMode = isSplitMode ? 'split' : currentViewMode === 'source' ? 'source' : 'rich-text';

    return (
      <div
        ref={wrapperRef}
        className={`mdx-editor-wrapper ${className}`}
        style={{ height, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative' }}
        onBlur={handleBlur}
      >
        {/* 分栏模式下直接渲染工具栏（非分栏模式由 toolbarPlugin 在 MDXEditor 内部渲染） */}
        {isSplitMode && showToolbar && renderToolbar()}

        {/* 编辑器主体 — 恢复添加目录前的布局，确保滚动条正常 */}
        {isSplitMode ? (
          <SplitEditor
            value={internalValue}
            onChange={handleChange}
            editorViewRef={editorViewRef}
            readOnly={readOnly}
            splitRatio={splitRatio}
          />
        ) : (
          <MDXEditor
            plugins={plugins}
            ref={editorRef}
            autoFocus={autoFocus}
            markdown={internalValue}
            onChange={handleChange}
            readOnly={readOnly}
            placeholder={placeholder}
            contentEditableClassName="mdx-editor-content"
          />
        )}

        {/* 文档目录：绝对定位浮动在右侧，不参与主布局 */}
        {showToc && tocVisible && (
          <DocumentToc
            containerRef={wrapperRef}
            editorViewRef={editorViewRef}
            mode={tocMode}
            visible={tocVisible}
            onClose={() => setTocVisible(false)}
          />
        )}
      </div>
    );
  },
);

MDXEditorComponent.displayName = 'MDXEditor';

export default MDXEditorComponent;

// 命名导出（供外部模块复用）
export { directiveDescriptors } from './directives';
export {
  codeBlockEditorDescriptor,
  createBasePlugins,
  imageUploadHandler,
} from './plugins';
export type {
  EditorCursorPos,
  ExtendedViewMode,
  MDXEditorProps,
  MDXEditorRef,
} from './types';
