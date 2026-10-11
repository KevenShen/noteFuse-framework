/**
 * @file MDXEditor 富文本/Markdown 编辑器主组件
 * @description 基于 @mdxeditor/editor 二次封装，支持富文本/源码/Diff/分栏四种模式
 *              统一工具栏：富文本模式操作 Lexical，源码模式操作 CodeMirror
 *
 * 架构：
 * - useEditorState: 统一管理值同步、视图模式、Diff 对比状态
 * - useEditorPlugins: 组装插件列表
 * - useEditorImperativeHandle: 对外暴露 ref 方法
 * - 主组件只负责 Refs、工具栏渲染、插件组装和最终渲染
 */

// ==================== 第三方库 ====================
import { MDXEditor, type MDXEditorMethods } from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

// ==================== 样式 ====================
import './index.less';

// ==================== 内部 Context ====================
/**
 * 编辑器只读状态 Context
 * 传递编辑器只读状态给指令编辑器（Tabs/Steps/Card 等）。
 * 当 readOnly=true 时，指令编辑器应隐藏所有操作按钮（增删、类型切换等），
 * 内容区由 @mdxeditor/editor 的 readOnly prop 自动控制不可编辑。
 */
export const EditorReadOnlyContext = createContext<boolean>(false);

/** 获取编辑器只读状态 */
export const useEditorReadOnly = (): boolean =>
  useContext(EditorReadOnlyContext);

// ==================== 内部组件 ====================
import { DocumentToc, UnifiedToolbar } from './components';
import SplitEditor from './components/SplitEditor';

// ==================== 内部 Hooks ====================
import {
  useEditorImperativeHandle,
  useEditorPlugins,
  useEditorState,
  useTooltipTranslate,
} from './hooks';

// ==================== 内部类型 ====================
import type {
  EditorCursorPos,
  EditorViewLike,
  MDXEditorProps,
  MDXEditorRef,
} from './types';

const MDXEditorComponent = forwardRef<MDXEditorRef, MDXEditorProps>(
  (props, ref) => {
    // ==================== Props 解构 ====================
    const {
      readOnly = false,
      value,
      splitRatio = 0.5,
      placeholder,
      toolbarButtons,
      customToolbarContent,
      extraPlugins = [],
      height = '100vh',
      className = '',
      onChange,
      onBlur,
      onViewModeChange,
      /** 对比模式原始内容（左栏固定显示，右栏编辑当前内容） */
      oldVersionMarkdown,
    } = props;

    // ==================== 只读模式智能默认值 ====================
    // 当 readOnly={true} 时，自动应用查看器模式的默认配置（等价于原 MDXViewer）
    // 用户显式传入的 props 优先级高于默认值
    const effectiveShowToolbar =
      props.showToolbar !== undefined ? props.showToolbar : !readOnly;
    const effectiveAutoFocus =
      props.autoFocus !== undefined ? props.autoFocus : !readOnly;
    const effectiveShowToc =
      props.showToc !== undefined ? props.showToc : !readOnly;

    // ==================== Refs ====================
    const wrapperRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<MDXEditorMethods | null>(null);
    const editorViewRef = useRef<EditorViewLike | null>(null);
    /** 分栏模式下的预览编辑器实例（使完整 API 可用） */
    const previewEditorRef = useRef<MDXEditorMethods | null>(null);
    const cursorPosRef = useRef<EditorCursorPos>({
      mode: 'rich-text',
      lineNumber: 0,
      columnOffset: 0,
      anchorOffset: 0,
      isCollapsed: true,
    });

    // ==================== 统一状态管理（值同步 + 视图模式 + Diff） ====================
    const {
      currentViewMode,
      isSplitMode,
      displayValue,
      handleChange,
      originalMarkdown,
      handleModeChange,
    } = useEditorState({
      value,
      readOnly,
      defaultViewMode: props.defaultViewMode,
      oldVersionMarkdown,
      editorRef,
      editorViewRef,
      wrapperRef,
      onChange,
      onViewModeChange,
    });

    // ==================== 渲染辅助 ====================
    const tocMode: 'split' | 'source' | 'rich-text' = isSplitMode
      ? 'split'
      : currentViewMode === 'source'
      ? 'source'
      : 'rich-text';

    // ==================== 文档目录显示状态 ====================
    const [tocVisible, setTocVisible] = useState(
      readOnly && !!effectiveShowToc,
    );

    // ==================== 工具栏渲染 ====================
    const renderToolbar = useCallback(
      () => (
        <UnifiedToolbar
          editorRef={editorRef}
          editorViewRef={editorViewRef}
          cursorPosRef={cursorPosRef}
          readOnly={readOnly}
          currentViewMode={currentViewMode}
          toolbarButtons={toolbarButtons}
          customToolbarContent={customToolbarContent}
          tocVisible={tocVisible}
          onToggleToc={() => setTocVisible((v) => !v)}
          onModeChange={handleModeChange}
        />
      ),
      [
        readOnly,
        tocVisible,
        toolbarButtons,
        customToolbarContent,
        handleModeChange,
        currentViewMode,
        editorRef,
        editorViewRef,
        cursorPosRef,
      ],
    );

    // ==================== Tooltip 中文翻译 ====================
    useTooltipTranslate({
      enabled: effectiveShowToolbar,
      containerRef: wrapperRef,
    });

    // ==================== 插件组装 ====================
    const { plugins } = useEditorPlugins({
      renderToolbar,
      currentViewMode,
      originalMarkdown,
      editorViewRef,
      showToolbar: effectiveShowToolbar,
      extraPlugins,
    });

    // ==================== 对外暴露实例 ====================
    useEditorImperativeHandle({
      ref,
      editorRef,
      editorViewRef,
      previewEditorRef,
      cursorPosRef,
      currentViewMode,
    });

    // ==================== 失焦回调 ====================
    const handleBlur = useCallback(() => onBlur?.(), [onBlur]);

    // ==================== 渲染 ====================
    return (
      <EditorReadOnlyContext.Provider value={readOnly}>
        <div
          ref={wrapperRef}
          className={`mdx-editor-wrapper ${
            readOnly ? 'mdx-editor-readonly' : ''
          } ${isSplitMode ? 'mdx-editor-split-mode' : ''} ${className}`}
          style={{
            height,
            display: 'flex',
            flexDirection: 'row',
            boxSizing: 'border-box',
          }}
          onBlur={handleBlur}
        >
          {/* 左侧：编辑区（独立滚动） */}
          <div className="mdx-editor-main-area">
            {/* 分栏模式下直接渲染工具栏（非分栏模式由 toolbarPlugin 在 MDXEditor 内部渲染） */}
            {isSplitMode && effectiveShowToolbar && renderToolbar()}

            {isSplitMode ? (
              <SplitEditor
                readOnly={readOnly}
                value={displayValue}
                onChange={handleChange}
                editorViewRef={editorViewRef}
                previewEditorRef={previewEditorRef}
                splitRatio={splitRatio}
              />
            ) : (
              <MDXEditor
                readOnly={readOnly}
                plugins={plugins}
                ref={editorRef}
                autoFocus={effectiveAutoFocus}
                markdown={displayValue}
                onChange={handleChange}
                placeholder={placeholder}
                contentEditableClassName="mdx-editor-content"
              />
            )}
          </div>

          {/* 右侧：文档目录（固定宽度，独立滚动）；diff 模式下自动隐藏 */}
          {effectiveShowToc && tocVisible && currentViewMode !== 'diff' && (
            <DocumentToc
              visible={tocVisible}
              containerRef={wrapperRef}
              editorViewRef={editorViewRef}
              mode={tocMode}
              onClose={() => setTocVisible(false)}
            />
          )}
        </div>
      </EditorReadOnlyContext.Provider>
    );
  },
);

MDXEditorComponent.displayName = 'MDXEditor';

export default MDXEditorComponent;

// ==================== 命名导出（供外部模块复用） ====================
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
