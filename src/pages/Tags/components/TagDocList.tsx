// src/pages/Tags/components/TagDocList.tsx
// 标签页面 - 右侧标签下的文档列表（组件自治：直接从 Dva model 取数 + 翻页 + 查看 + 清除标签）
import {
  CloseOutlined,
  EyeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useShallowSelector } from '@/hooks';
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
import { history, useDispatch } from '@umijs/max';
import dayjs from 'dayjs';
import React, { useCallback, useMemo } from 'react';
import type { TagDocItem, TagItem } from '../types';

const { Text } = Typography;

const TagDocList: React.FC = () => {
  const dispatch = useDispatch();

  // 直接从 Dva model 取数
  const {
    tagDocList: list,
    tagDocLoading: loading,
    tagDocTotal: total,
    tagDocPage: page,
    selectedTagId,
    tagCategories,
  } = useShallowSelector((state: any) => state.tag);

  // 当前选中标签名称
  const selectedTagName = useMemo(() => {
    if (!selectedTagId) return '';
    for (const category of tagCategories) {
      const tag = category.tags?.find((t: TagItem) => t.id === selectedTagId);
      if (tag) return tag.name;
    }
    return '';
  }, [selectedTagId, tagCategories]);

  // 翻页
  const handlePageChange = useCallback(
    (pageNum: number) => {
      if (selectedTagId) {
        dispatch({
          type: 'tag/fetchTagDocs',
          payload: { id: selectedTagId, page: pageNum, page_size: 10 },
        });
      }
    },
    [dispatch, selectedTagId],
  );

  // 查看文档
  const handleView = useCallback((doc: TagDocItem) => {
    history.push(`/doc/${doc.id}?project_id=${doc.project_id}`);
  }, []);

  // 清除选中标签
  const handleClearTag = useCallback(() => {
    dispatch({ type: 'tag/setSelectedTag', payload: null });
    dispatch({
      type: 'tag/saveTagDocList',
      payload: { list: [], total: 0, page: 1 },
    });
  }, [dispatch]);

  return (
    <Card
      size="small"
      className="tag-doc-card"
      title={
        <Space size={8}>
          <FileTextOutlined className="tags-icon-blue" />
          <span>标签文档列表</span>
          {selectedTagName && (
            <Tag
              color="blue"
              closable
              onClose={(e) => {
                e.preventDefault();
                handleClearTag();
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
        renderItem={(doc: TagDocItem) => (
          <List.Item
            className="tag-doc-item"
            actions={[
              <Tooltip key="view" title="查看文档">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => handleView(doc)}
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
                    onClick={() => handleView(doc)}
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
            pageSize={10}
            total={total}
            onChange={handlePageChange}
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
