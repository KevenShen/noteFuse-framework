// src/pages/Quick/components/QuickGroupManager.tsx
// 快捷操作页面 - 分组管理器弹窗（组件自治：直接从 Dva model 取数 + 增删改分组）
import { DeleteOutlined, EditOutlined, FolderOutlined, PlusOutlined } from '@ant-design/icons';
import { useShallowSelector } from '@/hooks';
import {
  Button,
  Empty,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Tag,
  message,
} from 'antd';
import { useDispatch } from '@umijs/max';
import React, { useState } from 'react';

interface QuickGroupManagerProps {
  open: boolean;
  onClose: () => void;
  onDeleteGroup?: (id: number) => void; // 删除分组后的回调（如重置选中分组）
}

const QuickGroupManager: React.FC<QuickGroupManagerProps> = ({
  open,
  onClose,
  onDeleteGroup,
}) => {
  const dispatch = useDispatch();

  // 直接从 Dva model 取数
  const {
    quickGroups: groups,
    quickGroupsLoading: loading,
    quickGroupSubmitting: submitting,
  } = useShallowSelector((state: any) => state.quick);

  const [newGroupName, setNewGroupName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  // 创建分组
  const handleCreate = () => {
    if (!newGroupName.trim()) {
      message.warning('请输入分组名称');
      return;
    }
    dispatch({
      type: 'quick/createQuickGroup',
      payload: { name: newGroupName.trim() },
    });
    setNewGroupName('');
  };

  // 开始重命名
  const handleStartRename = (id: number, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  // 确认重命名
  const handleConfirmRename = () => {
    if (!editingName.trim()) {
      message.warning('分组名称不能为空');
      return;
    }
    if (editingId !== null) {
      dispatch({
        type: 'quick/updateQuickGroup',
        payload: { id: editingId, name: editingName.trim() },
      });
    }
    setEditingId(null);
    setEditingName('');
  };

  // 删除分组
  const handleDelete = (id: number) => {
    dispatch({
      type: 'quick/deleteQuickGroup',
      payload: { id },
    });
    onDeleteGroup?.(id);
  };

  return (
    <Modal
      title={
        <Space size={8}>
          <FolderOutlined style={{ color: '#1890ff' }} />
          <span>分组管理</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnClose
    >
      {/* 新建分组 */}
      <div className="quick-group-create">
        <Input
          placeholder="输入新分组名称"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onPressEnter={handleCreate}
          style={{ width: 280 }}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          loading={submitting}
        >
          新建分组
        </Button>
      </div>

      {/* 分组列表 */}
      <List
        loading={loading}
        dataSource={groups}
        locale={{ emptyText: <Empty description="暂无分组，快去创建吧" /> }}
        renderItem={(group: any) => (
          <List.Item
            actions={[
              editingId === group.id ? (
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
                  onClick={() => handleStartRename(group.id, group.name)}
                >
                  重命名
                </Button>
              ),
              <Popconfirm
                key="delete"
                title="确定删除该分组？"
                description="删除后分组内的操作项将被移除"
                onConfirm={() => handleDelete(group.id)}
                okText="删除"
                cancelText="取消"
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              avatar={<FolderOutlined style={{ color: '#faad14', fontSize: 20 }} />}
              title={
                editingId === group.id ? (
                  <Input
                    size="small"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onPressEnter={handleConfirmRename}
                    style={{ width: 200 }}
                    autoFocus
                  />
                ) : (
                  <span style={{ fontWeight: 500 }}>{group.name}</span>
                )
              }
              description={
                <Tag color="blue">{group.item_count || 0} 个操作</Tag>
              }
            />
          </List.Item>
        )}
      />
    </Modal>
  );
};

export default QuickGroupManager;
