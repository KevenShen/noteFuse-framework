// src/pages/Project/components/ProjectCardList.tsx
// 文集列表组件 - 支持卡片/列表视图，分页，操作菜单
// 组件内自治：viewMode、loading、isMobile、分页/删除/置顶 dispatch

import { getIconComponent } from '@/components/IconPicker/iconData';
import { MOBILE_BREAKPOINT } from '@/constants';
import { useMobile, useShallowSelector } from '@/hooks';
import {
  ClockCircleOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  MoreOutlined,
  PushpinOutlined,
} from '@ant-design/icons';
import { history, useDispatch } from '@umijs/max';
import {
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  List,
  MenuProps,
  Pagination,
  Popconfirm,
  Row,
  Space,
  Spin,
  Tag,
} from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';
import React from 'react';
import type { PaginationState, ProjectItem, ViewMode } from '../types';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface ProjectCardListProps {
  projects: ProjectItem[];
  pagination: PaginationState;
  onEdit: (project: ProjectItem) => void;
}

const ProjectCardList: React.FC<ProjectCardListProps> = ({
  projects,
  pagination,
  onEdit,
}) => {
  // ==================== 组件内自治状态 ====================
  const dispatch = useDispatch();
  const isMobile = useMobile(MOBILE_BREAKPOINT);

  // 从 Dva model 获取 viewMode 和 loading（一次浅比较获取）
  const { viewMode, loading } = useShallowSelector((state: any) => ({
    viewMode: state.project.filters.view_mode,
    loading: state.project.loading,
  })) as { viewMode: ViewMode; loading: boolean };

  // ==================== 事件处理（组件内 dispatch） ====================

  /** 分页变更 */
  const handlePageChange = (page: number, pageSize: number) => {
    dispatch({
      type: 'project/setPagination',
      payload: { current: page, page_size: pageSize },
    });
  };

  /** 删除文集（model 内已做本地移除 + 分页边界回退，无需二次拉取） */
  const handleDelete = async (id: number) => {
    await dispatch({
      type: 'project/handleDeleteProject',
      payload: id,
    });
  };

  /** 置顶/取消置顶 */
  const handleToggleTop = async (id: number, isTop: boolean) => {
    await dispatch({
      type: 'project/handleToggleTop',
      payload: { id, is_top: isTop },
    });
  };

  /** 新建文档：先创建拿到真实 ID，再跳转编辑页（避免 /docEdit/0 空 id 约定） */
  const handleCreateDoc = async (projectId: number) => {
    const newDoc = await dispatch({
      type: 'docList/handleCreateDoc',
      payload: { project_id: projectId, name: '未命名文档' },
    });
    if (newDoc?.id) {
      history.push(`/docEdit/${newDoc.id}?project_id=${projectId}`);
    }
  };

  // ==================== 操作菜单 ====================
  const actionMenu = (project: ProjectItem): MenuProps['items'] => [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: '查看文集',
      onClick: () => history.push(`/projectDetail/${project.id}`),
    },
    {
      key: 'top',
      icon: <PushpinOutlined />,
      label: project.is_top ? '取消置顶' : '置顶文集',
      onClick: () => {
        handleToggleTop(project.id, !project.is_top);
      },
    },
    { type: 'divider' },
    {
      key: 'delete',
      danger: true,
      label: (
        <Popconfirm
          title="确认删除文集"
          description={
            project.doc_count > 0
              ? `该文集下存在 ${project.doc_count} 篇文档，无法删除，请先清空文档`
              : '删除后不可恢复，确认删除此文集吗？'
          }
          okText="确认删除"
          cancelText="取消"
          okButtonProps={{ danger: true, disabled: project.doc_count > 0 }}
          onConfirm={() => {
            if (project.doc_count === 0) {
              handleDelete(project.id);
            }
          }}
        >
          <span>删除文集</span>
        </Popconfirm>
      ),
      onClick: (e) => {
        // 阻止菜单关闭，让 Popconfirm 可以交互
        e.domEvent.stopPropagation();
        e.domEvent.preventDefault();
      },
    },
  ];

  // ==================== 分页渲染 ====================
  const renderPagination = () => (
    <div className="pagination-wrapper">
      <Pagination
        current={pagination.current}
        pageSize={pagination.page_size}
        total={pagination.total}
        onChange={handlePageChange}
        showSizeChanger
        showQuickJumper={!isMobile}
        showTotal={(t) => `共 ${t} 个文集`}
        pageSizeOptions={['8', '12', '16', '24']}
        size={isMobile ? 'small' : undefined}
        simple={isMobile}
      />
    </div>
  );

  // ==================== 加载/空状态 ====================
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (projects.length === 0) {
    return <Empty description="暂无文集" style={{ padding: 60 }} />;
  }

  // ==================== 列表视图 ====================
  if (viewMode === 'list') {
    return (
      <>
        <Card
          size="small"
          className="project-list-card"
          bodyStyle={{ padding: '12px 16px' }}
        >
          <List
            dataSource={projects}
            className="project-list"
            renderItem={(project) => (
              <List.Item
                className="project-list-item"
                actions={
                  isMobile
                    ? undefined
                    : [
                        <Button
                          key="doc"
                          type="link"
                          size="small"
                          icon={<FileTextOutlined />}
                          onClick={() => handleCreateDoc(project.id)}
                        >
                          新建
                        </Button>,
                        <Button
                          key="edit"
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => onEdit(project)}
                        >
                          编辑
                        </Button>,
                        <Dropdown
                          key="more"
                          menu={{ items: actionMenu(project) }}
                          trigger={['click']}
                        >
                          <Button
                            type="link"
                            size="small"
                            icon={<MoreOutlined />}
                          />
                        </Dropdown>,
                      ]
                }
              >
                <List.Item.Meta
                  avatar={
                    <div
                      className="project-icon"
                      style={{
                        background: project.color + '15',
                        color: project.color,
                      }}
                      onClick={() =>
                        history.push(`/projectDetail/${project.id}`)
                      }
                    >
                      {React.createElement(
                        getIconComponent(project.icon) || FileTextOutlined,
                      )}
                    </div>
                  }
                  title={
                    <div
                      className="project-title"
                      onClick={() =>
                        history.push(`/projectDetail/${project.id}`)
                      }
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="project-name">{project.name}</span>
                      <div className="project-tags-row">
                        <Space size={4} className="project-tags">
                          {project.is_top && (
                            <Tag color="red" className="project-tag">
                              置顶
                            </Tag>
                          )}
                          {project.role === 1 && (
                            <Tag color="gold" className="project-tag">
                              私有
                            </Tag>
                          )}
                          {project.is_collaborator && (
                            <Tag color="blue" className="project-tag">
                              协作
                            </Tag>
                          )}
                        </Space>
                      </div>
                    </div>
                  }
                  description={
                    <div className="project-desc-wrapper">
                      <p className="project-intro">{project.intro}</p>
                      <Space
                        split={<span className="divider">|</span>}
                        className="project-meta"
                      >
                        <span>
                          <FileTextOutlined /> {project.doc_count} 篇
                        </span>
                        <span>
                          <ClockCircleOutlined />{' '}
                          {dayjs(project.modify_time).fromNow()}
                        </span>
                      </Space>
                      {isMobile && (
                        <Space
                          className="mobile-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="small"
                            type="primary"
                            ghost
                            icon={<FileTextOutlined />}
                            onClick={() => handleCreateDoc(project.id)}
                          >
                            新建文档
                          </Button>
                          <Dropdown
                            menu={{ items: actionMenu(project) }}
                            trigger={['click']}
                          >
                            <Button size="small" icon={<MoreOutlined />} />
                          </Dropdown>
                        </Space>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
        {renderPagination()}
      </>
    );
  }

  // ==================== 卡片视图 ====================
  return (
    <>
      <Row gutter={[12, 12]} className="project-card-grid">
        {projects.map((project) => (
          <Col xs={24} sm={12} md={8} lg={8} xl={6} key={project.id}>
            <Card hoverable className="project-card">
              <Card.Meta
                avatar={
                  <div
                    className="project-card-icon"
                    style={{
                      background: project.color + '15',
                      color: project.color,
                    }}
                    onClick={() => history.push(`/projectDetail/${project.id}`)}
                  >
                    {React.createElement(
                      getIconComponent(project.icon) || FileTextOutlined,
                    )}
                  </div>
                }
                title={
                  <div
                    className="project-card-title"
                    onClick={() => history.push(`/projectDetail/${project.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="project-card-name">{project.name}</span>
                    <div className="project-card-tags-row">
                      <Space size={4} className="project-card-tags">
                        {project.is_top && (
                          <Tag color="red" className="card-tag">
                            置顶
                          </Tag>
                        )}
                        {project.role === 1 && (
                          <Tag color="gold" className="card-tag">
                            私有
                          </Tag>
                        )}
                        {project.is_collaborator && (
                          <Tag color="blue" className="card-tag">
                            协作
                          </Tag>
                        )}
                      </Space>
                    </div>
                  </div>
                }
                description={
                  <div
                    onClick={() => history.push(`/projectDetail/${project.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <p className="project-card-intro">{project.intro}</p>
                    <Space
                      split={<span className="divider">|</span>}
                      className="project-card-meta"
                    >
                      <span>{project.doc_count} 篇</span>
                      <span>{dayjs(project.modify_time).fromNow()}</span>
                    </Space>
                  </div>
                }
              />
              {/* 底部操作栏 */}
              <div className="project-card-actions">
                <Button
                  type="text"
                  icon={<FileTextOutlined />}
                  size="small"
                  onClick={() => handleCreateDoc(project.id)}
                >
                  {isMobile ? '' : '新建文档'}
                </Button>
                <div className="project-card-actions-right">
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => onEdit(project)}
                  >
                    {isMobile ? '' : '编辑'}
                  </Button>
                  <Dropdown
                    menu={{ items: actionMenu(project) }}
                    trigger={['click']}
                  >
                    <Button type="text" icon={<MoreOutlined />} size="small" />
                  </Dropdown>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      {renderPagination()}
    </>
  );
};

export default ProjectCardList;
