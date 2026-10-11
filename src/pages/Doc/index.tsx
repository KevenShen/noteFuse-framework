// src/pages/Doc/index.tsx
// 文档详情页 - 组件自治架构（深度优化版）
// 页面组件仅负责布局和页面级事件，所有 UI 状态由 doc model 管理
// clientLoader：页面渲染前并行预加载详情页数据，通过 useClientLoaderSync 同步到 model
import { type MDXEditorRef } from '@/components/MDXEditor';
import {
  useClientLoaderSync,
  useMergedState,
  useShallowSelector,
} from '@/hooks';
import ProjectDocDetailLayout from '@/layouts/ProjectDocDetailLayout';
import {
  getDocDetail,
  getProjectDetail,
  getProjectDocCategories,
  getProjectDocVersions,
  getProjectDocs,
} from '@/services';
import {
  FolderOpenOutlined,
  UnorderedListOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons';
import { history, useClientLoaderData, useDispatch } from '@umijs/max';
import { useSetState } from 'ahooks';
import { FloatButton, Modal, Space, Tag, message } from 'antd';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  AddAnnotationModal,
  DocContent,
  DocRightPanel,
  DocSidebar,
  DocToolbar,
} from './components';
import './index.less';
import type { AnchorItem } from './types';
import {
  filterMarkers,
  generateMarkerId,
  insertMarkerAfterLineInContentWithMarkers,
  removeMarker,
  type AnnotationItem,
} from './utils/annotationUtils';

// ==================== clientLoader：页面渲染前并行预加载详情页数据 ====================

export async function clientLoader() {
  const EMPTY_DATA = {
    currentProject: null,
    currentDoc: null,
    docCategoryList: [],
    docList: [],
    docVersions: [],
  };
  const extractData = (res: any) => (res?.data !== undefined ? res.data : res);
  const pathname = history.location.pathname;
  const search = history.location.search;
  const docId = Number(pathname.split('/').pop() || 0);
  const searchParams = new URLSearchParams(search);
  const projectId = Number(searchParams.get('project_id') || 0);
  const versionId = searchParams.get('version');

  if (!docId || !projectId) return EMPTY_DATA;

  try {
    const [projectRes, docRes, categoriesRes, docsRes, versionsRes] =
      await Promise.all([
        getProjectDetail({ id: projectId }),
        getDocDetail(
          versionId ? { id: docId, version: Number(versionId) } : { id: docId },
        ),
        getProjectDocCategories({ id: projectId }),
        getProjectDocs({ id: projectId }),
        getProjectDocVersions({ id: projectId }),
      ]);
    return {
      currentProject: extractData(projectRes),
      currentDoc: extractData(docRes),
      docCategoryList: extractData(categoriesRes) || [],
      docList: extractData(docsRes) || [],
      docVersions: extractData(versionsRes) || [],
    };
  } catch {
    return EMPTY_DATA;
  }
}

const DocPage: React.FC = () => {
  const dispatch = useDispatch();

  // 从路径 /doc/:id 解析 id
  const docId = Number(location.pathname.split('/').pop() || '1');
  const searchParams = new URLSearchParams(location.search);
  const projectId = searchParams.get('project_id') || '1';
  const versionId = searchParams.get('version');

  // ==================== Dva Hooks：从 model 获取所有状态 ====================
  const {
    loading,
    // 数据状态
    currentDoc: modelCurrentDoc,
    docList: modelDocList,
    docVersions: modelDocVersions,
    docAnnotations,
    readMode,
    // 批注编辑状态
    annotationEditMode,
    editingAnnotation,
    annotationContent,
    originalContentBeforeEdit,
    newAnnotationMarkerId,
    // 阅读模式状态
    outlineMode,
    outlineContent,
    versionOverviewMode,
    focusMode,
    focusAnchor,
    activeAnchor,
    // 右面板状态
    activeTab,
    collected,
  } = useShallowSelector((state: any) => ({
    loading: state.docDetail.loading,
    currentDoc: state.docDetail.currentDoc,
    docList: state.docList.docList,
    docVersions: state.docVersions.docVersions,
    docAnnotations: state.docAnnotations.docAnnotations,
    readMode: state.docDetail.readMode,
    annotationEditMode: state.docAnnotations.annotationEditMode,
    editingAnnotation: state.docAnnotations.editingAnnotation,
    annotationContent: state.docAnnotations.annotationContent,
    originalContentBeforeEdit: state.docAnnotations.originalContentBeforeEdit,
    newAnnotationMarkerId: state.docAnnotations.newAnnotationMarkerId,
    outlineMode: state.docDetail.outlineMode,
    outlineContent: state.docDetail.outlineContent,
    versionOverviewMode: state.docDetail.versionOverviewMode,
    focusMode: state.docDetail.focusMode,
    focusAnchor: state.docDetail.focusAnchor,
    activeAnchor: state.docDetail.activeAnchor,
    activeTab: state.docDetail.activeTab,
    collected: state.docDetail.collected,
  }));

  const { currentProject: modelCurrentProject } = useShallowSelector(
    (state: any) => ({
      currentProject: state.projectDetail.currentProject,
    }),
  );

  // useClientLoaderData 返回 { data: clientLoader返回值 }
  const { data: clientLoaderData } = useClientLoaderData() as {
    data: {
      currentProject: any;
      docCategoryList: any[];
      docList: any[];
      docVersions: any[];
      currentDoc: any;
    };
  };

  // ==================== 合并数据：优先 model，兜底 clientLoader ====================
  const currentProject = useMergedState({
    modelData: modelCurrentProject,
    loaderData: clientLoaderData?.currentProject,
  });

  const docList = useMergedState({
    modelData: modelDocList,
    loaderData: clientLoaderData?.docList,
  });

  const docVersions = useMergedState({
    modelData: modelDocVersions,
    loaderData: clientLoaderData?.docVersions,
  });

  const currentDoc = useMemo(() => {
    // 合并 model 数据和 clientLoader 数据，确保字段完整（如 version_overview）
    if (modelCurrentDoc && clientLoaderData?.currentDoc) {
      return { ...clientLoaderData.currentDoc, ...modelCurrentDoc };
    }
    return modelCurrentDoc || clientLoaderData?.currentDoc || null;
  }, [modelCurrentDoc, clientLoaderData]);

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  useClientLoaderSync({
    clientLoaderData,
    actionType: 'docDetail/saveDocDetailInitialData',
    mapData: (data) => ({
      categories: data.docCategoryList,
      docs: data.docList,
      versions: data.docVersions,
      currentDoc: data.currentDoc,
    }),
    hasData: (data) => !!data?.currentDoc || !!data?.docList?.length,
  });

  useClientLoaderSync({
    clientLoaderData,
    actionType: 'projectDetail/saveCurrentProject',
    mapData: (data) => data.currentProject,
    hasData: (data) => !!data?.currentProject,
  });

  // ==================== 页面级 UI 状态（仅保留布局相关） ====================
  const [state, setState] = useSetState({
    showRightPanel: false,
    isFullscreen: false,
    addAnnotationModalOpen: false,
  });
  const { showRightPanel, isFullscreen, addAnnotationModalOpen } = state;

  const markdownDocRef = useRef<MDXEditorRef>(null);
  const isProgramScrollingRef = useRef(false);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeAnchorRef = useRef(activeAnchor);
  activeAnchorRef.current = activeAnchor;
  const focusModeRef = useRef(focusMode);
  focusModeRef.current = focusMode;

  // ==================== 大纲内容加载 ====================
  // 【优化】从 API 返回的 current_version.outline 获取大纲数据，不再硬编码
  // 优先级：localStorage（用户编辑过的）> API 返回的版本大纲 > 空字符串
  useEffect(() => {
    try {
      const OUTLINE_STORAGE_KEY = `doc-editor-outline-${docId}`;
      const stored = localStorage.getItem(OUTLINE_STORAGE_KEY);
      if (stored) {
        // 用户本地编辑过的大纲优先
        dispatch({ type: 'docDetail/setOutlineContent', payload: stored });
      } else if (modelCurrentDoc?.current_version?.outline) {
        // 从 API 获取的版本大纲
        dispatch({
          type: 'docDetail/setOutlineContent',
          payload: modelCurrentDoc.current_version.outline,
        });
      } else {
        // 没有大纲数据，使用空字符串
        dispatch({ type: 'docDetail/setOutlineContent', payload: '' });
      }
    } catch (e) {
      console.error('加载文档大纲失败:', e);
    }
  }, [docId, dispatch, modelCurrentDoc?.current_version?.outline]);

  // ==================== 全屏监听 ====================
  useEffect(() => {
    const handleFullscreenChange = () => {
      setState({ isFullscreen: !!document.fullscreenElement });
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ==================== 当前版本（从 docVersions 扁平化列表中查找） ====================
  const currentVersion = useMemo(() => {
    if (!docVersions || docVersions.length === 0) return null;
    // 优先找指定版本，否则找当前版本
    if (versionId) {
      return docVersions.find((v: any) => v.id === Number(versionId)) || null;
    }
    return (
      docVersions.find((v: any) => v.doc_id === docId && v.is_current) || null
    );
  }, [docVersions, docId, versionId]);

  // ==================== 批注数据（当前版本的批注列表） ====================
  useEffect(() => {
    if (currentVersion?.id) {
      dispatch({
        type: 'docAnnotations/fetchDocAnnotations',
        payload: { versionId: currentVersion.id },
      });
    }
  }, [currentVersion?.id, dispatch]);

  // ==================== 批注操作（使用 model 状态） ====================

  // 添加批注：打开选择批注位置的弹窗
  const handleAddAnnotation = () => {
    setState({ addAnnotationModalOpen: true });
  };

  // 确认添加批注：在选中行后插入标记，创建空批注，切换到编辑模式
  const handleConfirmAddAnnotation = async (lineIndex: number) => {
    if (!currentVersion?.id) return;

    // 1. 生成新标记 ID
    const markerId = generateMarkerId(docAnnotations || []);

    // 2. 在包含所有标记的原文中插入新标记
    // 【修复】使用 insertMarkerAfterLineInContentWithMarkers，保留已有批注的标记
    // lineIndex 是纯原文（AddAnnotationModal 中显示）的行索引
    // 函数内部会跳过标记行，找到对应的位置插入新标记
    const contentWithMarker = insertMarkerAfterLineInContentWithMarkers(
      currentVersion.content || '',
      lineIndex,
      markerId,
    );

    // 4. 保存带标记的原文
    await dispatch({
      type: 'docAnnotations/saveVersionContent',
      payload: { versionId: currentVersion.id, content: contentWithMarker },
    });

    // 5. 创建空批注（先在本地创建，后续保存时调用 API）
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

    // 6. 保存状态到 model
    dispatch({
      type: 'docAnnotations/setOriginalContentBeforeEdit',
      payload: contentWithMarker,
    });
    dispatch({
      type: 'docAnnotations/setNewAnnotationMarkerId',
      payload: markerId,
    });
    dispatch({
      type: 'docAnnotations/setEditingAnnotation',
      payload: newAnnotation,
    });
    dispatch({ type: 'docAnnotations/setAnnotationContent', payload: '' });
    dispatch({ type: 'docAnnotations/setAnnotationEditMode', payload: true });

    // 7. 关闭弹窗
    setState({ addAnnotationModalOpen: false });

    // 8. 自动切换到批注模式
    dispatch({ type: 'docDetail/setReadMode', payload: 'annotation' });
  };

  // 保存批注
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

  // 取消批注编辑
  const handleCancelAnnotationEdit = () => {
    // 如果是新批注，需要恢复原文（删除标记）
    if (
      newAnnotationMarkerId !== null &&
      currentVersion?.id &&
      originalContentBeforeEdit
    ) {
      // 从原文中删除标记
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

  // 编辑已有批注
  const handleEditAnnotation = (annotation: AnnotationItem) => {
    dispatch({
      type: 'docAnnotations/setEditingAnnotation',
      payload: annotation,
    });
    dispatch({
      type: 'docAnnotations/setAnnotationContent',
      payload: annotation.content,
    });
    dispatch({ type: 'docAnnotations/setAnnotationEditMode', payload: true });
    dispatch({
      type: 'docAnnotations/setNewAnnotationMarkerId',
      payload: null,
    });
  };

  // 删除批注
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

  // 跳转到批注位置
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

  // ==================== 锚点提取 ====================
  const anchors = useMemo<AnchorItem[]>(() => {
    const content = outlineMode
      ? outlineContent
      : currentVersion?.content || currentDoc?.content;
    if (!content) return [];
    const lines = content.split('\n');
    const result: AnchorItem[] = [];
    lines.forEach((line: string, index: number) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        result.push({
          key: `heading-${index}`,
          title: match[2],
          level: match[1].length,
        });
      }
    });
    return result;
  }, [
    currentVersion?.content,
    currentDoc?.content,
    outlineMode,
    outlineContent,
  ]);

  // ==================== 滚动监听（更新当前锚点） ====================
  useEffect(() => {
    const container = document.querySelector('.doc-content');
    if (!container) return;

    const headingElements = anchors
      .map((a) => document.getElementById(a.key))
      .filter(Boolean) as HTMLElement[];
    let ticking = false;

    const handleScroll = () => {
      if (isProgramScrollingRef.current) return;
      if (focusModeRef.current) return;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollTop = container.scrollTop;
          let current = '';
          for (let i = headingElements.length - 1; i >= 0; i--) {
            const el = headingElements[i];
            if (el.offsetTop - 100 <= scrollTop) {
              current = anchors[i].key;
              break;
            }
          }
          if (current && current !== activeAnchorRef.current) {
            dispatch({ type: 'docDetail/setActiveAnchor', payload: current });
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [anchors, dispatch]);

  // ==================== 上一篇/下一篇 ====================
  const { prev, next } = useMemo(() => {
    const allDocs = [...(docList || [])].sort((a, b) => a.sort - b.sort);
    const currentIndex = allDocs.findIndex((d) => d.id === docId);
    return {
      prev:
        currentIndex > 0
          ? {
              key: String(allDocs[currentIndex - 1].id),
              title: allDocs[currentIndex - 1].name,
            }
          : null,
      next:
        currentIndex < allDocs.length - 1 && currentIndex >= 0
          ? {
              key: String(allDocs[currentIndex + 1].id),
              title: allDocs[currentIndex + 1].name,
            }
          : null,
    };
  }, [docList, docId]);

  // ==================== 页面级事件 ====================

  // 选择文档（路由跳转）
  const handleSelectDoc = (id: number) => {
    // 切换文档时重置阅读模式状态
    dispatch({ type: 'docDetail/setFocusMode', payload: false });
    dispatch({ type: 'docDetail/setFocusAnchor', payload: '' });
    dispatch({ type: 'docDetail/setActiveAnchor', payload: '' });
    history.push(`/doc/${id}?project_id=${projectId}`);
  };

  // 锚点点击
  const handleAnchorClick = (anchor: AnchorItem) => {
    dispatch({ type: 'docDetail/setActiveAnchor', payload: anchor.key });
    if (focusMode) {
      dispatch({ type: 'docDetail/setFocusAnchor', payload: anchor.title });
    } else {
      isProgramScrollingRef.current = true;
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      markdownDocRef.current?.scrollToAnchor(anchor.title, 60);
      scrollTimerRef.current = setTimeout(() => {
        isProgramScrollingRef.current = false;
      }, 800);
    }
  };

  // 返回文集概览
  const handleBackToProject = () => {
    history.push(`/projectDetail/${projectId}`);
  };

  // 获取滚动容器
  const getScrollContainer = () =>
    (document.querySelector('.doc-content') as HTMLElement) || window;

  // ==================== 页面布局 ====================
  return (
    <>
      <ProjectDocDetailLayout
        sidebarTitle={
          <Space size={8}>
            <FolderOpenOutlined style={{ color: '#1890ff' }} />
            <span>{currentProject?.name || '文集'}</span>
            <Tag color="blue" variant="outlined">
              浏览
            </Tag>
          </Space>
        }
        sidebarContent={
          <DocSidebar
            currentDocId={docId}
            currentVersionId={versionId ? Number(versionId) : undefined}
            projectId={Number(projectId)}
            onSelectDoc={handleSelectDoc}
          />
        }
        onTitleClick={handleBackToProject}
        onBack={handleBackToProject}
        onCreate={() =>
          history.push(`/docEdit/${docId}?project_id=${projectId}`)
        }
        onSettings={() => history.push(`/project/${projectId}/settings`)}
        showRightPanel={showRightPanel}
        rightPanelWidth={280}
        rightPanel={
          <DocRightPanel
            anchors={anchors}
            docId={docId}
            projectId={Number(projectId)}
            onClose={() => setState({ showRightPanel: false })}
            onAnchorClick={handleAnchorClick}
            onJumpToAnnotation={handleJumpToAnnotation}
            onEditAnnotation={handleEditAnnotation}
            onDeleteAnnotation={handleDeleteAnnotation}
            onAddAnnotation={handleAddAnnotation}
          />
        }
        toolbarExtra={
          <DocToolbar
            docId={docId}
            projectId={Number(projectId)}
            onAddAnnotation={handleAddAnnotation}
          />
        }
        defaultFontSize={14}
      >
        <DocContent
          doc={currentDoc}
          currentVersion={currentVersion}
          loading={loading}
          prevDoc={prev}
          nextDoc={next}
          markdownDocRef={markdownDocRef}
          onSelectDoc={handleSelectDoc}
          onSaveAnnotation={handleSaveAnnotation}
          onCancelAnnotationEdit={handleCancelAnnotationEdit}
          onEditAnnotation={handleEditAnnotation}
          onDeleteAnnotation={handleDeleteAnnotation}
        />

        {/* 悬浮按钮 */}
        <>
          {/* 全屏时只显示返回顶部 */}
          {isFullscreen && (
            <FloatButton.BackTop
              visibilityHeight={200}
              icon={<VerticalAlignTopOutlined />}
              tooltip="返回顶部"
              style={{ right: 16, bottom: 24, zIndex: 9999 }}
              target={getScrollContainer}
            />
          )}

          {/* PC端悬浮按钮：右面板隐藏时显示唤起按钮 */}
          {!isFullscreen && !showRightPanel && (
            <FloatButton
              icon={<UnorderedListOutlined />}
              tooltip="显示工具坞"
              style={{ right: 24, bottom: 24, zIndex: 9999 }}
              onClick={() => setState({ showRightPanel: true })}
            />
          )}

          {/* 返回顶部按钮 */}
          {!isFullscreen && (
            <FloatButton.BackTop
              visibilityHeight={200}
              icon={<VerticalAlignTopOutlined />}
              tooltip="返回顶部"
              style={{ right: 24, bottom: 80, zIndex: 9999 }}
              target={getScrollContainer}
            />
          )}
        </>
      </ProjectDocDetailLayout>

      {/* 添加批注弹窗 */}
      <AddAnnotationModal
        open={addAnnotationModalOpen}
        content={filterMarkers(currentVersion?.content || '')}
        onCancel={() => setState({ addAnnotationModalOpen: false })}
        onConfirm={handleConfirmAddAnnotation}
      />
    </>
  );
};

export default DocPage;
