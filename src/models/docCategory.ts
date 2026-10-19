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
    /** 批量删除文档分类（扁平化数组，按 ids 移除） */
    removeDocCategories(state: DocCategoryState, { payload }: { payload: (number | string)[] }) {
      const idSet = new Set(payload.map(Number));
      state.docCategoryList = state.docCategoryList.filter((c) => !idSet.has(Number(c.id)));
    },
  },

  effects: {
    /** 获取文集下的文档分类列表（路径参数版 API，带 doc_count） */
    *fetchProjectCategories(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docCategoryService.getDocCategoriesByProjectId, {
          projectId: payload,
        });
        if (!res?.success) {
          message.error(res?.message || '加载文档分类失败');
          return [];
        }
        yield put({ type: 'saveDocCategoryList', payload: res.data });
        return res.data;
      } catch (e: any) {
        message.error(e?.message || '加载文档分类失败');
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
        if (!res?.success) {
          message.error(res?.message || '加载文档分类失败');
          return [];
        }
        yield put({ type: 'saveDocCategoryList', payload: res.data });
        return res.data;
      } catch (e: any) {
        message.error(e?.message || '加载文档分类失败');
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
        if (!res?.success) {
          message.error(res?.message || '分类创建失败');
          return null;
        }
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
        if (!res?.success) {
          message.error(res?.message || '分类更新失败');
          return null;
        }
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
        const res = yield call(docCategoryService.deleteDocCategory, { id: payload });
        if (!res?.success) {
          message.error(res?.message || '分类删除失败');
          return false;
        }
        yield put({ type: 'removeDocCategory', payload });
        message.success('分类删除成功');
        return true;
      } catch (e: any) {
        message.error(e?.message || '分类删除失败');
        return false;
      }
    },

    /** 批量删除文档分类（乐观删除，不再重新获取列表） */
    *handleBatchDeleteDocCategories(
      { payload }: { payload: (number | string)[] },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docCategoryService.batchDeleteDocCategories, { ids: payload });
        if (!res?.success) {
          message.error(res?.message || '批量删除失败');
          return false;
        }
        // 乐观删除：从 model 中直接移除
        const deletedIds = res?.data?.ids || payload;
        yield put({ type: 'removeDocCategories', payload: deletedIds });
        message.success('批量删除成功');
        return true;
      } catch (e: any) {
        message.error(e?.message || '批量删除失败');
        return false;
      }
    },

    /** 批量移动文档分类（乐观更新：修改 parent_id，不再重新获取列表） */
    *handleBatchMoveDocCategories(
      { payload }: { payload: { ids: (number | string)[]; target_parent_id: number | string } },
      { call, put, select }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docCategoryService.batchMoveDocCategories, payload);
        if (!res?.success) {
          message.error(res?.message || '批量移动失败');
          return false;
        }
        // 乐观更新：修改受影响分类的 parent_id
        const { docCategoryList } = yield select((state: any) => state.docCategory);
        const idSet = new Set(payload.ids.map(Number));
        const updatedList = docCategoryList.map((c: DocCategory) =>
          idSet.has(Number(c.id))
            ? { ...c, parent_id: payload.target_parent_id }
            : c,
        );
        yield put({ type: 'saveDocCategoryList', payload: updatedList });
        message.success('批量移动成功');
        return true;
      } catch (e: any) {
        message.error(e?.message || '批量移动失败');
        return false;
      }
    },

    /** 保存文档分类排序（乐观更新，不再重新获取列表） */
    *handleSaveDocCategorySort(
      { payload }: { payload: any[] },
      { call, put, select }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docCategoryService.saveDocCategorySort, { sorts: payload });
        if (!res?.success) {
          message.error(res?.message || '排序保存失败');
          return false;
        }
        // 乐观更新：根据 sorts 更新每个分类的 sort 字段
        const { docCategoryList } = yield select((state: any) => state.docCategory);
        const sortMap = new Map(payload.map((s) => [Number(s.id), s.sort]));
        const updatedList = docCategoryList.map((c: DocCategory) =>
          sortMap.has(Number(c.id))
            ? { ...c, sort: sortMap.get(Number(c.id)) }
            : c,
        );
        yield put({ type: 'saveDocCategoryList', payload: updatedList });
        message.success('排序保存成功');
        return true;
      } catch (e: any) {
        message.error(e?.message || '排序保存失败');
        return false;
      }
    },
  },
};
