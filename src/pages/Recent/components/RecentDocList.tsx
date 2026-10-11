// src/pages/Recent/components/RecentDocList.tsx
// 最近使用页面 - 文档列表（含翻页、权限判断）
import {
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Card, Empty, List, Pagination, Space, Tag, Tooltip } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React, { useMemo } from 'react';
import type { RecentDocListProps, RecentDocItem, RecentTabType } from '../types';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const RecentDocList: React.FC<RecentDocListProps> = ({
  list,
  loading,
  total,
  page,
  pageSize,
  tabType,
  currentUserId,
  onPageChange,
  onView,
  onEdit,
}) => {
  // 时间字段根据 tab 类型选择
  const getTimeField = (doc: RecentDocItem): number | string => {
    if (tabType === 'browsed') return doc.browse_time || 0;
    if (tabType === 'created') return doc.create_time || doc.modify_time || 0;
    return doc.update_time || doc.modify_time || 0;
  };

  // 格式化时间显示
  const formatTime = (doc: RecentDocItem): string => {
    const time = getTimeField(doc);
    if (!time) return '-';
    if (typeof time === 'number') {
      return dayjs(time).fromNow();
    }
    return dayjs(time).fromNow();
  };

  // 判断是否可编辑（当前用户创建的才能编辑）
  const canEdit = (doc: RecentDocItem): boolean => {
    return doc.author_id === currentUserId;
  };

  // 列表项渲染
  const renderItem = (doc: RecentDocItem) => {
    const editable = canEdit(doc);
    return (
      <List.Item
        className="recent-doc-item"
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
          editable ? (
            <Tooltip key="edit" title="编辑文档">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(doc)}
              >
                编辑
              </Button>
            </Tooltip>
          ) : (
            <Tooltip key="edit-disabled" title="仅创建者可编辑">
              <Button type="text" size="small" icon={<EditOutlined />} disabled>
                编辑
              </Button>
            </Tooltip>
          ),
        ]}
      >
        <List.Item.Meta
          avatar={
            <Avatar
              icon={<FileTextOutlined />}
              className="recent-doc-avatar"
              size={40}
            />
          }
          title={
            <Space size={8} wrap>
              <a
                onClick={() => onView(doc)}
                className="recent-doc-title"
              >
                {doc.name}
              </a>
              {tabType === 'browsed' && (
                <Tag color="orange" className="recent-doc-tag">已浏览</Tag>
              )}
              {tabType === 'created' && (
                <Tag color="blue" className="recent-doc-tag">我创建</Tag>
              )}
            </Space>
          }
          description={
            <Space size={12} wrap className="recent-doc-meta">
              <span>📁 {doc.project_name || '未知文集'}</span>
              <span>👤 {doc.author_name || '未知'}</span>
              <span>🕐 {formatTime(doc)}</span>
              {doc.summary && (
                <span className="recent-doc-summary">
                  {doc.summary.length > 50 ? doc.summary.slice(0, 50) + '...' : doc.summary}
                </span>
              )}
            </Space>
          }
        />
      </List.Item>
    );
  };

  return (
    <Card
      size="small"
      className="recent-doc-card"
      bodyStyle={{ padding: 0 }}
    >
      <List
        loading={loading}
        dataSource={list}
        renderItem={renderItem}
        locale={{
          emptyText: (
            <Empty
              description={
                tabType === 'browsed' ? '暂无浏览记录' : '暂无文档'
              }
              className="recent-doc-empty"
            />
          ),
        }}
      />
      {total > 0 && (
        <div className="recent-doc-pagination">
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

export default RecentDocList;
