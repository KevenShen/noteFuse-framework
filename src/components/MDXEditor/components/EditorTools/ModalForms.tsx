/**
 * 弹窗表单工厂
 * 视频/音频/附件/Tabs 4 个表单结构完全相同，用工厂函数消除重复
 */
import { Button, Form, Input, Radio } from 'antd';
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
const createModalForm = <T extends Record<string, any>>(
  cfg: ModalFormConfig,
) => {
  return (
    init: Record<string, any>,
    onFinish: (vals: T) => void,
  ): ReactNode => (
    <Form layout="vertical" initialValues={init} onFinish={onFinish}>
      {cfg.fields.map((f) => (
        <Form.Item
          key={f.name}
          label={f.label}
          name={f.name}
          rules={
            f.required
              ? [{ required: true, message: f.message || `请输入${f.label}` }]
              : undefined
          }
        >
          <Input placeholder={f.placeholder} />
        </Form.Item>
      ))}
      {cfg.hint && (
        <div
          style={{
            fontSize: 12,
            color: '#999',
            marginTop: -8,
            marginBottom: 16,
          }}
        >
          {cfg.hint}
        </div>
      )}
      <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
        <Button type="primary" htmlType="submit">
          确认插入
        </Button>
      </Form.Item>
    </Form>
  );
};

// 视频弹窗
export const renderVideoForm = createModalForm<{ url: string }>({
  fields: [
    {
      name: 'url',
      label: '视频链接',
      placeholder: '支持 MP4/WebM、B站、YouTube 链接',
      required: true,
    },
  ],
  hint: '支持：MP4/WebM 直链、bilibili.com、youtube.com / youtu.be',
});

// 音频弹窗
export const renderAudioForm = createModalForm<{ url: string }>({
  fields: [
    {
      name: 'url',
      label: '音频链接',
      placeholder: 'MP3 / WAV / OGG 等音频文件直链',
      required: true,
    },
  ],
});

// 附件弹窗
export const renderAttachmentForm = createModalForm<{
  name: string;
  url: string;
}>({
  fields: [
    {
      name: 'name',
      label: '附件名称',
      placeholder: '显示在文档中的附件名称',
      required: true,
    },
    {
      name: 'url',
      label: '附件链接',
      placeholder: '附件文件下载地址',
      required: true,
    },
  ],
});

// Tabs 弹窗
export const renderTabsForm = createModalForm<{
  tab1: string;
  tab2?: string;
  tab3?: string;
}>({
  fields: [
    {
      name: 'tab1',
      label: '标签 1 标题',
      placeholder: '第一个标签的标题',
      required: true,
    },
    {
      name: 'tab2',
      label: '标签 2 标题',
      placeholder: '第二个标签的标题（可选）',
    },
    {
      name: 'tab3',
      label: '标签 3 标题',
      placeholder: '第三个标签的标题（可选）',
    },
  ],
  hint: '插入后可直接在编辑器中编辑各标签内容，支持平铺模式查看全部',
});

// Steps 弹窗
export const renderStepsForm = createModalForm<{
  step1: string;
  step2?: string;
  step3?: string;
}>({
  fields: [
    {
      name: 'step1',
      label: '步骤 1 标题',
      placeholder: '第一个步骤的标题',
      required: true,
    },
    {
      name: 'step2',
      label: '步骤 2 标题',
      placeholder: '第二个步骤的标题（可选）',
    },
    {
      name: 'step3',
      label: '步骤 3 标题',
      placeholder: '第三个步骤的标题（可选）',
    },
  ],
  hint: '插入后可直接在编辑器中编辑各步骤内容，支持平铺模式查看全部',
});

// Card 类型选项
const CARD_TYPE_OPTIONS = [
  { label: '默认', value: 'default' },
  { label: '信息', value: 'info' },
  { label: '成功', value: 'success' },
  { label: '警告', value: 'warning' },
  { label: '错误', value: 'error' },
];

// Card 弹窗（自定义表单：标题 + 类型选择器，无法用 createModalForm 工厂）
export const renderCardForm = (
  init: Record<string, any>,
  onFinish: (vals: { title: string; type: string }) => void,
): ReactNode => (
  <Form layout="vertical" initialValues={init} onFinish={onFinish}>
    <Form.Item label="卡片标题" name="title">
      <Input placeholder="卡片标题（可选，留空则无标题栏）" />
    </Form.Item>
    <Form.Item label="卡片类型" name="type">
      <Radio.Group
        options={CARD_TYPE_OPTIONS}
        optionType="button"
        buttonStyle="solid"
      />
    </Form.Item>
    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
      <Button type="primary" htmlType="submit">
        确认插入
      </Button>
    </Form.Item>
  </Form>
);
