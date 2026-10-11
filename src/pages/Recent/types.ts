// src/pages/Recent/types.ts
// 最近使用页面类型定义

import type { DocItem } from '@/pages/Project/types';

/** 最近使用 Tab 类型 */
export type RecentTabType = 'created' | 'updated' | 'browsed';

/** 时间筛选类型 */
export type TimeFilterType = 'all' | 'today' | 'week' | 'month';

/** 最近使用文档项（扩展 DocItem，增加浏览时间） */
export interface RecentDocItem extends DocItem {
  /** 文集名称 */
  project_name?: string;
  /** 作者名称 */
  author_name?: string;
  /** 作者ID */
  author_id?: number;
  /** 浏览时间（仅 browsed 类型有） */
  browse_time?: number;
  /** 创建时间 */
  create_time?: string;
  /** 更新时间 */
  update_time?: string;
}

/** RecentFilter 组件 Props */
export interface RecentFilterProps {
  activeTab: RecentTabType;
  onTabChange: (tab: RecentTabType) => void;
  timeFilter: TimeFilterType;
  onTimeFilterChange: (filter: TimeFilterType) => void;
  counts: {
    created: number;
    updated: number;
    browsed: number;
  };
}

/** RecentDocList 组件 Props */
export interface RecentDocListProps {
  list: RecentDocItem[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  tabType: RecentTabType;
  currentUserId: number;
  onPageChange: (page: number) => void;
  onView: (doc: RecentDocItem) => void;
  onEdit: (doc: RecentDocItem) => void;
}
