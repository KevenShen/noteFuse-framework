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
  getDocCategoriesByProjectId,
  getDocDetail,
  getProjectDetail,
  getProjectDocVersions,
  getProjectDocs,
} from '@/services';
import {
  FolderOpenOutlined,
  UnorderedListOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons';
import { history, useClientLoaderData, useDispatch, useLocation } from '@umijs/max';
import { useSetState } from 'ahooks';
import { FloatButton, Space, Tag } from 'antd';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  AddAnnotationModal,
  type AddAnnotationModalRef,
  DocContent,
  DocRightPanel,
  DocSidebar,
  DocToolbar,
} from './components';
import { useAnnotationManager } from './hooks/useAnnotationManager';
import './index.less';

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
  const pathname = window.location.pathname;
  const search = window.location.search;
  const docId = Number(pathname.split('/').pop() || 0);
  const searchParams = new URLSearchParams(search);
  const projectId = Number(searchParams.get('project_id') || 0);
  const versionId = searchParams.get('version');

  if (!docId || !projectId) return EMPTY_DATA;

  try {
    // 使用 Promise.allSettled：单个接口失败不影响其他数据
    // （如新文档暂无版本时 getDocDetail 可能失败，但文集/分类/文档列表仍需正常加载）
    const [projectRes, docRes, categoriesRes, docsRes, versionsRes] =
      await Promise.allSettled([
        getProjectDetail({ id: projectId }),
        getDocDetail(
          versionId ? { id: docId, version: Number(versionId) } : { id: docId },
        ),
        getDocCategoriesByProjectId({ projectId }),
        getProjectDocs({ id: projectId }),
        getProjectDocVersions({ id: projectId }),
      ]);
    return {
      currentProject:
        projectRes.status === 'fulfilled' ? extractData(projectRes.value) : null,
      currentDoc:
        docRes.status === 'fulfilled' ? extractData(docRes.value) : null,
      docCategoryList:
        categoriesRes.status === 'fulfilled'
          ? extractData(categoriesRes.value) || []
          : [],
      docList:
        docsRes.status === 'fulfilled' ? extractData(docsRes.value) || [] : [],
      docVersions:
        versionsRes.status === 'fulfilled'
          ? extractData(versionsRes.value) || []
          : [],
    };
  } catch {
    return EMPTY_DATA;
  }
}

const DocPage: React.FC = () => {
  const dispatch = useDispatch();
  const location = useLocation();

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
    collected,
  } = useShallowSelector((state: any) => ({
    loading: state.docDetail.loading,
    currentDoc: state.docDetail.currentDoc,
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

  const currentDoc = useMemo(() => {
    // getDocDetail 返回结构为 { doc: MockDoc, current_version, version_overview, ... }
    // 需要展平为 { ...MockDoc, current_version, version_overview, ... }
    const flattenDoc = (data: any) => {
      if (!data) return null;
      if (data.doc) {
        const { doc, ...rest } = data;
        return { ...doc, ...rest };
      }
      return data;
    };
    const flattenedModel = flattenDoc(modelCurrentDoc);
    const flattenedLoader = flattenDoc(clientLoaderData?.currentDoc);
    // 合并 model 数据和 clientLoader 数据，确保字段完整（如 version_overview）
    if (flattenedModel && flattenedLoader) {
      return { ...flattenedLoader, ...flattenedModel };
    }
    return flattenedModel || flattenedLoader || null;
  }, [modelCurrentDoc, clientLoaderData]);

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  // resetKey=docId：路由参数变化时重置同步状态，确保加载新文档的数据
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
    resetKey: docId,
  });

  useClientLoaderSync({
    clientLoaderData,
    actionType: 'projectDetail/saveCurrentProject',
    mapData: (data) => data.currentProject,
    hasData: (data) => !!data?.currentProject,
    resetKey: docId,
  });

  // ==================== 页面级 UI 状态（仅保留布局相关） ====================
  const [state, setState] = useSetState({
    showRightPanel: false,
    isFullscreen: false,
  });
  const { showRightPanel, isFullscreen } = state;

  // 添加批注弹窗 ref（组件自治 open 状态）
  const addAnnotationModalRef = useRef<AddAnnotationModalRef>(null);

  const markdownDocRef = useRef<MDXEditorRef>(null);

  // ==================== 批注管理（下沉到 hook，组件自治） ====================
  const {
    handleSaveAnnotation,
    handleCancelAnnotationEdit,
    handleEditAnnotation,
    handleDeleteAnnotation,
    handleJumpToAnnotation,
  } = useAnnotationManager(docId, versionId || undefined);

  // ==================== 全屏监听 ====================
  useEffect(() => {
    const handleFullscreenChange = () => {
      setState({ isFullscreen: !!document.fullscreenElement });
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ==================== 页面级事件 ====================

  // 选择文档（路由跳转）
  const handleSelectDoc = (id: number) => {
    // 切换文档时重置阅读模式状态
    dispatch({ type: 'docDetail/setFocusMode', payload: false });
    dispatch({ type: 'docDetail/setFocusAnchor', payload: '' });
    dispatch({ type: 'docDetail/setActiveAnchor', payload: '' });
    history.push(`/doc/${id}?project_id=${projectId}`);
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
            docId={docId}
            projectId={Number(projectId)}
            versionId={versionId}
            markdownDocRef={markdownDocRef}
            onClose={() => setState({ showRightPanel: false })}
            onJumpToAnnotation={handleJumpToAnnotation}
            onEditAnnotation={handleEditAnnotation}
            onDeleteAnnotation={handleDeleteAnnotation}
            onAddAnnotation={() => addAnnotationModalRef.current?.open()}
          />
        }
        toolbarExtra={
          <DocToolbar
            docId={docId}
            projectId={Number(projectId)}
            onAddAnnotation={() => addAnnotationModalRef.current?.open()}
          />
        }
        defaultFontSize={14}
      >
        <DocContent
          doc={currentDoc}
          versionId={versionId}
          loading={loading}
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

      {/* 添加批注弹窗（组件自治，通过 ref 控制打开） */}
      <AddAnnotationModal
        ref={addAnnotationModalRef}
        docId={docId}
        versionId={versionId}
      />
    </>
  );
};

export default DocPage;
