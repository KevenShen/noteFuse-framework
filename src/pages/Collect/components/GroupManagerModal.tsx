// src/pages/Collect/components/GroupManagerModal.tsx
// 收藏页面 - 分组管理弹窗（组件自治：直接从 Dva model 取数 + 增删改）
import {
  DeleteOutlined,
  EditOutlined,
  FolderOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useShallowSelector } from '@/hooks';
import {
  Button,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
} from 'antd';
import { useDispatch } from '@umijs/max';
import React, { useEffect, useState } from 'react';
import type { CollectGroup } from '../types';

interface GroupManagerModalProps {
  visible: boolean;
  activeTab: 'project' | 'doc';
  onClose: () => void;
  onDeleteGroup?: (id: number) => void; // 删除分组后的回调（如重置选中分组）
}

const GroupManagerModal: React.FC<GroupManagerModalProps> = ({
  visible,
  activeTab,
  onClose,
  onDeleteGroup,
}) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [editingGroup, setEditingGroup] = useState<CollectGroup | null>(null);
  const [showForm, setShowForm] = useState(false);

  // 直接从 Dva model 取数
  const { collectGroups: groups } = useShallowSelector(
    (state: any) => state.collect,
  );

  // 弹窗关闭时重置
  useEffect(() => {
    if (!visible) {
      setEditingGroup(null);
      setShowForm(false);
      form.resetFields();
    }
  }, [visible, form]);

  // 点击新建
  const handleCreate = () => {
    setEditingGroup(null);
    setShowForm(true);
    form.resetFields();
  };

  // 点击编辑
  const handleEdit = (group: CollectGroup) => {
    setEditingGroup(group);
    setShowForm(true);
    form.setFieldsValue({
      name: group.name,
      description: group.description,
    });
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingGroup) {
        dispatch({
          type: 'collect/updateCollectGroup',
          payload: { id: editingGroup.id, ...values },
        });
      } else {
        dispatch({
          type: 'collect/createCollectGroup',
          payload: { ...values, type: activeTab },
        });
      }
      setShowForm(false);
      setEditingGroup(null);
      form.resetFields();
    } catch (e) {
      // 表单校验失败
    }
  };

  // 取消表单
  const handleCancelForm = () => {
    setShowForm(false);
    setEditingGroup(null);
    form.resetFields();
  };

  // 删除分组
  const handleDelete = (id: number) => {
    dispatch({
      type: 'collect/deleteCollectGroup',
      payload: { id },
    });
    onDeleteGroup?.(id);
  };

  return (
    <Modal
      title={
        <Space size={8}>
          <FolderOutlined className="collect-icon-blue" />
          <span>收藏分组管理</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnClose
    >
      {/* 新建/编辑表单 */}
      {showForm && (
        <div className="group-manager-form">
          <div className="group-manager-form-title">
            {editingGroup ? '编辑分组' : '新建分组'}
          </div>
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="分组名称"
              rules={[{ required: true, message: '请输入分组名称' }]}
            >
              <Input placeholder="请输入分组名称" maxLength={20} />
            </Form.Item>
            <Form.Item name="description" label="分组描述">
              <Input.TextArea
                placeholder="请输入分组描述（可选）"
                rows={2}
                maxLength={100}
              />
            </Form.Item>
            <Form.Item className="group-manager-form-actions">
              <Space>
                <Button onClick={handleCancelForm}>取消</Button>
                <Button type="primary" onClick={handleSubmit}>
                  {editingGroup ? '保存' : '创建'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      )}

      {/* 分组列表 */}
      <div className="group-manager-header">
        <span className="group-manager-count">
          共 {groups.length} 个分组
        </span>
        {!showForm && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建分组
          </Button>
        )}
      </div>

      <List
        dataSource={groups}
        locale={{
          emptyText: <Empty description="暂无分组，点击上方按钮创建" />,
        }}
        renderItem={(group: CollectGroup) => (
          <List.Item
            className="group-manager-list-item"
            actions={[
              <Button
                key="edit"
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(group)}
              >
                编辑
              </Button>,
              <Tooltip
                key="delete"
                title={(group.count || 0) > 0 ? '该分组下有收藏项，不能删除' : '删除分组'}
              >
                <Popconfirm
                  title="确定删除该分组？"
                  description="删除后不可恢复"
                  onConfirm={() => handleDelete(group.id)}
                  okText="确定"
                  cancelText="取消"
                  disabled={(group.count || 0) > 0}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    disabled={(group.count || 0) > 0}
                  >
                    删除
                  </Button>
                </Popconfirm>
              </Tooltip>,
            ]}
          >
            <List.Item.Meta
              avatar={<FolderOutlined className="group-manager-avatar-icon" />}
              title={
                <Space size={8}>
                  <span className="group-manager-group-name">{group.name}</span>
                  <Tag color="blue">{group.count || 0} 篇</Tag>
                </Space>
              }
              description={
                group.description || <span className="group-manager-no-desc">暂无描述</span>
              }
            />
          </List.Item>
        )}
      />
    </Modal>
  );
};

export default GroupManagerModal;
