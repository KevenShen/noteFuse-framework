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
  getProjectDocCategories,
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
import { history, useClientLoaderData } from '@umijs/max';
import { Col, Divider, Row, Tabs, Tag } from 'antd';
import React from 'react';
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
  const projectId = Number(history.location.pathname.split('/').pop() || 0);
  if (!projectId) return EMPTY_DATA;

  try {
    const [projectRes, categoriesRes, docsRes, versionsRes, outlineRes] =
      await Promise.all([
        getProjectDetail({ id: projectId }),
        getProjectDocCategories({ id: projectId }),
        getProjectDocs({ id: projectId }),
        getProjectDocVersions({ id: projectId }),
        getAiOutline({ id: projectId }),
      ]);
    return {
      currentProject: extractResponseData(projectRes, null),
      docCategoryList: extractResponseData<any[]>(categoriesRes, []),
      docList: extractResponseData<any[]>(docsRes, []),
      docVersions: extractResponseData<any[]>(versionsRes, []),
      aiOutline: extractResponseData(outlineRes, null),
    };
  } catch {
    return EMPTY_DATA;
  }
}

const ProjectDetail: React.FC = () => {
  // 从路径 /projectDetail/:id 解析 id
  const projectId = Number(location.pathname.split('/').pop() || '0');

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

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  // 一次性同步所有数据到对应 model，子组件自行从 model 获取所需数据
  useClientLoaderSync({
    clientLoaderData,
    actionType: 'projectDetail/saveCurrentProject',
    mapData: (data) => data.currentProject,
    hasData: (data) => !!data?.currentProject,
  });

  useClientLoaderSync({
    clientLoaderData,
    actionType: 'doc/saveDocList',
    mapData: (data) => data.docList || [],
  });

  useClientLoaderSync({
    clientLoaderData,
    actionType: 'doc/saveDocCategoryList',
    mapData: (data) => data.docCategoryList || [],
  });

  useClientLoaderSync({
    clientLoaderData,
    actionType: 'doc/saveDocVersions',
    mapData: (data) => data.docVersions || [],
  });

  useClientLoaderSync({
    clientLoaderData,
    actionType: 'doc/saveAiOutline',
    mapData: (data) => data.aiOutline || null,
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
