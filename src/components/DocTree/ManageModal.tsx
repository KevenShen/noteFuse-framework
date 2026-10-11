/**
 * DocTree 管理弹窗组件
 * 支持分类和文档的新增/编辑/删除
 */
import { DeleteOutlined } from '@ant-design/icons';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  TreeSelect,
  message,
} from 'antd';
import type { TreeSelectProps } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import type { CategoryItem, ManageActionType, ManageModalProps } from './types';

/** 分类树节点 */
interface CategoryTreeNode {
  title: string;
  value: number;
  key: number;
  disabled?: boolean;
  children?: CategoryTreeNode[];
}

/**
 * 扁平化分类数据转树形结构
 * @param categories 扁平化分类列表
 * @param parentId 父分类 ID
 * @param maxLevel 最大层级（默认 3 级）
 * @param currentLevel 当前层级
 */
const buildCategoryTree = (
  categories: CategoryItem[],
  parentId: number = 0,
  maxLevel: number = 3,
  currentLevel: number = 1,
): CategoryTreeNode[] => {
  if (currentLevel > maxLevel) return [];
  return categories
    .filter((cat) => (cat.parent_id || 0) === parentId)
    .sort((a, b) => a.sort - b.sort)
    .map((cat) => ({
      title: cat.name,
      value: cat.id,
      key: cat.id,
      children: buildCategoryTree(categories, cat.id, maxLevel, currentLevel + 1),
    }));
};

const ManageModal: React.FC<ManageModalProps> = ({
  visible,
  action,
  initialData,
  categories = [],
  onClose,
  onSubmit,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 递归查找指定分类的所有子分类 ID（用于避免循环嵌套）
  const getChildCategoryIds = (categoryId: number): number[] => {
    const childIds = categories
      .filter((cat) => (cat.parent_id || 0) === categoryId)
      .map((cat) => cat.id);
    const allChildIds = [...childIds];
    childIds.forEach((id) => {
      allChildIds.push(...getChildCategoryIds(id));
    });
    return allChildIds;
  };

  // 编辑分类时，不能选择自己或自己的子分类作为父分类
  const disabledCategoryIds = useMemo(() => {
    if (action !== 'edit-category' || !initialData?.id) return [];
    return [initialData.id, ...getChildCategoryIds(initialData.id)];
  }, [action, initialData, categories]);

  // 分类树数据（三级分类）
  const categoryTreeData = useMemo(() => {
    const tree = buildCategoryTree(categories, 0, 3);
    // 添加顶级分类选项（value=0）
    return [
      {
        title: '顶级分类',
        value: 0,
        key: 0,
        children: tree,
      },
    ];
  }, [categories]);

  // 禁用指定节点及其子节点
  const disableTreeNode = (
    node: CategoryTreeNode,
    disabledIds: number[],
  ): CategoryTreeNode => {
    return {
      ...node,
      disabled: disabledIds.includes(node.value),
      children: node.children?.map((child) => disableTreeNode(child, disabledIds)),
    };
  };

  // 最终的分类树数据（含禁用状态）
  const finalCategoryTreeData = useMemo(() => {
    if (disabledCategoryIds.length === 0) return categoryTreeData;
    return categoryTreeData.map((node) => disableTreeNode(node, disabledCategoryIds));
  }, [categoryTreeData, disabledCategoryIds]);

  // TreeSelect 配置
  const treeSelectProps: TreeSelectProps = {
    treeData: finalCategoryTreeData,
    placeholder: '请选择父分类（顶级分类为根节点）',
    allowClear: false,
    treeDefaultExpandAll: true,
    showSearch: true,
    treeNodeFilterProp: 'title',
    style: { width: '100%' },
  };

  useEffect(() => {
    if (visible && action) {
      form.setFieldsValue({
        name: initialData?.name || '',
        sort: initialData?.sort ?? 0,
        parent_id: initialData?.parent_id ?? 0,
        doc_category_id: initialData?.doc_category_id,
        summary: initialData?.summary || '',
      });
    } else {
      form.resetFields();
    }
  }, [visible, action, initialData, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      // 支持异步操作，等待 onSubmit 返回的 Promise
      const result = onSubmit(action as ManageActionType, { ...initialData, ...values });
      if (result instanceof Promise) {
        await result;
      }
      setLoading(false);
      onClose();
      message.success('操作成功');
    } catch (e: any) {
      setLoading(false);
      // 表单验证失败不显示错误消息，其他错误显示
      if (e?.errorFields) return;
      message.error(e?.message || '操作失败，请重试');
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      const result = onSubmit(action as ManageActionType, initialData);
      if (result instanceof Promise) {
        await result;
      }
      setLoading(false);
      onClose();
      message.success('删除成功');
    } catch (e: any) {
      setLoading(false);
      message.error(e?.message || '删除失败，请重试');
    }
  };

  const getTitle = () => {
    switch (action) {
      case 'add-category':
        return '新增分类';
      case 'edit-category':
        return '编辑分类';
      case 'delete-category':
        return '删除分类';
      case 'add-doc':
        return '新增文档';
      case 'edit-doc':
        return '编辑文档';
      case 'delete-doc':
        return '删除文档';
      case 'move-doc':
        return '移动文档';
      default:
        return '管理';
    }
  };

  const isCategoryAction = action?.includes('category');
  const isDeleteAction = action?.includes('delete');

  return (
    <Modal
      title={getTitle()}
      open={visible}
      onCancel={onClose}
      footer={
        isDeleteAction ? (
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Popconfirm
              title="确定要删除吗？"
              description="删除后不可恢复"
              onConfirm={handleDelete}
            >
              <Button danger icon={<DeleteOutlined />} loading={loading}>
                确认删除
              </Button>
            </Popconfirm>
          </Space>
        ) : (
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={handleOk} loading={loading}>
              确认
            </Button>
          </Space>
        )
      }
      destroyOnClose
    >
      {isDeleteAction ? (
        <div style={{ padding: '16px 0' }}>
          <p>确定要删除「{initialData?.name}」吗？</p>
          <p style={{ color: '#999', fontSize: 12, lineHeight: 1.6 }}>
            {isCategoryAction
              ? '删除分类后，该分类下的子分类将提升一级，文档将变为未分类。此操作不可恢复。'
              : '删除后不可恢复。'}
          </p>
        </div>
      ) : (
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={isCategoryAction ? '分类名称' : '文档名称'}
            rules={[{ required: true, message: `请输入${isCategoryAction ? '分类' : '文档'}名称` }]}
          >
            <Input placeholder={`请输入${isCategoryAction ? '分类' : '文档'}名称`} />
          </Form.Item>

          {/* 分类：选择父分类（三级分类树形选择） */}
          {isCategoryAction && (
            <Form.Item
              name="parent_id"
              label="父分类"
              initialValue={0}
              rules={[{ required: true, message: '请选择父分类' }]}
            >
              <TreeSelect {...treeSelectProps} />
            </Form.Item>
          )}

          {/* 文档：选择所属分类（三级分类树形选择） */}
          {!isCategoryAction && (
            <Form.Item
              name="doc_category_id"
              label="所属分类"
              rules={[{ required: true, message: '请选择所属分类' }]}
            >
              <TreeSelect
                treeData={buildCategoryTree(categories, 0, 3)}
                placeholder="请选择所属分类"
                allowClear={false}
                treeDefaultExpandAll
                showSearch
                treeNodeFilterProp="title"
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}

          {/* 文档：副标题（summary），用于列表显示和 Tooltip 提示 */}
          {!isCategoryAction && (
            <Form.Item
              name="summary"
              label="副标题"
              extra="简短描述文档内容，用于列表显示和鼠标悬停提示"
            >
              <Input.TextArea
                placeholder="请输入文档副标题（可选）"
                rows={2}
                maxLength={200}
                showCount
                autoSize={{ minRows: 2, maxRows: 4 }}
              />
            </Form.Item>
          )}

          <Form.Item name="sort" label="排序" initialValue={0}>
            <InputNumber style={{ width: '100%' }} placeholder="排序值，越小越靠前" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};

export default ManageModal;
