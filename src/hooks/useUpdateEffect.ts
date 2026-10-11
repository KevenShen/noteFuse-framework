// src/hooks/useUpdateEffect.ts
// 跳过首次渲染的 useEffect
// 只在依赖更新时执行，首次渲染不执行

import { useEffect, useRef } from 'react';

/**
 * 跳过首次渲染的 useEffect
 *
 * 功能：
 * - 首次渲染时不执行 effect
 * - 依赖更新时才执行 effect
 * - 用法与 useEffect 完全一致
 *
 * @example
 * useUpdateEffect(() => {
 *   dispatch({ type: 'project/fetchProjectList' });
 * }, [filters.keyword, filters.filter, pagination.current]);
 */
export const useUpdateEffect = (
  effect: React.EffectCallback,
  deps?: React.DependencyList,
) => {
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    // 首次渲染，跳过执行
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    // 非首次渲染，执行 effect
    return effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

export default useUpdateEffect;
