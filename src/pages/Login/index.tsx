// src/pages/Login/index.tsx
import { useShallowSelector } from '@/hooks';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginFormPage, ProFormText } from '@ant-design/pro-components';
import { history, useDispatch } from '@umijs/max';
import { Tabs } from 'antd';
import styles from './index.less';

const LoginPage: React.FC = () => {
  const dispatch = useDispatch();
  const loading = useShallowSelector((state: any) => state.userLogin.loading);

  // 登录成功/失败提示由 model 统一处理，页面组件只负责调用
  const handleSubmit = async (values: any) => {
    await dispatch({
      type: 'userLogin/handleLogin',
      payload: values,
    });
  };

  return (
    <div className={styles.container}>
      <LoginFormPage
        backgroundImageUrl="https://gw.alipayobjects.com/zos/rmsportal/FfdJeJRQWjEeGTpqgBKj.png"
        logo="https://api.dicebear.com/7.x/shapes/svg?seed=mrdoc"
        title="NoteFuse"
        subTitle="在线文档管理系统"
        onFinish={handleSubmit}
        loading={loading}
        actions={
          <div className={styles.actions}>
            <a onClick={() => history.push('/register')}>注册账号</a>
            <a onClick={() => history.push('/forget-password')}>忘记密码</a>
          </div>
        }
      >
        <Tabs centered items={[{ key: 'account', label: '账号密码登录' }]} />
        <ProFormText
          name="username"
          fieldProps={{
            size: 'large',
            prefix: <UserOutlined />,
            placeholder: '用户名',
          }}
          rules={[{ required: true, message: '请输入用户名!' }]}
        />
        <ProFormText.Password
          name="password"
          fieldProps={{
            size: 'large',
            prefix: <LockOutlined />,
            placeholder: '密码',
          }}
          rules={[{ required: true, message: '请输入密码!' }]}
        />
      </LoginFormPage>
    </div>
  );
};

export default LoginPage;
