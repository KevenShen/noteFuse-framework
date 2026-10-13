// src/pages/Project/components/ProjectFilterBar.tsx
// 文集筛选排序栏 - 可折叠，组件内维护折叠状态
// 组件内自治：filters 状态、searchText、筛选/搜索/分页 dispatch

import { getIconComponent } from '@/components/IconPicker';
import { buildCategoryMenu } from '@/components/tree';
import { MOBILE_BREAKPOINT } from '@/constants';
import { useMobile, useShallowSelector } from '@/hooks';
import {
  AppstoreAddOutlined,
  AppstoreOutlined,
  BarsOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DownOutlined,
  FileTextOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  LockOutlined,
  PlusOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  TagsFilled,
  TeamOutlined,
  UpOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { history, useDispatch } from '@umijs/max';
import { useSetState } from 'ahooks';
import {
  Button,
  Divider,
  Dropdown,
  Input,
  MenuProps,
  Segmented,
  Space,
  Tag,
  Tooltip,
} from 'antd';
import React from 'react';
import type { CategoryItem, ProjectFilterState, ViewMode } from '../types';

interface ProjectFilterBarProps {
  categories: CategoryItem[];
  total: number;
  onCreate: () => void;
}

const filterLabels: Record<string, string> = {
  all: '全部文集',
  mine: '我的文集',
  collab: '协作文集',
  private: '私有文集',
};

const sortLabels: Record<string, string> = {
  update: '最近更新',
  create: '创建时间',
  count: '文档数量',
  name: '名称排序',
};

const ProjectFilterBar: React.FC<ProjectFilterBarProps> = ({
  categories,
  total,
  onCreate,
}) => {
  // ==================== 组件内自治状态 ====================
  const dispatch = useDispatch();
  const isMobile = useMobile(MOBILE_BREAKPOINT);
  const [state, setState] = useSetState({
    collapsed: isMobile,
    searchText: '',
  });
  const { collapsed, searchText } = state;

  // 从 Dva model 获取 filters 状态
  const { filters } = useShallowSelector((state: any) => ({
    filters: state.project.filters,
  })) as { filters: ProjectFilterState };

  // ==================== 菜单配置 ====================
  const filterMenuItems: MenuProps['items'] = [
    { key: 'all', label: '全部文集', icon: <GlobalOutlined /> },
    { key: 'mine', label: '我的文集', icon: <UserOutlined /> },
    { key: 'collab', label: '协作文集', icon: <TeamOutlined /> },
    { key: 'private', label: '私有文集', icon: <LockOutlined /> },
  ];

  const sortMenuItems: MenuProps['items'] = [
    { key: 'update', label: '最近更新', icon: <ClockCircleOutlined /> },
    { key: 'create', label: '创建时间', icon: <CalendarOutlined /> },
    { key: 'count', label: '文档数量', icon: <FileTextOutlined /> },
    { key: 'name', label: '名称排序', icon: <SortAscendingOutlined /> },
  ];

  // 使用公共函数构建分类菜单（扁平化数据 → Ant Design Menu 结构）
  // 通过 renderLabel 自定义渲染：图标 + 分类名称
  const categoryMenuItems = buildCategoryMenu(categories, {
    allIcon: <AppstoreOutlined />,
    uncategorizedIcon: <FolderOpenOutlined />,
    renderLabel: (item) => {
      const icon = (item as any).icon;
      const IconComp = icon ? getIconComponent(icon) : null;
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {IconComp ? <IconComp style={{ fontSize: 14 }} /> : null}
          <span>{item.name}</span>
        </span>
      );
    },
  });

  // ==================== 事件处理（组件内 dispatch） ====================

  const getCategoryName = () => {
    if (filters.project_category_id === -1) return '未分类';
    return (
      categories.find((c) => c.id === filters.project_category_id)?.name ||
      '全部分类'
    );
  };

  /** 获取当前选中分类的图标组件 */
  const getCategoryIcon = () => {
    if (filters.project_category_id === -1) return <FolderOpenOutlined />;
    if (filters.project_category_id === 0) return <AppstoreOutlined />;
    const category = categories.find(
      (c) => c.id === filters.project_category_id,
    );
    const icon = category?.icon;
    if (icon) {
      const IconComp = getIconComponent(icon);
      if (IconComp) return <IconComp />;
    }
    return <TagsFilled />;
  };

  /** 分类变更：更新 filters + 重置分页 */
  const handleCategory = (key: string) => {
    dispatch({
      type: 'project/setFilters',
      payload: { project_category_id: Number(key) },
    });
    dispatch({ type: 'project/setPagination', payload: { current: 1 } });
  };

  /** 筛选变更：更新 filters + 重置分页 */
  const handleFilter = (key: string) => {
    dispatch({ type: 'project/setFilters', payload: { filter: key } });
    dispatch({ type: 'project/setPagination', payload: { current: 1 } });
  };

  /** 排序变更：更新 filters + 重置分页 */
  const handleSort = (key: string) => {
    dispatch({ type: 'project/setFilters', payload: { sort: key } });
    dispatch({ type: 'project/setPagination', payload: { current: 1 } });
  };

  /** 视图模式变更：只更新 filters */
  const handleViewMode = (v: ViewMode) => {
    dispatch({ type: 'project/setFilters', payload: { view_mode: v } });
  };

  /** 搜索：更新 keyword + 重置分页 */
  const handleSearch = () => {
    dispatch({ type: 'project/setFilters', payload: { keyword: searchText } });
    dispatch({ type: 'project/setPagination', payload: { current: 1 } });
  };

  // ==================== 渲染 ====================
  return (
    <div className="filter-bar-wrapper">
      <div
        className="filter-bar-header"
        onClick={() => setState({ collapsed: !collapsed })}
      >
        <Space size={8}>
          <FilterOutlined style={{ color: '#1890ff' }} />
          <span className="filter-bar-title">筛选与排序</span>
          <Tag color="blue">{total} 个文集</Tag>
        </Space>
        <Space size={4}>
          {!isMobile && (
            <Segmented
              size="small"
              value={filters.view_mode}
              onChange={(v) => handleViewMode(v as ViewMode)}
              options={[
                {
                  value: 'card',
                  icon: (
                    <Tooltip title="卡片视图">
                      <AppstoreOutlined />
                    </Tooltip>
                  ),
                },
                {
                  value: 'list',
                  icon: (
                    <Tooltip title="列表视图">
                      <BarsOutlined />
                    </Tooltip>
                  ),
                },
              ]}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <Button
            type="text"
            size="small"
            icon={collapsed ? <DownOutlined /> : <UpOutlined />}
          />
        </Space>
      </div>

      {!collapsed && (
        <>
          <Divider style={{ margin: 0 }} />
          <div className="filter-bar-content">
            <Space wrap size={[8, 8]}>
              <Dropdown
                menu={{
                  items: categoryMenuItems,
                  onClick: ({ key }) => handleCategory(key),
                  selectedKeys: [String(filters.project_category_id)],
                }}
                trigger={['click']}
              >
                <Button className="filter-btn">
                  {getCategoryIcon()} {getCategoryName()}{' '}
                  <DownOutlined className="dropdown-icon" />
                </Button>
              </Dropdown>
              <Dropdown
                menu={{
                  items: filterMenuItems,
                  onClick: ({ key }) => handleFilter(key),
                  selectedKeys: [filters.filter],
                }}
                trigger={['click']}
              >
                <Button className="filter-btn">
                  <FilterOutlined /> {filterLabels[filters.filter]}{' '}
                  <DownOutlined className="dropdown-icon" />
                </Button>
              </Dropdown>

              <Dropdown
                menu={{
                  items: sortMenuItems,
                  onClick: ({ key }) => handleSort(key),
                  selectedKeys: [filters.sort],
                }}
                trigger={['click']}
              >
                <Button className="filter-btn">
                  <SortAscendingOutlined /> {sortLabels[filters.sort]}{' '}
                  <DownOutlined className="dropdown-icon" />
                </Button>
              </Dropdown>

              <Button
                icon={<AppstoreAddOutlined />}
                onClick={() => history.push('/projects/category')}
                className="filter-btn"
              >
                分类管理
              </Button>
            </Space>

            {/* 搜索 + 新建 */}
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px dashed #f0f0f0',
              }}
            >
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="搜索文集..."
                  prefix={<SearchOutlined />}
                  value={searchText}
                  onChange={(e) => setState({ searchText: e.target.value })}
                  onPressEnter={handleSearch}
                  allowClear
                  style={{ flex: 1 }}
                />
                <Button type="primary" onClick={handleSearch}>
                  搜索
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={onCreate}
                >
                  新建文集
                </Button>
              </Space.Compact>
            </div>

            {isMobile && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px dashed #f0f0f0',
                }}
              >
                <Space size={8}>
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                    视图：
                  </span>
                  <Segmented
                    size="small"
                    value={filters.view_mode}
                    onChange={(v) => handleViewMode(v as ViewMode)}
                    options={[
                      {
                        value: 'card',
                        icon: <AppstoreOutlined />,
                        label: '卡片',
                      },
                      { value: 'list', icon: <BarsOutlined />, label: '列表' },
                    ]}
                  />
                </Space>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectFilterBar;
