// src/pages/Project/index.tsx
// 文集页面 - 仅显示文集列表
// Dva 最新用法：useSelector 获取状态，useDispatch 触发更新
// 布局：Row + Col，兼容移动端
// clientLoader：页面渲染前并行预加载分类+列表数据
// 组件自治：筛选、搜索、分页、删除、置顶等操作下沉到子组件

import {
  useClientLoaderSync,
  useMergedState,
  useShallowSelector,
} from '@/hooks';
import { getCategoryList, getProjectList } from '@/services';
import { extractListWithPagination } from '@/utils/clientLoader';
import { useClientLoaderData, useDispatch } from '@umijs/max';
import { useSetState, useUpdateEffect } from 'ahooks';
import { Col, Row } from 'antd';
import React from 'react';
import { ProjectCardList, ProjectFilterBar, ProjectModal } from './components';
import './index.less';
import type { ProjectItem } from './types';

// ==================== clientLoader：页面渲染前并行预加载初始数据 ====================
// 不传 user_id，后端从 token 解析当前用户（mock 环境兜底 user_id=1）
export async function clientLoader() {
  const EMPTY_DATA = {
    projectCategoryList: [],
    projectList: [],
    projectTotal: 0,
    projectPage: 1,
  };
  try {
    const [categoriesRes, listRes] = await Promise.all([
      getCategoryList(),
      getProjectList({ page: 1, page_size: 12 }),
    ]);

    // 使用统一的工具函数提取数据（兼容直接数组与 { list } 两种结构）
    const { list: projectCategoryList } =
      extractListWithPagination<any>(categoriesRes);
    const {
      list: projectList,
      total: projectTotal,
      page: projectPage,
    } = extractListWithPagination<ProjectItem>(listRes);

    return {
      projectCategoryList,
      projectList,
      projectTotal,
      projectPage,
    };
  } catch (e) {
    return EMPTY_DATA;
  }
}

const ProjectPage: React.FC = () => {
  // ==================== Dva Hooks ====================
  const dispatch = useDispatch();
  // 使用 useShallowSelector 浅比较，避免无关字段（如 listLoading）变化时触发重渲染
  const {
    projectCategoryList: modelCategoryList,
    projectList: modelProjectList,
    pagination,
    filters,
  } = useShallowSelector((state: any) => ({
    projectCategoryList: state.projectCategory.projectCategoryList,
    projectList: state.project.projectList,
    pagination: state.project.pagination,
    filters: state.project.filters,
  }));

  // useClientLoaderData 返回 { data: clientLoader返回值 }
  const { data: clientLoaderData } = useClientLoaderData() as {
    data: {
      projectCategoryList: any[];
      projectList: any[];
      projectTotal: number;
      projectPage: number;
    };
  };

  // ==================== 合并数据：优先 model，兜底 clientLoader ====================
  const projectList = useMergedState<ProjectItem[]>({
    modelData: modelProjectList,
    loaderData: clientLoaderData?.projectList,
  });

  const projectCategoryList = useMergedState<any[]>({
    modelData: modelCategoryList,
    loaderData: clientLoaderData?.projectCategoryList,
  });

  // 合并分页数据：优先 model，兜底 clientLoader
  // useMergedState 会自动处理：model 数据初始化后，即使 total=0 也不会回退到旧数据
  const mergedPagination = useMergedState({
    modelData: pagination,
    loaderData: {
      current: clientLoaderData?.projectPage || 1,
      page_size: pagination.page_size || 12,
      total: clientLoaderData?.projectTotal || 0,
    },
  });

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  // 分类数据同步到 projectCategory model
  useClientLoaderSync({
    clientLoaderData,
    actionType: 'projectCategory/saveCategoryList',
    mapData: (data) => data.projectCategoryList,
    hasData: (data) => !!data?.projectCategoryList?.length,
  });

  // 列表+分页数据同步到 project model
  useClientLoaderSync({
    clientLoaderData,
    actionType: 'project/saveProjectInitialData',
    mapData: (data) => ({
      list: data.projectList,
      total: data.projectTotal,
      page: data.projectPage,
    }),
    hasData: (data) => !!data?.projectList?.length,
  });

  // ==================== 本地状态（仅弹窗状态） ====================
  const [state, setState] = useSetState<{
    modalOpen: boolean;
    editingProject: ProjectItem | null;
  }>({
    modalOpen: false,
    editingProject: null,
  });

  const { modalOpen, editingProject } = state;

  // ==================== 筛选/分页变更 => 重新拉取列表（跳过首次渲染） ====================
  // 注意：必须同时监听 filters 和 pagination，因为筛选变更时如果已经在第1页，pagination 不会变化
  useUpdateEffect(() => {
    dispatch({ type: 'project/fetchProjectList' });
  }, [
    dispatch,
    // 筛选条件变更
    filters.keyword,
    filters.filter,
    filters.project_category_id,
    filters.sort,
    // 分页变更
    pagination.current,
    pagination.page_size,
  ]);

  // ==================== 事件处理（仅弹窗相关） ====================

  const handleCreate = () => {
    setState({ editingProject: null, modalOpen: true });
  };

  const handleEdit = (project: ProjectItem) => {
    setState({ editingProject: project, modalOpen: true });
  };

  /** 弹窗提交成功后刷新列表 */
  const handleModalSuccess = () => {
    dispatch({ type: 'project/fetchProjectList' });
  };

  // ==================== 页面布局 ====================
  return (
    <div className="project-page">
      <Row gutter={[16, 16]}>
        {/* 筛选栏（含搜索+新建） */}
        <Col span={24}>
          <ProjectFilterBar
            categories={projectCategoryList}
            total={mergedPagination.total}
            onCreate={handleCreate}
          />
        </Col>

        {/* 文集列表 */}
        <Col span={24}>
          <ProjectCardList
            projects={projectList}
            pagination={mergedPagination}
            onEdit={handleEdit}
          />
        </Col>
      </Row>

      {/* 新建/编辑弹窗 */}
      <ProjectModal
        open={modalOpen}
        editingProject={editingProject}
        categories={projectCategoryList}
        onCancel={() => setState({ modalOpen: false })}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default ProjectPage;
