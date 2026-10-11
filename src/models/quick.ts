// src/models/quick.ts
// 快捷操作模块 Dva Model
// 最新规范：namespace + state + reducers + effects，配合 Immer
// 组件中使用 useSelector 获取状态，useDispatch 触发更新

import * as quickService from '@/services/quick';
import { message } from 'antd';

export interface QuickState {
  // 快捷操作项
  quickItemsLoading: boolean;
  quickItems: any[];
  quickFilter: number | 'all';
  // 快捷操作分组
  quickGroups: any[];
  quickGroupsLoading: boolean;
  quickGroupSubmitting: boolean;
}

const initialState: QuickState = {
  quickItemsLoading: false,
  quickItems: [],
  quickFilter: 'all',
  quickGroups: [],
  quickGroupsLoading: false,
  quickGroupSubmitting: false,
};

export default {
  namespace: 'quick',
  state: initialState,

  reducers: {
    // ==================== 快捷操作项 ====================
    setQuickItemsLoading(state: QuickState, { payload }: { payload: boolean }) {
      state.quickItemsLoading = payload;
    },
    saveQuickItems(state: QuickState, { payload }: { payload: any[] }) {
      state.quickItems = payload;
    },
    // 合并保存初始数据（items+groups），减少 dispatch 次数
    saveQuickInitialData(
      state: QuickState,
      { payload }: { payload: { quickItems: any[]; quickGroups: any[] } },
    ) {
      state.quickItems = payload.quickItems;
      state.quickGroups = payload.quickGroups;
    },

    setQuickFilter(
      state: QuickState,
      { payload }: { payload: number | 'all' },
    ) {
      state.quickFilter = payload;
    },

    // ==================== 快捷操作分组 ====================
    saveQuickGroups(state: QuickState, { payload }: { payload: any[] }) {
      state.quickGroups = payload;
    },
    setQuickGroupsLoading(
      state: QuickState,
      { payload }: { payload: boolean },
    ) {
      state.quickGroupsLoading = payload;
    },
    setQuickGroupSubmitting(
      state: QuickState,
      { payload }: { payload: boolean },
    ) {
      state.quickGroupSubmitting = payload;
    },
  },

  effects: {
    // ==================== 快捷操作项 ====================
    *fetchQuickItems(
      { payload }: { payload?: { category_id?: number | 'all' } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setQuickItemsLoading', payload: true });
      if (payload?.category_id !== undefined) {
        yield put({ type: 'setQuickFilter', payload: payload.category_id });
      }
      try {
        const res = yield call(quickService.fetchQuickItems, payload);
        yield put({ type: 'saveQuickItems', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('获取快捷操作列表失败');
        return null;
      } finally {
        yield put({ type: 'setQuickItemsLoading', payload: false });
      }
    },

    // ==================== 快捷操作分组 ====================
    *fetchQuickGroups(
      { payload }: { payload?: { [key: string]: any } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setQuickGroupsLoading', payload: true });
      try {
        const res = yield call(quickService.fetchQuickGroups, payload);
        yield put({ type: 'saveQuickGroups', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('获取分组列表失败');
        return null;
      } finally {
        yield put({ type: 'setQuickGroupsLoading', payload: false });
      }
    },

    *createQuickGroup(
      { payload }: { payload: { name: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setQuickGroupSubmitting', payload: true });
      try {
        const res = yield call(quickService.createQuickGroup, payload);
        message.success('分组创建成功');
        yield put({ type: 'fetchQuickGroups' });
        return res.data;
      } catch (e) {
        return null;
      } finally {
        yield put({ type: 'setQuickGroupSubmitting', payload: false });
      }
    },

    *updateQuickGroup(
      { payload }: { payload: { id: number; name: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setQuickGroupSubmitting', payload: true });
      try {
        const { id, name } = payload;
        yield call(quickService.updateQuickGroup, id, { name });
        message.success('分组已更新');
        yield put({ type: 'fetchQuickGroups' });
        return true;
      } catch (e) {
        return null;
      } finally {
        yield put({ type: 'setQuickGroupSubmitting', payload: false });
      }
    },

    *deleteQuickGroup(
      { payload }: { payload: { id: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(quickService.deleteQuickGroup, payload.id);
        message.success('分组已删除');
        yield put({ type: 'fetchQuickGroups' });
        return true;
      } catch (e) {
        return null;
      }
    },

    *addQuickItemToGroup(
      {
        payload,
      }: { payload: { group_id: number; item_id: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const { group_id, item_id } = payload;
        yield call(quickService.addQuickItemToGroup, group_id, {
          item_id,
        });
        message.success('已添加到分组');
        yield put({ type: 'fetchQuickGroups' });
        return true;
      } catch (e) {
        return null;
      }
    },

    *removeQuickItemFromGroup(
      {
        payload,
      }: { payload: { group_id: number; item_id: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const { group_id, item_id } = payload;
        yield call(quickService.removeQuickItemFromGroup, group_id, item_id);
        message.success('已从分组移除');
        yield put({ type: 'fetchQuickGroups' });
        return true;
      } catch (e) {
        return null;
      }
    },
  },
};
