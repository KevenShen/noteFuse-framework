// src/pages/ProjectDetail/index.tsx
// 文集详情页 - 组件自治架构
// 页面组件仅负责布局和页面级状态，数据获取和事件处理下沉到子组件
// clientLoader：页面渲染前并行预加载所有数据，通过 useClientLoaderSync 同步到 model
import {
  useClientLoaderSync,
  useMergedState,
  useShallowSelector,
} from '@/hooks';
import ProjectDocDetailLayout from '@/layouts/ProjectDocDetailLayout';
import {
  getAiOutline,
  getDocCategoriesByProjectId,
  getProjectDetail,
  getProjectDocVersions,
  getProjectDocs,
} from '@/services';
import {
  extractResponseData,
} from '@/utils/clientLoader';
import {
  ClockCircleOutlined,
  FolderOpenOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { history, useClientLoaderData, useDispatch, useLocation } from '@umijs/max';
import { Col, Divider, Row, Tabs, Tag } from 'antd';
import React, { useEffect, useRef } from 'react';
import {
  AiOutlineTab,
  DocSidebar,
  IntroTab,
  LatestDocsTab,
  OutlineTab,
  ProjectHeader,
} from './components';
import './index.less';

// ==================== clientLoader：页面渲染前并行预加载详情页数据 ====================

export async function clientLoader() {
  const EMPTY_DATA = {
    currentProject: null,
    docCategoryList: [],
    docList: [],
    docVersions: [],
    aiOutline: null,
  };
  const projectId = Number(window.location.pathname.split('/').pop() || 0);
  if (!projectId) return EMPTY_DATA;

  try {
    // 使用 Promise.allSettled：单个接口失败不影响其他数据
    const [projectRes, categoriesRes, docsRes, versionsRes, outlineRes] =
      await Promise.allSettled([
        getProjectDetail({ id: projectId }),
        getDocCategoriesByProjectId({ projectId }),
        getProjectDocs({ id: projectId }),
        getProjectDocVersions({ id: projectId }),
        getAiOutline({ id: projectId }),
      ]);
    return {
      currentProject:
        projectRes.status === 'fulfilled'
          ? extractResponseData(projectRes.value, null)
          : null,
      docCategoryList:
        categoriesRes.status === 'fulfilled'
          ? extractResponseData<any[]>(categoriesRes.value, [])
          : [],
      docList:
        docsRes.status === 'fulfilled'
          ? extractResponseData<any[]>(docsRes.value, [])
          : [],
      docVersions:
        versionsRes.status === 'fulfilled'
          ? extractResponseData<any[]>(versionsRes.value, [])
          : [],
      aiOutline:
        outlineRes.status === 'fulfilled'
          ? extractResponseData(outlineRes.value, null)
          : null,
    };
  } catch {
    return EMPTY_DATA;
  }
}

const ProjectDetail: React.FC = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  // 从路径 /projectDetail/:id 解析 id
  const projectId = Number(location.pathname.split('/').pop() || '0');
  // 标记是否已完成初始加载（clientLoader 已处理）
  const initialLoadedRef = useRef(false);

  // ==================== Dva Hooks：仅获取页面布局所需的 currentProject ====================
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
      aiOutline: any;
    };
  };

  // 合并 currentProject：优先 model，兜底 clientLoader
  const currentProject = useMergedState({
    modelData: modelCurrentProject,
    loaderData: clientLoaderData?.currentProject,
  });

  // ==================== 路由变化时手动获取数据（兜底方案） ====================
  // clientLoader 在同一路由组件切换参数时可能不重新执行，此处作为兜底
  // 初始加载由 clientLoader 处理，路由变化时手动 dispatch
  useEffect(() => {
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      return; // 初始加载由 clientLoader 完成
    }
    if (!projectId) return;
    // 路由变化时，手动获取所有数据
    dispatch({ type: 'projectDetail/fetchProjectDetail', payload: projectId });
    dispatch({ type: 'docCategory/fetchProjectCategories', payload: projectId });
    dispatch({ type: 'docList/fetchProjectDocs', payload: projectId });
    dispatch({ type: 'docVersions/fetchDocVersions', payload: projectId });
    dispatch({ type: 'docDetail/fetchAiOutline', payload: projectId });
  }, [projectId, dispatch]);

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  // 一次性同步所有数据到对应 model，子组件自行从 model 获取所需数据
  // resetKey=projectId：路由参数变化时重置同步状态，确保加载新文集的数据
  useClientLoaderSync({
    clientLoaderData,
    actionType: 'projectDetail/saveCurrentProject',
    mapData: (data) => data.currentProject,
    hasData: (data) => !!data?.currentProject,
    resetKey: projectId,
  });

  useClientLoaderSync({
    clientLoaderData,
    actionType: 'docList/saveDocList',
    mapData: (data) => data.docList || [],
    resetKey: projectId,
  });

  useClientLoaderSync({
    clientLoaderData,
    actionType: 'docCategory/saveDocCategoryList',
    mapData: (data) => data.docCategoryList || [],
    resetKey: projectId,
  });

  useClientLoaderSync({
    clientLoaderData,
    actionType: 'docVersions/saveDocVersions',
    mapData: (data) => data.docVersions || [],
    resetKey: projectId,
  });

  useClientLoaderSync({
    clientLoaderData,
    actionType: 'docDetail/saveAiOutline',
    mapData: (data) => data.aiOutline || null,
    resetKey: projectId,
  });

  // ==================== 页面级事件：仅保留多个子组件共用的文档跳转 ====================
  const handleSelectDoc = (docId: number) => {
    history.push(`/doc/${docId}?project_id=${projectId}`);
  };

  // ==================== Tab 配置：子组件自行获取数据和处理事件 ====================
  const tabItems = [
    {
      key: 'intro',
      label: '简介',
      children: <IntroTab projectId={projectId} />,
    },
    {
      key: 'outline',
      label: '目录',
      children: <OutlineTab onSelectDoc={handleSelectDoc} />,
    },
    {
      key: 'latest',
      label: (
        <span>
          <ClockCircleOutlined /> 最新
        </span>
      ),
      children: <LatestDocsTab onSelectDoc={handleSelectDoc} />,
    },
    {
      key: 'ai-outline',
      label: (
        <span>
          <RobotOutlined /> AI总结大纲
        </span>
      ),
      children: <AiOutlineTab projectId={projectId} />,
    },
  ];

  // ==================== 页面布局 ====================
  return (
    <ProjectDocDetailLayout
      sidebarTitle={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FolderOpenOutlined style={{ color: '#1890ff' }} />
          <span>{currentProject?.name || '文集详情'}</span>
          <Tag color="blue" variant="outlined">
            文集
          </Tag>
        </span>
      }
      sidebarContent={
        <DocSidebar projectId={projectId} onSelectDoc={handleSelectDoc} />
      }
      onCreate={() => history.push(`/doc/create?project_id=${projectId}`)}
      onBack={() => history.push('/project')}
      onSettings={() => history.push(`/project/${projectId}/settings`)}
      defaultFontSize={14}
    >
      <div className="project-detail-content">
        <Row gutter={[16, 16]}>
          {/* 文集信息头部 */}
          <Col span={24}>
            <ProjectHeader project={currentProject} />
          </Col>

          <Col span={24}>
            <Divider style={{ margin: '8px 0' }} />
          </Col>

          {/* Tabs 聚合内容 */}
          <Col span={24}>
            <Tabs
              defaultActiveKey="intro"
              items={tabItems}
              className="detail-tabs"
              size="large"
            />
          </Col>
        </Row>
      </div>
    </ProjectDocDetailLayout>
  );
};

export default ProjectDetail;
