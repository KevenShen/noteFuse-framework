// src/components/DocTemplateManager/index.tsx
// 文档模板管理器主组件
// 功能：搜索、分类筛选、预览、插入、编辑（点击进入编辑模式）、删除

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  InsertRowAboveOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type {
  DocTemplateCategory,
  DocTemplateItem,
  DocTemplateManagerProps,
} from './types';
import { systemTemplateCategories, systemTemplates } from './mock';
import {
  deleteTemplate,
  getUserCategories,
  getUserTemplates,
} from './storage';
import './index.less';

const { TextArea } = Input;

/**
 * DocTemplateManager 文档模板管理器
 * 支持搜索、分类筛选、预览、插入、编辑（点击进入编辑模式）、删除
 */
const DocTemplateManager: React.FC<DocTemplateManagerProps> = ({
  onInsert,
  onEdit,
  className = '',
  style,
}) => {
  // 搜索关键词
  const [searchKeyword, setSearchKeyword] = useState('');
  // 选中的分类ID（undefined 表示全部）
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  // 所有分类（系统分类 + 用户分类）
  const [categories, setCategories] = useState<DocTemplateCategory[]>([]);
  // 所有模板（系统模板 + 用户模板）
  const [templates, setTemplates] = useState<DocTemplateItem[]>([]);
  // 预览的模板
  const [previewTemplate, setPreviewTemplate] = useState<DocTemplateItem | null>(null);
  // 刷新标记（用于触发重新加载）
  const [refreshKey, setRefreshKey] = useState(0);

  // 加载分类和模板（系统 + 用户）
  useEffect(() => {
    const userCategories = getUserCategories();
    const userTemplates = getUserTemplates();
    // 合并系统分类和用户分类，按 sort 排序
    const allCategories = [...systemTemplateCategories, ...userCategories].sort(
      (a, b) => a.sort - b.sort,
    );
    // 合并系统模板和用户模板
    const allTemplates = [...systemTemplates, ...userTemplates];
    setCategories(allCategories);
    setTemplates(allTemplates);
  }, [refreshKey]);

  // 刷新模板列表
  const refreshTemplates = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

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
          template.content.toLowerCase().includes(keyword)
        );
      }
      return true;
    });
  }, [templates, searchKeyword, selectedCategory]);

  // 获取分类名称
  const getCategoryName = useCallback(
    (categoryId: number): string => {
      return categories.find((c) => c.id === categoryId)?.name || '未分类';
    },
    [categories],
  );

  // 处理预览
  const handlePreview = useCallback((template: DocTemplateItem) => {
    setPreviewTemplate(template);
  }, []);

  // 处理插入
  const handleInsert = useCallback(
    (template: DocTemplateItem) => {
      onInsert?.(template);
      message.success(`已插入模板：${template.title}`);
    },
    [onInsert],
  );

  // 处理编辑（点击模板标题，进入编辑模板模式）
  const handleEdit = useCallback(
    (template: DocTemplateItem) => {
      onEdit?.(template);
    },
    [onEdit],
  );

  // 处理删除
  const handleDelete = useCallback(
    (template: DocTemplateItem) => {
      if (template.is_system) {
        message.warning('系统模板不可删除');
        return;
      }
      const success = deleteTemplate(template.id);
      if (success) {
        message.success(`已删除模板：${template.title}`);
        refreshTemplates();
      } else {
        message.error('删除失败');
      }
    },
    [refreshTemplates],
  );

  return (
    <div className={`doc-template-manager ${className}`} style={style}>
      {/* 工具栏：搜索 + 分类筛选 */}
      <div className="template-toolbar">
        <Input
          placeholder="搜索模板..."
          prefix={<SearchOutlined />}
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          allowClear
          size="small"
          className="template-search"
        />
        <Select
          placeholder="选择分类"
          value={selectedCategory}
          onChange={(value) => setSelectedCategory(value)}
          allowClear
          size="small"
          className="template-category-select"
          options={[
            { value: undefined, label: '全部分类' },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>

      {/* 模板列表 */}
      <div className="template-list">
        {filteredTemplates.length === 0 ? (
          <div className="template-empty">
            <Empty description="暂无模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <div key={template.id} className="template-item">
              {/* 模板标题 + 系统标签 */}
              <div className="template-header">
                <span
                  className="template-title"
                  onClick={() => handleEdit(template)}
                  title={`点击加载到编辑器：${template.title}`}
                >
                  {template.title}
                </span>
                {template.is_system && (
                  <Tag color="blue" className="system-tag">
                    系统
                  </Tag>
                )}
              </div>

              {/* 模板描述 */}
              <div className="template-description">{template.description}</div>

              {/* 模板底部：分类 + 操作按钮 */}
              <div className="template-footer">
                <span className="template-meta">{getCategoryName(template.category_id)}</span>
                <Space size={4} className="template-actions">
                  <Tooltip title="预览">
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handlePreview(template)}
                    />
                  </Tooltip>
                  <Tooltip title="插入到编辑器">
                    <Button
                      type="text"
                      size="small"
                      icon={<InsertRowAboveOutlined />}
                      onClick={() => handleInsert(template)}
                    />
                  </Tooltip>
                  {!template.is_system && (
                    <Tooltip title="编辑模板">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(template)}
                      />
                    </Tooltip>
                  )}
                  {!template.is_system && (
                    <Popconfirm
                      title="确定删除该模板？"
                      description="删除后不可恢复"
                      onConfirm={() => handleDelete(template)}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Tooltip title="删除">
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                      </Tooltip>
                    </Popconfirm>
                  )}
                </Space>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 预览弹窗 */}
      <Modal
        title={
          <Space>
            <span>{previewTemplate?.title}</span>
            {previewTemplate?.is_system && <Tag color="blue">系统模板</Tag>}
          </Space>
        }
        open={!!previewTemplate}
        onCancel={() => setPreviewTemplate(null)}
        footer={
          <Space>
            <Button onClick={() => setPreviewTemplate(null)}>关闭</Button>
            <Button
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
            </Button>
          </Space>
        }
        width={720}
      >
        {previewTemplate && (
          <div className="template-preview-content">
            <div className="preview-header">
              <div className="preview-meta">
                <span>分类：{getCategoryName(previewTemplate.category_id)}</span>
                {previewTemplate.author && <span>作者：{previewTemplate.author}</span>}
                {previewTemplate.updated_at && <span>更新：{previewTemplate.updated_at}</span>}
              </div>
            </div>
            <div className="preview-body">{previewTemplate.content}</div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DocTemplateManager;
