// src/pages/Tags/components/TagCategoryManager.tsx
// 标签页面 - 标签分类管理器弹窗（支持三级分类的增删改）
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  FolderOutlined,
  PlusOutlined,
  RightOutlined,
  TagsOutlined,
} from '@ant-design/icons';
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
import React, { useState } from 'react';
import type { TagCategory, TagCategoryManagerProps } from '../types';

const TagCategoryManager: React.FC<TagCategoryManagerProps> = ({
  open,
  categories,
  loading,
  submitting,
  onClose,
  onCreate,
  onRename,
  onDelete,
  onMove,
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newParentId, setNewParentId] = useState<number>(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  // 折叠状态：记录被折叠的分类 ID（有子分类的分类可折叠）
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());

  // 打开弹窗时默认全部折叠（有子分类的分类都折叠）
  React.useEffect(() => {
    if (open) {
      const ids = new Set<number>();
      categories.forEach((c) => {
        if (categories.some((child) => child.parent_id === c.id)) {
          ids.add(c.id);
        }
      });
      setCollapsedIds(ids);
    }
  }, [open, categories]);

  // ==================== 可作为父分类的选项（最多二级，因为新建后最多三级） ====================
  // 直接计算，不使用 useMemo，确保 categories 更新后立即生效
  const getParentOptions = () => {
    const options = [{ label: '作为一级分类', value: 0 }];
    // 一级分类可作为父分类
    const level1 = categories.filter((c) => c.parent_id === 0);
    level1.forEach((c) => {
      options.push({ label: c.name, value: c.id });
      // 二级分类也可作为父分类（新建后为三级）
      const children = categories.filter((child) => child.parent_id === c.id);
      children.forEach((child) => {
        options.push({ label: `　└ ${child.name}`, value: child.id });
      });
    });
    return options;
  };

  // ==================== 按层级排序显示（支持折叠） ====================
  const getSortedCategories = (): TagCategory[] => {
    const result: TagCategory[] = [];
    const level1 = categories
      .filter((c) => c.parent_id === 0)
      .sort((a, b) => a.sort - b.sort);
    level1.forEach((l1) => {
      result.push(l1);
      // 如果一级分类被折叠，跳过其子分类
      if (collapsedIds.has(l1.id)) return;
      const level2 = categories
        .filter((c) => c.parent_id === l1.id)
        .sort((a, b) => a.sort - b.sort);
      level2.forEach((l2) => {
        result.push(l2);
        // 如果二级分类被折叠，跳过其三级子分类
        if (collapsedIds.has(l2.id)) return;
        const level3 = categories
          .filter((c) => c.parent_id === l2.id)
          .sort((a, b) => a.sort - b.sort);
        level3.forEach((l3) => result.push(l3));
      });
    });
    return result;
  };

  // 切换折叠状态
  const toggleCollapse = (id: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 判断分类是否有子分类
  const hasChildren = (cat: TagCategory): boolean => {
    return categories.some((c) => c.parent_id === cat.id);
  };

  // 获取分类层级（用于缩进显示）
  const getLevel = (cat: TagCategory): number => {
    if (cat.parent_id === 0) return 1;
    const parent = categories.find((c) => c.id === cat.parent_id);
    if (!parent || parent.parent_id === 0) return 2;
    return 3;
  };

  // 检查分类是否有子分类或标签（用于删除禁用）
  const canDelete = (cat: TagCategory): boolean => {
    const hasChildren = categories.some((c) => c.parent_id === cat.id);
    const hasTags = (cat.tags?.length || 0) > 0;
    return !hasChildren && !hasTags;
  };

  // ==================== 事件处理 ====================

  const handleCreate = () => {
    if (!newCategoryName.trim()) {
      message.warning('请输入分类名称');
      return;
    }
    onCreate(newCategoryName.trim(), newParentId);
    setNewCategoryName('');
    setNewParentId(0);
  };

  const handleStartRename = (id: number, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleConfirmRename = () => {
    if (!editingName.trim()) {
      message.warning('分类名称不能为空');
      return;
    }
    if (editingId !== null) {
      onRename(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  // ==================== 渲染 ====================
  return (
    <Modal
      title={
        <Space size={8}>
          <TagsOutlined style={{ color: '#1890ff' }} />
          <span>标签分类管理</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      {/* 新建分类 */}
      <div className="tag-category-create">
        <Space.Compact style={{ width: '100%' }}>
          <Select
            value={newParentId}
            onChange={setNewParentId}
            options={getParentOptions()}
            style={{ width: 160 }}
          />
          <Input
            placeholder="输入新分类名称"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onPressEnter={handleCreate}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            loading={submitting}
          >
            新建
          </Button>
        </Space.Compact>
      </div>

      {/* 分类列表（按层级缩进显示） */}
      <List
        loading={loading}
        dataSource={getSortedCategories()}
        locale={{ emptyText: <Empty description="暂无分类，快去创建吧" /> }}
        renderItem={(category) => {
          const level = getLevel(category);
          const deletable = canDelete(category);

          // 计算同级分类位置，判断能否上移/下移
          const siblings = categories
            .filter((c) => c.parent_id === category.parent_id && c.type === category.type)
            .sort((a, b) => a.sort - b.sort);
          const siblingIndex = siblings.findIndex((c) => c.id === category.id);
          const canMoveUp = siblingIndex > 0;
          const canMoveDown = siblingIndex < siblings.length - 1;

          return (
            <List.Item
              actions={[
                // 上移/下移按钮（非编辑状态下显示）
                editingId !== category.id && (
                  <Space key="move" size={0}>
                    <Tooltip title="上移">
                      <Button
                        type="text"
                        size="small"
                        icon={<ArrowUpOutlined />}
                        disabled={!canMoveUp}
                        onClick={() => onMove(category.id, 'up')}
                      />
                    </Tooltip>
                    <Tooltip title="下移">
                      <Button
                        type="text"
                        size="small"
                        icon={<ArrowDownOutlined />}
                        disabled={!canMoveDown}
                        onClick={() => onMove(category.id, 'down')}
                      />
                    </Tooltip>
                  </Space>
                ),
                editingId === category.id ? (
                  <Button
                    key="confirm"
                    type="link"
                    size="small"
                    onClick={handleConfirmRename}
                  >
                    确认
                  </Button>
                ) : (
                  <Button
                    key="edit"
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleStartRename(category.id, category.name)}
                  >
                    重命名
                  </Button>
                ),
                <Popconfirm
                  key="delete"
                  title="确定删除该分类？"
                  description={
                    deletable
                      ? '删除后不可恢复'
                      : '该分类下有子分类或标签，无法删除'
                  }
                  onConfirm={() => deletable && onDelete(category.id)}
                  okText="删除"
                  cancelText="取消"
                  disabled={!deletable}
                >
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    disabled={!deletable}
                  >
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <FolderOutlined
                    style={{
                      color: level === 1 ? '#faad14' : level === 2 ? '#1890ff' : '#52c41a',
                      fontSize: 18,
                    }}
                  />
                }
                title={
                  <span style={{ paddingLeft: (level - 1) * 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {/* 折叠/展开箭头（有子分类才显示） */}
                    {hasChildren(category) ? (
                      <span
                        className="category-collapse-arrow"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollapse(category.id);
                        }}
                      >
                        {collapsedIds.has(category.id) ? (
                          <RightOutlined style={{ fontSize: 10, color: '#8c8c8c' }} />
                        ) : (
                          <DownOutlined style={{ fontSize: 10, color: '#8c8c8c' }} />
                        )}
                      </span>
                    ) : (
                      <span style={{ width: 10, display: 'inline-block' }} />
                    )}
                    {editingId === category.id ? (
                      <Input
                        size="small"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onPressEnter={handleConfirmRename}
                        style={{ width: 200, display: 'inline-block' }}
                        autoFocus
                      />
                    ) : (
                      <span style={{ fontWeight: level === 1 ? 600 : 400 }}>
                        {category.name}
                      </span>
                    )}
                  </span>
                }
                description={
                  <Space size={8}>
                    <Tag color={level === 1 ? 'orange' : level === 2 ? 'blue' : 'green'}>
                      {level === 1 ? '一级' : level === 2 ? '二级' : '三级'}
                    </Tag>
                    <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                      {category.tags?.length || 0} 个标签
                    </span>
                  </Space>
                }
              />
            </List.Item>
          );
        }}
      />
    </Modal>
  );
};

export default TagCategoryManager;
