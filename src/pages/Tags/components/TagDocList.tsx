// src/pages/Tags/components/TagDocList.tsx
// 标签页面 - 右侧标签下的文档列表（含翻页）
import {
  CloseOutlined,
  EyeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Empty,
  List,
  Pagination,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import type { TagDocListProps } from '../types';

const { Text } = Typography;

const TagDocList: React.FC<TagDocListProps> = ({
  list,
  loading,
  total,
  page,
  pageSize,
  selectedTagName,
  onPageChange,
  onView,
  onClearTag,
}) => {
  return (
    <Card
      size="small"
      className="tag-doc-card"
      title={
        <Space size={8}>
          <FileTextOutlined className="tags-icon-blue" />
          <span>
            {selectedTagName ? '标签文档列表' : '标签文档列表'}
          </span>
          {selectedTagName && (
            <Tag
              color="blue"
              closable
              onClose={(e) => {
                e.preventDefault();
                onClearTag?.();
              }}
              closeIcon={<CloseOutlined style={{ fontSize: 10 }} />}
            >
              {selectedTagName}
            </Tag>
          )}
          {total > 0 && <Tag color="default">{total} 篇</Tag>}
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
              description={selectedTagName ? '该标签下暂无文档' : '请选择左侧标签查看文档'}
              className="tags-empty"
            />
          ),
        }}
        renderItem={(doc) => (
          <List.Item
            className="tag-doc-item"
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
            ]}
          >
            <List.Item.Meta
              avatar={
                <Avatar
                  icon={<FileTextOutlined />}
                  className="tags-avatar"
                  size={40}
                />
              }
              title={
                <Space size={8} wrap>
                  <a
                    onClick={() => onView(doc)}
                    className="tags-item-title"
                  >
                    {doc.name}
                  </a>
                  {/* 文档的所有标签 */}
                  {doc.tags?.map((tag) => (
                    <Tag key={tag.id} color={tag.color} className="tags-item-tag">
                      {tag.name}
                    </Tag>
                  ))}
                </Space>
              }
              description={
                <Space size={12} wrap className="tags-item-meta">
                  <span>📁 {doc.project_name}</span>
                  <span>👤 {doc.author_name}</span>
                  <span>🕐 更新于 {dayjs(doc.update_time).format('YYYY-MM-DD')}</span>
                  {doc.summary && (
                    <Text type="secondary" className="tags-item-summary">
                      {doc.summary.length > 60
                        ? doc.summary.slice(0, 60) + '...'
                        : doc.summary}
                    </Text>
                  )}
                </Space>
              }
            />
          </List.Item>
        )}
      />
      {total > 0 && (
        <div className="tags-pagination">
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

export default TagDocList;
