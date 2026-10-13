// src/pages/Recent/index.tsx
// 最近使用页面 - Dva Hooks + 组件自治 + clientLoader 预加载
// 三个场景：最近创建 / 最近更新 / 最近浏览
// index.tsx 仅负责：clientLoader 预加载、数据同步到 model、Tab/时间筛选状态、页面布局
// 数据获取、时间筛选、翻页、查看/编辑等逻辑已下沉到 RecentDocList 组件自治
import { fetchRecentBrowsed } from '@/services';
import { useClientLoaderData, useDispatch } from '@umijs/max';
import React, { useEffect, useState } from 'react';
import { RecentDocList, RecentFilter } from './components';
import './index.less';
import type { RecentTabType, TimeFilterType } from './types';

// ==================== clientLoader：页面渲染前预加载默认 tab（最近浏览）数据 ====================
// 不传 user_id，后端从 token 解析当前用户（mock 环境兜底 user_id=1）
export async function clientLoader() {
  try {
    const res = await fetchRecentBrowsed({ page: 1, page_size: 10 });
    const data: any = res?.data ?? res ?? {};
    return {
      recentBrowsedList: data.list || [],
      recentBrowsedTotal: data.total || 0,
      recentBrowsedPage: data.page || 1,
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
  const dispatch = useDispatch();

  // useClientLoaderData 返回 { data: clientLoader返回值 }
  const { data: clientLoaderData } = useClientLoaderData() as {
    data: {
      recentBrowsedList: any[];
      recentBrowsedTotal: number;
      recentBrowsedPage: number;
    };
  };

  // ==================== 页面状态 ====================
  const [activeTab, setActiveTab] = useState<RecentTabType>('browsed');
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('all');

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  // 用 useRef 标记，避免重复 dispatch
  const syncedRef = React.useRef(false);
  useEffect(() => {
    if (syncedRef.current) return;
    if (clientLoaderData?.recentBrowsedList?.length) {
      dispatch({
        type: 'recent/saveRecentBrowsed',
        payload: {
          list: clientLoaderData.recentBrowsedList,
          total: clientLoaderData.recentBrowsedTotal,
          page: clientLoaderData.recentBrowsedPage,
        },
      });
      syncedRef.current = true;
    }
  }, [clientLoaderData, dispatch]);

  // Tab 切换时加载对应数据（初始 tab 数据由 clientLoader 预加载）
  const initializedRef = React.useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return; // 初始加载由 clientLoader 完成
    }
    const params = { page: 1, page_size: 10 };
    if (activeTab === 'created') {
      dispatch({ type: 'recent/fetchRecentCreated', payload: params });
    } else if (activeTab === 'updated') {
      dispatch({ type: 'recent/fetchRecentUpdated', payload: params });
    } else {
      dispatch({ type: 'recent/fetchRecentBrowsed', payload: params });
    }
  }, [activeTab, dispatch]);

  // ==================== 页面布局 ====================
  return (
    <div className="recent-page">
      <RecentFilter
        activeTab={activeTab}
        onTabChange={setActiveTab}
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
      />
      <RecentDocList activeTab={activeTab} timeFilter={timeFilter} />
    </div>
  );
};

export default RecentPage;
