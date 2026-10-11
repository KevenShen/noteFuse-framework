// src/pages/Tags/components/TagCategoryPanel.tsx
// 标签页面 - 左侧标签分类面板（Dropdown 三级分类 + 标签增删改）
import {
  CloseOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  PlusOutlined,
  SettingOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  MenuProps,
  Popconfirm,
  Tag,
  Tooltip,
  message,
} from 'antd';
import React, { useState } from 'react';
import type { TagCategory, TagCategoryPanelProps, TagItem } from '../types';

// ==================== 标签颜色选项 ====================
const TAG_COLORS = [
  { name: 'red', label: '红', hex: '#f5222d' },
  { name: 'orange', label: '橙', hex: '#fa8c16' },
  { name: 'green', label: '绿', hex: '#52c41a' },
  { name: 'blue', label: '蓝', hex: '#1890ff' },
  { name: 'cyan', label: '青', hex: '#13c2c2' },
  { name: 'purple', label: '紫', hex: '#722ed1' },
  { name: 'geekblue', label: '极客蓝', hex: '#2f54eb' },
  { name: 'default', label: '灰', hex: '#8c8c8c' },
];

// 根据颜色名获取色值
const getColorHex = (colorName: string): string => {
  return TAG_COLORS.find((c) => c.name === colorName)?.hex || '#8c8c8c';
};

const TagCategoryPanel: React.FC<TagCategoryPanelProps> = ({
  categories,
  loading,
  selectedTagId,
  onSelectTag,
  onOpenCategoryManager,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  tagSubmitting,
}) => {
  // 当前选中的分类 ID（0 表示全部分类）
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0);

  // 新建标签状态
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('blue');

  // 编辑标签状态
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState('blue');

  // ==================== 递归构建三级分类菜单（参照 Project 分类选择） ====================
  const buildCategoryMenu = (): MenuProps['items'] => {
    const items: MenuProps['items'] = [
      { key: '0', label: '全部分类' },
      { type: 'divider' as const },
    ];

    const buildNode = (cat: TagCategory, level: number): any => {
      const children = categories.filter((c) => c.parent_id === cat.id);
      const hasChildren = children.length > 0;
      const label = (
        <span style={{ paddingLeft: level * 12 }}>
          {hasChildren && <span style={{ marginRight: 4, fontSize: 10 }}>▸</span>}
          {cat.name}
        </span>
      );
      if (!hasChildren) {
        return { key: String(cat.id), label };
      }
      return {
        key: `sub-${cat.id}`,
        label,
        children: [
          {
            key: String(cat.id),
            label: (
              <span style={{ paddingLeft: (level + 1) * 12, color: '#1677ff' }}>
                全部{cat.name}
              </span>
            ),
          },
          { type: 'divider' as const },
          ...children.map((child) => buildNode(child, level + 1)),
        ],
      };
    };

    const roots = categories.filter((c) => c.parent_id === 0);
    roots.forEach((root) => items.push(buildNode(root, 0)));
    return items;
  };

  const getCategoryName = () => {
    if (selectedCategoryId === 0) return '全部分类';
    return categories.find((c) => c.id === selectedCategoryId)?.name || '全部分类';
  };

  const handleCategoryChange = ({ key }: { key: string }) => {
    setSelectedCategoryId(Number(key));
  };

  // ==================== 当前分类下的标签（递归收集子分类标签） ====================
  const currentTags = (() => {
    if (selectedCategoryId === 0) {
      return categories.flatMap((c) => c.tags || []);
    }
    const collectIds = (catId: number): number[] => {
      const children = categories.filter((c) => c.parent_id === catId);
      return [catId, ...children.flatMap((c) => collectIds(c.id))];
    };
    const categoryIds = collectIds(selectedCategoryId);
    return categories
      .filter((c) => categoryIds.includes(c.id))
      .flatMap((c) => c.tags || []);
  })();

  // ==================== 标签增删改 ====================

  // 获取当前最底层分类 ID（用于新建标签）
  const getLeafCategoryId = (): number | null => {
    if (selectedCategoryId === 0) return null;
    const hasChildren = categories.some((c) => c.parent_id === selectedCategoryId);
    return hasChildren ? null : selectedCategoryId;
  };

  const handleAddTag = () => {
    const leafCategoryId = getLeafCategoryId();
    if (!leafCategoryId) {
      message.warning('请先选择最底层分类（叶子节点）再添加标签');
      return;
    }
    if (!newTagName.trim()) {
      message.warning('请输入标签名称');
      return;
    }
    onCreateTag?.(newTagName.trim(), leafCategoryId, newTagColor);
    setNewTagName('');
    setNewTagColor('blue');
    setShowAddTag(false);
  };

  const handleStartEdit = (tag: TagItem) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
    setEditingTagColor(tag.color || 'blue');
  };

  const handleConfirmEdit = () => {
    if (!editingTagName.trim()) {
      message.warning('标签名称不能为空');
      return;
    }
    if (editingTagId !== null) {
      onUpdateTag?.(editingTagId, editingTagName.trim(), editingTagColor);
    }
    setEditingTagId(null);
    setEditingTagName('');
    setEditingTagColor('blue');
  };

  // ==================== 渲染 ====================
  return (
    <Card
      size="small"
      className="tag-category-card"
      title={
        <span className="tags-card-title">
          <TagsOutlined className="tags-icon-blue" />
          <span>标签分类</span>
        </span>
      }
      extra={
        <Tooltip title="分类管理">
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={onOpenCategoryManager}
          />
        </Tooltip>
      }
    >
      {/* 分类选择 Dropdown */}
      <div className="tag-category-dropdown">
        <Dropdown
          menu={{
            items: buildCategoryMenu(),
            onClick: handleCategoryChange,
            selectedKeys: [String(selectedCategoryId)],
          }}
          trigger={['click']}
        >
          <Button className="tag-category-btn" loading={loading}>
            <TagsOutlined />
            <span className="tag-category-btn-name">{getCategoryName()}</span>
            {/* 清除按钮：非全部分类时显示，点击回到全部分类 */}
            {selectedCategoryId !== 0 && (
              <CloseOutlined
                className="tag-category-clear"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCategoryId(0);
                }}
              />
            )}
            <DownOutlined className="dropdown-icon" />
          </Button>
        </Dropdown>
      </div>

      {/* 添加标签按钮 / 输入框 + 颜色选择 */}
      <div className="tag-add-row">
        {showAddTag ? (
          <div className="tag-add-form">
            <Input
              placeholder="标签名称"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onPressEnter={handleAddTag}
              autoFocus
              style={{ flex: 1 }}
            />
            {/* 颜色选择 */}
            <div className="tag-color-picker">
              {TAG_COLORS.map((c) => (
                <span
                  key={c.name}
                  className={`tag-color-dot ${newTagColor === c.name ? 'active' : ''}`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                  onClick={() => setNewTagColor(c.name)}
                />
              ))}
            </div>
            <Button type="primary" size="small" onClick={handleAddTag} loading={tagSubmitting}>
              添加
            </Button>
            <Button size="small" onClick={() => { setShowAddTag(false); setNewTagName(''); }}>
              取消
            </Button>
          </div>
        ) : (
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() => setShowAddTag(true)}
            disabled={selectedCategoryId === 0}
          >
            {selectedCategoryId === 0 ? '请选择分类后添加标签' : '添加标签'}
          </Button>
        )}
      </div>

      {/* 标签列表（横向排列，支持编辑删除） */}
      <div className="tag-category-tags-row">
        {currentTags.length === 0 ? (
          <Empty
            description="该分类下暂无标签"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          currentTags.map((tag: TagItem) => {
            const isChecked = selectedTagId === tag.id;
            const isEditing = editingTagId === tag.id;
            return (
              <div key={tag.id} className="tag-item-wrapper">
                {isEditing ? (
                  <div className="tag-edit-form">
                    <Input
                      size="small"
                      value={editingTagName}
                      onChange={(e) => setEditingTagName(e.target.value)}
                      onPressEnter={handleConfirmEdit}
                      autoFocus
                      className="tag-edit-input"
                    />
                    <div className="tag-color-picker tag-color-picker-sm">
                      {TAG_COLORS.map((c) => (
                        <span
                          key={c.name}
                          className={`tag-color-dot tag-color-dot-sm ${editingTagColor === c.name ? 'active' : ''}`}
                          style={{ backgroundColor: c.hex }}
                          title={c.label}
                          onClick={() => setEditingTagColor(c.name)}
                        />
                      ))}
                    </div>
                    <Button size="small" type="primary" onClick={handleConfirmEdit}>
                      确认
                    </Button>
                  </div>
                ) : (
                  <Tooltip title={`${tag.usage_count} 篇文档`}>
                    <Tag.CheckableTag
                      checked={isChecked}
                      onChange={() => onSelectTag(isChecked ? null : tag.id)}
                      className={`tag-checkable ${isChecked ? 'checked' : ''}`}
                      style={
                        isChecked
                          ? {
                              backgroundColor: getColorHex(tag.color),
                              borderColor: getColorHex(tag.color),
                              color: '#fff',
                            }
                          : {
                              borderColor: getColorHex(tag.color),
                              color: getColorHex(tag.color),
                            }
                      }
                    >
                      <span>{tag.name}</span>
                      <span className="tag-usage-count" style={{ opacity: isChecked ? 0.8 : 0.6 }}>
                        ({tag.usage_count})
                      </span>
                      {isChecked && (
                        <CloseOutlined
                          className="tag-close-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTag(null);
                          }}
                        />
                      )}
                    </Tag.CheckableTag>
                  </Tooltip>
                )}
                {/* 操作按钮：编辑 / 删除 */}
                {!isEditing && (
                  <div className="tag-item-actions">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      className="tag-action-btn"
                      onClick={() => handleStartEdit(tag)}
                    />
                    <Popconfirm
                      title="确定删除该标签？"
                      description="删除后不可恢复"
                      onConfirm={() => onDeleteTag?.(tag.id)}
                      okText="删除"
                      cancelText="取消"
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        className="tag-action-btn"
                      />
                    </Popconfirm>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

export default TagCategoryPanel;
