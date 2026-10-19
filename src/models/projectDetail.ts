// src/models/projectDetail.ts
// 文集详情 Dva Model
// 职责：管理文集详情页相关的状态（当前文集、详情加载、简介保存）
// 最新规范：namespace + state + reducers + effects，配合 Immer
// 组件中使用 useSelector 获取状态，useDispatch 触发更新

import type { ProjectItem } from '@/pages/Project/types';
import * as projectDetailService from '@/services/projectDetail';
import { message } from 'antd';

export interface ProjectDetailState {
  /** 当前文集详情 */
  currentProject: ProjectItem | null;
  /** 详情加载状态 */
  detailLoading: boolean;
  /** 简介保存中状态 */
  introSaving: boolean;
}

const initialState: ProjectDetailState = {
  currentProject: null,
  detailLoading: false,
  introSaving: false,
};

export default {
  namespace: 'projectDetail',

  state: initialState,

  reducers: {
    /** 保存当前文集详情 */
    saveCurrentProject(
      state: ProjectDetailState,
      { payload }: { payload: ProjectItem | null },
    ) {
      state.currentProject = payload;
    },
    /** 设置详情加载状态 */
    setDetailLoading(
      state: ProjectDetailState,
      { payload }: { payload: boolean },
    ) {
      state.detailLoading = payload;
    },
    /** 设置简介保存状态 */
    setIntroSaving(
      state: ProjectDetailState,
      { payload }: { payload: boolean },
    ) {
      state.introSaving = payload;
    },
  },

  effects: {
    // ==================== 文集详情 ====================

    /** 获取文集详情 */
    *fetchProjectDetail(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setDetailLoading', payload: true });
      try {
        const res = yield call(projectDetailService.getProjectDetail, {
          id: payload,
        });
        if (!res?.success) {
          message.error(res?.message || '加载文集详情失败');
          return null;
        }
        yield put({ type: 'saveCurrentProject', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('加载文集详情失败');
        return null;
      } finally {
        yield put({ type: 'setDetailLoading', payload: false });
      }
    },

    // ==================== 保存文集简介 ====================

    /** 保存文集简介 */
    *handleUpdateProjectIntro(
      { payload }: { payload: { id: number; intro: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setIntroSaving', payload: true });
      try {
        const res = yield call(projectDetailService.updateProjectIntro, payload);
        if (!res?.success) {
          message.error(res?.message || '保存失败');
          return null;
        }
        yield put({ type: 'saveCurrentProject', payload: res.data });
        message.success('简介已保存');
        return res;
      } catch (e) {
        message.error('保存失败');
        return null;
      } finally {
        yield put({ type: 'setIntroSaving', payload: false });
      }
    },
  },
};
