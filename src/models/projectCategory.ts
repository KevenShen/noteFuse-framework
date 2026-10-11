// src/models/projectCategory.ts
// 文集分类管理 Dva Model
// 职责：管理文集分类的状态（分类列表、加载状态）和 CRUD 操作
// 最新规范：namespace + state + reducers + effects，配合 Immer

import type { ProjectCategoryItem } from '@/pages/Project/types';
import * as projectCategoryService from '@/services/projectCategory';
import { message } from 'antd';

export interface ProjectCategoryState {
  /** 分类列表（扁平化） */
  projectCategoryList: ProjectCategoryItem[];
  /** 加载状态 */
  loading: boolean;
}

const initialState: ProjectCategoryState = {
  projectCategoryList: [],
  loading: false,
};

export default {
  namespace: 'projectCategory',

  state: initialState,

  reducers: {
    /** 保存分类列表 */
    saveCategoryList(
      state: ProjectCategoryState,
      { payload }: { payload: ProjectCategoryItem[] },
    ) {
      state.projectCategoryList = payload;
    },
    /** 新增或更新单个分类 */
    upsertCategory(
      state: ProjectCategoryState,
      { payload }: { payload: ProjectCategoryItem },
    ) {
      const idx = state.projectCategoryList.findIndex(
        (c) => c.id === payload.id,
      );
      if (idx >= 0) {
        state.projectCategoryList[idx] = payload;
      } else {
        state.projectCategoryList.push(payload);
      }
    },
    /** 删除单个分类 */
    removeCategory(
      state: ProjectCategoryState,
      { payload }: { payload: number },
    ) {
      state.projectCategoryList = state.projectCategoryList.filter(
        (c) => c.id !== payload,
      );
    },
    /** 设置加载状态 */
    setLoading(
      state: ProjectCategoryState,
      { payload }: { payload: boolean },
    ) {
      state.loading = payload;
    },
  },

  effects: {
    // ==================== 获取分类列表 ====================
    *fetchCategoryList(
      _: any,
      { call, put }: any,
    ): Generator<any, void, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(projectCategoryService.getCategoryList);
        yield put({ type: 'saveCategoryList', payload: res.data });
      } catch (e) {
        message.error('加载分类失败');
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },

    // ==================== 新建分类 ====================
    *handleCreateCategory(
      { payload }: { payload: Partial<ProjectCategoryItem> },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(projectCategoryService.createCategory, payload);
        yield put({ type: 'upsertCategory', payload: res.data });
        message.success('分类创建成功');
        return res;
      } catch (e) {
        message.error('分类创建失败');
        return null;
      }
    },

    // ==================== 更新分类 ====================
    *handleUpdateCategory(
      {
        payload,
      }: { payload: { id: number; data: Partial<ProjectCategoryItem> } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(projectCategoryService.updateCategory, payload);
        yield put({ type: 'upsertCategory', payload: res.data });
        message.success('分类更新成功');
        return res;
      } catch (e) {
        message.error('分类更新失败');
        return null;
      }
    },

    // ==================== 删除分类 ====================
    *handleDeleteCategory(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(projectCategoryService.deleteCategory, { id: payload });
        yield put({ type: 'removeCategory', payload });
        message.success('分类删除成功');
        return true;
      } catch (e) {
        message.error('分类删除失败');
        return false;
      }
    },

    // ==================== 批量删除分类 ====================
    *handleBatchDeleteCategories(
      { payload }: { payload: (number | string)[] },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(projectCategoryService.batchDeleteCategories, {
          ids: payload,
        });
        yield put({ type: 'fetchCategoryList' });
        message.success('批量删除成功');
        return true;
      } catch (e) {
        message.error('批量删除失败');
        return false;
      }
    },

    // ==================== 批量移动分类 ====================
    *handleBatchMoveCategories(
      {
        payload,
      }: {
        payload: {
          ids: (number | string)[];
          target_parent_id: number | string;
        };
      },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(projectCategoryService.batchMoveCategories, payload);
        yield put({ type: 'fetchCategoryList' });
        message.success('批量移动成功');
        return true;
      } catch (e) {
        message.error('批量移动失败');
        return false;
      }
    },

    // ==================== 保存分类排序 ====================
    *handleSaveCategorySort(
      { payload }: { payload: ProjectCategoryItem[] },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(projectCategoryService.saveCategorySort, {
          sorts: payload,
        });
        yield put({ type: 'fetchCategoryList' });
        message.success('排序保存成功');
        return true;
      } catch (e) {
        message.error('排序保存失败');
        return false;
      }
    },
  },
};
