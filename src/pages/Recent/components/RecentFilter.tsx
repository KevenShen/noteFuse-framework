// src/pages/Recent/components/RecentFilter.tsx
// 最近使用页面 - 顶部筛选栏（Tab切换 + 时间筛选，组件自治：直接从 Dva model 取 counts）
import {
  ClockCircleOutlined,
  DownOutlined,
  FileAddOutlined,
  HistoryOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Button, Dropdown, Space, Tabs, Tag } from 'antd';
import { useShallowSelector } from '@/hooks';
import React, { useMemo } from 'react';
import type { RecentTabType, TimeFilterType } from '../types';

interface RecentFilterProps {
  activeTab: RecentTabType;
  onTabChange: (tab: RecentTabType) => void;
  timeFilter: TimeFilterType;
  onTimeFilterChange: (filter: TimeFilterType) => void;
}

const RecentFilter: React.FC<RecentFilterProps> = ({
  activeTab,
  onTabChange,
  timeFilter,
  onTimeFilterChange,
}) => {
  // 直接从 Dva model 获取各 Tab 总数
  const { recentCreatedTotal, recentUpdatedTotal, recentBrowsedTotal } =
    useShallowSelector((state: any) => state.recent);

  const counts = useMemo(
    () => ({
      created: recentCreatedTotal,
      updated: recentUpdatedTotal,
      browsed: recentBrowsedTotal,
    }),
    [recentCreatedTotal, recentUpdatedTotal, recentBrowsedTotal],
  );

  const timeLabels: Record<TimeFilterType, string> = {
    all: '全部时间',
    today: '今天',
    week: '本周',
    month: '本月',
  };

  const timeMenuItems: MenuProps['items'] = [
    { key: 'all', label: '全部时间', icon: <ClockCircleOutlined /> },
    { key: 'today', label: '今天' },
    { key: 'week', label: '本周' },
    { key: 'month', label: '本月' },
  ];

  const tabItems = [
    {
      key: 'browsed',
      label: (
        <Space size={6}>
          <HistoryOutlined />
          <span>最近浏览</span>
          <Tag color="orange" className="recent-filter-tag">
            {counts.browsed}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'created',
      label: (
        <Space size={6}>
          <FileAddOutlined />
          <span>最近创建</span>
          <Tag color="blue" className="recent-filter-tag">
            {counts.created}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'updated',
      label: (
        <Space size={6}>
          <SyncOutlined />
          <span>最近更新</span>
          <Tag color="green" className="recent-filter-tag">
            {counts.updated}
          </Tag>
        </Space>
      ),
    },
  ];

  return (
    <div className="recent-filter">
      <div className="recent-filter-inner">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => onTabChange(key as RecentTabType)}
          items={tabItems}
          className="recent-filter-tabs"
        />
        <Dropdown
          menu={{
            items: timeMenuItems,
            onClick: ({ key }) => onTimeFilterChange(key as TimeFilterType),
            selectedKeys: [timeFilter],
          }}
          trigger={['click']}
        >
          <Button>
            <ClockCircleOutlined /> {timeLabels[timeFilter]}{' '}
            <DownOutlined className="recent-filter-dropdown-icon" />
          </Button>
        </Dropdown>
      </div>
    </div>
  );
};

export default RecentFilter;
