// src/pages/Collect/components/CollectSidebar.tsx
// 收藏页面 - 左侧分组侧边栏
import {
  AppstoreOutlined,
  FolderOutlined,
  PlusOutlined,
  SettingOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { Badge, Button, Card, List, Space, Tooltip } from 'antd';
import React from 'react';
import type { CollectSidebarProps } from '../types';

const CollectSidebar: React.FC<CollectSidebarProps> = ({
  groups,
  loading,
  activeGroupId,
  totalCount,
  ungroupedCount,
  onSelectGroup,
  onOpenGroupManager,
}) => {
  // 快捷分组项（全部 + 未分组）
  const quickItems = [
    {
      key: -1,
      name: '全部收藏',
      icon: <StarOutlined />,
      count: totalCount,
      color: '#faad14',
    },
    {
      key: 0,
      name: '未分组',
      icon: <FolderOutlined />,
      count: ungroupedCount,
      color: '#8c8c8c',
    },
  ];

  return (
    <Card
      size="small"
      className="collect-sidebar-card"
      title={
        <Space size={8}>
          <AppstoreOutlined className="collect-icon-blue" />
          <span>收藏分组</span>
        </Space>
      }
      extra={
        <Tooltip title="管理分组">
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={onOpenGroupManager}
          />
        </Tooltip>
      }
    >
      <List
        loading={loading}
        dataSource={[
          ...quickItems,
          ...groups.map((g) => ({
            key: g.id,
            name: g.name,
            icon: <FolderOutlined />,
            count: g.count || 0,
            color: '#1890ff',
            description: g.description,
          })),
        ]}
        renderItem={(item: any) => (
          <List.Item
            className={`collect-group-item ${
              activeGroupId === item.key ? 'active' : ''
            }`}
            onClick={() => onSelectGroup(item.key)}
          >
            <Space size={8} className="collect-sidebar-item-space">
              <Space size={8}>
                <span style={{ color: item.color }}>{item.icon}</span>
                <span
                  style={{ fontWeight: activeGroupId === item.key ? 600 : 400 }}
                >
                  <Tooltip title={item.description}>{item.name}</Tooltip>
                </span>
              </Space>
              <Badge
                count={item.count}
                size="small"
                color={activeGroupId === item.key ? '#1890ff' : '#d9d9d9'}
              />
            </Space>
          </List.Item>
        )}
      />
      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        className="collect-group-new-btn"
        onClick={onOpenGroupManager}
      >
        新建分组
      </Button>
    </Card>
  );
};

export default CollectSidebar;
