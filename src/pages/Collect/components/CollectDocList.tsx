// src/pages/Collect/components/CollectDocList.tsx
// 收藏页面 - 右侧收藏文档列表（含翻页、取消收藏、移动分组）
import {
  DeleteOutlined,
  EyeOutlined,
  SwapOutlined,
  StarFilled,
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
import type { CollectDocItem, CollectDocListProps, CollectGroup } from '../types';

const { Text } = Typography;

const CollectDocList: React.FC<CollectDocListProps> = ({
  list,
  loading,
  total,
  page,
  pageSize,
  activeGroupName,
  onPageChange,
  onView,
  onCancelCollect,
  onMoveGroup,
  groups,
  showMove = true,
}) => {
  // 移动分组的下拉菜单
  const getMoveMenuItems = (doc: CollectDocItem) => {
    const otherGroups = (groups || []).filter((g: CollectGroup) => g.id !== doc.group_id);
    return [
      {
        key: '0',
        label: '移至未分组',
        onClick: () => onMoveGroup(doc, 0),
      },
      ...otherGroups.map((g: CollectGroup) => ({
        key: String(g.id),
        label: g.name,
        onClick: () => onMoveGroup(doc, g.id),
      })),
    ];
  };

  return (
    <Card
      size="small"
      className="collect-doc-card"
      title={
        <Space size={8}>
          <StarFilled className="collect-icon-gold" />
          <span>{activeGroupName}</span>
          <Tag color="gold">{total} 篇</Tag>
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
              description="暂无收藏文档"
              className="collect-empty"
            />
          ),
        }}
        renderItem={(doc: CollectDocItem) => (
          <List.Item
            className="collect-doc-item"
            actions={[
              <Tooltip key="view" title="查看文档">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => onView(doc)}
                >
                  查看
                </Button>
              </Tooltip>,
              ...(showMove
                ? [
                    <Dropdown
                      key="move"
                      menu={{ items: getMoveMenuItems(doc) }}
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
                title="确定取消收藏该文档？"
                onConfirm={() => onCancelCollect(doc)}
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
                  icon={<StarFilled />}
                  className="collect-doc-avatar"
                  size={40}
                />
              }
              title={
                <Space size={8} wrap>
                  <a
                    onClick={() => onView(doc)}
                    className="collect-item-title"
                  >
                    {doc.name}
                  </a>
                  <Tag color="blue" className="collect-item-tag">{doc.group_name}</Tag>
                </Space>
              }
              description={
                <Space size={12} wrap className="collect-item-meta">
                  <span>📁 {doc.project_name}</span>
                  <span>👤 {doc.author_name}</span>
                  <span>⭐ 收藏于 {dayjs(doc.collect_time).format('YYYY-MM-DD')}</span>
                  {doc.summary && (
                    <Text type="secondary" className="collect-item-summary">
                      {doc.summary.length > 60 ? doc.summary.slice(0, 60) + '...' : doc.summary}
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

export default CollectDocList;
