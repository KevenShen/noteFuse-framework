// src/pages/UserCenter/UserSettings/components/ProfileForm.tsx
// 个人资料表单组件
import type { CurrentUser } from '@/models';
import type { UpdateProfileParams } from '@/services';
import { useShallowSelector } from '@/hooks';
import { UserOutlined } from '@ant-design/icons';
import { useDispatch } from '@umijs/max';
import { Avatar, Button, Form, Input } from 'antd';
import { useEffect } from 'react';

export interface ProfileFormProps {
  /** 当前用户信息 */
  currentUser: CurrentUser | null;
}

/** 个人资料表单 */
const ProfileForm: React.FC<ProfileFormProps> = ({ currentUser }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm<UpdateProfileParams>();
  // 使用 model 的全局 loading 状态，无需新建本地状态
  const loading = useShallowSelector((state: any) => state.user.loading);

  // 用户信息加载完成后，设置表单初始值
  useEffect(() => {
    if (currentUser) {
      form.setFieldsValue({
        username: currentUser.username || '',
        nickname: currentUser.nickname || '',
        email: currentUser.email,
      });
    }
  }, [currentUser, form]);

  // 保存个人资料
  // 成功/失败提示由 model 统一处理
  const handleSave = async (values: UpdateProfileParams) => {
    await dispatch({
      type: 'user/handleUpdateProfile',
      payload: {
        nickname: values.nickname,
        email: values.email,
      },
    });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSave}
      className="user-settings-form"
    >
      <div className="profile-avatar-section">
        <Avatar size={80} src={currentUser?.avatar} icon={<UserOutlined />} />
        <div className="profile-avatar-action">
          <Button type="link" disabled>
            更换头像（暂未开放）
          </Button>
        </div>
      </div>

      <Form.Item name="username" label="用户名">
        <Input disabled value={currentUser?.username} />
      </Form.Item>

      <Form.Item
        name="nickname"
        label="昵称"
        rules={[{ max: 20, message: '昵称最多20个字符' }]}
      >
        <Input placeholder="请输入昵称" maxLength={20} />
      </Form.Item>

      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '请输入正确的邮箱格式' },
        ]}
      >
        <Input placeholder="请输入邮箱" />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          保存修改
        </Button>
      </Form.Item>
    </Form>
  );
};

export default ProfileForm;
