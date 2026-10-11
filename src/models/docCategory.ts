// src/models/docCategory.ts
// 文档分类 Dva Model
import type { DocCategory } from '@/pages/Project/types';
import * as docCategoryService from '@/services/docCategory';
import { message } from 'antd';

export interface DocCategoryState {
  /** 文档分类列表（扁平化，按文集分组） */
  docCategoryList: DocCategory[];
}

const initialState: DocCategoryState = {
  docCategoryList: [],
};

export default {
  namespace: 'docCategory',

  state: initialState,

  reducers: {
    saveDocCategoryList(
      state: DocCategoryState,
      { payload }: { payload: DocCategory[] },
    ) {
      state.docCategoryList = payload;
    },
    /** 新增或更新文档分类（扁平化数组，按 id 匹配） */
    upsertDocCategory(state: DocCategoryState, { payload }: { payload: DocCategory }) {
      const index = state.docCategoryList.findIndex((c) => c.id === payload.id);
      if (index >= 0) {
        state.docCategoryList[index] = { ...state.docCategoryList[index], ...payload };
      } else {
        state.docCategoryList.push(payload);
      }
    },
    /** 删除文档分类（扁平化数组，按 id 移除） */
    removeDocCategory(state: DocCategoryState, { payload }: { payload: number }) {
      state.docCategoryList = state.docCategoryList.filter((c) => c.id !== payload);
    },
  },

  effects: {
    /** 获取文集下的文档分类列表 */
    *fetchProjectCategories(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docCategoryService.getProjectDocCategories, {
          id: payload,
        });
        yield put({ type: 'saveDocCategoryList', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('加载文集分类失败');
        return [];
      }
    },

    /** 获取所有文档分类列表（跨文集，带文档数量） */
    *fetchDocCategoryList(
      { payload }: { payload?: { project_id?: number; keyword?: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docCategoryService.getDocCategoryList, payload || {});
        yield put({ type: 'saveDocCategoryList', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('加载文档分类失败');
        return [];
      }
    },

    /** 创建文档分类 */
    *handleCreateDocCategory(
      { payload }: { payload: any },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docCategoryService.createDocCategory, payload);
        yield put({ type: 'upsertDocCategory', payload: res.data });
        message.success('分类创建成功');
        return res.data;
      } catch (e: any) {
        message.error(e?.message || '分类创建失败');
        return null;
      }
    },

    /** 更新文档分类 */
    *handleUpdateDocCategory(
      { payload }: { payload: { id: number; data: any } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docCategoryService.updateDocCategory, payload);
        yield put({ type: 'upsertDocCategory', payload: res.data });
        message.success('分类更新成功');
        return res.data;
      } catch (e: any) {
        message.error(e?.message || '分类更新失败');
        return null;
      }
    },

    /** 删除文档分类 */
    *handleDeleteDocCategory(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(docCategoryService.deleteDocCategory, { id: payload });
        yield put({ type: 'removeDocCategory', payload });
        message.success('分类删除成功');
        return true;
      } catch (e: any) {
        message.error(e?.message || '分类删除失败');
        return false;
      }
    },

    /** 批量删除文档分类 */
    *handleBatchDeleteDocCategories(
      { payload }: { payload: (number | string)[] },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(docCategoryService.batchDeleteDocCategories, { ids: payload });
        // 批量删除后重新获取列表
        yield put({ type: 'fetchDocCategoryList' });
        message.success('批量删除成功');
        return true;
      } catch (e: any) {
        message.error(e?.message || '批量删除失败');
        return false;
      }
    },

    /** 批量移动文档分类 */
    *handleBatchMoveDocCategories(
      { payload }: { payload: { ids: (number | string)[]; target_parent_id: number | string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(docCategoryService.batchMoveDocCategories, payload);
        // 批量移动后重新获取列表
        yield put({ type: 'fetchDocCategoryList' });
        message.success('批量移动成功');
        return true;
      } catch (e: any) {
        message.error(e?.message || '批量移动失败');
        return false;
      }
    },

    /** 保存文档分类排序 */
    *handleSaveDocCategorySort(
      { payload }: { payload: any[] },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(docCategoryService.saveDocCategorySort, { sorts: payload });
        // 排序保存后重新获取列表
        yield put({ type: 'fetchDocCategoryList' });
        message.success('排序保存成功');
        return true;
      } catch (e: any) {
        message.error(e?.message || '排序保存失败');
        return false;
      }
    },
  },
};
