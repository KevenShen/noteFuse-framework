import { useShallowSelector } from '@/hooks';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { ProForm, ProFormText } from '@ant-design/pro-components';
import { history, useDispatch } from '@umijs/max';
import { useSetState } from 'ahooks';
import { Alert, Card, Steps } from 'antd';
import styles from './index.less';

const ForgetPasswordPage: React.FC = () => {
  const [state, setState] = useSetState({
    step: 0,
    email: '',
  });
  const { step, email } = state;
  const dispatch = useDispatch();
  const loading = useShallowSelector((state: any) => state.userResetPassword.loading);

  // 第一步：发送验证码
  // 成功/失败提示由 model 统一处理，页面组件根据返回值判断是否成功，成功后执行业务逻辑
  const handleSendCode = async (values: any) => {
    const result = await dispatch({
      type: 'userResetPassword/handleSendResetCode',
      payload: values,
    });
    if (result) {
      setState({ email: values.email, step: 1 }); // 保存邮箱，第二步使用
    }
  };

  // 第二步：重置密码
  // 成功/失败提示由 model 统一处理
  const handleReset = async (values: any) => {
    await dispatch({
      type: 'userResetPassword/handleResetPassword',
      payload: {
        ...values,
        email, // 带上第一步输入的邮箱
      },
    });
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card} title="忘记密码">
        <Steps
          className={styles.steps}
          current={step}
          items={[{ title: '验证邮箱' }, { title: '重置密码' }]}
          size="small"
        />

        {step === 0 ? (
          <>
            <ProForm
              onFinish={handleSendCode}
              submitter={{
                searchConfig: { submitText: '发送验证码' },
                submitButtonProps: { loading, block: true, size: 'large' },
              }}
            >
              <ProFormText
                name="email"
                fieldProps={{
                  size: 'large',
                  prefix: <MailOutlined />,
                  placeholder: '请输入注册邮箱',
                }}
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '请输入正确的邮箱格式' },
                ]}
              />
              <div className={styles.actions}>
                <a onClick={() => history.push('/login')}>返回登录</a>
              </div>
            </ProForm>
            <Alert
              className={styles.tips}
              type="info"
              showIcon
              message="Mock 测试邮箱"
              description="admin@notefuse.com / editor@notefuse.com / zhangsan@example.com"
            />
          </>
        ) : (
          <>
            <ProForm
              onFinish={handleReset}
              submitter={{
                searchConfig: { submitText: '重置密码' },
                submitButtonProps: { loading, block: true, size: 'large' },
              }}
            >
              <ProFormText
                name="code"
                fieldProps={{
                  size: 'large',
                  placeholder: '请输入验证码',
                  maxLength: 6,
                }}
                rules={[{ required: true, message: '请输入验证码' }]}
              />
              <ProFormText.Password
                name="new_password"
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined />,
                  placeholder: '请输入新密码',
                }}
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 6, message: '密码长度至少6位' },
                ]}
              />
              <ProFormText.Password
                name="confirm_password"
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined />,
                  placeholder: '请确认新密码',
                }}
                rules={[{ required: true, message: '请再次输入新密码' }]}
              />
              <div className={styles.actions}>
                <a onClick={() => setState({ step: 0 })}>上一步</a>
              </div>
            </ProForm>
            <Alert
              className={styles.tips}
              type="warning"
              showIcon
              message="Mock 固定验证码"
              description="验证码为 123456（5分钟内有效，不实际发送邮件）"
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default ForgetPasswordPage;
