// src/models/docList.ts
// 文档列表 Dva Model
import type { DocItem } from '@/pages/Project/types';
import * as docListService from '@/services/docList';
import { message } from 'antd';

export interface DocListState {
  /** 文档列表（扁平化，按文集分组） */
  docList: DocItem[];
}

const initialState: DocListState = {
  docList: [],
};

export default {
  namespace: 'docList',

  state: initialState,

  reducers: {
    saveDocList(state: DocListState, { payload }: { payload: DocItem[] }) {
      state.docList = payload;
    },
    /** 新增或更新文档（扁平化数组，按 id 匹配） */
    upsertDoc(state: DocListState, { payload }: { payload: DocItem }) {
      const index = state.docList.findIndex((d) => d.id === payload.id);
      if (index >= 0) {
        state.docList[index] = { ...state.docList[index], ...payload };
      } else {
        state.docList.push(payload);
      }
    },
    /** 删除文档（扁平化数组，按 id 移除） */
    removeDoc(state: DocListState, { payload }: { payload: number }) {
      state.docList = state.docList.filter((d) => d.id !== payload);
    },
  },

  effects: {
    /** 获取文集下的文档列表 */
    *fetchProjectDocs(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docListService.getProjectDocs, { id: payload });
        yield put({ type: 'saveDocList', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('加载文档列表失败');
        return [];
      }
    },

    /** 新建文档 */
    *handleCreateDoc(
      {
        payload,
      }: {
        payload: {
          project_id: number;
          name: string;
          doc_category_id?: number;
          content?: string;
        };
      },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docListService.createDoc, payload);
        yield put({ type: 'upsertDoc', payload: res.data });
        message.success('文档创建成功');
        return res.data;
      } catch (e) {
        message.error('文档创建失败');
        return null;
      }
    },

    /** 编辑文档（重命名/移动分类/更新副标题等） */
    *handleUpdateDoc(
      {
        payload,
      }: {
        payload: {
          id: number;
          name?: string;
          doc_category_id?: number;
          summary?: string;
          sort?: number;
          data?: any;
        };
      },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        // 兼容两种调用方式：直接传字段 或 { id, data } 包装
        const updateData = payload.data
          ? { id: payload.id, ...payload.data }
          : payload;
        const res = yield call(docListService.updateDoc, updateData);
        yield put({
          type: 'upsertDoc',
          payload: { id: payload.id, ...res.data },
        });
        message.success('文档更新成功');
        return res.data;
      } catch (e) {
        message.error('文档更新失败');
        return null;
      }
    },

    /** 删除文档 */
    *handleDeleteDoc(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(docListService.deleteDoc, { id: payload });
        yield put({ type: 'removeDoc', payload });
        message.success('文档删除成功');
        return true;
      } catch (e) {
        message.error('文档删除失败');
        return false;
      }
    },
  },
};
