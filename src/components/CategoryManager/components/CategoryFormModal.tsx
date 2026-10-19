import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
} from 'antd';
import type { FormInstance } from 'antd/es/form';
import React from 'react';
import type { CategoryItem, ColumnDisplayConfig, ExtraFieldConfig } from '../types';

interface CategoryFormModalProps {
  visible: boolean;
  editingRecord: CategoryItem | null;
  form: FormInstance;
  onOk: () => void;
  onCancel: () => void;
  submitting: boolean;
  nameLabel: string;
  columnDisplay: ColumnDisplayConfig;
  extraFields: ExtraFieldConfig[];
  formProps?: any;
  modalTitle: string;
  isMobile: boolean;
}

/** 新增/编辑分类弹窗：PC 端 Modal，移动端底部 Drawer */
const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  visible,
  editingRecord,
  form,
  onOk,
  onCancel,
  submitting,
  nameLabel,
  columnDisplay,
  extraFields,
  formProps,
  modalTitle,
  isMobile,
}) => {
  const dialogTitle = editingRecord ? `编辑${modalTitle}` : `新增${modalTitle}`;

  const renderFormContent = () => (
    <Form form={form} layout="vertical" {...formProps}>
      <Form.Item
        name="name"
        label={nameLabel}
        rules={[{ required: true, message: `请输入${nameLabel}` }]}
      >
        <Input placeholder={`请输入${nameLabel}`} />
      </Form.Item>
      {columnDisplay.sort && (
        <Form.Item name="sort" label="排序" initialValue={1}>
          <InputNumber
            min={1}
            disabled
            style={{ width: '100%' }}
            placeholder="通过拖动调整排序"
          />
        </Form.Item>
      )}
      {extraFields.map((field) => {
        // showInForm 设为 false 时不在表单中显示（需通过 onAdd/onEdit 手动注入）
        if (field.showInForm === false) return null;
        if (!field.formType && !field.renderFormItem) return null;
        return (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.label}
            rules={
              field.rules ||
              (field.required
                ? [{ required: true, message: `请输入${field.label}` }]
                : undefined)
            }
          >
            {/* 优先使用自定义表单组件（Form.Item 自动注入 value 和 onChange） */}
            {field.renderFormItem ?? (
              <>
                {field.formType === 'input' && (
                  <Input placeholder={field.placeholder} />
                )}
                {field.formType === 'textarea' && (
                  <Input.TextArea rows={3} placeholder={field.placeholder} />
                )}
                {field.formType === 'inputNumber' && (
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder={field.placeholder}
                  />
                )}
                {field.formType === 'select' && (
                  <Select
                    options={field.options}
                    placeholder={field.placeholder}
                  />
                )}
              </>
            )}
          </Form.Item>
        );
      })}
    </Form>
  );

  // PC 端：Modal
  if (!isMobile) {
    return (
      <Modal
        title={dialogTitle}
        open={visible}
        onOk={onOk}
        onCancel={onCancel}
        confirmLoading={submitting}
        destroyOnClose
        okText="确定"
        cancelText="取消"
      >
        {renderFormContent()}
      </Modal>
    );
  }

  // 移动端：底部 Drawer
  return (
    <Drawer
      title={dialogTitle}
      placement="bottom"
      open={visible}
      onClose={onCancel}
      height="auto"
      destroyOnClose
      footer={
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" loading={submitting} onClick={onOk}>
              确定
            </Button>
          </Space>
        </div>
      }
    >
      {renderFormContent()}
    </Drawer>
  );
};

export default CategoryFormModal;
