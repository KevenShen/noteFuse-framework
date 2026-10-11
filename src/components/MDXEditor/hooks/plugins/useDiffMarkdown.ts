/**
 * @file Diff 模式 Markdown 计算 Hook
 * @description 计算 diff 模式需要的原始内容快照，其他模式传空串以避免重建 plugins
 */
import { useMemo } from 'react';
import type { ExtendedViewMode } from '../../types';

/**
 * 计算 diff 模式需要的原始内容快照
 * - diff 模式：返回进入对比模式时保存的原始快照（左栏固定显示）
 * - 其他模式：返回空串，避免每次输入都重建 plugins 数组
 */
export const useDiffMarkdown = (
  currentViewMode: ExtendedViewMode,
  originalMarkdown: string,
) => {
  return useMemo(
    () => (currentViewMode === 'diff' ? originalMarkdown : ''),
    [currentViewMode, originalMarkdown],
  );
};
