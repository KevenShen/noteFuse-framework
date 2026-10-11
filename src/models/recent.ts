// src/models/recent.ts
// 最近使用模块 Dva Model
// 配合 Immer：namespace + state + reducers + effects
// 三个场景：最近创建 / 最近更新 / 最近浏览
import { message } from 'antd';
import * as recentService from '@/services/recent';

export interface RecentState {
  // 最近创建
  recentCreatedList: any[];
  recentCreatedTotal: number;
  recentCreatedPage: number;
  recentCreatedLoading: boolean;
  // 最近更新
  recentUpdatedList: any[];
  recentUpdatedTotal: number;
  recentUpdatedPage: number;
  recentUpdatedLoading: boolean;
  // 最近浏览
  recentBrowsedList: any[];
  recentBrowsedTotal: number;
  recentBrowsedPage: number;
  recentBrowsedLoading: boolean;
}

const initialState: RecentState = {
  recentCreatedList: [],
  recentCreatedTotal: 0,
  recentCreatedPage: 1,
  recentCreatedLoading: false,
  recentUpdatedList: [],
  recentUpdatedTotal: 0,
  recentUpdatedPage: 1,
  recentUpdatedLoading: false,
  recentBrowsedList: [],
  recentBrowsedTotal: 0,
  recentBrowsedPage: 1,
  recentBrowsedLoading: false,
};

export default {
  namespace: 'recent',

  state: initialState,

  reducers: {
    // ==================== 最近创建 ====================
    saveRecentCreated(
      state: RecentState,
      { payload }: { payload: { list: any[]; total: number; page: number } },
    ) {
      state.recentCreatedList = payload.list;
      state.recentCreatedTotal = payload.total;
      state.recentCreatedPage = payload.page;
    },
    setRecentCreatedLoading(state: RecentState, { payload }: { payload: boolean }) {
      state.recentCreatedLoading = payload;
    },
    // ==================== 最近更新 ====================
    saveRecentUpdated(
      state: RecentState,
      { payload }: { payload: { list: any[]; total: number; page: number } },
    ) {
      state.recentUpdatedList = payload.list;
      state.recentUpdatedTotal = payload.total;
      state.recentUpdatedPage = payload.page;
    },
    setRecentUpdatedLoading(state: RecentState, { payload }: { payload: boolean }) {
      state.recentUpdatedLoading = payload;
    },
    // ==================== 最近浏览 ====================
    saveRecentBrowsed(
      state: RecentState,
      { payload }: { payload: { list: any[]; total: number; page: number } },
    ) {
      state.recentBrowsedList = payload.list;
      state.recentBrowsedTotal = payload.total;
      state.recentBrowsedPage = payload.page;
    },
    setRecentBrowsedLoading(state: RecentState, { payload }: { payload: boolean }) {
      state.recentBrowsedLoading = payload;
    },
  },

  effects: {
    // ==================== 最近创建 ====================
    *fetchRecentCreated(
      { payload }: { payload?: { page?: number; page_size?: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setRecentCreatedLoading', payload: true });
      try {
        const res = yield call(recentService.fetchRecentCreated, payload);
        yield put({ type: 'saveRecentCreated', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('获取最近创建文档失败');
        return null;
      } finally {
        yield put({ type: 'setRecentCreatedLoading', payload: false });
      }
    },

    // ==================== 最近更新 ====================
    *fetchRecentUpdated(
      { payload }: { payload?: { page?: number; page_size?: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setRecentUpdatedLoading', payload: true });
      try {
        const res = yield call(recentService.fetchRecentUpdated, payload);
        yield put({ type: 'saveRecentUpdated', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('获取最近更新文档失败');
        return null;
      } finally {
        yield put({ type: 'setRecentUpdatedLoading', payload: false });
      }
    },

    // ==================== 最近浏览 ====================
    *fetchRecentBrowsed(
      { payload }: { payload?: { page?: number; page_size?: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setRecentBrowsedLoading', payload: true });
      try {
        const res = yield call(recentService.fetchRecentBrowsed, payload);
        yield put({ type: 'saveRecentBrowsed', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('获取最近浏览文档失败');
        return null;
      } finally {
        yield put({ type: 'setRecentBrowsedLoading', payload: false });
      }
    },
  },
};
