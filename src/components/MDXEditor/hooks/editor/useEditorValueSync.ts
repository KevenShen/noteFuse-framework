/**
 * @file 编辑器值同步 Hook
 * @description 封装非受控组件的值同步逻辑：
 *              - displayValue 内部状态（模式切换时的桥梁）
 *              - lastSyncedValueRef 防循环标记
 *              - 统一的 value 同步 useEffect（合并只读/可编辑模式）
 *              - handleChange 包装（外部 onChange + 内部 displayValue + 防循环）
 */
import type { MDXEditorMethods } from '@mdxeditor/editor';
import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeBlockquotes } from '../../components/EditorTools/clipboard';
import { useEditorSync } from './useEditorSync';

interface UseEditorValueSyncOptions {
  /** 外部传入的 markdown 内容 */
  value: string;
  /** @mdxeditor/editor 实例引用（非分栏模式） */
  editorRef: MutableRefObject<MDXEditorMethods | null>;
  /** 编辑器容器引用（粘贴监听用） */
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  /** 内容变化回调 */
  onChange?: (value: string) => void;
  /** 是否为分栏模式（分栏模式下 editorRef 未绑定，只需更新 displayValue） */
  isSplitMode: boolean;
}

/**
 * 编辑器值同步 Hook
 *
 * 核心机制：
 * - @mdxeditor/editor 是非受控组件，markdown prop 仅作为初始值
 * - 外部 value 变化时，通过 lastSyncedValueRef 防循环检测，同步到 displayValue + 编辑器实例
 * - 用户输入时，handleChange 先更新 lastSyncedValueRef，避免同步 useEffect 循环触发
 */
export function useEditorValueSync({
  value,
  editorRef,
  wrapperRef,
  onChange,
  isSplitMode,
}: UseEditorValueSyncOptions) {
  // 基础值同步（粘贴处理、内部变更标记）
  const { internalValue, handleChange: baseHandleChange } = useEditorSync({
    value,
    editorRef,
    wrapperRef,
    onChange,
  });

  // 内部显示值（切换模式时的桥梁）
  const [displayValue, setDisplayValue] = useState(internalValue);

  // 记录上一次同步到编辑器的值，用于防循环：
  // - 用户输入时 handleChange 更新 lastSyncedValueRef，外部 value 变化时检测到相等则跳过
  // - 外部强制更新时 value !== lastSyncedValueRef.current，触发同步
  const lastSyncedValueRef = useRef(value);

  // 统一值同步（合并只读/可编辑模式）
  useEffect(() => {
    if (value === undefined || value === null) return;
    if (value === lastSyncedValueRef.current) return; // 内部变更，跳过

    lastSyncedValueRef.current = value;
    setDisplayValue(value);

    // 非分栏模式下，同时更新 @mdxeditor/editor 的内容
    // 分栏模式下 editorRef 未绑定，只需更新 displayValue（SplitEditor 内部响应）
    if (!isSplitMode) {
      // 延迟到下一帧执行，确保编辑器实例已创建
      requestAnimationFrame(() => {
        editorRef.current?.setMarkdown(value);
      });
    }
  }, [value, isSplitMode, editorRef]);

  // 包装 handleChange：更新外部 value + 内部 displayValue + 防循环标记
  const handleChange = useCallback(
    (newVal: string) => {
      lastSyncedValueRef.current = newVal; // 标记为内部变更，防止同步 useEffect 循环
      baseHandleChange(newVal); // 更新外部 onChange
      setDisplayValue(newVal); // 更新内部 displayValue（模式切换时使用）
    },
    [baseHandleChange],
  );

  return { displayValue, handleChange };
}

/** 规范化引用块（导出供外部使用） */
export { normalizeBlockquotes };
