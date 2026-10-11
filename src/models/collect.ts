// src/models/collect.ts
// 收藏模块 Dva Model
// 配合 Immer：namespace + state + reducers + effects
// 统一接口，type 区分文档/文集收藏
import { message } from 'antd';
import * as collectService from '@/services/collect';

export interface CollectState {
  // 收藏分组
  collectGroups: any[];
  collectGroupLoading: boolean;
  collectUngroupedCount: number;
  collectTotalCount: number; // 全局全部收藏数（不随当前分组变化）
  // 收藏列表
  collectList: any[];
  collectTotal: number; // 当前查询的总数（随分组/分页变化）
  collectPage: number;
  collectLoading: boolean;
}

const initialState: CollectState = {
  collectGroups: [],
  collectGroupLoading: false,
  collectUngroupedCount: 0,
  collectTotalCount: 0,
  collectList: [],
  collectTotal: 0,
  collectPage: 1,
  collectLoading: false,
};

export default {
  namespace: 'collect',

  state: initialState,

  reducers: {
    // ==================== 收藏分组 ====================
    saveCollectGroups(
      state: CollectState,
      { payload }: { payload: { list: any[]; ungrouped_count: number; total_count: number } },
    ) {
      state.collectGroups = payload.list;
      state.collectUngroupedCount = payload.ungrouped_count;
      state.collectTotalCount = payload.total_count;
    },
    // 合并保存初始数据（分组+列表），减少 dispatch 次数
    saveCollectInitialData(
      state: CollectState,
      { payload }: {
        payload: {
          groups: { list: any[]; ungrouped_count: number; total_count: number };
          list: { list: any[]; total: number; page: number };
        };
      },
    ) {
      state.collectGroups = payload.groups.list;
      state.collectUngroupedCount = payload.groups.ungrouped_count;
      state.collectTotalCount = payload.groups.total_count;
      state.collectList = payload.list.list;
      state.collectTotal = payload.list.total;
      state.collectPage = payload.list.page;
    },
    setCollectGroupLoading(state: CollectState, { payload }: { payload: boolean }) {
      state.collectGroupLoading = payload;
    },
    // ==================== 收藏列表 ====================
    saveCollectList(
      state: CollectState,
      { payload }: { payload: { list: any[]; total: number; page: number } },
    ) {
      state.collectList = payload.list;
      state.collectTotal = payload.total;
      state.collectPage = payload.page;
    },
    setCollectLoading(state: CollectState, { payload }: { payload: boolean }) {
      state.collectLoading = payload;
    },
  },

  effects: {
    // ==================== 收藏分组 ====================
    *fetchCollectGroups(
      { payload }: { payload?: { type?: 'doc' | 'project' } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setCollectGroupLoading', payload: true });
      try {
        const res = yield call(collectService.fetchCollectGroups, payload);
        yield put({ type: 'saveCollectGroups', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('获取收藏分组失败');
        return null;
      } finally {
        yield put({ type: 'setCollectGroupLoading', payload: false });
      }
    },

    *createCollectGroup(
      { payload }: { payload: { name: string; description?: string; type?: 'doc' | 'project' } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(collectService.createCollectGroup, payload);
        message.success('分组创建成功');
        // 刷新分组列表（不传 user_id，后端从 token 解析）
        yield put({ type: 'fetchCollectGroups', payload: { type: payload.type } });
        return res.data;
      } catch (e) {
        message.error('创建分组失败');
        return null;
      }
    },

    *updateCollectGroup(
      { payload }: { payload: { id: number; name?: string; description?: string; type?: 'doc' | 'project' } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(collectService.updateCollectGroup, payload);
        message.success('分组更新成功');
        yield put({ type: 'fetchCollectGroups', payload: { type: payload.type } });
        return res.data;
      } catch (e) {
        message.error('更新分组失败');
        return null;
      }
    },

    *deleteCollectGroup(
      { payload }: { payload: { id: number; type?: 'doc' | 'project' } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(collectService.deleteCollectGroup, payload);
        message.success('分组删除成功');
        yield put({ type: 'fetchCollectGroups', payload: { type: payload.type } });
        return true;
      } catch (e) {
        message.error('删除分组失败');
        return null;
      }
    },

    // ==================== 收藏列表 ====================
    *fetchCollectList(
      { payload }: { payload?: { page?: number; page_size?: number; group_id?: number; keyword?: string; type?: 'doc' | 'project' } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setCollectLoading', payload: true });
      try {
        const res = yield call(collectService.fetchCollectList, payload);
        yield put({ type: 'saveCollectList', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('获取收藏列表失败');
        return null;
      } finally {
        yield put({ type: 'setCollectLoading', payload: false });
      }
    },

    *cancelCollect(
      { payload }: { payload: { id: number; group_id?: number; page?: number; page_size?: number; type?: 'doc' | 'project' } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(collectService.cancelCollect, { id: payload.id });
        message.success('已取消收藏');
        // 刷新收藏列表和分组列表
        yield put({
          type: 'fetchCollectList',
          payload: { page: payload.page, page_size: payload.page_size, group_id: payload.group_id, type: payload.type },
        });
        yield put({ type: 'fetchCollectGroups', payload: { type: payload.type } });
        return true;
      } catch (e) {
        message.error('取消收藏失败');
        return null;
      }
    },

    // 移动收藏到其他分组
    *moveCollect(
      { payload }: { payload: { id: number; group_id: number; currentGroupId?: number; page?: number; page_size?: number; type?: 'doc' | 'project' } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(collectService.moveCollect, { id: payload.id, group_id: payload.group_id });
        message.success('移动成功');
        // 刷新列表时用当前选中分组（currentGroupId），而非目标分组（group_id）
        yield put({
          type: 'fetchCollectList',
          payload: { page: payload.page, page_size: payload.page_size, group_id: payload.currentGroupId, type: payload.type },
        });
        yield put({ type: 'fetchCollectGroups', payload: { type: payload.type } });
        return true;
      } catch (e) {
        message.error('移动失败');
        return null;
      }
    },
  },
};
