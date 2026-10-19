// src/pages/DocEditor/index.tsx
// 文档编辑页 - Dva Hooks + 组件化拆分 + clientLoader 预加载
// 布局：ProjectDocDetailLayout（左侧目录+中间编辑器+右侧工具坞）
import type { VersionActionType } from '@/components/DocTree/types';
import { type MDXEditorRef } from '@/components/MDXEditor';
import {
  useClientLoaderSync,
  useCurrentUser,
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
  VerticalAlignTopOutlined,
} from '@ant-design/icons';
import {
  history,
  useClientLoaderData,
  useDispatch,
  useLocation,
} from '@umijs/max';
import { FloatButton, Space, Tag, message } from 'antd';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  EditorContent,
  EditorRightPanel,
  EditorSidebar,
  EditorToolbar,
  TemplateManager,
  type TemplateManagerRef,
} from './components';
import './index.less';

// ==================== clientLoader：页面渲染前并行预加载详情页数据 ====================

export async function clientLoader() {
  // 从 history.location 解析路由参数（clientLoader 的 opts 不含路由参数）
  const EMPTY_DATA = {
    currentProject: null,
    docCategoryList: [],
    docList: [],
    docVersions: [],
    currentDoc: null,
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
    // 使用 Promise.allSettled：单个接口失败不影响其他数据
    // （如新文档暂无版本时 getDocDetail 可能失败，但文集/分类/文档列表仍需正常加载）
    const [projectRes, categoriesRes, docsRes, versionsRes, docRes] =
      await Promise.allSettled([
        getProjectDetail({ id: projectId }),
        getDocCategoriesByProjectId({ projectId }),
        getProjectDocs({ id: projectId }),
        getProjectDocVersions({ id: projectId }),
        getDocDetail(
          versionId ? { id: docId, version: Number(versionId) } : { id: docId },
        ),
      ]);
    return {
      currentProject:
        projectRes.status === 'fulfilled' ? extractData(projectRes.value) : null,
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
      currentDoc:
        docRes.status === 'fulfilled' ? extractData(docRes.value) : null,
    };
  } catch {
    return EMPTY_DATA;
  }
}

const DocEditorPage: React.FC = () => {
  const location = useLocation();
  const dispatch = useDispatch();

  // 从路径 /docEdit/:id 解析 id
  const docId = Number(location.pathname.split('/').pop() || '1');
  const searchParams = new URLSearchParams(location.search);
  const projectId = searchParams.get('project_id') || '1';
  const versionId = searchParams.get('version');

  // ==================== Dva Hooks 取数 ====================
  // doc 相关数据从 doc model 获取
  const {
    currentDoc: modelCurrentDoc,
    loading,
    docList: modelDocList,
    docCategoryList: modelDocCategoryList,
    docVersions: modelDocVersions,
  } = useShallowSelector((state: any) => ({
    currentDoc: state.docDetail.currentDoc,
    loading: state.docDetail.loading,
    docList: state.docList.docList,
    docCategoryList: state.docCategory.docCategoryList,
    docVersions: state.docVersions.docVersions,
  }));
  // project 相关数据从 project model 获取
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

  // 优先 model 数据（交互更新后），兜底 clientLoader 预加载数据（首屏）
  const currentProject = useMergedState({
    modelData: modelCurrentProject,
    loaderData: clientLoaderData?.currentProject,
  });
  const docCategoryList = useMergedState({
    modelData: modelDocCategoryList,
    loaderData: clientLoaderData?.docCategoryList,
  });
  const docList = useMergedState({
    modelData: modelDocList,
    loaderData: clientLoaderData?.docList,
  });
  const docVersions = useMergedState({
    modelData: modelDocVersions,
    loaderData: clientLoaderData?.docVersions,
  });
  const currentDoc = useMergedState({
    modelData: modelCurrentDoc,
    loaderData: clientLoaderData?.currentDoc,
  });

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

  // ==================== 当前用户与权限判断 ====================
  // 使用 useCurrentUser hook：优先 Dva（登录后未刷新），兜底 initialState（刷新后从 API 获取）
  const { currentUser } = useCurrentUser();
  // 仅文集创建者可管理分类和文档（使用 Number() 转换避免类型不匹配）
  const canManage =
    Number(currentUser?.id) === Number(currentProject?.create_user_id);

  // ==================== 管理版本回调（涉及版本对比编辑模式，暂保留在页面） ====================

  // 管理版本
  const handleManageVersion = useCallback(
    async (action: VersionActionType, data?: any) => {
      switch (action) {
        case 'add-version': {
          // 新建版本：
          // 1. 如果选择了基底版本，进入对比编辑模式（左栏基底版本只读，右栏新版本可编辑）
          // 2. 如果没有选择基底版本，进入平常的新建版本内容功能（内容为空，正常编辑模式）
          // 注意：data.doc_id 是用户点击的文档ID，可能不同于当前编辑的 docId
          const targetDocId = data?.doc_id || docId;
          const baseVersionId = data?.base_version_id;
          const base = baseVersionId
            ? docVersions.find((v: any) => v.id === baseVersionId)
            : null;

          if (baseVersionId && !base) {
            message.error('未找到基底版本');
            return;
          }

          if (base) {
            // 选择了基底版本：进入对比编辑模式
            dispatch({
              type: 'docEditor/enterVersionEditMode',
              payload: {
                baseVersion: base,
                newVersionInfo: {
                  version: data?.version || `v${docVersions.length + 1}.0`,
                  status: data?.status || 'draft',
                  remark: data?.remark || '',
                },
                newVersionContent: base.content || '',
              },
            });
            message.info(`已进入版本对比编辑模式，基底版本：${base.version}`);
          } else {
            // 没有选择基底版本：进入平常的新建版本内容功能
            // 创建新版本（内容为空），然后切换到该版本进行编辑
            try {
              // 计算目标文档的版本数量，生成新版本号
              const targetDocVersions = docVersions.filter(
                (v: any) => v.doc_id === targetDocId,
              );
              const result = await dispatch({
                type: 'docVersions/handleCreateDocVersion',
                payload: {
                  doc_id: targetDocId,
                  projectId,
                  version: data?.version || `v${targetDocVersions.length + 1}.0`,
                  status: data?.status || 'draft',
                  remark: data?.remark || '',
                  content: '',
                },
              });
              // handleCreateDocVersion effect 返回的是新版本对象（res.data）
              if (result?.id) {
                // 切换到新版本进行编辑
                history.push(
                  `/docEdit/${targetDocId}?project_id=${projectId}&version=${result.id}`,
                );
                message.success('新版本创建成功，内容为空，请开始编辑');
              } else {
                message.error('创建新版本失败');
              }
            } catch (e) {
              console.error('创建新版本失败:', e);
              message.error('创建新版本失败');
            }
          }
          break;
        }
        case 'edit-version': {
          // 编辑版本信息（不涉及内容编辑）
          await dispatch({
            type: 'docVersions/handleUpdateDocVersion',
            payload: { id: data.id, data },
          });
          break;
        }
        case 'delete-version': {
          await dispatch({
            type: 'docVersions/handleDeleteDocVersion',
            payload: data.id,
          });
          break;
        }
        case 'set-current-version': {
          await dispatch({
            type: 'docVersions/handleSetCurrentDocVersion',
            payload: data.id,
          });
          break;
        }
        case 'rollback-version': {
          // 回滚版本：将该版本内容复制到当前版本
          await dispatch({
            type: 'docVersions/handleRollbackDocVersion',
            payload: data.id,
          });
          break;
        }
        default:
          break;
      }
    },
    [dispatch, docVersions],
  );

  // ==================== 编辑器 UI 状态（从 docEditor model 获取） ====================
  const { showRightPanel } = useShallowSelector((state: any) => ({
    showRightPanel: state.docEditor.showRightPanel,
  }));

  const mdxEditorRef = useRef<MDXEditorRef>(null);
  const templateManagerRef = useRef<TemplateManagerRef>(null);

  // 记录上一次的 versionId，用于检测版本切换
  const prevVersionIdRef = useRef<string | null | undefined>(versionId);

  // ==================== 数据兜底：clientLoader 数据为空时才从 API 获取 ====================
  // 版本切换时（versionId 变化），即使 clientLoader 已有数据，也需要重新获取文档详情
  useEffect(() => {
    const pid = Number(projectId);
    const versionChanged = prevVersionIdRef.current !== versionId;
    const hasData =
      clientLoaderData?.currentDoc || clientLoaderData?.docList?.length;

    // 版本切换时，强制重新获取文档详情（其他数据不随版本变化，不需要重新获取）
    if (versionChanged && docId) {
      dispatch({
        type: 'docDetail/fetchDocDetail',
        payload: versionId ? { id: docId, version: Number(versionId) } : docId,
      });
      prevVersionIdRef.current = versionId;
      return;
    }

    if (hasData) {
      prevVersionIdRef.current = versionId;
      return; // clientLoader 已预加载，跳过
    }

    if (pid) {
      dispatch({ type: 'projectDetail/fetchProjectDetail', payload: pid });
      dispatch({ type: 'docCategory/fetchProjectCategories', payload: pid });
      dispatch({ type: 'docList/fetchProjectDocs', payload: pid });
      dispatch({ type: 'docVersions/fetchDocVersions', payload: pid });
    }
    if (docId) {
      dispatch({
        type: 'docDetail/fetchDocDetail',
        payload: versionId ? { id: docId, version: Number(versionId) } : docId,
      });
    }
    prevVersionIdRef.current = versionId;
  }, [dispatch, projectId, docId, versionId, clientLoaderData]);

  // ==================== 事件处理 ====================

  // 返回文集详情
  const handleBack = () => {
    history.push(`/projectDetail/${projectId}`);
  };

  // 获取滚动容器
  const getScrollContainer = () =>
    (document.querySelector('.doc-content') as HTMLElement) || window;

  // ==================== 页面布局 ====================
  return (
    <ProjectDocDetailLayout
      sidebarTitle={
        <Space size={8}>
          <FolderOpenOutlined style={{ color: '#1890ff' }} />
          <span>{currentProject?.name || '文集'}</span>
          <Tag color="orange" variant="outlined">
            编辑
          </Tag>
        </Space>
      }
      sidebarContent={
        <EditorSidebar
          currentDocId={docId}
          currentVersionId={versionId ? Number(versionId) : undefined}
          projectId={Number(projectId)}
          canManage={canManage}
          onManageVersion={handleManageVersion}
        />
      }
      onTitleClick={handleBack}
      onBack={handleBack}
      onSettings={() => history.push(`/project/${projectId}/settings`)}
      showRightPanel={showRightPanel}
      rightPanelWidth={300}
      rightPanel={
        <EditorRightPanel
          docId={docId}
          projectId={Number(projectId)}
          currentVersionId={versionId ? Number(versionId) : undefined}
          mdxEditorRef={mdxEditorRef}
          onClose={() =>
            dispatch({ type: 'docEditor/setShowRightPanel', payload: false })
          }
          // 文档模板
          onEditTemplate={(t) => templateManagerRef.current?.editTemplate(t)}
        />
      }
      toolbarExtra={
        <EditorToolbar
          docId={docId}
          projectId={Number(projectId)}
          versionId={versionId || undefined}
          mdxEditorRef={mdxEditorRef}
          onSaveAsTemplate={() => templateManagerRef.current?.saveAsTemplate()}
        />
      }
      defaultFontSize={14}
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <TemplateManager
          ref={templateManagerRef}
          mdxEditorRef={mdxEditorRef}
          currentUser={currentUser}
        />
        <EditorContent
          key={docId}
          doc={currentDoc}
          docId={docId}
          versionId={versionId || undefined}
          loading={loading}
          mdxEditorRef={mdxEditorRef}
        />
      </div>

      {/* 悬浮按钮 */}
      <>
        {!showRightPanel && (
          <FloatButton
            icon={<VerticalAlignTopOutlined />}
            tooltip="显示工具坞"
            style={{ right: 24, bottom: 24, zIndex: 9999 }}
            onClick={() =>
              dispatch({ type: 'docEditor/setShowRightPanel', payload: true })
            }
          />
        )}
        <FloatButton.BackTop
          visibilityHeight={200}
          icon={<VerticalAlignTopOutlined />}
          tooltip="返回顶部"
          style={{ right: 24, bottom: 80, zIndex: 9999 }}
          target={getScrollContainer}
        />
      </>
    </ProjectDocDetailLayout>
  );
};

export default DocEditorPage;
