// src/hooks/useCurrentUser.ts
// 当前登录用户 Hook：优先 Dva（登录后未刷新），兜底 initialState（刷新后从 API 获取）
// 封装双源取数 + 自动兜底获取 + 请求去重，避免每个页面重复编写
import type { CurrentUser } from '@/models';
import { useDispatch, useModel } from '@umijs/max';
import { useCallback, useEffect, useRef } from 'react';
import { useShallowSelector } from './useShallowSelector';

// 1. 定义 RootState 类型，避免使用 any
interface RootState {
  user: {
    currentUser: CurrentUser | null;
  };
  userLogin: {
    loading: boolean;
  };
}

/** 模块级请求去重标记，避免多个组件同时挂载时重复 dispatch */
let fetchingRef = false;

export interface UseCurrentUserResult {
  /** 当前登录用户，未登录时为 null */
  currentUser: CurrentUser | null;
  /** 用户信息加载中 */
  loading: boolean;
  /** 手动刷新用户信息 */
  refresh: () => void;
}

/**
 * 获取当前登录用户
 * - 优先从 Dva model 读取（登录后未刷新场景）
 * - 兜底从 initialState 读取（页面刷新后，app.ts 启动时已获取）
 * - 两边都为空但有 token 时，自动从 API 兜底获取
 */
const useCurrentUser = (): UseCurrentUserResult => {
  const dispatch = useDispatch();
  const { initialState } = useModel('@@initialState');

  // 合并为一次 selector 调用，同时获取 currentUser 和 loading
  const { currentUser: dvaCurrentUser, loading } = useShallowSelector(
    (state: RootState) => ({
      currentUser: state.user.currentUser,
      loading: state.userLogin.loading,
    }),
  );

  const currentUser = dvaCurrentUser || initialState?.currentUser || null;

  // 记录当前 currentUser，用于 effect 内判断（避免闭包问题）
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // 有 token 但两边都没有用户信息时，从 API 兜底获取（带请求去重）
  useEffect(() => {
    const token = localStorage.getItem('note_fuse_token');
    // 条件：有 Token、无用户数据、当前没有正在进行的请求
    if (token && !currentUserRef.current && !fetchingRef) {
      fetchingRef = true;
      dispatch({ type: 'userLogin/fetchCurrentUser' }).finally(() => {
        fetchingRef = false;
      });
    }
  }, [currentUser, dispatch]);

  // 5. 使用 useCallback 包裹 refresh，避免每次渲染都生成新的函数引用
  const refresh = useCallback(() => {
    if (fetchingRef) return; // 防止手动连续点击触发重复请求
    fetchingRef = true;
    dispatch({ type: 'userLogin/fetchCurrentUser' }).finally(() => {
      fetchingRef = false;
    });
  }, [dispatch]);

  return { currentUser, loading, refresh };
};

export default useCurrentUser;
