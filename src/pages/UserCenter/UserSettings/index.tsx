// src/pages/UserCenter/UserSettings/index.tsx
// 用户设置页面 - 主入口（Tab 布局）
import { useCurrentUser } from '@/hooks';
import { Card, Spin, Tabs } from 'antd';
import { useState } from 'react';
import EditorSettingsForm from './components/EditorSettingsForm';
import PasswordForm from './components/PasswordForm';
import ProfileForm from './components/ProfileForm';
import './index.less';

const { TabPane } = Tabs;

/** Tab 配置常量（模块级，避免每次渲染重建） */
const TAB_ITEMS = [
  { key: 'profile', label: '个人资料' },
  { key: 'editor', label: '编辑器设置' },
  { key: 'password', label: '修改密码' },
] as const;

const UserSettings: React.FC = () => {
  // 使用统一的 useCurrentUser hook，自动处理双源取数 + 兜底获取 + 请求去重
  const { currentUser, loading } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<string>('profile');

  // 初始加载：无用户信息且正在请求时显示 Spin
  if (loading && !currentUser) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="user-settings-page">
      <Card title="账号设置">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={TAB_ITEMS.map((item) => ({
            key: item.key,
            label: item.label,
            children:
              item.key === 'profile' ? (
                <ProfileForm currentUser={currentUser} />
              ) : item.key === 'editor' ? (
                <EditorSettingsForm currentUser={currentUser} />
              ) : (
                <PasswordForm />
              ),
          }))}
        />
      </Card>
    </div>
  );
};

export default UserSettings;
