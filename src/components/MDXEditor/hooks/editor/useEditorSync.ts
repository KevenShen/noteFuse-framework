/**
 * 编辑器值同步 Hook（非受控模式）
 * - value 仅作为初始内容，外部 value 变化不自动同步到编辑器
 * - 需要外部更新内容时调用 ref.current.setMarkdown(val)
 * - 粘贴事件统一处理
 * - 内部变更标记，防止 onChange 触发的 value 回写
 */
import type { MDXEditorMethods } from '@mdxeditor/editor';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  handlePaste,
  normalizeBlockquotes,
} from '../../components/EditorTools/clipboard';

interface UseEditorSyncOptions {
  value: string;
  editorRef: React.RefObject<MDXEditorMethods | null>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  onChange?: (value: string) => void;
}

/**
 * 编辑器值同步 Hook
 * 返回：internalValue（规范化后的值，仅用于初始渲染）、handleChange（内部变更回调）
 */
export const useEditorSync = ({
  value,
  editorRef,
  wrapperRef,
  onChange,
}: UseEditorSyncOptions) => {
  const isInternalChange = useRef<boolean>(false);

  // 数据预处理：规范化引用块（useMemo 缓存，value 不变时不重复计算）
  // 注意：internalValue 仅用于初始渲染，后续 value 变化不会自动同步到编辑器
  const internalValue = useMemo(
    () => normalizeBlockquotes(value || ''),
    [value],
  );

  // 粘贴监听
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => handlePaste(e, editorRef.current);
    el.addEventListener('paste', onPaste);
    return () => el.removeEventListener('paste', onPaste);
  }, [wrapperRef, editorRef]);

  // 内部变更回调
  const handleChange = useCallback(
    (newVal: string) => {
      isInternalChange.current = true;
      onChange?.(newVal);
    },
    [onChange],
  );

  return { internalValue, handleChange, isInternalChange };
};
