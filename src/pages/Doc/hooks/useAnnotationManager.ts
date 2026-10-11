// src/pages/Doc/hooks/useAnnotationManager.ts
// 批注管理 Hook：封装所有批注相关的状态读取与操作函数
// 组件内直接使用，无需从页面传递大量 props
import { useShallowSelector } from '@/hooks';
import { useDispatch } from '@umijs/max';
import { Modal, message } from 'antd';
import { useEffect, useMemo } from 'react';
import {
  filterMarkers,
  generateMarkerId,
  insertMarkerAfterLineInContentWithMarkers,
  removeMarker,
  type AnnotationItem,
} from '../utils/annotationUtils';

/**
 * 批注管理 Hook
 * @param docId 当前文档 ID
 * @param versionId 当前版本 ID（可选，不传则使用当前版本）
 */
export function useAnnotationManager(docId: number, versionId?: string) {
  const dispatch = useDispatch();

  // ==================== 从 Dva model 读取批注状态 ====================
  const {
    docAnnotations,
    annotationEditMode,
    editingAnnotation,
    annotationContent,
    originalContentBeforeEdit,
    newAnnotationMarkerId,
    readMode,
    docVersions,
  } = useShallowSelector((state: any) => ({
    docAnnotations: state.docAnnotations.docAnnotations,
    annotationEditMode: state.docAnnotations.annotationEditMode,
    editingAnnotation: state.docAnnotations.editingAnnotation,
    annotationContent: state.docAnnotations.annotationContent,
    originalContentBeforeEdit: state.docAnnotations.originalContentBeforeEdit,
    newAnnotationMarkerId: state.docAnnotations.newAnnotationMarkerId,
    readMode: state.docDetail.readMode,
    docVersions: state.docVersions.docVersions,
  }));

  // ==================== 当前版本（从 docVersions 扁平化列表中查找） ====================
  const currentVersion = useMemo(() => {
    if (!docVersions || docVersions.length === 0) return null;
    if (versionId) {
      return docVersions.find((v: any) => v.id === Number(versionId)) || null;
    }
    return (
      docVersions.find((v: any) => v.doc_id === docId && v.is_current) || null
    );
  }, [docVersions, docId, versionId]);

  // ==================== 批注数据自动获取（当前版本的批注列表） ====================
  useEffect(() => {
    if (currentVersion?.id) {
      dispatch({
        type: 'docAnnotations/fetchDocAnnotations',
        payload: { versionId: currentVersion.id },
      });
    }
  }, [currentVersion?.id, dispatch]);

  // ==================== 批注操作函数 ====================

  /** 确认添加批注：在选中行后插入标记，创建空批注，切换到编辑模式 */
  const handleConfirmAddAnnotation = async (lineIndex: number) => {
    if (!currentVersion?.id) return;

    // 1. 生成新标记 ID
    const markerId = generateMarkerId(docAnnotations || []);

    // 2. 在包含所有标记的原文中插入新标记
    const contentWithMarker = insertMarkerAfterLineInContentWithMarkers(
      currentVersion.content || '',
      lineIndex,
      markerId,
    );

    // 3. 保存带标记的原文
    await dispatch({
      type: 'docAnnotations/saveVersionContent',
      payload: { versionId: currentVersion.id, content: contentWithMarker },
    });

    // 4. 创建空批注（先在本地创建，后续保存时调用 API）
    const newAnnotation: AnnotationItem = {
      id: Date.now(),
      version_id: currentVersion.id,
      marker_id: markerId,
      author_id: 1,
      author_name: 'admin',
      created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
      updated_at: new Date().toLocaleString('zh-CN', { hour12: false }),
      is_orphan: false,
      content: '',
    };

    // 5. 保存状态到 model
    dispatch({
      type: 'docAnnotations/setOriginalContentBeforeEdit',
      payload: contentWithMarker,
    });
    dispatch({ type: 'docAnnotations/setNewAnnotationMarkerId', payload: markerId });
    dispatch({ type: 'docAnnotations/setEditingAnnotation', payload: newAnnotation });
    dispatch({ type: 'docAnnotations/setAnnotationContent', payload: '' });
    dispatch({ type: 'docAnnotations/setAnnotationEditMode', payload: true });

    // 6. 自动切换到批注模式
    dispatch({ type: 'docDetail/setReadMode', payload: 'annotation' });
  };

  /** 保存批注 */
  const handleSaveAnnotation = async () => {
    if (!currentVersion?.id || !editingAnnotation) return;

    if (newAnnotationMarkerId !== null) {
      // 新批注：调用添加批注 API
      await dispatch({
        type: 'docAnnotations/addDocAnnotation',
        payload: {
          versionId: currentVersion.id,
          marker_id: newAnnotationMarkerId,
          content: annotationContent,
          content_with_marker: originalContentBeforeEdit,
        },
      });
    } else {
      // 已有批注：调用更新批注 API
      await dispatch({
        type: 'docAnnotations/updateDocAnnotation',
        payload: {
          id: editingAnnotation.id,
          content: annotationContent,
        },
      });
    }

    // 重置批注编辑状态
    dispatch({ type: 'docAnnotations/resetAnnotationEditState' });
  };

  /** 取消批注编辑 */
  const handleCancelAnnotationEdit = () => {
    // 如果是新批注，需要恢复原文（删除标记）
    if (
      newAnnotationMarkerId !== null &&
      currentVersion?.id &&
      originalContentBeforeEdit
    ) {
      const restoredContent = removeMarker(
        originalContentBeforeEdit,
        newAnnotationMarkerId,
      );
      dispatch({
        type: 'docAnnotations/saveVersionContent',
        payload: { versionId: currentVersion.id, content: restoredContent },
      });
    }

    // 重置批注编辑状态
    dispatch({ type: 'docAnnotations/resetAnnotationEditState' });
  };

  /** 编辑已有批注 */
  const handleEditAnnotation = (annotation: AnnotationItem) => {
    dispatch({ type: 'docAnnotations/setEditingAnnotation', payload: annotation });
    dispatch({ type: 'docAnnotations/setAnnotationContent', payload: annotation.content });
    dispatch({ type: 'docAnnotations/setAnnotationEditMode', payload: true });
    dispatch({ type: 'docAnnotations/setNewAnnotationMarkerId', payload: null });
  };

  /** 删除批注 */
  const handleDeleteAnnotation = (annotation: AnnotationItem) => {
    Modal.confirm({
      title: '确认删除批注',
      content: '删除后将同时移除原文中的标记，此操作不可恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        if (!currentVersion?.id) return;

        // 1. 从原文中删除对应标记
        const contentWithoutMarker = removeMarker(
          currentVersion.content || '',
          annotation.marker_id,
        );

        // 2. 调用删除批注 API（同时传递删除标记后的原文）
        await dispatch({
          type: 'docAnnotations/deleteDocAnnotation',
          payload: {
            id: annotation.id,
            content_without_marker: contentWithoutMarker,
          },
        });

        // 3. 刷新批注列表
        dispatch({
          type: 'docAnnotations/fetchDocAnnotations',
          payload: { versionId: currentVersion.id },
        });

        message.success('批注删除成功');
      },
    });
  };

  /** 跳转到批注位置 */
  const handleJumpToAnnotation = (annotation: AnnotationItem) => {
    // 1. 确保处于批注模式
    if (readMode !== 'annotation') {
      dispatch({ type: 'docDetail/setReadMode', payload: 'annotation' });
    }

    // 2. 等待渲染完成后，找到批注块元素
    setTimeout(() => {
      const annotationBlock = document.querySelector(
        `[data-annotation-id="${annotation.id}"]`,
      ) as HTMLElement | null;
      if (annotationBlock) {
        // 3. 滚动到可视区域
        annotationBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // 4. 高亮显示（添加临时高亮样式）
        annotationBlock.classList.add('annotation-highlight');
        setTimeout(() => {
          annotationBlock.classList.remove('annotation-highlight');
        }, 2000);
      }
    }, 100);
  };

  /** 获取过滤标记后的纯原文（用于 AddAnnotationModal 显示） */
  const getPureContent = () => filterMarkers(currentVersion?.content || '');

  return {
    // 状态
    currentVersion,
    docAnnotations,
    annotationEditMode,
    editingAnnotation,
    annotationContent,
    // 操作函数
    handleConfirmAddAnnotation,
    handleSaveAnnotation,
    handleCancelAnnotationEdit,
    handleEditAnnotation,
    handleDeleteAnnotation,
    handleJumpToAnnotation,
    getPureContent,
  };
}
