// src/pages/UserCenter/UserSettings/components/EditorSettingsForm.tsx
// 编辑器设置表单组件
import { useShallowSelector } from '@/hooks';
import { Button, Form, Select, Switch } from 'antd';
import { useDispatch } from '@umijs/max';
import { useEffect } from 'react';
import type { CurrentUser } from '@/models';
import type { EditorSettingsParams } from '@/services';

export interface EditorSettingsFormProps {
  /** 当前用户信息 */
  currentUser: CurrentUser | null;
}

/** 编辑器选项常量（模块级，避免每次渲染重建）
 *  与后端 validator.ts 中的 validEditors 保持一致：vditor / mdxeditor / monaco
 */
const EDITOR_OPTIONS = [
  { value: 'vditor', label: 'Vditor 编辑器' },
  { value: 'mdxeditor', label: 'MDXEditor 编辑器' },
  { value: 'monaco', label: 'Monaco 代码编辑器' },
];

/** 编辑器设置表单 */
const EditorSettingsForm: React.FC<EditorSettingsFormProps> = ({ currentUser }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm<EditorSettingsParams>();
  // 使用 model 的全局 loading 状态，无需新建本地状态
  const loading = useShallowSelector((state: any) => state.user.loading);

  // 用户信息加载完成后，设置表单初始值（从 currentUser 中读取扁平字段）
  useEffect(() => {
    if (currentUser) {
      form.setFieldsValue({
        editor: currentUser.editor,
        autosave: currentUser.autosave,
        livepreview: currentUser.livepreview,
      });
    }
  }, [currentUser, form]);

  // 保存编辑器设置
  // 成功/失败提示由 model 统一处理
  const handleSave = async (values: EditorSettingsParams) => {
    await dispatch({
      type: 'user/handleSaveEditorSettings',
      payload: values,
    });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSave}
      className="user-settings-form"
    >
      <Form.Item name="editor" label="默认编辑器">
        <Select options={EDITOR_OPTIONS} />
      </Form.Item>

      <Form.Item
        name="autosave"
        label="自动保存"
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>

      <Form.Item
        name="livepreview"
        label="实时预览"
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          保存设置
        </Button>
      </Form.Item>
    </Form>
  );
};

export default EditorSettingsForm;
