/**
 * 编辑器值同步 Hook
 * - 外部 value 变化时同步到编辑器（避免循环更新）
 * - 粘贴事件统一处理
 * - 内部变更标记，防止 onChange 触发的 value 回写
 */
import { useEffect, useRef, useCallback } from 'react';
import type { MDXEditorMethods } from '@mdxeditor/editor';
import { handlePaste, normalizeBlockquotes } from '../utils/clipboard';

interface UseEditorSyncOptions {
  value: string;
  editorRef: React.RefObject<MDXEditorMethods | null>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  onChange?: (value: string) => void;
}

/**
 * 编辑器值同步 Hook
 * 返回：internalValue（规范化后的值）、handleChange（内部变更回调）、isInternalChangeRef
 */
export const useEditorSync = ({ value, editorRef, wrapperRef, onChange }: UseEditorSyncOptions) => {
  const lastExternalValue = useRef<string>('');
  const isInternalChange = useRef<boolean>(false);

  // 数据预处理：规范化引用块
  const internalValue = normalizeBlockquotes(value || '');

  // 初始化同步
  useEffect(() => {
    lastExternalValue.current = internalValue;
  }, [internalValue]);

  // 粘贴监听
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => handlePaste(e, editorRef.current);
    el.addEventListener('paste', onPaste);
    return () => el.removeEventListener('paste', onPaste);
  }, [wrapperRef, editorRef]);

  // 外部 value 变化时同步到编辑器
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    const newVal = value || '';
    if (newVal !== lastExternalValue.current && editorRef.current) {
      lastExternalValue.current = newVal;
      editorRef.current.setMarkdown(newVal);
    }
  }, [value, editorRef]);

  // 内部变更回调
  const handleChange = useCallback(
    (newVal: string) => {
      isInternalChange.current = true;
      lastExternalValue.current = newVal;
      onChange?.(newVal);
    },
    [onChange],
  );

  return { internalValue, handleChange, lastExternalValue, isInternalChange };
};
