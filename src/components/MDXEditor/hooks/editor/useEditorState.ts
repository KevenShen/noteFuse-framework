/**
 * @file 编辑器状态管理 Hook（统一入口）
 * @description 整合值同步、视图模式、Diff 对比三个子 Hook，处理依赖顺序：
 *              1. currentViewMode 状态（值同步需要 isSplitMode）
 *              2. useEditorValueSync（需要 isSplitMode）→ displayValue, handleChange
 *              3. useDiffMode（需要 currentViewMode）→ originalMarkdown, setOriginalMarkdown
 *              4. handleModeChange（需要 displayValue, setOriginalMarkdown）
 *
 * 这样 index.tsx 只需调用一个 Hook，无需关心内部依赖顺序。
 */
import type { MDXEditorMethods } from '@mdxeditor/editor';
import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeBlockquotes } from '../../components/EditorTools/clipboard';
import type { EditorViewLike, ExtendedViewMode } from '../../types';
import { useEditorValueSync } from './useEditorValueSync';

interface UseEditorStateOptions {
  /** 外部传入的 markdown 内容 */
  value: string;
  /** 是否只读 */
  readOnly: boolean;
  /** 默认视图模式（用户显式传入） */
  defaultViewMode?: ExtendedViewMode;
  /** 对比模式原始内容（通过 props 传入，用于版本对比场景） */
  oldVersionMarkdown?: string;
  /** @mdxeditor/editor 实例引用 */
  editorRef: MutableRefObject<MDXEditorMethods | null>;
  /** CodeMirror EditorView 实例引用 */
  editorViewRef: MutableRefObject<EditorViewLike | null>;
  /** 编辑器容器引用（粘贴监听用） */
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  /** 内容变化回调 */
  onChange?: (value: string) => void;
  /** 视图切换回调 */
  onViewModeChange?: (mode: ExtendedViewMode) => void;
}

/**
 * 编辑器状态管理 Hook
 */
export function useEditorState({
  value,
  readOnly,
  defaultViewMode,
  oldVersionMarkdown,
  editorRef,
  editorViewRef,
  wrapperRef,
  onChange,
  onViewModeChange,
}: UseEditorStateOptions) {
  // ==================== 1. 视图模式状态（值同步需要 isSplitMode，必须先声明） ====================
  const effectiveDefaultViewMode: ExtendedViewMode =
    defaultViewMode !== undefined
      ? defaultViewMode
      : readOnly
      ? 'rich-text'
      : 'split';

  const [currentViewMode, setCurrentViewMode] =
    useState<ExtendedViewMode>(effectiveDefaultViewMode);

  // readOnly 变化时自动切换视图模式
  useEffect(() => {
    if (readOnly) {
      setCurrentViewMode('rich-text');
    } else if (defaultViewMode !== undefined) {
      setCurrentViewMode(defaultViewMode);
    } else {
      setCurrentViewMode('split');
    }
  }, [readOnly, defaultViewMode]);

  const isSplitMode = currentViewMode === 'split';

  // ==================== 2. 值同步（需要 isSplitMode） ====================
  const { displayValue, handleChange } = useEditorValueSync({
    value,
    editorRef,
    wrapperRef,
    onChange,
    isSplitMode,
  });

  // ==================== 3. Diff 对比模式（需要 currentViewMode） ====================
  const [originalMarkdown, setOriginalMarkdown] = useState(
    oldVersionMarkdown ? normalizeBlockquotes(oldVersionMarkdown) : '',
  );

  // oldVersionMarkdown 变化时更新快照
  useEffect(() => {
    if (oldVersionMarkdown !== undefined) {
      setOriginalMarkdown(normalizeBlockquotes(oldVersionMarkdown || ''));
    }
  }, [oldVersionMarkdown]);

  // 进入 diff 模式后从编辑器实例同步真实内容
  const diffSyncedRef = useRef(false);
  useEffect(() => {
    if (currentViewMode !== 'diff') {
      diffSyncedRef.current = false;
      return;
    }
    if (diffSyncedRef.current) return;
    const timer = setTimeout(() => {
      const editorContent = editorRef.current?.getMarkdown();
      if (editorContent !== undefined && editorContent !== null) {
        setOriginalMarkdown(editorContent);
        diffSyncedRef.current = true;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [currentViewMode, editorRef]);

  // ==================== 4. 模式切换处理（需要 displayValue, setOriginalMarkdown） ====================
  const handleModeChange = useCallback(
    (mode: ExtendedViewMode) => {
      // 进入对比模式时，保存当前内容作为原始快照
      if (
        mode === 'diff' &&
        currentViewMode !== 'diff' &&
        !oldVersionMarkdown
      ) {
        const latestContent =
          editorRef.current?.getMarkdown() ||
          editorViewRef.current?.state.doc.toString() ||
          displayValue;
        setOriginalMarkdown(normalizeBlockquotes(latestContent || ''));
      }
      setCurrentViewMode(mode);
      onViewModeChange?.(mode);
    },
    [
      currentViewMode,
      displayValue,
      editorRef,
      editorViewRef,
      onViewModeChange,
      oldVersionMarkdown,
    ],
  );

  return {
    currentViewMode,
    isSplitMode,
    displayValue,
    handleChange,
    originalMarkdown,
    handleModeChange,
  };
}
