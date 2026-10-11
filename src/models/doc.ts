// src/models/doc.ts
// 文档模块 Dva Model
// 最新规范：namespace + state + reducers + effects，配合 Immer
// 组件中使用 useSelector 获取状态，useDispatch 触发更新
// 注意：effect 内的 put 调用不需要手动加 namespace 前缀，Dva 会自动补全

import type { MockDocAnnotation as DocAnnotation } from '@/../mock/Entities/doc';
import type { DocVersion } from '@/components/DocTree/types';
import type {
  AiOutline,
  AiOutlineChapter,
  DocCategory,
  DocItem,
} from '@/pages/Project/types';
import * as docService from '@/services/doc';
import { message } from 'antd';

export interface DocState {
  // 文档列表（扁平化，按文集分组）
  docList: DocItem[];
  // 文档分类列表（扁平化，按文集分组）
  docCategoryList: DocCategory[];
  // 文档版本列表（扁平化，单独获取，在组件内关联到文档）
  docVersions: DocVersion[];
  // 当前文档详情（含当前版本 content）
  currentDoc: DocItem | null;
  // AI 大纲
  aiOutline: AiOutline | null;
  // 文档批注（内容嵌入标记版）
  docAnnotations: DocAnnotation[];
  annotationSaving: boolean;
  // ==================== 统一 Loading（计数器模式，支持并发） ====================
  // 是否有异步操作正在进行（loadingCount > 0 时为 true）
  loading: boolean;
  // 正在进行的异步操作计数器（支持多个操作并发）
  loadingCount: number;
  readMode: 'original' | 'annotation'; // 阅读模式：原文/批注
  annotationEditMode: boolean; // 是否处于批注编辑模式
  editingAnnotation: DocAnnotation | null; // 当前编辑的批注
  // ==================== 批注编辑状态（跨组件共享） ====================
  annotationContent: string; // 批注编辑内容
  originalContentBeforeEdit: string; // 编辑前的原文（用于取消时恢复）
  newAnnotationMarkerId: number | null; // 新批注的标记 ID
  // ==================== 阅读模式状态（跨组件共享） ====================
  outlineMode: boolean; // 大纲阅读模式
  outlineContent: string; // 大纲内容
  versionOverviewMode: boolean; // 版本总览阅读模式
  focusMode: boolean; // 聚焦模式
  focusAnchor: string; // 聚焦的锚点标题
  activeAnchor: string; // 当前激活的锚点
  // ==================== 右面板状态（跨组件共享） ====================
  activeTab: 'outline' | 'annotations' | 'ai' | 'share'; // 右面板当前 Tab
  collected: boolean; // 是否已收藏
}

const initialState: DocState = {
  // 统一 Loading
  loading: false,
  loadingCount: 0,
  currentDoc: null,
  docList: [],
  docCategoryList: [],
  docVersions: [],
  aiOutline: null,
  docAnnotations: [],
  annotationSaving: false,
  readMode: 'annotation', // 默认批注模式
  annotationEditMode: false,
  editingAnnotation: null,
  // 批注编辑状态
  annotationContent: '',
  originalContentBeforeEdit: '',
  newAnnotationMarkerId: null,
  // 阅读模式状态
  outlineMode: false,
  outlineContent: '',
  versionOverviewMode: false,
  focusMode: false,
  focusAnchor: '',
  activeAnchor: '',
  // 右面板状态
  activeTab: 'outline',
  collected: false,
};

export default {
  namespace: 'doc',

  state: initialState,

  reducers: {
    // ==================== 详情页初始数据 ====================
    // 合并保存文档详情页初始数据（分类+文档+版本+当前文档）
    saveDocDetailInitialData(
      state: DocState,
      {
        payload,
      }: {
        payload: {
          categories: DocCategory[];
          docs: DocItem[];
          versions: DocVersion[];
          currentDoc: DocItem | null;
        };
      },
    ) {
      state.docCategoryList = payload.categories;
      state.docList = payload.docs;
      state.docVersions = payload.versions;
      state.currentDoc = payload.currentDoc;
    },

    // ==================== 文档列表 ====================
    saveDocList(state: DocState, { payload }: { payload: DocItem[] }) {
      state.docList = payload;
    },
    // 新增或更新文档（扁平化数组，按 id 匹配）
    upsertDoc(state: DocState, { payload }: { payload: DocItem }) {
      const index = state.docList.findIndex((d) => d.id === payload.id);
      if (index >= 0) {
        state.docList[index] = { ...state.docList[index], ...payload };
      } else {
        state.docList.push(payload);
      }
    },
    // 删除文档（扁平化数组，按 id 移除）
    removeDoc(state: DocState, { payload }: { payload: number }) {
      state.docList = state.docList.filter((d) => d.id !== payload);
    },

    // ==================== 文档分类 ====================
    saveDocCategoryList(
      state: DocState,
      { payload }: { payload: DocCategory[] },
    ) {
      state.docCategoryList = payload;
    },
    // 新增或更新文档分类（扁平化数组，按 id 匹配）
    upsertDocCategory(state: DocState, { payload }: { payload: DocCategory }) {
      const index = state.docCategoryList.findIndex((c) => c.id === payload.id);
      if (index >= 0) {
        state.docCategoryList[index] = { ...state.docCategoryList[index], ...payload };
      } else {
        state.docCategoryList.push(payload);
      }
    },
    // 删除文档分类（扁平化数组，按 id 移除）
    removeDocCategory(state: DocState, { payload }: { payload: number }) {
      state.docCategoryList = state.docCategoryList.filter((c) => c.id !== payload);
    },

    // ==================== 文档版本列表 ====================
    saveDocVersions(state: DocState, { payload }: { payload: DocVersion[] }) {
      state.docVersions = payload;
    },
    // 更新版本大纲（本地数据同步）
    updateDocVersionOutline(
      state: DocState,
      { payload }: { payload: DocVersion },
    ) {
      const index = state.docVersions.findIndex((v) => v.id === payload.id);
      if (index >= 0) {
        state.docVersions[index] = { ...state.docVersions[index], ...payload };
      }
    },

    // ==================== 文档详情 ====================
    saveCurrentDoc(state: DocState, { payload }: { payload: DocItem | null }) {
      state.currentDoc = payload;
    },

    // ==================== AI 大纲 ====================
    saveAiOutline(state: DocState, { payload }: { payload: AiOutline | null }) {
      state.aiOutline = payload;
    },

    // ==================== 文档批注 ====================
    saveDocAnnotations(
      state: DocState,
      { payload }: { payload: DocAnnotation[] },
    ) {
      state.docAnnotations = payload;
    },
    setAnnotationSaving(state: DocState, { payload }: { payload: boolean }) {
      state.annotationSaving = payload;
    },
    setReadMode(
      state: DocState,
      { payload }: { payload: 'original' | 'annotation' },
    ) {
      state.readMode = payload;
    },
    setAnnotationEditMode(state: DocState, { payload }: { payload: boolean }) {
      state.annotationEditMode = payload;
    },
    setEditingAnnotation(
      state: DocState,
      { payload }: { payload: DocAnnotation | null },
    ) {
      state.editingAnnotation = payload;
    },
    // 添加批注到列表
    addAnnotationToList(
      state: DocState,
      { payload }: { payload: DocAnnotation },
    ) {
      state.docAnnotations.push(payload);
    },
    // 更新列表中的批注
    updateAnnotationInList(
      state: DocState,
      { payload }: { payload: DocAnnotation },
    ) {
      const index = state.docAnnotations.findIndex((a) => a.id === payload.id);
      if (index !== -1) {
        state.docAnnotations[index] = payload;
      }
    },
    // 从列表中删除批注
    removeAnnotationFromList(
      state: DocState,
      { payload }: { payload: number },
    ) {
      state.docAnnotations = state.docAnnotations.filter(
        (a) => a.id !== payload,
      );
    },

    // ==================== 批注编辑状态 ====================
    setAnnotationContent(state: DocState, { payload }: { payload: string }) {
      state.annotationContent = payload;
    },
    setOriginalContentBeforeEdit(
      state: DocState,
      { payload }: { payload: string },
    ) {
      state.originalContentBeforeEdit = payload;
    },
    setNewAnnotationMarkerId(
      state: DocState,
      { payload }: { payload: number | null },
    ) {
      state.newAnnotationMarkerId = payload;
    },
    // 重置批注编辑状态（保存/取消后调用）
    resetAnnotationEditState(state: DocState) {
      state.annotationEditMode = false;
      state.editingAnnotation = null;
      state.annotationContent = '';
      state.originalContentBeforeEdit = '';
      state.newAnnotationMarkerId = null;
    },

    // ==================== 阅读模式状态 ====================
    setOutlineMode(state: DocState, { payload }: { payload: boolean }) {
      state.outlineMode = payload;
    },
    setOutlineContent(state: DocState, { payload }: { payload: string }) {
      state.outlineContent = payload;
    },
    setVersionOverviewMode(state: DocState, { payload }: { payload: boolean }) {
      state.versionOverviewMode = payload;
    },
    setFocusMode(state: DocState, { payload }: { payload: boolean }) {
      state.focusMode = payload;
    },
    setFocusAnchor(state: DocState, { payload }: { payload: string }) {
      state.focusAnchor = payload;
    },
    setActiveAnchor(state: DocState, { payload }: { payload: string }) {
      state.activeAnchor = payload;
    },

    // ==================== 右面板状态 ====================
    setActiveTab(
      state: DocState,
      { payload }: { payload: DocState['activeTab'] },
    ) {
      state.activeTab = payload;
    },
    setCollected(state: DocState, { payload }: { payload: boolean }) {
      state.collected = payload;
    },
    toggleCollected(state: DocState) {
      state.collected = !state.collected;
    },

    // ==================== 统一 Loading（计数器模式） ====================
    // 开始加载：计数器 +1，loading 自动变为 true
    startLoading(state: DocState) {
      state.loadingCount += 1;
      state.loading = state.loadingCount > 0;
    },
    // 结束加载：计数器 -1，计数器为 0 时 loading 变为 false
    stopLoading(state: DocState) {
      state.loadingCount = Math.max(0, state.loadingCount - 1);
      state.loading = state.loadingCount > 0;
    },
  },

  effects: {
    // ==================== 获取文集下的文档分类列表 ====================
    *fetchProjectCategories(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docService.getProjectDocCategories, {
          id: payload,
        });
        yield put({ type: 'saveDocCategoryList', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('加载文集分类失败');
        return [];
      }
    },

    // ==================== 文档分类管理（参照 ProjectCategory） ====================
    // 获取所有文档分类列表（跨文集，带文档数量）
    *fetchDocCategoryList(
      { payload }: { payload?: { project_id?: number; keyword?: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docService.getDocCategoryList, payload || {});
        yield put({ type: 'saveDocCategoryList', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('加载文档分类失败');
        return [];
      }
    },

    // 创建文档分类
    *handleCreateDocCategory(
      { payload }: { payload: any },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docService.createDocCategory, payload);
        yield put({ type: 'upsertDocCategory', payload: res.data });
        message.success('分类创建成功');
        return res.data;
      } catch (e: any) {
        message.error(e?.message || '分类创建失败');
        return null;
      }
    },

    // 更新文档分类
    *handleUpdateDocCategory(
      { payload }: { payload: { id: number; data: any } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docService.updateDocCategory, payload);
        yield put({ type: 'upsertDocCategory', payload: res.data });
        message.success('分类更新成功');
        return res.data;
      } catch (e: any) {
        message.error(e?.message || '分类更新失败');
        return null;
      }
    },

    // 删除文档分类
    *handleDeleteDocCategory(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(docService.deleteDocCategory, { id: payload });
        yield put({ type: 'removeDocCategory', payload });
        message.success('分类删除成功');
        return true;
      } catch (e: any) {
        message.error(e?.message || '分类删除失败');
        return false;
      }
    },

    // 批量删除文档分类
    *handleBatchDeleteDocCategories(
      { payload }: { payload: (number | string)[] },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(docService.batchDeleteDocCategories, { ids: payload });
        // 批量删除后重新获取列表
        yield put({ type: 'fetchDocCategoryList' });
        message.success('批量删除成功');
        return true;
      } catch (e: any) {
        message.error(e?.message || '批量删除失败');
        return false;
      }
    },

    // 批量移动文档分类
    *handleBatchMoveDocCategories(
      { payload }: { payload: { ids: (number | string)[]; target_parent_id: number | string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(docService.batchMoveDocCategories, payload);
        // 批量移动后重新获取列表
        yield put({ type: 'fetchDocCategoryList' });
        message.success('批量移动成功');
        return true;
      } catch (e: any) {
        message.error(e?.message || '批量移动失败');
        return false;
      }
    },

    // 保存文档分类排序
    *handleSaveDocCategorySort(
      { payload }: { payload: any[] },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(docService.saveDocCategorySort, { sorts: payload });
        // 排序保存后重新获取列表
        yield put({ type: 'fetchDocCategoryList' });
        message.success('排序保存成功');
        return true;
      } catch (e: any) {
        message.error(e?.message || '排序保存失败');
        return false;
      }
    },

    // ==================== 获取文集下的文档列表 ====================
    *fetchProjectDocs(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docService.getProjectDocs, { id: payload });
        yield put({ type: 'saveDocList', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('加载文档列表失败');
        return [];
      }
    },

    // ==================== 获取文档详情（含指定版本 content，version 可选） ====================
    *fetchDocDetail(
      { payload }: { payload: number | { id: number; version?: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'startLoading' });
      try {
        // 兼容 number 和 { id, version } 两种传参
        const params = typeof payload === 'number' ? { id: payload } : payload;
        const res = yield call(docService.getDocDetail, params);
        yield put({ type: 'saveCurrentDoc', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('加载文档详情失败');
        return null;
      } finally {
        yield put({ type: 'stopLoading' });
      }
    },

    // ==================== 获取文集下所有文档的版本列表 ====================
    *fetchDocVersions(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'startLoading' });
      try {
        const res = yield call(docService.getDocVersions, {
          projectId: payload,
        });
        yield put({ type: 'saveDocVersions', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('加载文档版本失败');
        return [];
      } finally {
        yield put({ type: 'stopLoading' });
      }
    },

    // ==================== 保存文档内容（更新当前版本） ====================
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
        const res = yield call(docService.saveVersionContent, {
          versionId: payload.versionId,
          content: payload.content,
        });
        message.success('保存成功');
        // 重新获取文档详情和版本列表
        yield put({ type: 'fetchDocDetail', payload: payload.docId });
        yield put({
          type: 'fetchDocVersions',
          payload: payload.projectId || 1,
        });
        return res;
      } catch (e) {
        message.error('保存失败');
        return null;
      }
    },

    // ==================== 保存版本大纲 ====================
    *saveDocVersionOutline(
      { payload }: { payload: { versionId: number; outline: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docService.updateDocVersion, payload);
        message.success('大纲保存成功');
        // 更新本地版本数据中的 outline 字段
        yield put({ type: 'updateDocVersionOutline', payload: res.data });
        return res;
      } catch (e) {
        message.error('大纲保存失败');
        return null;
      }
    },

    // ==================== 新建文档 ====================
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
        const res = yield call(docService.createDoc, payload);
        yield put({ type: 'upsertDoc', payload: res.data });
        message.success('文档创建成功');
        return res.data;
      } catch (e) {
        message.error('文档创建失败');
        return null;
      }
    },

    // ==================== 编辑文档（重命名/移动分类/更新副标题等） ====================
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
        const res = yield call(docService.updateDoc, updateData);
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

    // ==================== 删除文档 ====================
    *handleDeleteDoc(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(docService.deleteDoc, { id: payload });
        yield put({ type: 'removeDoc', payload });
        message.success('文档删除成功');
        return true;
      } catch (e) {
        message.error('文档删除失败');
        return false;
      }
    },

    // ==================== 新建版本 ====================
    *createDocVersion(
      {
        payload,
      }: {
        payload: {
          id: number;
          content: string;
          remark?: string;
          version_name?: string;
        };
      },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docService.createDocVersion, payload);
        message.success('新版本创建成功');
        // 重新获取版本列表
        yield put({ type: 'fetchDocVersions', payload: 1 });
        return res;
      } catch (e) {
        message.error('创建版本失败');
        return null;
      }
    },

    // ==================== 新建版本（版本对比编辑模式使用） ====================
    *handleCreateDocVersion(
      {
        payload,
      }: {
        payload: {
          doc_id: number;
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
        const { doc_id, ...data } = payload;
        const res = yield call(docService.createDocVersion, {
          id: doc_id,
          ...data,
        });
        message.success(`新版本 ${payload.version} 创建成功`);
        // 重新获取版本列表
        yield put({ type: 'fetchDocVersions', payload: doc_id });
        return res.data;
      } catch (e) {
        message.error('创建新版本失败');
        return null;
      }
    },

    // ==================== 设置当前版本 ====================
    *handleSetCurrentDocVersion(
      { payload }: { payload: number },
      { call }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docService.setCurrentVersion, {
          versionId: payload,
        });
        message.success('已设置为当前版本');
        return res.data;
      } catch (e) {
        message.error('设置当前版本失败');
        return null;
      }
    },

    // ==================== 回滚版本（将该版本内容复制到当前版本） ====================
    *handleRollbackDocVersion(
      { payload }: { payload: number },
      { call, put, select }: any,
    ): Generator<any, any, any> {
      try {
        // 先获取该版本的内容
        const { docVersions } = yield select((state: any) => state.doc);
        const version = docVersions.find((v: DocVersion) => v.id === payload);
        if (!version) {
          message.error('版本不存在');
          return null;
        }
        // 创建新版本作为回滚
        const res = yield call(docService.createDocVersion, {
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

    // ==================== AI 大纲 ====================
    *fetchAiOutline(
      { payload }: { payload: number },
      { call, put }: any,
    ): Generator<any, void, any> {
      try {
        const res = yield call(docService.getAiOutline, { id: payload });
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
        const res = yield call(docService.generateAiOutline, { id: payload });
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
        const res = yield call(docService.saveAiOutline, payload);
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

    // ==================== 文档批注 ====================

    // 获取版本的批注列表
    *fetchDocAnnotations(
      { payload }: { payload: { versionId: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'startLoading' });
      try {
        const res = yield call(docService.getDocAnnotations, payload);
        yield put({ type: 'saveDocAnnotations', payload: res.data || [] });
        return res.data || [];
      } catch (e) {
        message.error('获取批注列表失败');
        return [];
      } finally {
        yield put({ type: 'stopLoading' });
      }
    },

    // 添加批注（同时保存带标记的原文）
    *addDocAnnotation(
      {
        payload,
      }: {
        payload: {
          versionId: number;
          marker_id: number;
          content: string;
          content_with_marker: string;
          author_id?: number;
          author_name?: string;
        };
      },
      { call, put, select }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setAnnotationSaving', payload: true });
      try {
        const res = yield call(docService.addDocAnnotation, payload);
        if (res.success && res.data) {
          yield put({
            type: 'addAnnotationToList',
            payload: res.data.annotation,
          });

          // 【修复】保存批注后，后端也会更新版本内容
          // 同步更新前端 docVersions 状态，避免添加第二个批注时使用旧内容
          if (res.data.content) {
            const docVersions = yield select((state: any) => state.doc.docVersions);
            const updatedVersions = docVersions.map((v: any) =>
              v.id === payload.versionId ? { ...v, content: res.data.content } : v,
            );
            yield put({ type: 'saveDocVersions', payload: updatedVersions });

            // 同时更新 currentDoc.current_version
            const currentDoc = yield select((state: any) => state.doc.currentDoc);
            if (currentDoc?.current_version?.id === payload.versionId) {
              yield put({
                type: 'saveCurrentDoc',
                payload: {
                  ...currentDoc,
                  current_version: { ...currentDoc.current_version, content: res.data.content },
                },
              });
            }
          }

          message.success('批注添加成功');
          return res.data;
        }
        message.error('批注添加失败');
        return null;
      } catch (e) {
        message.error('批注添加失败');
        return null;
      } finally {
        yield put({ type: 'setAnnotationSaving', payload: false });
      }
    },

    // 更新批注
    *updateDocAnnotation(
      { payload }: { payload: { id: number; content: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setAnnotationSaving', payload: true });
      try {
        const res = yield call(docService.updateDocAnnotation, payload);
        if (res.success && res.data) {
          yield put({ type: 'updateAnnotationInList', payload: res.data });
          message.success('批注更新成功');
          return res.data;
        }
        message.error('批注更新失败');
        return null;
      } catch (e) {
        message.error('批注更新失败');
        return null;
      } finally {
        yield put({ type: 'setAnnotationSaving', payload: false });
      }
    },

    // 删除批注（同时删除原文中的标记）
    *deleteDocAnnotation(
      { payload }: { payload: { id: number; content_without_marker?: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setAnnotationSaving', payload: true });
      try {
        const res = yield call(docService.deleteDocAnnotation, payload);
        if (res.success) {
          yield put({ type: 'removeAnnotationFromList', payload: payload.id });
          message.success('批注删除成功');
          return res.data;
        }
        message.error('批注删除失败');
        return null;
      } catch (e) {
        message.error('批注删除失败');
        return null;
      } finally {
        yield put({ type: 'setAnnotationSaving', payload: false });
      }
    },

    // 保存版本原文（带标记，同时检测孤立批注）
    *saveVersionContent(
      { payload }: { payload: { versionId: number; content: string } },
      { call, put, select }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docService.saveVersionContent, payload);
        if (res.success) {
          // 【修复】保存成功后，同步更新前端 docVersions 状态
          // 避免 currentVersion.content 仍是旧内容，导致 MDXEditor 显示不对
          const docVersions = yield select((state: any) => state.doc.docVersions);
          const updatedVersions = docVersions.map((v: any) =>
            v.id === payload.versionId ? { ...v, content: payload.content } : v,
          );
          yield put({ type: 'saveDocVersions', payload: updatedVersions });

          // 同时更新 currentDoc.current_version（如果存在）
          const currentDoc = yield select((state: any) => state.doc.currentDoc);
          if (currentDoc?.current_version?.id === payload.versionId) {
            yield put({
              type: 'saveCurrentDoc',
              payload: {
                ...currentDoc,
                current_version: { ...currentDoc.current_version, content: payload.content },
              },
            });
          }

          return res.data;
        }
        return null;
      } catch (e) {
        message.error('原文保存失败');
        return null;
      }
    },
  },
};
