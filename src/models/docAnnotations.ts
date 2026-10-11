// src/models/docAnnotations.ts
// 文档批注 Dva Model
import type { MockDocAnnotation as DocAnnotation } from '@/../mock/Entities/doc';
import * as docAnnotationsService from '@/services/docAnnotations';
import * as docVersionsService from '@/services/docVersions';
import { message } from 'antd';

export interface DocAnnotationsState {
  /** 文档批注（内容嵌入标记版） */
  docAnnotations: DocAnnotation[];
  annotationSaving: boolean;
  /** 是否处于批注编辑模式 */
  annotationEditMode: boolean;
  /** 当前编辑的批注 */
  editingAnnotation: DocAnnotation | null;
  // ==================== 批注编辑状态（跨组件共享） ====================
  annotationContent: string;
  /** 编辑前的原文（用于取消时恢复） */
  originalContentBeforeEdit: string;
  /** 新批注的标记 ID */
  newAnnotationMarkerId: number | null;
}

const initialState: DocAnnotationsState = {
  docAnnotations: [],
  annotationSaving: false,
  annotationEditMode: false,
  editingAnnotation: null,
  annotationContent: '',
  originalContentBeforeEdit: '',
  newAnnotationMarkerId: null,
};

export default {
  namespace: 'docAnnotations',

  state: initialState,

  reducers: {
    saveDocAnnotations(
      state: DocAnnotationsState,
      { payload }: { payload: DocAnnotation[] },
    ) {
      state.docAnnotations = payload;
    },
    setAnnotationSaving(state: DocAnnotationsState, { payload }: { payload: boolean }) {
      state.annotationSaving = payload;
    },
    setAnnotationEditMode(state: DocAnnotationsState, { payload }: { payload: boolean }) {
      state.annotationEditMode = payload;
    },
    setEditingAnnotation(
      state: DocAnnotationsState,
      { payload }: { payload: DocAnnotation | null },
    ) {
      state.editingAnnotation = payload;
    },
    /** 添加批注到列表 */
    addAnnotationToList(
      state: DocAnnotationsState,
      { payload }: { payload: DocAnnotation },
    ) {
      state.docAnnotations.push(payload);
    },
    /** 更新列表中的批注 */
    updateAnnotationInList(
      state: DocAnnotationsState,
      { payload }: { payload: DocAnnotation },
    ) {
      const index = state.docAnnotations.findIndex((a) => a.id === payload.id);
      if (index !== -1) {
        state.docAnnotations[index] = payload;
      }
    },
    /** 从列表中删除批注 */
    removeAnnotationFromList(
      state: DocAnnotationsState,
      { payload }: { payload: number },
    ) {
      state.docAnnotations = state.docAnnotations.filter(
        (a) => a.id !== payload,
      );
    },
    setAnnotationContent(state: DocAnnotationsState, { payload }: { payload: string }) {
      state.annotationContent = payload;
    },
    setOriginalContentBeforeEdit(
      state: DocAnnotationsState,
      { payload }: { payload: string },
    ) {
      state.originalContentBeforeEdit = payload;
    },
    setNewAnnotationMarkerId(
      state: DocAnnotationsState,
      { payload }: { payload: number | null },
    ) {
      state.newAnnotationMarkerId = payload;
    },
    /** 重置批注编辑状态（保存/取消后调用） */
    resetAnnotationEditState(state: DocAnnotationsState) {
      state.annotationEditMode = false;
      state.editingAnnotation = null;
      state.annotationContent = '';
      state.originalContentBeforeEdit = '';
      state.newAnnotationMarkerId = null;
    },
  },

  effects: {
    /** 获取版本的批注列表 */
    *fetchDocAnnotations(
      { payload }: { payload: { versionId: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docAnnotationsService.getDocAnnotations, payload);
        yield put({ type: 'saveDocAnnotations', payload: res.data || [] });
        return res.data || [];
      } catch (e) {
        message.error('获取批注列表失败');
        return [];
      }
    },

    /** 添加批注（同时保存带标记的原文） */
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
        const res = yield call(docAnnotationsService.addDocAnnotation, payload);
        if (res.success && res.data) {
          yield put({
            type: 'addAnnotationToList',
            payload: res.data.annotation,
          });

          // 保存批注后，后端也会更新版本内容
          // 同步更新前端 docVersions 状态，避免添加第二个批注时使用旧内容
          if (res.data.content) {
            const docVersions = yield select((state: any) => state.docVersions.docVersions);
            const updatedVersions = docVersions.map((v: any) =>
              v.id === payload.versionId ? { ...v, content: res.data.content } : v,
            );
            yield put({ type: 'docVersions/saveDocVersions', payload: updatedVersions });

            // 同时更新 currentDoc.current_version
            const currentDoc = yield select((state: any) => state.docDetail.currentDoc);
            if (currentDoc?.current_version?.id === payload.versionId) {
              yield put({
                type: 'docDetail/saveCurrentDoc',
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

    /** 更新批注 */
    *updateDocAnnotation(
      { payload }: { payload: { id: number; content: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setAnnotationSaving', payload: true });
      try {
        const res = yield call(docAnnotationsService.updateDocAnnotation, payload);
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

    /** 删除批注（同时删除原文中的标记） */
    *deleteDocAnnotation(
      { payload }: { payload: { id: number; content_without_marker?: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setAnnotationSaving', payload: true });
      try {
        const res = yield call(docAnnotationsService.deleteDocAnnotation, payload);
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

    /** 保存版本原文（带标记，同时检测孤立批注） */
    *saveVersionContent(
      { payload }: { payload: { versionId: number; content: string } },
      { call, put, select }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(docVersionsService.saveVersionContent, payload);
        if (res.success) {
          // 保存成功后，同步更新前端 docVersions 状态
          // 避免 currentVersion.content 仍是旧内容，导致 MDXEditor 显示不对
          const docVersions = yield select((state: any) => state.docVersions.docVersions);
          const updatedVersions = docVersions.map((v: any) =>
            v.id === payload.versionId ? { ...v, content: payload.content } : v,
          );
          yield put({ type: 'docVersions/saveDocVersions', payload: updatedVersions });

          // 同时更新 currentDoc.current_version（如果存在）
          const currentDoc = yield select((state: any) => state.docDetail.currentDoc);
          if (currentDoc?.current_version?.id === payload.versionId) {
            yield put({
              type: 'docDetail/saveCurrentDoc',
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
