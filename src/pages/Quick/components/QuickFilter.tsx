// src/pages/Quick/components/QuickFilter.tsx
// 快捷操作页面 - 顶部分类筛选栏（组件自治：直接从 Dva model 取数 + 分组切换）
import {
  DownOutlined,
  FilterOutlined,
  SettingOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { useShallowSelector } from '@/hooks';
import { Button, Divider, Select, Space, Tag } from 'antd';
import React, { useState } from 'react';

interface QuickFilterProps {
  selectedGroupId: number | 'all';
  onGroupChange: (groupId: number | 'all') => void;
  onOpenGroupManager: () => void;
}

const QuickFilter: React.FC<QuickFilterProps> = ({
  selectedGroupId,
  onGroupChange,
  onOpenGroupManager,
}) => {
  // 直接从 Dva model 取数
  const { quickGroups: groups, quickGroupsLoading: loading } = useShallowSelector(
    (state: any) => state.quick,
  );

  // 折叠状态 - 移动端默认折叠
  const [collapsed, setCollapsed] = useState(window.innerWidth < 768);

  // 分组 select 选项
  const groupOptions = [
    { value: 'all', label: '全部功能' },
    ...groups.map((g: any) => ({
      value: g.id,
      label: `${g.name} (${g.item_count || 0})`,
    })),
  ];

  return (
    <div className="quick-filter-wrapper">
      <div
        className="quick-filter-header"
        onClick={() => setCollapsed(!collapsed)}
      >
        <Space size={8}>
          <FilterOutlined className="quick-filter-icon" />
          <span className="quick-filter-title">功能分类</span>
          {/* 管理按钮在功能分类旁边 */}
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onOpenGroupManager();
            }}
            title="分组管理"
          />
        </Space>
        <Button
          type="text"
          size="small"
          icon={collapsed ? <DownOutlined /> : <UpOutlined />}
        />
      </div>
      {!collapsed && (
        <>
          <Divider style={{ margin: 0 }} />
          <div className="quick-filter-content">
            {/* 分组筛选 select（唯一筛选） */}
            <div className="quick-filter-group">
              <Select
                value={selectedGroupId}
                onChange={onGroupChange}
                options={groupOptions}
                style={{ width: 200 }}
                size="middle"
                placeholder="选择分类"
                loading={loading}
              />
              <div className="quick-grid-tip">右键卡片可添加到分组</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default QuickFilter;
