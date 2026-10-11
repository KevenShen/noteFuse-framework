// src/pages/Collect/components/CollectProjectList.tsx
// 收藏页面 - 收藏文集列表（含翻页、取消收藏）
import {
  DeleteOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  StarFilled,
  SwapOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Empty,
  List,
  Pagination,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React from 'react';

const { Text } = Typography;

/** 收藏文集项 */
export interface CollectProjectItem {
  id: number;
  name: string;
  description: string;
  project_category_id: number;
  category_name: string;
  cover: string;
  doc_count: number;
  author_name: string;
  author_id: number;
  collect_id: number;
  group_id: number;
  group_name: string;
  collect_time: number;
}

interface CollectProjectListProps {
  list: CollectProjectItem[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  activeGroupName: string;
  groups: any[];
  onPageChange: (page: number) => void;
  onView: (project: CollectProjectItem) => void;
  onCancelCollect: (project: CollectProjectItem) => void;
  onMoveGroup: (project: CollectProjectItem, groupId: number) => void;
  showMove?: boolean; // 是否显示移动按钮（全部收藏时隐藏）
}

const CollectProjectList: React.FC<CollectProjectListProps> = ({
  list,
  loading,
  total,
  page,
  pageSize,
  activeGroupName,
  groups,
  onPageChange,
  onView,
  onCancelCollect,
  onMoveGroup,
  showMove = true,
}) => {
  // 移动分组的下拉菜单
  const getMoveMenuItems = (project: CollectProjectItem) => {
    const otherGroups = (groups || []).filter((g: any) => g.id !== project.group_id);
    return [
      {
        key: '0',
        label: '移至未分组',
        onClick: () => onMoveGroup(project, 0),
      },
      ...otherGroups.map((g: any) => ({
        key: String(g.id),
        label: g.name,
        onClick: () => onMoveGroup(project, g.id),
      })),
    ];
  };

  return (
    <Card
      size="small"
      className="collect-project-card"
      title={
        <Space size={8}>
          <StarFilled className="collect-icon-gold" />
          <span>{activeGroupName}</span>
          <Tag color="gold">{total} 个</Tag>
        </Space>
      }
      bodyStyle={{ padding: 0 }}
    >
      <List
        loading={loading}
        dataSource={list}
        locale={{
          emptyText: (
            <Empty
              description="暂无收藏文集"
              className="collect-empty"
            />
          ),
        }}
        renderItem={(project: CollectProjectItem) => (
          <List.Item
            className="collect-project-item"
            actions={[
              <Tooltip key="view" title="查看文集">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => onView(project)}
                >
                  查看
                </Button>
              </Tooltip>,
              ...(showMove
                ? [
                    <Dropdown
                      key="move"
                      menu={{ items: getMoveMenuItems(project) }}
                      trigger={['click']}
                      disabled={!groups || groups.length === 0}
                    >
                      <Tooltip title="移动分组">
                        <Button type="text" size="small" icon={<SwapOutlined />}>
                          移动
                        </Button>
                      </Tooltip>
                    </Dropdown>,
                  ]
                : []),
              <Popconfirm
                key="cancel"
                title="确定取消收藏该文集？"
                onConfirm={() => onCancelCollect(project)}
                okText="确定"
                cancelText="取消"
              >
                <Tooltip title="取消收藏">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />}>
                    取消
                  </Button>
                </Tooltip>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              avatar={
                <Avatar
                  icon={<FolderOpenOutlined />}
                  className="collect-project-avatar"
                  size={40}
                />
              }
              title={
                <Space size={8} wrap>
                  <a
                    onClick={() => onView(project)}
                    className="collect-item-title"
                  >
                    {project.name}
                  </a>
                  <Tag color="purple" className="collect-item-tag">{project.group_name}</Tag>
                  <Tag color="blue">{project.doc_count || 0} 篇文档</Tag>
                </Space>
              }
              description={
                <Space size={12} wrap className="collect-item-meta">
                  <span>👤 {project.author_name}</span>
                  <span>⭐ 收藏于 {dayjs(project.collect_time).format('YYYY-MM-DD')}</span>
                  {project.description && (
                    <Text type="secondary" className="collect-item-summary">
                      {project.description.length > 60
                        ? project.description.slice(0, 60) + '...'
                        : project.description}
                    </Text>
                  )}
                </Space>
              }
            />
          </List.Item>
        )}
      />
      {total > 0 && (
        <div className="collect-pagination">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={onPageChange}
            showSizeChanger={false}
            showQuickJumper
            showTotal={(t) => `共 ${t} 条`}
          />
        </div>
      )}
    </Card>
  );
};

export default CollectProjectList;
