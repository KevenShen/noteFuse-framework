import React, { useMemo, useState } from 'react';
import { Input, Select, Button, List, Tag, Empty, Tooltip, Modal } from 'antd';
import {
  SearchOutlined,
  InsertRowAboveOutlined,
  EyeOutlined,
  FireOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import type { CodeTemplateManagerProps, CodeTemplateItem } from './types';
import './index.less';

/**
 * CodeTemplate 代码模板管理器
 * 支持搜索、分类筛选、预览、插入
 */
const CodeTemplateManager: React.FC<CodeTemplateManagerProps> = ({
  templates,
  categories,
  onInsert,
  onPreview,
  className = '',
  style,
}) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | string | undefined>(undefined);
  const [previewTemplate, setPreviewTemplate] = useState<CodeTemplateItem | null>(null);

  // 过滤后的模板列表
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      // 分类筛选
      if (selectedCategory !== undefined && template.category_id !== selectedCategory) {
        return false;
      }
      // 关键词搜索
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase();
        return (
          template.title.toLowerCase().includes(keyword) ||
          template.description?.toLowerCase().includes(keyword) ||
          template.content.toLowerCase().includes(keyword) ||
          template.language?.toLowerCase().includes(keyword) ||
          template.tags?.some((tag) => tag.toLowerCase().includes(keyword))
        );
      }
      return true;
    });
  }, [templates, searchKeyword, selectedCategory]);

  // 获取分类名称
  const getCategoryName = (categoryId: number | string) => {
    return categories.find((c) => c.id === categoryId)?.name || '未分类';
  };

  // 处理预览
  const handlePreview = (template: CodeTemplateItem) => {
    setPreviewTemplate(template);
    onPreview?.(template);
  };

  // 处理插入
  const handleInsert = (template: CodeTemplateItem) => {
    onInsert(template);
  };

  return (
    <div className={`code-template-manager ${className}`} style={style}>
      {/* 搜索和筛选区域 */}
      <div className="code-template-toolbar">
        <Input
          placeholder="搜索代码模板..."
          prefix={<SearchOutlined />}
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          allowClear
          size="small"
          className="code-template-search"
        />
        <Select
          placeholder="全部分类"
          value={selectedCategory}
          onChange={setSelectedCategory}
          allowClear
          size="small"
          className="code-template-category-select"
          options={categories.map((cat) => ({
            value: cat.id,
            label: cat.name,
          }))}
        />
      </div>

      {/* 模板数量 */}
      <div className="code-template-count">
        共 {filteredTemplates.length} 个模板
      </div>

      {/* 模板列表 */}
      {filteredTemplates.length === 0 ? (
        <Empty
          description="未找到匹配的模板"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          className="code-template-empty"
        />
      ) : (
        <List
          dataSource={filteredTemplates}
          className="code-template-list"
          renderItem={(template) => (
            <List.Item className="code-template-item">
              <div className="code-template-item-content">
                {/* 标题行 */}
                <div className="code-template-item-header">
                  <span className="code-template-title">
                    <CodeOutlined className="code-template-icon" />
                    {template.title}
                  </span>
                  {template.usage_count !== undefined && template.usage_count > 100 && (
                    <Tooltip title="使用次数">
                      <Tag color="orange" className="code-template-hot-tag">
                        <FireOutlined /> {template.usage_count}
                      </Tag>
                    </Tooltip>
                  )}
                </div>

                {/* 描述 */}
                {template.description && (
                  <div className="code-template-description">{template.description}</div>
                )}

                {/* 预览 */}
                {template.preview && (
                  <div className="code-template-preview">{template.preview}</div>
                )}

                {/* 标签和分类 */}
                <div className="code-template-meta">
                  <Tag color="blue" className="code-template-category-tag">
                    {getCategoryName(template.category_id)}
                  </Tag>
                  {template.language && (
                    <Tag color="purple" className="code-template-language-tag">
                      {template.language}
                    </Tag>
                  )}
                  {template.tags?.map((tag) => (
                    <Tag key={tag} className="code-template-tag">
                      {tag}
                    </Tag>
                  ))}
                </div>

                {/* 操作按钮 */}
                <div className="code-template-actions">
                  <Tooltip title="预览">
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handlePreview(template)}
                    >
                      预览
                    </Button>
                  </Tooltip>
                  <Tooltip title="插入到光标位置">
                    <Button
                      type="primary"
                      size="small"
                      icon={<InsertRowAboveOutlined />}
                      onClick={() => handleInsert(template)}
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
        title={previewTemplate?.title}
        open={!!previewTemplate}
        onCancel={() => setPreviewTemplate(null)}
        footer={[
          <Button key="close" onClick={() => setPreviewTemplate(null)}>
            关闭
          </Button>,
          <Button
            key="insert"
            type="primary"
            icon={<InsertRowAboveOutlined />}
            onClick={() => {
              if (previewTemplate) {
                handleInsert(previewTemplate);
                setPreviewTemplate(null);
              }
            }}
          >
            插入到编辑器
          </Button>,
        ]}
        width={700}
      >
        {previewTemplate && (
          <div className="code-template-preview-modal">
            {previewTemplate.description && (
              <div className="code-template-preview-desc">{previewTemplate.description}</div>
            )}
            <div className="code-template-preview-meta">
              {previewTemplate.language && (
                <Tag color="purple">{previewTemplate.language}</Tag>
              )}
              {previewTemplate.tags?.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
            <div className="code-template-preview-content">
              <pre><code>{previewTemplate.content}</code></pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CodeTemplateManager;
