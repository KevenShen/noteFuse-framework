// src/models/docDetail.ts
// 文档详情 Dva Model
import type { AiOutline, AiOutlineChapter, DocItem } from '@/pages/Project/types';
import * as docDetailService from '@/services/docDetail';
import { message } from 'antd';

export interface DocDetailState {
  /** 当前文档详情（含当前版本 content） */
  currentDoc: DocItem | null;
  /** AI 大纲 */
  aiOutline: AiOutline | null;
  /** 是否有异步操作正在进行（loadingCount > 0 时为 true） */
  loading: boolean;
  /** 正在进行的异步操作计数器（支持多个操作并发） */
  loadingCount: number;
  /** 阅读模式：原文/批注 */
  readMode: 'original' | 'annotation';
  // ==================== 阅读模式状态（跨组件共享） ====================
  outlineMode: boolean;
  outlineContent: string;
  versionOverviewMode: boolean;
  focusMode: boolean;
  focusAnchor: string;
  activeAnchor: string;
  // ==================== 右面板状态（跨组件共享） ====================
  activeTab: 'outline' | 'annotations' | 'ai' | 'share';
  collected: boolean;
}

const initialState: DocDetailState = {
  currentDoc: null,
  aiOutline: null,
  loading: false,
  loadingCount: 0,
  readMode: 'annotation',
  outlineMode: false,
  outlineContent: '',
  versionOverviewMode: false,
  focusMode: false,
  focusAnchor: '',
  activeAnchor: '',
  activeTab: 'outline',
  collected: false,
};

export default {
  namespace: 'docDetail',

  state: initialState,

  reducers: {
    saveCurrentDoc(state: DocDetailState, { payload }: { payload: DocItem | null }) {
      state.currentDoc = payload;
    },
    saveAiOutline(state: DocDetailState, { payload }: { payload: AiOutline | null }) {
      state.aiOutline = payload;
    },
    setReadMode(
      state: DocDetailState,
      { payload }: { payload: 'original' | 'annotation' },
    ) {
      state.readMode = payload;
    },
    setOutlineMode(state: DocDetailState, { payload }: { payload: boolean }) {
      state.outlineMode = payload;
    },
    setOutlineContent(state: DocDetailState, { payload }: { payload: string }) {
      state.outlineContent = payload;
    },
    setVersionOverviewMode(state: DocDetailState, { payload }: { payload: boolean }) {
      state.versionOverviewMode = payload;
    },
    setFocusMode(state: DocDetailState, { payload }: { payload: boolean }) {
      state.focusMode = payload;
    },
    setFocusAnchor(state: DocDetailState, { payload }: { payload: string }) {
      state.focusAnchor = payload;
    },
    setActiveAnchor(state: DocDetailState, { payload }: { payload: string }) {
      state.activeAnchor = payload;
    },
    setActiveTab(
      state: DocDetailState,
      { payload }: { payload: DocDetailState['activeTab'] },
    ) {
      state.activeTab = payload;
    },
    setCollected(state: DocDetailState, { payload }: { payload: boolean }) {
      state.collected = payload;
    },
    toggleCollected(state: DocDetailState) {
      state.collected = !state.collected;
    },
    /** 开始加载：计数器 +1，loading 自动变为 true */
    startLoading(state: DocDetailState) {
      state.loadingCount += 1;
      state.loading = state.loadingCount > 0;
    },
    /** 结束加载：计数器 -1，计数器为 0 时 loading 变为 false */
    stopLoading(state: DocDetailState) {
      state.loadingCount = Math.max(0, state.loadingCount - 1);
      state.loading = state.loadingCount > 0;
    },
  },

  effects: {
    /** 获取文档详情（含指定版本 content，version 可选） */
    *fetchDocDetail(
      { payload }: { payload: number | { id: number; version?: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'startLoading' });
      try {
        // 兼容 number 和 { id, version } 两种传参
        const params = typeof payload === 'number' ? { id: payload } : payload;
        const res = yield call(docDetailService.getDocDetail, params);
        yield put({ type: 'saveCurrentDoc', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('加载文档详情失败');
        return null;
      } finally {
        yield put({ type: 'stopLoading' });
      }
    },

    /** 保存文档内容（更新当前版本） */
    *saveDocContent(
      {
        payload,
      }: {
        payload: {
          versionId: number;
          content: string;
          docId: number;
          projectId?: number;
        };
      },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docDetailService.saveDocContent, {
          id: payload.versionId,
          content: payload.content,
        });
        message.success('保存成功');
        // 重新获取文档详情和版本列表
        yield put({ type: 'fetchDocDetail', payload: payload.docId });
        yield put({
          type: 'docVersions/fetchDocVersions',
          payload: payload.projectId || 1,
        });
        return res;
      } catch (e) {
        message.error('保存失败');
        return null;
      }
    },

    /** 合并保存文档详情页初始数据（分类+文档+版本+当前文档，跨 model） */
    *saveDocDetailInitialData(
      {
        payload,
      }: {
        payload: {
          categories: any[];
          docs: any[];
          versions: any[];
          currentDoc: any | null;
        };
      },
      { put }: any,
    ): Generator<any, void, any> {
      yield put({ type: 'docCategory/saveDocCategoryList', payload: payload.categories || [] });
      yield put({ type: 'docList/saveDocList', payload: payload.docs || [] });
      yield put({ type: 'docVersions/saveDocVersions', payload: payload.versions || [] });
      yield put({ type: 'saveCurrentDoc', payload: payload.currentDoc || null });
    },

    // ==================== AI 大纲 ====================
    *fetchAiOutline(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, void, any> {
      try {
        const res = yield call(docDetailService.getAiOutline, { id: payload });
        yield put({ type: 'saveAiOutline', payload: res.data });
      } catch (e) {
        // 大纲不存在时不报错
      }
    },

    *handleGenerateAiOutline(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'startLoading' });
      try {
        const res = yield call(docDetailService.generateAiOutline, { id: payload });
        yield put({ type: 'saveAiOutline', payload: res.data });
        message.success('大纲生成成功');
        return res.data;
      } catch (e) {
        message.error('大纲生成失败');
        return null;
      } finally {
        yield put({ type: 'stopLoading' });
      }
    },

    *handleSaveAiOutline(
      {
        payload,
      }: {
        payload: { id: number; summary: string; chapters: AiOutlineChapter[] };
      },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'startLoading' });
      try {
        const res = yield call(docDetailService.saveAiOutline, payload);
        yield put({ type: 'saveAiOutline', payload: res.data });
        message.success('大纲已保存');
        return res.data;
      } catch (e) {
        message.error('大纲保存失败');
        return null;
      } finally {
        yield put({ type: 'stopLoading' });
      }
    },
  },
};
