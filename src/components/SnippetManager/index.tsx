import React, { useMemo, useState } from 'react';
import { Input, Select, Button, List, Tag, Empty, Tooltip, Modal } from 'antd';
import {
  SearchOutlined,
  InsertRowAboveOutlined,
  EyeOutlined,
  FireOutlined,
} from '@ant-design/icons';
import type { SnippetManagerProps, SnippetItem } from './types';
import './index.less';

/**
 * Snippet 片段管理器
 * 支持搜索、分类筛选、预览、插入
 */
const SnippetManager: React.FC<SnippetManagerProps> = ({
  snippets,
  categories,
  onInsert,
  onPreview,
  className = '',
  style,
}) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | string | undefined>(undefined);
  const [previewSnippet, setPreviewSnippet] = useState<SnippetItem | null>(null);

  // 过滤后的片段列表
  const filteredSnippets = useMemo(() => {
    return snippets.filter((snippet) => {
      // 分类筛选
      if (selectedCategory !== undefined && snippet.category_id !== selectedCategory) {
        return false;
      }
      // 关键词搜索
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase();
        return (
          snippet.title.toLowerCase().includes(keyword) ||
          snippet.description?.toLowerCase().includes(keyword) ||
          snippet.content.toLowerCase().includes(keyword) ||
          snippet.tags?.some((tag) => tag.toLowerCase().includes(keyword))
        );
      }
      return true;
    });
  }, [snippets, searchKeyword, selectedCategory]);

  // 获取分类名称
  const getCategoryName = (categoryId: number | string) => {
    return categories.find((c) => c.id === categoryId)?.name || '未分类';
  };

  // 处理预览
  const handlePreview = (snippet: SnippetItem) => {
    setPreviewSnippet(snippet);
    onPreview?.(snippet);
  };

  // 处理插入
  const handleInsert = (snippet: SnippetItem) => {
    onInsert(snippet);
  };

  return (
    <div className={`snippet-manager ${className}`} style={style}>
      {/* 搜索和筛选区域 */}
      <div className="snippet-toolbar">
        <Input
          placeholder="搜索片段..."
          prefix={<SearchOutlined />}
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          allowClear
          size="small"
          className="snippet-search"
        />
        <Select
          placeholder="全部分类"
          value={selectedCategory}
          onChange={setSelectedCategory}
          allowClear
          size="small"
          className="snippet-category-select"
          options={categories.map((cat) => ({
            value: cat.id,
            label: cat.name,
          }))}
        />
      </div>

      {/* 片段数量 */}
      <div className="snippet-count">
        共 {filteredSnippets.length} 个片段
      </div>

      {/* 片段列表 */}
      {filteredSnippets.length === 0 ? (
        <Empty
          description="未找到匹配的片段"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          className="snippet-empty"
        />
      ) : (
        <List
          dataSource={filteredSnippets}
          className="snippet-list"
          renderItem={(snippet) => (
            <List.Item className="snippet-item">
              <div className="snippet-item-content">
                {/* 标题行 */}
                <div className="snippet-item-header">
                  <span className="snippet-title">{snippet.title}</span>
                  {snippet.usage_count !== undefined && snippet.usage_count > 50 && (
                    <Tooltip title="使用次数">
                      <Tag color="orange" className="snippet-hot-tag">
                        <FireOutlined /> {snippet.usage_count}
                      </Tag>
                    </Tooltip>
                  )}
                </div>

                {/* 描述 */}
                {snippet.description && (
                  <div className="snippet-description">{snippet.description}</div>
                )}

                {/* 预览 */}
                {snippet.preview && (
                  <div className="snippet-preview">{snippet.preview}</div>
                )}

                {/* 标签和分类 */}
                <div className="snippet-meta">
                  <Tag color="blue" className="snippet-category-tag">
                    {getCategoryName(snippet.category_id)}
                  </Tag>
                  {snippet.tags?.map((tag) => (
                    <Tag key={tag} className="snippet-tag">
                      {tag}
                    </Tag>
                  ))}
                </div>

                {/* 操作按钮 */}
                <div className="snippet-actions">
                  <Tooltip title="预览">
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handlePreview(snippet)}
                    >
                      预览
                    </Button>
                  </Tooltip>
                  <Tooltip title="插入到光标位置">
                    <Button
                      type="primary"
                      size="small"
                      icon={<InsertRowAboveOutlined />}
                      onClick={() => handleInsert(snippet)}
                    >
                      插入
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </List.Item>
          )}
        />
      )}

      {/* 预览弹窗 */}
      <Modal
        title={previewSnippet?.title}
        open={!!previewSnippet}
        onCancel={() => setPreviewSnippet(null)}
        footer={[
          <Button key="close" onClick={() => setPreviewSnippet(null)}>
            关闭
          </Button>,
          <Button
            key="insert"
            type="primary"
            icon={<InsertRowAboveOutlined />}
            onClick={() => {
              if (previewSnippet) {
                handleInsert(previewSnippet);
                setPreviewSnippet(null);
              }
            }}
          >
            插入到编辑器
          </Button>,
        ]}
        width={600}
      >
        {previewSnippet && (
          <div className="snippet-preview-modal">
            {previewSnippet.description && (
              <div className="snippet-preview-desc">{previewSnippet.description}</div>
            )}
            <div className="snippet-preview-content">
              <pre><code>{previewSnippet.content}</code></pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SnippetManager;
