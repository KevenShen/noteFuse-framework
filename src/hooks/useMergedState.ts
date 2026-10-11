// src/hooks/useMergedState.ts
// 合并 model 数据和 clientLoader 数据的通用 Hook
// 优先使用 model 数据（交互更新后），兜底使用 clientLoader 预加载数据（首屏）
// 关键：model 数据一旦被初始化过（非 undefined/null），后续即使变为空数组/0，也不再回退到 loaderData

import { useMemo, useRef } from 'react';
import { mergeWithClientLoader } from '@/utils/clientLoader';

export interface UseMergedStateOptions<T = any> {
  /** model 中的数据（交互更新后） */
  modelData: T | undefined | null;
  /** clientLoader 中的数据（首屏预加载） */
  loaderData: T | undefined | null;
}

/**
 * 合并 model 数据和 clientLoader 数据
 *
 * 功能：
 * - 首次渲染时使用 loaderData 兜底（避免首屏空白）
 * - model 数据一旦被初始化过（非 undefined/null），后续始终使用 model 数据
 * - 即使 model 数据变为空数组/0（筛选后无结果），也不会回退到 loaderData
 * - 使用 useMemo 缓存，避免不必要的重计算
 *
 * @example
 * const projectList = useMergedState({
 *   modelData: modelProjectList,
 *   loaderData: clientLoaderData?.projectList,
 * });
 */
export const useMergedState = <T = any>({
  modelData,
  loaderData,
}: UseMergedStateOptions<T>): T => {
  // 跟踪 model 数据是否曾经被初始化过（非 undefined/null）
  const modelInitializedRef = useRef(false);

  // 更新初始化标志
  if (modelData !== undefined && modelData !== null) {
    modelInitializedRef.current = true;
  }

  return useMemo(() => {
    // 如果 model 数据曾经被初始化过，始终使用 model 数据（包括空数组/0）
    if (modelInitializedRef.current) {
      return (modelData ?? loaderData) as T;
    }
    // 否则，使用 mergeWithClientLoader 的默认逻辑（优先 model，兜底 loader）
    return mergeWithClientLoader<T>(modelData, loaderData);
  }, [modelData, loaderData]);
};

export default useMergedState;
