// src/pages/DocEditor/components/TemplateManager.tsx
// 模板管理组件：模板编辑提示条 + 存为新模板弹窗 + 编辑模板信息弹窗
// 组件自治：内部使用 useTemplateManager hook，通过 ref 暴露 editTemplate 方法
import type { DocTemplateItem } from '@/components/DocTemplateManager/types';
import type { MDXEditorRef } from '@/components/MDXEditor';
import {
  EditOutlined,
  FormOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { Button, Form, Input, Modal, Select, Space, Tag } from 'antd';
import React, {
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useTemplateManager } from '../hooks/useTemplateManager';

export interface TemplateManagerRef {
  editTemplate: (template: DocTemplateItem) => void;
  saveAsTemplate: () => void;
}

interface TemplateManagerProps {
  mdxEditorRef: React.RefObject<MDXEditorRef>;
  currentUser?: { username?: string } | null;
}

const TemplateManager = forwardRef<TemplateManagerRef, TemplateManagerProps>(
  ({ mdxEditorRef, currentUser }, ref) => {
    const {
      editingTemplate,
      saveTemplateModalVisible,
      templateInfoModalVisible,
      templateInfoForm,
      saveTemplateForm,
      templateCategories,
      handleEditTemplate,
      handleSaveTemplateEdit,
      handleCancelTemplateEdit,
      handleOpenTemplateInfoModal,
      handleSaveTemplateInfo,
      handleSaveAsTemplate,
      handleSaveTemplateConfirm,
      setSaveTemplateModalVisible,
      setTemplateInfoModalVisible,
    } = useTemplateManager({ mdxEditorRef, currentUser });

    // 通过 ref 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      editTemplate: handleEditTemplate,
      saveAsTemplate: handleSaveAsTemplate,
    }));

    return (
      <>
        {/* 临时编辑模板提示条 */}
        {editingTemplate && (
          <div className="template-edit-banner">
            <div className="template-edit-banner-left">
              <EditOutlined className="template-edit-icon" />
              <span className="template-edit-title">正在编辑模板：</span>
              <span className="template-edit-name">
                {editingTemplate.title}
              </span>
              <Tag color="orange" className="template-edit-tag">
                模板编辑
              </Tag>
            </div>
            <div className="template-edit-banner-right">
              <Button
                size="small"
                icon={<FormOutlined />}
                onClick={handleOpenTemplateInfoModal}
              >
                编辑信息
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                onClick={handleSaveTemplateEdit}
              >
                保存修改
              </Button>
              <Button size="small" onClick={handleCancelTemplateEdit}>
                取消
              </Button>
            </div>
          </div>
        )}

        {/* 存为新模板弹窗 */}
        <Modal
          title="存为新模板"
          open={saveTemplateModalVisible}
          onCancel={() => {
            setSaveTemplateModalVisible(false);
            saveTemplateForm.resetFields();
          }}
          onOk={handleSaveTemplateConfirm}
          okText="保存"
          cancelText="取消"
          width={560}
          destroyOnClose
        >
          <Form form={saveTemplateForm} layout="vertical" preserve={false}>
            <Form.Item
              name="title"
              label="模板标题"
              rules={[{ required: true, message: '请输入模板标题' }]}
            >
              <Input placeholder="请输入模板标题" maxLength={50} showCount />
            </Form.Item>
            <Form.Item name="description" label="模板描述">
              <Input.TextArea
                placeholder="请输入模板描述（选填）"
                rows={2}
                maxLength={200}
                showCount
              />
            </Form.Item>
            <Form.Item
              name="category_id"
              label="模板分类"
              rules={[{ required: true, message: '请选择模板分类' }]}
            >
              <Select
                placeholder="请选择模板分类"
                options={templateCategories.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
              />
            </Form.Item>
            <Form.Item name="new_category" label="或新建分类">
              <Input placeholder="输入新分类名称（选填，填写后优先使用新分类）" />
            </Form.Item>
            <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
              模板内容将自动使用当前编辑器中的内容，保存后可在右侧"文档模板"Tab
              中查看和使用。
            </div>
          </Form>
        </Modal>

        {/* 编辑模板信息弹窗 */}
        <Modal
          title="编辑模板信息"
          open={templateInfoModalVisible}
          onCancel={() => setTemplateInfoModalVisible(false)}
          onOk={handleSaveTemplateInfo}
          okText="确定"
          cancelText="取消"
          width={520}
          destroyOnClose
        >
          <Form form={templateInfoForm} layout="vertical" preserve={false}>
            <Form.Item
              name="title"
              label="模板标题"
              rules={[{ required: true, message: '请输入模板标题' }]}
            >
              <Input placeholder="请输入模板标题" maxLength={50} showCount />
            </Form.Item>
            <Form.Item name="description" label="模板描述">
              <Input.TextArea
                placeholder="请输入模板描述（选填）"
                rows={2}
                maxLength={200}
                showCount
              />
            </Form.Item>
            <Form.Item
              name="category_id"
              label="模板分类"
              rules={[{ required: true, message: '请选择模板分类' }]}
            >
              <Select
                placeholder="请选择模板分类"
                options={templateCategories.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
              />
            </Form.Item>
            <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
              修改信息后，点击"确定"暂存修改，再点击提示条上的"保存修改"完成保存。
            </div>
          </Form>
        </Modal>
      </>
    );
  },
);

TemplateManager.displayName = 'TemplateManager';

export default TemplateManager;
