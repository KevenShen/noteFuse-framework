// mock/Module/Recent/recent.dto.ts
// Recent 模块 DTO（Data Transfer Object，数据传输对象）
// 功能：定义接口请求和响应的数据结构类型

import type { PaginatedResponse } from '../../Core';

/** 最近文档列表请求 */
export interface GetRecentDocsRequest {
  page?: number;
  page_size?: number;
  time_filter?: 'all' | 'today' | 'week' | 'month';
}

/** 最近文档列表响应项 */
export interface RecentDocItem {
  id: number;
  name: string;
  project_id: number;
  project_name: string;
  author_name: string;
  author_id: number;
  summary?: string;
  modify_time: number;
  current_version_id: number;
  [key: string]: any;
}

/** 最近文档列表响应 */
export type GetRecentDocsResponse = PaginatedResponse<RecentDocItem>;

/** 最近创建文档响应项 */
export interface RecentCreatedItem extends RecentDocItem {
  create_time: string;
}

/** 最近创建文档响应 */
export type GetRecentCreatedResponse = PaginatedResponse<RecentCreatedItem>;

/** 最近更新文档响应项 */
export interface RecentUpdatedItem extends RecentDocItem {
  update_time: string;
}

/** 最近更新文档响应 */
export type GetRecentUpdatedResponse = PaginatedResponse<RecentUpdatedItem>;

/** 最近浏览文档响应项 */
export interface RecentBrowsedItem extends RecentDocItem {
  browse_time: number;
}

/** 最近浏览文档响应 */
export type GetRecentBrowsedResponse = PaginatedResponse<RecentBrowsedItem>;
