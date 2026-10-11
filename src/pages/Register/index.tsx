// src/pages/Register/index.tsx
import { useShallowSelector } from '@/hooks';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { ProForm, ProFormText } from '@ant-design/pro-components';
import { history, useDispatch } from '@umijs/max';

import { Button, Card, Form } from 'antd';

import styles from './index.less';

const RegisterPage: React.FC = () => {
  const dispatch = useDispatch();
  const loading = useShallowSelector((state) => state.userRegister.loading);
  const [form] = Form.useForm();

  // 注册成功/失败提示由 model 统一处理，页面组件只负责调用
  const handleSubmit = async (values: any) => {
    await dispatch({
      type: 'userRegister/handleRegister',
      payload: values,
    });
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card} title="注册账号">
        <ProForm form={form} onFinish={handleSubmit} submitter={false}>
          <ProFormText
            name="username"
            fieldProps={{
              size: 'large',
              prefix: <UserOutlined />,
              placeholder: '请输入用户名',
            }}
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, max: 20, message: '用户名长度3-20位' },
            ]}
          />
          <ProFormText
            name="email"
            fieldProps={{
              size: 'large',
              prefix: <MailOutlined />,
              placeholder: '请输入邮箱',
            }}
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入正确的邮箱格式' },
            ]}
          />
          <ProFormText.Password
            name="password"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined />,
              placeholder: '请输入密码',
            }}
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码长度至少6位' },
            ]}
          />
          <ProFormText.Password
            name="confirm_password"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined />,
              placeholder: '请确认密码',
            }}
            rules={[{ required: true, message: '请再次输入密码' }]}
          />
          <ProFormText
            name="invite_code"
            fieldProps={{ size: 'large', placeholder: '邀请码（选填）' }}
          />
        </ProForm>

        <div className={styles.submit}>
          <Button
            type="primary"
            block
            size="large"
            loading={loading}
            onClick={() => form.submit()}
          >
            注册
          </Button>
          <Button block size="large" onClick={() => history.back()}>
            返回登录
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
