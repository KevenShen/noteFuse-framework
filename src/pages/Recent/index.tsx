// src/pages/Recent/index.tsx
// 最近使用页面 - Dva Hooks + 组件自治 + clientLoader 预加载
// 三个场景：最近创建 / 最近更新 / 最近浏览
// index.tsx 仅负责：clientLoader 预加载、数据同步到 model、Tab/时间筛选状态、页面布局
// 数据获取、时间筛选、翻页、查看/编辑等逻辑已下沉到 RecentDocList 组件自治
import { fetchRecentBrowsed } from '@/services';
import { useClientLoaderSync } from '@/hooks';
import { extractListWithPagination } from '@/utils/clientLoader';
import { useClientLoaderData } from '@umijs/max';
import { useSetState } from 'ahooks';
import React from 'react';
import { RecentDocList, RecentFilter } from './components';
import './index.less';
import type { RecentTabType, TimeFilterType } from './types';

// ==================== clientLoader：页面渲染前预加载默认 tab（最近浏览）数据 ====================
// 不传 user_id，后端从 token 解析当前用户（mock 环境兜底 user_id=1）
export async function clientLoader() {
  try {
    const res = await fetchRecentBrowsed({ page: 1, page_size: 10 });
    const { list, total, page } = extractListWithPagination<any>(res);
    return {
      recentBrowsedList: list,
      recentBrowsedTotal: total,
      recentBrowsedPage: page,
    };
  } catch (e) {
    return {
      recentBrowsedList: [],
      recentBrowsedTotal: 0,
      recentBrowsedPage: 1,
    };
  }
}

const RecentPage: React.FC = () => {
  // useClientLoaderData 返回 { data: clientLoader返回值 }
  const { data: clientLoaderData } = useClientLoaderData() as {
    data: {
      recentBrowsedList: any[];
      recentBrowsedTotal: number;
      recentBrowsedPage: number;
    };
  };

  // ==================== 页面状态 ====================
  const [state, setState] = useSetState({
    activeTab: 'browsed' as RecentTabType,
    timeFilter: 'all' as TimeFilterType,
  });
  const { activeTab, timeFilter } = state;

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  // 只同步一次，避免后续交互更新被覆盖
  useClientLoaderSync({
    clientLoaderData,
    actionType: 'recent/saveRecentBrowsed',
    mapData: (data) => ({
      list: data.recentBrowsedList,
      total: data.recentBrowsedTotal,
      page: data.recentBrowsedPage,
    }),
    hasData: (data) => data?.recentBrowsedList?.length > 0,
  });

  // ==================== 页面布局 ====================
  return (
    <div className="recent-page">
      <RecentFilter
        activeTab={activeTab}
        onTabChange={(tab) => setState({ activeTab: tab })}
        timeFilter={timeFilter}
        onTimeFilterChange={(filter) => setState({ timeFilter: filter })}
      />
      <RecentDocList activeTab={activeTab} timeFilter={timeFilter} />
    </div>
  );
};

export default RecentPage;
