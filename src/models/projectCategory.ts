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
  // 分类列表
  projectCategoryList: [],
  /** 列表加载状态 */
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
    /** 新增或更新单个分类（合并模式，防止后端返回缺字段时丢失数据） */
    upsertCategory(
      state: ProjectCategoryState,
      { payload }: { payload: ProjectCategoryItem },
    ) {
      const idx = state.projectCategoryList.findIndex(
        (c) => c.id === payload.id,
      );
      if (idx >= 0) {
        // 合并而非替换：保留旧记录中未返回的字段（如 project_count、parent_id）
        state.projectCategoryList[idx] = {
          ...state.projectCategoryList[idx],
          ...payload,
        };
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
    /** 批量删除分类（乐观更新，含所有后代） */
    removeCategories(
      state: ProjectCategoryState,
      { payload }: { payload: number[] },
    ) {
      const idSet = new Set(payload);
      state.projectCategoryList = state.projectCategoryList.filter(
        (c) => !idSet.has(c.id),
      );
    },
    /** 设置加载状态 */
    setLoading(state: ProjectCategoryState, { payload }: { payload: boolean }) {
      state.loading = payload;
    },
  },

  effects: {
    // ==================== 获取分类列表 ====================
    *fetchCategoryList(_: any, { call, put }: any): Generator<any, void, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(projectCategoryService.getCategoryList);
        if (!res?.success) {
          message.error(res?.message || '加载分类失败');
          return;
        }
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
        if (!res?.success) {
          message.error(res?.message || '分类创建失败');
          return null;
        }
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
        if (!res?.success) {
          message.error(res?.message || '分类更新失败');
          return null;
        }
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
        const res = yield call(projectCategoryService.deleteCategory, {
          id: payload,
        });
        if (!res?.success) {
          message.error(res?.message || '分类删除失败');
          return false;
        }
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
        const res = yield call(projectCategoryService.batchDeleteCategories, {
          ids: payload,
        });
        if (!res?.success) {
          message.error(res?.message || '批量删除失败');
          return false;
        }
        // 乐观删除：使用后端返回的 deletedIds（含所有后代）直接从 model 中移除，不再重新请求
        const deletedIds: number[] =
          res?.data?.deletedIds || payload.map(Number);
        yield put({ type: 'removeCategories', payload: deletedIds });
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
        const res = yield call(
          projectCategoryService.batchMoveCategories,
          payload,
        );
        if (!res?.success) {
          message.error(res?.message || '批量移动失败');
          return false;
        }
        // 乐观更新：使用后端返回的全部分类列表直接替换，不再重新请求
        const categories: ProjectCategoryItem[] = res?.data?.categories || [];
        if (categories.length > 0) {
          yield put({ type: 'saveCategoryList', payload: categories });
        } else {
          // 兜底：如果后端未返回分类列表，重新获取
          yield put({ type: 'fetchCategoryList' });
        }
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
        const res = yield call(projectCategoryService.saveCategorySort, {
          sorts: payload,
        });
        if (!res?.success) {
          message.error(res?.message || '排序保存失败');
          return false;
        }
        // 乐观更新：使用后端返回的全部分类列表直接替换，不再重新请求
        const categories: ProjectCategoryItem[] =
          res?.data?.categories || payload;
        yield put({ type: 'saveCategoryList', payload: categories });
        message.success('排序保存成功');
        return true;
      } catch (e) {
        message.error('排序保存失败');
        return false;
      }
    },
  },
};
