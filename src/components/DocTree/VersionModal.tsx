/**
 * DocTree 版本管理弹窗组件
 * 支持版本的新增/编辑/删除/设为当前/回滚
 */
import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  message,
} from 'antd';
import React, { useEffect, useState } from 'react';
import type { DocItem, VersionActionType, VersionModalProps } from './types';

const { Option } = Select;
const { TextArea } = Input;

const VersionModal: React.FC<VersionModalProps> = ({
  visible,
  action,
  initialData,
  docInfo,
  docVersions = [],
  onClose,
  onSubmit,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && action) {
      form.setFieldsValue({
        version: initialData?.version || '',
        status: initialData?.status || 'draft',
        remark: initialData?.remark || '',
        base_version_id: initialData?.base_version_id,
      });
    } else {
      form.resetFields();
    }
  }, [visible, action, initialData, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const result = onSubmit(action as VersionActionType, {
        ...initialData,
        ...values,
        doc_id: docInfo?.id,
      });
      if (result instanceof Promise) await result;
      setLoading(false);
      onClose();
      message.success('操作成功');
    } catch (e: any) {
      setLoading(false);
      if (e?.errorFields) return;
      message.error(e?.message || '操作失败，请重试');
    }
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      const result = onSubmit(action as VersionActionType, initialData);
      if (result instanceof Promise) await result;
      setLoading(false);
      onClose();
      message.success(
        action === 'set-current-version'
          ? '已设为当前版本'
          : action === 'rollback-version'
            ? '已回滚到此版本'
            : '删除成功',
      );
    } catch (e: any) {
      setLoading(false);
      message.error(e?.message || '操作失败，请重试');
    }
  };

  const getTitle = () => {
    switch (action) {
      case 'add-version':
        return '新建版本';
      case 'edit-version':
        return '编辑版本';
      case 'delete-version':
        return '删除版本';
      case 'set-current-version':
        return '设为当前版本';
      case 'rollback-version':
        return '回滚版本';
      case 'compare-version':
        return '对比版本';
      default:
        return '版本管理';
    }
  };

  const isFormAction = action === 'add-version' || action === 'edit-version';
  const isConfirmAction =
    action === 'delete-version' ||
    action === 'set-current-version' ||
    action === 'rollback-version';

  const getConfirmText = () => {
    switch (action) {
      case 'delete-version':
        return '确定要删除此版本吗？删除后不可恢复。';
      case 'set-current-version':
        return '确定要将此版本设为当前版本吗？';
      case 'rollback-version':
        return '确定要回滚到此版本吗？当前版本的内容将被替换。';
      default:
        return '确定要执行此操作吗？';
    }
  };

  return (
    <Modal
      title={getTitle()}
      open={visible}
      onCancel={onClose}
      footer={
        isFormAction ? (
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={handleOk} loading={loading}>
              确认
            </Button>
          </Space>
        ) : isConfirmAction ? (
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Popconfirm title={getConfirmText()} onConfirm={handleConfirm}>
              <Button
                danger={action === 'delete-version'}
                type={action === 'delete-version' ? 'default' : 'primary'}
                icon={
                  action === 'delete-version' ? (
                    <DeleteOutlined />
                  ) : action === 'set-current-version' ? (
                    <SaveOutlined />
                  ) : (
                    <HistoryOutlined />
                  )
                }
                loading={loading}
              >
                {action === 'delete-version' ? '确认删除' : '确认'}
              </Button>
            </Popconfirm>
          </Space>
        ) : null
      }
      destroyOnClose
    >
      {isFormAction ? (
        <Form form={form} layout="vertical">
          <Form.Item
            name="version"
            label="版本号"
            rules={[{ required: true, message: '请输入版本号' }]}
          >
            <Input placeholder="如 v1.0、v2.0、draft" />
          </Form.Item>

          <Form.Item
            name="status"
            label="版本状态"
            rules={[{ required: true, message: '请选择版本状态' }]}
          >
            <Select placeholder="请选择版本状态">
              <Option value="draft">草稿</Option>
              <Option value="published">已发布</Option>
              <Option value="archived">已归档</Option>
              <Option value="deprecated">废弃</Option>
            </Select>
          </Form.Item>

          {/* 新建版本时：选择基底版本（基于哪个版本进行编辑升级） */}
          {action === 'add-version' && docVersions.length > 0 && (
            <Form.Item
              name="base_version_id"
              label="基底版本"
              extra="选择一个版本作为基础，新版本将继承该版本的内容进行对比编辑；不选择则创建内容为空的新版本"
            >
              <Select placeholder="请选择基底版本（不选则内容为空）" allowClear>
                {docVersions.map((v) => (
                  <Option key={v.id} value={v.id}>
                    {v.version}
                    {v.is_current && '（当前）'}
                    {v.status === 'draft' && ' - 草稿'}
                    {v.status === 'published' && ' - 已发布'}
                    {v.status === 'archived' && ' - 已归档'}
                    {v.status === 'deprecated' && ' - 废弃'}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="remark" label="版本备注">
            <TextArea rows={3} placeholder="请输入版本备注（可选）" />
          </Form.Item>
        </Form>
      ) : isConfirmAction ? (
        <div style={{ padding: '16px 0' }}>
          <p>
            文档：<strong>{docInfo?.name}</strong>
          </p>
          <p>
            版本：<strong>{initialData?.version}</strong>（{
              initialData?.status === 'draft' ? '草稿' :
              initialData?.status === 'published' ? '已发布' :
              initialData?.status === 'archived' ? '已归档' :
              initialData?.status === 'deprecated' ? '废弃' : '未知'
            }）
          </p>
          <p style={{ color: '#999', fontSize: 12, marginTop: 8 }}>{getConfirmText()}</p>
        </div>
      ) : null}
    </Modal>
  );
};

export default VersionModal;
