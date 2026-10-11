// src/pages/Recent/index.tsx
// 最近使用页面 - Dva Hooks + 组件化拆分 + clientLoader 预加载
// 三个场景：最近创建 / 最近更新 / 最近浏览
import { fetchRecentBrowsed } from '@/services';
import {
  history,
  useClientLoaderData,
  useDispatch,
  useSelector,
} from '@umijs/max';
import { message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RecentDocList, RecentFilter } from './components';
import './index.less';
import type { RecentDocItem, RecentTabType, TimeFilterType } from './types';

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
    return { recentBrowsedList: [], recentBrowsedTotal: 0, recentBrowsedPage: 1 };
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

  // ==================== Dva Hooks 取数 ====================
  const {
    recentCreatedList,
    recentCreatedTotal,
    recentCreatedPage,
    recentCreatedLoading,
    recentUpdatedList,
    recentUpdatedTotal,
    recentUpdatedPage,
    recentUpdatedLoading,
    recentBrowsedList: modelBrowsedList,
    recentBrowsedTotal: modelBrowsedTotal,
    recentBrowsedPage: modelBrowsedPage,
    recentBrowsedLoading,
  } = useSelector((state: any) => state.recent);

  // 优先 model 数据（交互更新后），兜底 clientLoader 预加载数据（首屏）
  const { recentBrowsedList, recentBrowsedTotal, recentBrowsedPage } = useMemo(() => {
    const useModel = modelBrowsedList?.length > 0;
    const src = useModel
      ? { list: modelBrowsedList, total: modelBrowsedTotal, page: modelBrowsedPage }
      : {
          list: clientLoaderData?.recentBrowsedList,
          total: clientLoaderData?.recentBrowsedTotal,
          page: clientLoaderData?.recentBrowsedPage,
        };
    return {
      recentBrowsedList: src.list || [],
      recentBrowsedTotal: src.total ?? 0,
      recentBrowsedPage: src.page ?? 1,
    };
  }, [modelBrowsedList, modelBrowsedTotal, modelBrowsedPage, clientLoaderData]);

  // 当前登录用户（用于权限判断）
  const { currentUser } = useSelector((state: any) => state.user);
  const currentUserId = currentUser?.id || 1;

  // ==================== 页面状态 ====================
  const [activeTab, setActiveTab] = useState<RecentTabType>('browsed');
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('all');
  const [pageSize] = useState(10);

  // ==================== 数据加载 ====================
  // 不传 user_id，后端从 token 解析当前用户
  const fetchData = useCallback(
    (tab: RecentTabType, page: number) => {
      const params = { page, page_size: pageSize };
      if (tab === 'created') {
        dispatch({ type: 'recent/fetchRecentCreated', payload: params });
      } else if (tab === 'updated') {
        dispatch({ type: 'recent/fetchRecentUpdated', payload: params });
      } else {
        dispatch({ type: 'recent/fetchRecentBrowsed', payload: params });
      }
    },
    [dispatch, pageSize],
  );

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  // 用 useRef 标记，避免 setState 导致额外渲染
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

  // Tab 切换时加载（初始 tab 数据由 clientLoader 预加载）
  const initializedRef = React.useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return; // 初始加载由 clientLoader 完成
    }
    fetchData(activeTab, 1);
  }, [activeTab, fetchData]);

  // ==================== 时间筛选（前端过滤） ====================
  const filterByTime = useCallback(
    (list: RecentDocItem[]): RecentDocItem[] => {
      if (timeFilter === 'all') return list;
      const now = Date.now();
      const thresholds: Record<TimeFilterType, number> = {
        all: 0,
        today: 86400000,
        week: 86400000 * 7,
        month: 86400000 * 30,
      };
      const threshold = thresholds[timeFilter];
      return list.filter((doc) => {
        let time: number;
        if (activeTab === 'browsed') {
          time = doc.browse_time || 0;
        } else if (activeTab === 'created') {
          time = doc.create_time ? new Date(doc.create_time).getTime() : 0;
        } else {
          time = doc.update_time ? new Date(doc.update_time).getTime() : 0;
        }
        return now - time < threshold;
      });
    },
    [timeFilter, activeTab],
  );

  // 当前 Tab 的数据
  const currentData = useMemo(() => {
    if (activeTab === 'created') {
      return {
        list: filterByTime(recentCreatedList as RecentDocItem[]),
        total: recentCreatedTotal,
        page: recentCreatedPage,
        loading: recentCreatedLoading,
      };
    }
    if (activeTab === 'updated') {
      return {
        list: filterByTime(recentUpdatedList as RecentDocItem[]),
        total: recentUpdatedTotal,
        page: recentUpdatedPage,
        loading: recentUpdatedLoading,
      };
    }
    return {
      list: filterByTime(recentBrowsedList as RecentDocItem[]),
      total: recentBrowsedTotal,
      page: recentBrowsedPage,
      loading: recentBrowsedLoading,
    };
  }, [
    activeTab,
    recentCreatedList,
    recentCreatedTotal,
    recentCreatedPage,
    recentCreatedLoading,
    recentUpdatedList,
    recentUpdatedTotal,
    recentUpdatedPage,
    recentUpdatedLoading,
    recentBrowsedList,
    recentBrowsedTotal,
    recentBrowsedPage,
    recentBrowsedLoading,
    filterByTime,
  ]);

  // 各 Tab 总数
  const counts = useMemo(
    () => ({
      created: recentCreatedTotal,
      updated: recentUpdatedTotal,
      browsed: recentBrowsedTotal,
    }),
    [recentCreatedTotal, recentUpdatedTotal, recentBrowsedTotal],
  );

  // ==================== 事件处理 ====================

  // 翻页
  const handlePageChange = (page: number) => {
    fetchData(activeTab, page);
  };

  // 查看文档（跳转到 /doc/:id，并记录浏览历史）
  const handleView = (doc: RecentDocItem) => {
    // 记录浏览历史，刷新最近浏览列表（不传 user_id，后端从 token 解析）
    dispatch({
      type: 'recent/fetchRecentBrowsed',
      payload: { page: 1, page_size: pageSize },
    });
    history.push(`/doc/${doc.id}?project_id=${doc.project_id}`);
  };

  // 编辑文档（仅创建者可编辑，跳转到 /docEdit/:id）
  const handleEdit = (doc: RecentDocItem) => {
    if (doc.author_id !== currentUserId) {
      message.warning('仅文档创建者可编辑');
      return;
    }
    history.push(`/docEdit/${doc.id}?project_id=${doc.project_id}`);
  };

  // ==================== 页面布局 ====================
  return (
    <div className="recent-page">
      <RecentFilter
        activeTab={activeTab}
        onTabChange={setActiveTab}
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
        counts={counts}
      />
      <RecentDocList
        list={currentData.list}
        loading={currentData.loading}
        total={currentData.total}
        page={currentData.page}
        pageSize={pageSize}
        tabType={activeTab}
        currentUserId={currentUserId}
        onPageChange={handlePageChange}
        onView={handleView}
        onEdit={handleEdit}
      />
    </div>
  );
};

export default RecentPage;
