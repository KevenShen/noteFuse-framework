// src/models/docVersions.ts
// 文档版本 Dva Model
import type { DocVersion } from '@/components/DocTree/types';
import * as docVersionsService from '@/services/docVersions';
import { message } from 'antd';

export interface DocVersionsState {
  /** 文档版本列表（扁平化，单独获取，在组件内关联到文档） */
  docVersions: DocVersion[];
}

const initialState: DocVersionsState = {
  docVersions: [],
};

export default {
  namespace: 'docVersions',

  state: initialState,

  reducers: {
    saveDocVersions(state: DocVersionsState, { payload }: { payload: DocVersion[] }) {
      state.docVersions = payload;
    },
    /** 更新版本大纲（本地数据同步） */
    updateDocVersionOutline(
      state: DocVersionsState,
      { payload }: { payload: DocVersion },
    ) {
      const index = state.docVersions.findIndex((v) => v.id === payload.id);
      if (index >= 0) {
        state.docVersions[index] = { ...state.docVersions[index], ...payload };
      }
    },
    /** 更新版本内容（本地数据同步） */
    updateDocVersionContent(
      state: DocVersionsState,
      { payload }: { payload: { id: number; content: string } },
    ) {
      const index = state.docVersions.findIndex((v) => v.id === payload.id);
      if (index >= 0) {
        state.docVersions[index] = { ...state.docVersions[index], content: payload.content };
      }
    },
    /** 添加新版本（本地数据同步，创建版本后立即更新左栏） */
    addDocVersion(
      state: DocVersionsState,
      { payload }: { payload: DocVersion },
    ) {
      // 直接添加新版本（当前版本由 doc.current_version_id 标识，无需修改版本列表）
      state.docVersions.push(payload);
    },
    /** 乐观更新版本（编辑版本后立即更新左栏，不依赖重新获取） */
    upsertDocVersion(
      state: DocVersionsState,
      { payload }: { payload: DocVersion },
    ) {
      const index = state.docVersions.findIndex((v) => v.id === payload.id);
      if (index >= 0) {
        state.docVersions[index] = { ...state.docVersions[index], ...payload };
      } else {
        state.docVersions.push(payload);
      }
    },
  },

  effects: {
    /** 获取文集下所有文档的版本列表 */
    *fetchDocVersions(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docVersionsService.getDocVersions, {
          projectId: payload,
        });
        yield put({ type: 'saveDocVersions', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('加载文档版本失败');
        return [];
      }
    },

    /** 新建版本 */
    *createDocVersion(
      {
        payload,
      }: {
        payload: {
          id: number;
          projectId: number;
          content: string;
          remark?: string;
          version_name?: string;
        };
      },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docVersionsService.createDocVersion, payload);
        message.success('新版本创建成功');
        // 立即更新本地版本列表，确保左栏显示新版本（不依赖异步 fetchDocVersions）
        if (res?.data) {
          yield put({ type: 'addDocVersion', payload: res.data });
        }
        // 异步重新获取版本列表，确保数据一致性
        yield put({ type: 'fetchDocVersions', payload: payload.projectId });
        return res;
      } catch (e) {
        message.error('创建版本失败');
        return null;
      }
    },

    /** 新建版本（版本对比编辑模式使用） */
    *handleCreateDocVersion(
      {
        payload,
      }: {
        payload: {
          doc_id: number;
          projectId: number;
          version: string;
          status: string;
          remark?: string;
          content: string;
          base_version_id?: number;
        };
      },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const { doc_id, projectId, ...data } = payload;
        const res = yield call(docVersionsService.createDocVersion, {
          id: doc_id,
          ...data,
        });
        message.success(`新版本 ${payload.version} 创建成功`);
        // 立即更新本地版本列表，确保左栏显示新版本
        if (res?.data) {
          yield put({ type: 'addDocVersion', payload: res.data });
        }
        // 异步重新获取版本列表，确保数据一致性
        yield put({ type: 'fetchDocVersions', payload: projectId });
        return res.data;
      } catch (e) {
        message.error('创建新版本失败');
        return null;
      }
    },

    /** 设置当前版本 */
    *handleSetCurrentDocVersion(
      { payload }: { payload: number },
      { call }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docVersionsService.setCurrentVersion, {
          versionId: payload,
        });
        message.success('已设置为当前版本');
        return res.data;
      } catch (e) {
        message.error('设置当前版本失败');
        return null;
      }
    },

    /** 更新版本信息（不涉及内容编辑） */
    *handleUpdateDocVersion(
      { payload }: { payload: { id: number; data: any } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const { id, data } = payload;
        const res = yield call(docVersionsService.updateDocVersion, {
          versionId: id,
          ...data,
        });
        if (!res?.success) {
          message.error(res?.message || '版本更新失败');
          return null;
        }
        message.success('版本更新成功');
        // 乐观更新本地版本列表，不依赖重新获取
        if (res.data) {
          yield put({ type: 'upsertDocVersion', payload: res.data });
        }
        return res.data;
      } catch (e) {
        message.error('版本更新失败');
        return null;
      }
    },

    /** 删除版本 */
    *handleDeleteDocVersion(
      { payload }: { payload: number },
      { call, put, select }: any,
    ): Generator<any, any, any> {
      try {
        // 先获取版本信息以知道 doc_id
        const { docVersions } = yield select((state: any) => state.docVersions);
        const version = docVersions.find((v: DocVersion) => v.id === payload);
        const docId = version?.doc_id;
        yield call(docVersionsService.deleteDocVersion, { versionId: payload });
        message.success('版本删除成功');
        // 重新获取版本列表
        if (docId) {
          yield put({ type: 'fetchDocVersions', payload: docId });
        }
        return true;
      } catch (e) {
        message.error('版本删除失败');
        return null;
      }
    },

    /** 回滚版本（将该版本内容复制到当前版本） */
    *handleRollbackDocVersion(
      { payload }: { payload: number },
      { call, put, select }: any,
    ): Generator<any, any, any> {
      try {
        // 先获取该版本的内容
        const { docVersions } = yield select((state: any) => state.docVersions);
        const version = docVersions.find((v: DocVersion) => v.id === payload);
        if (!version) {
          message.error('版本不存在');
          return null;
        }
        // 创建新版本作为回滚
        const res = yield call(docVersionsService.createDocVersion, {
          id: version.doc_id,
          content: version.content,
          version: `回滚-${version.version}`,
          remark: `从版本 ${version.version} 回滚`,
          status: 'draft',
        });
        message.success('版本回滚成功');
        // 重新获取版本列表
        yield put({ type: 'fetchDocVersions', payload: version.doc_id });
        return res.data;
      } catch (e) {
        message.error('版本回滚失败');
        return null;
      }
    },

    /** 保存版本原文（带标记，同时检测孤立批注） */
    *saveVersionContent(
      { payload }: { payload: { versionId: number; content: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docVersionsService.saveVersionContent, payload);
        message.success('保存成功');
        // 更新本地版本数据中的 content 字段
        yield put({ type: 'updateDocVersionContent', payload: res.data });
        return res;
      } catch (e) {
        message.error('保存失败');
        return null;
      }
    },

    /** 保存版本大纲 */
    *saveDocVersionOutline(
      { payload }: { payload: { versionId: number; outline: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docVersionsService.updateDocVersion, payload);
        message.success('大纲保存成功');
        // 更新本地版本数据中的 outline 字段
        yield put({ type: 'updateDocVersionOutline', payload: res.data });
        return res;
      } catch (e) {
        message.error('大纲保存失败');
        return null;
      }
    },
  },
};
