// mock/Module/Recent/recent.validator.ts
// Recent 模块请求参数校验规则
// 功能：校验接口请求参数是否符合要求，返回错误信息（null 表示校验通过）

import type { GetRecentDocsRequest } from './recent.dto';

/**
 * 校验最近文档列表请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateGetRecentDocs(data: GetRecentDocsRequest): string | null {
  if (data.page !== undefined && (data.page < 1 || data.page > 1000)) {
    return '页码范围应为1-1000';
  }
  if (data.page_size !== undefined && (data.page_size < 1 || data.page_size > 100)) {
    return '每页条数范围应为1-100';
  }
  if (data.time_filter !== undefined && !['all', 'today', 'week', 'month'].includes(data.time_filter)) {
    return '时间筛选参数无效，应为 all/today/week/month';
  }
  return null;
}

/**
 * 校验分页请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validatePaginationRequest(data: { page?: number; page_size?: number }): string | null {
  if (data.page !== undefined && (data.page < 1 || data.page > 1000)) {
    return '页码范围应为1-1000';
  }
  if (data.page_size !== undefined && (data.page_size < 1 || data.page_size > 100)) {
    return '每页条数范围应为1-100';
  }
  return null;
}
