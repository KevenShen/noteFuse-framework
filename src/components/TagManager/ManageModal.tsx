/**
 * TagManageModal - 标签管理弹窗
 *
 * 功能：
 * - 新增标签
 * - 编辑标签
 * - 删除标签确认
 */
import { DeleteOutlined, TagOutlined } from '@ant-design/icons';
import {
  Button,
  ColorPicker,
  Form,
  Input,
  Modal,
  Space,
  Tag,
  message,
} from 'antd';
import type { Color } from 'antd/es/color-picker';
import React, { useEffect, useState } from 'react';
import type { TagItem, TagManageActionType, TagManageModalProps } from './types';
import { TAG_PRESET_COLORS } from './types';

const TagManageModal: React.FC<TagManageModalProps> = ({
  visible,
  action,
  initialData,
  onClose,
  onSubmit,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tagColor, setTagColor] = useState<string>('blue');

  useEffect(() => {
    if (visible) {
      if (action === 'edit-tag' && initialData) {
        form.setFieldsValue({
          name: initialData.name,
          description: initialData.description || '',
        });
        setTagColor(initialData.color || 'blue');
      } else {
        form.resetFields();
        setTagColor('blue');
      }
    }
  }, [visible, action, initialData, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const tagData: TagItem = {
        id: initialData?.id || Date.now(),
        name: values.name.trim(),
        color: tagColor,
        description: values.description?.trim() || '',
        sort: initialData?.sort || 0,
        usage_count: initialData?.usage_count || 0,
      };

      await onSubmit(action as TagManageActionType, tagData);
      message.success(action === 'edit-tag' ? '标签更新成功' : '标签创建成功');
      onClose();
    } catch (error: any) {
      if (error?.errorFields) {
        // 表单验证失败，不处理
      } else {
        message.error('操作失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData) return;
    setLoading(true);
    try {
      await onSubmit('delete-tag', initialData);
      message.success('标签删除成功');
      onClose();
    } catch (error) {
      message.error('删除失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const getModalTitle = () => {
    switch (action) {
      case 'add-tag':
        return '新增标签';
      case 'edit-tag':
        return '编辑标签';
      case 'delete-tag':
        return '删除标签';
      default:
        return '标签管理';
    }
  };

  // 删除确认弹窗
  if (action === 'delete-tag') {
    return (
      <Modal
        title={getModalTitle()}
        open={visible}
        onCancel={onClose}
        footer={[
          <Button key="cancel" onClick={onClose}>
            取消
          </Button>,
          <Button key="delete" danger loading={loading} onClick={handleDelete}>
            确认删除
          </Button>,
        ]}
      >
        <div style={{ padding: '12px 0' }}>
          <Space>
            <Tag color={initialData?.color}>{initialData?.name}</Tag>
          </Space>
          <p style={{ marginTop: 12, color: '#666' }}>
            确定要删除该标签吗？删除后，所有文档与该标签的关联将被移除。此操作不可恢复。
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={getModalTitle()}
      open={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="保存"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="标签名称"
          rules={[
            { required: true, message: '请输入标签名称' },
            { max: 20, message: '标签名称不能超过20个字符' },
          ]}
        >
          <Input placeholder="请输入标签名称" prefix={<TagOutlined />} />
        </Form.Item>

        <Form.Item label="标签颜色">
          <Space wrap>
            <ColorPicker
              value={tagColor}
              onChange={(color: Color) => setTagColor(color.toHexString())}
              showText
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TAG_PRESET_COLORS.map((color) => (
                <Tag
                  key={color}
                  color={color}
                  style={{
                    cursor: 'pointer',
                    margin: 0,
                    border: tagColor === color ? '2px solid #333' : '1px solid transparent',
                  }}
                  onClick={() => setTagColor(color)}
                >
                  {color}
                </Tag>
              ))}
            </div>
          </Space>
        </Form.Item>

        <Form.Item
          name="description"
          label="标签描述（可选）"
          rules={[{ max: 100, message: '描述不能超过100个字符' }]}
        >
          <Input.TextArea
            placeholder="请输入标签描述"
            rows={3}
            maxLength={100}
            showCount
          />
        </Form.Item>
      </Form>

      {/* 预览 */}
      <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>预览效果</div>
        <Tag color={tagColor} style={{ fontSize: 14, padding: '4px 12px' }}>
          {form.getFieldValue('name') || '标签名称'}
        </Tag>
      </div>
    </Modal>
  );
};

export default TagManageModal;
