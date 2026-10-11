// src/pages/UserCenter/UserSettings/components/PasswordForm.tsx
// 修改密码表单组件
import { useShallowSelector } from '@/hooks';
import { Button, Form, Input } from 'antd';
import { useDispatch } from '@umijs/max';
import type { ChangePasswordParams } from '@/services';

/** 确认密码校验规则 */
const confirmPasswordRule = ({ getFieldValue }: any) => ({
  validator(_: any, value: string) {
    if (!value || getFieldValue('new_password') === value) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('两次输入的密码不一致'));
  },
});

/** 修改密码表单 */
const PasswordForm: React.FC = () => {
  const dispatch = useDispatch();
  const [form] = Form.useForm<ChangePasswordParams>();
  // 使用 model 的全局 loading 状态，无需新建本地状态
  const loading = useShallowSelector((state: any) => state.user.loading);

  // 修改密码
  // 成功/失败提示由 model 统一处理，页面组件根据返回值判断是否成功，成功后执行业务逻辑
  const handleChangePassword = async (values: ChangePasswordParams) => {
    const result = await dispatch({
      type: 'user/handleChangePassword',
      payload: values,
    });
    if (result) {
      form.resetFields();
      // 修改密码成功后，清除 token 并跳转到登录页（硬跳转确保状态重置）
      localStorage.removeItem('note_fuse_token');
      window.location.href = '/login';
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleChangePassword}
      className="user-settings-form"
    >
      <Form.Item
        name="old_password"
        label="原密码"
        rules={[{ required: true, message: '请输入原密码' }]}
      >
        <Input.Password placeholder="请输入原密码" />
      </Form.Item>

      <Form.Item
        name="new_password"
        label="新密码"
        rules={[
          { required: true, message: '请输入新密码' },
          { min: 6, message: '密码长度至少6位' },
        ]}
      >
        <Input.Password placeholder="请输入新密码" />
      </Form.Item>

      <Form.Item
        name="confirm_password"
        label="确认新密码"
        dependencies={['new_password']}
        rules={[
          { required: true, message: '请再次输入新密码' },
          confirmPasswordRule,
        ]}
      >
        <Input.Password placeholder="请再次输入新密码" />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          修改密码
        </Button>
      </Form.Item>
    </Form>
  );
};

export default PasswordForm;
