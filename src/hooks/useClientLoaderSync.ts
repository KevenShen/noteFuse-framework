// src/hooks/useClientLoaderSync.ts
// clientLoader 数据同步到 Dva model 的通用 Hook
// 只同步一次，避免后续交互更新被覆盖

import { useDispatch } from '@umijs/max';
import { useEffect, useRef } from 'react';

export interface UseClientLoaderSyncOptions<T = any> {
  /** clientLoader 返回的数据 */
  clientLoaderData: T | null | undefined;
  /** Dva action type，用于保存初始数据 */
  actionType: string;
  /** 数据映射函数，将 clientLoader 数据转换为 action payload */
  mapData?: (data: T) => any;
  /** 判断是否有数据的函数（默认判断数组长度或对象非空） */
  hasData?: (data: T) => boolean;
  /** 重置键：当此值变化时，重置同步状态，允许重新同步（用于路由参数变化的场景） */
  resetKey?: string | number;
}

/**
 * 默认判断是否有数据
 * - 数组：长度 > 0
 * - 对象：非空且有属性
 * - 其他：非 null/undefined
 */
const defaultHasData = (data: any): boolean => {
  if (Array.isArray(data)) return data.length > 0;
  if (data && typeof data === 'object') return Object.keys(data).length > 0;
  return data !== null && data !== undefined;
};

/**
 * clientLoader 数据同步到 Dva model
 *
 * 功能：
 * - 只同步一次（使用 ref 标记），避免后续交互更新被覆盖
 * - 自动判断是否有数据，无数据时不同步
 * - 支持自定义数据映射函数
 *
 * @example
 * useClientLoaderSync({
 *   clientLoaderData,
 *   actionType: 'project/saveProjectInitialData',
 *   mapData: (data) => ({
 *     categories: data.projectCategoryList,
 *     list: data.projectList,
 *     total: data.projectTotal,
 *     page: data.projectPage,
 *   }),
 * });
 */
export const useClientLoaderSync = <T = any>({
  clientLoaderData,
  actionType,
  mapData,
  hasData = defaultHasData,
  resetKey,
}: UseClientLoaderSyncOptions<T>) => {
  const dispatch = useDispatch();
  const syncedRef = useRef(false);
  const lastResetKey = useRef<string | number | undefined>(resetKey);

  // 当 resetKey 变化时，重置同步状态
  useEffect(() => {
    if (resetKey !== lastResetKey.current) {
      syncedRef.current = false;
      lastResetKey.current = resetKey;
    }
  }, [resetKey]);

  useEffect(() => {
    // 已经同步过，跳过
    if (syncedRef.current) return;
    // 没有数据，跳过
    if (!clientLoaderData || !hasData(clientLoaderData)) return;

    // 构造 payload：使用 mapData 或直接使用 clientLoaderData
    const payload = mapData ? mapData(clientLoaderData) : clientLoaderData;

    // 同步到 Dva model
    dispatch({ type: actionType, payload });
    syncedRef.current = true;
  }, [clientLoaderData, actionType, mapData, hasData, dispatch]);
};

export default useClientLoaderSync;
