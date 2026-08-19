/**
 * 弹窗表单工厂
 * 视频/音频/附件/Tabs 4 个表单结构完全相同，用工厂函数消除重复
 */
import React from 'react';
import { Form, Input, Button } from 'antd';
import type { ReactNode } from 'react';

interface FormFieldConfig {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  message?: string;
}

interface ModalFormConfig {
  fields: FormFieldConfig[];
  hint?: string;
}

/** 通用弹窗表单工厂 */
const createModalForm = <T extends Record<string, any>>(cfg: ModalFormConfig) => {
  return (init: Record<string, any>, onFinish: (vals: T) => void): ReactNode => (
    <Form layout="vertical" initialValues={init} onFinish={onFinish}>
      {cfg.fields.map((f) => (
        <Form.Item
          key={f.name}
          label={f.label}
          name={f.name}
          rules={f.required ? [{ required: true, message: f.message || `请输入${f.label}` }] : undefined}
        >
          <Input placeholder={f.placeholder} />
        </Form.Item>
      ))}
      {cfg.hint && (
        <div style={{ fontSize: 12, color: '#999', marginTop: -8, marginBottom: 16 }}>
          {cfg.hint}
        </div>
      )}
      <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
        <Button type="primary" htmlType="submit">确认插入</Button>
      </Form.Item>
    </Form>
  );
};

// 视频弹窗
export const renderVideoForm = createModalForm<{ url: string }>({
  fields: [{ name: 'url', label: '视频链接', placeholder: '支持 MP4/WebM、B站、YouTube 链接', required: true }],
  hint: '支持：MP4/WebM 直链、bilibili.com、youtube.com / youtu.be',
});

// 音频弹窗
export const renderAudioForm = createModalForm<{ url: string }>({
  fields: [{ name: 'url', label: '音频链接', placeholder: 'MP3 / WAV / OGG 等音频文件直链', required: true }],
});

// 附件弹窗
export const renderAttachmentForm = createModalForm<{ name: string; url: string }>({
  fields: [
    { name: 'name', label: '附件名称', placeholder: '显示在文档中的附件名称', required: true },
    { name: 'url', label: '附件链接', placeholder: '附件文件下载地址', required: true },
  ],
});

// Tabs 弹窗
export const renderTabsForm = createModalForm<{ tab1: string; tab2?: string; tab3?: string }>({
  fields: [
    { name: 'tab1', label: '标签 1 标题', placeholder: '第一个标签的标题', required: true },
    { name: 'tab2', label: '标签 2 标题', placeholder: '第二个标签的标题（可选）' },
    { name: 'tab3', label: '标签 3 标题', placeholder: '第三个标签的标题（可选）' },
  ],
  hint: '插入后可直接在编辑器中编辑各标签内容，支持平铺模式查看全部',
});
