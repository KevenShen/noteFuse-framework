// src/pages/Quick/components/QuickGroupPanel.tsx
// 快捷操作页面 - 我的分组面板（展示分组及分组内操作项）
import {
  CloseOutlined,
  FolderOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Button, Card, Empty, List, Space, Tag, Tooltip } from 'antd';
import React, { useState } from 'react';
import type { QuickGroupPanelProps } from '../types';

const QuickGroupPanel: React.FC<QuickGroupPanelProps> = ({
  groups,
  loading,
  onOpenManager,
  onItemClick,
  onRemoveItem,
}) => {
  // 展开的分组 ID 集合
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(
    new Set(groups.slice(0, 1).map((g) => g.id)),
  );

  // 切换分组展开/折叠
  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <Card
      size="small"
      className="quick-group-panel"
      title={
        <Space size={8}>
          <FolderOutlined style={{ color: '#faad14' }} />
          <span>我的分组</span>
        </Space>
      }
      extra={
        <Button
          type="text"
          size="small"
          icon={<SettingOutlined />}
          onClick={onOpenManager}
        >
          管理
        </Button>
      }
    >
      <List
        loading={loading}
        dataSource={groups}
        locale={{
          emptyText: (
            <Empty
              description="暂无分组"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={onOpenManager}
              >
                创建分组
              </Button>
            </Empty>
          ),
        }}
        renderItem={(group) => (
          <List.Item className="quick-group-item">
            <div style={{ width: '100%' }}>
              {/* 分组标题 */}
              <div
                className="quick-group-header"
                onClick={() => toggleGroup(group.id)}
              >
                <Space size={8}>
                  <FolderOutlined style={{ color: '#faad14' }} />
                  <span className="quick-group-name">{group.name}</span>
                  <Tag color="blue">{group.item_count || 0}</Tag>
                </Space>
                <span className="quick-group-toggle">
                  {expandedGroups.has(group.id) ? '收起' : '展开'}
                </span>
              </div>

              {/* 分组内操作项 */}
              {expandedGroups.has(group.id) && (
                <div className="quick-group-items">
                  {group.items?.length > 0 ? (
                    group.items.map((item) => (
                      <div
                        key={item.id}
                        className="quick-group-item-card"
                        onClick={() => onItemClick(item)}
                      >
                        <span className="quick-group-item-icon">{item.icon}</span>
                        <span className="quick-group-item-name">{item.name}</span>
                        <Tooltip title="从分组移除">
                          <CloseOutlined
                            className="quick-group-item-remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveItem(group.id, item.id);
                            }}
                          />
                        </Tooltip>
                      </div>
                    ))
                  ) : (
                    <div className="quick-group-empty">该分组暂无操作项</div>
                  )}
                </div>
              )}
            </div>
          </List.Item>
        )}
      />
    </Card>
  );
};

export default QuickGroupPanel;
