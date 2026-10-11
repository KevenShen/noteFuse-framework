// src/pages/UserCenter/index.tsx
import {
  EditOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { history } from '@umijs/max';
import {
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
} from 'antd';
import { useCurrentUser } from '@/hooks';

const UserCenter: React.FC = () => {
  // 使用统一的 useCurrentUser hook，自动处理双源取数 + 兜底获取 + 请求去重
  const { currentUser, loading } = useCurrentUser();

  if (loading && !currentUser) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]}>
        {/* 左侧：用户卡片 */}
        <Col xs={24} md={8}>
          <Card>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Avatar size={80} src={currentUser?.avatar}>
                {currentUser?.username?.charAt(0)?.toUpperCase()}
              </Avatar>
              <h2 style={{ margin: '16px 0 8px' }}>
                {currentUser?.nickname || currentUser?.username}
              </h2>
              <p style={{ color: 'rgba(0,0,0,0.45)', marginBottom: 16 }}>
                {currentUser?.email}
              </p>
              <div style={{ marginBottom: 16 }}>
                {currentUser?.is_superuser && (
                  <Tag color="red" style={{ marginRight: 4 }}>
                    超级管理员
                  </Tag>
                )}
                {currentUser?.is_staff && !currentUser?.is_superuser && (
                  <Tag color="blue" style={{ marginRight: 4 }}>
                    管理员
                  </Tag>
                )}
                {!currentUser?.is_staff && (
                  <Tag color="green">普通用户</Tag>
                )}
              </div>
              <Space wrap>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => history.push('/user/settings')}
                >
                  编辑资料
                </Button>
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => history.push('/user/settings')}
                >
                  账号设置
                </Button>
              </Space>
            </div>
            <Divider style={{ margin: '16px 0' }} />
            <Row gutter={12}>
              <Col span={8}>
                <Statistic
                  title="文集"
                  value={12}
                  prefix={<FolderOpenOutlined />}
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="文档"
                  value={156}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="收藏"
                  value={28}
                  prefix={<StarOutlined />}
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 右侧：个人信息 */}
        <Col xs={24} md={16}>
          <Card
            title="个人信息"
            extra={<a onClick={() => history.push('/user/settings')}>编辑</a>}
          >
            <Descriptions column={1} size="default" labelStyle={{ width: 100 }}>
              <Descriptions.Item label="用户ID">
                {currentUser?.id || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="用户名">
                {currentUser?.username || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="昵称">
                {currentUser?.nickname || '未设置'}
              </Descriptions.Item>
              <Descriptions.Item label="邮箱">
                {currentUser?.email || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="用户角色">
                {currentUser?.is_superuser
                  ? '超级管理员'
                  : currentUser?.is_staff
                    ? '管理员'
                    : '普通用户'}
              </Descriptions.Item>
              <Descriptions.Item label="注册时间">
                {currentUser?.created_at || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="最后登录">
                {currentUser?.last_login || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default UserCenter;
