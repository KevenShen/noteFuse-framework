// src/services/recent.ts
// 最近使用模块 Service 层
// 三个场景：最近创建 / 最近更新 / 最近浏览
// 不传 user_id，后端从请求头 token 解析当前用户
import { request } from '@umijs/max';

// ==================== 最近使用文档 ====================

// 最近创建的文档
export async function fetchRecentCreated(
  params?: { page?: number; page_size?: number },
  options?: { [key: string]: any },
) {
  return request<{ data: { list: any[]; total: number; page: number; page_size: number } }>(
    '/api/recent/created',
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
}

// 最近更新的文档
export async function fetchRecentUpdated(
  params?: { page?: number; page_size?: number },
  options?: { [key: string]: any },
) {
  return request<{ data: { list: any[]; total: number; page: number; page_size: number } }>(
    '/api/recent/updated',
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
}

// 最近浏览的文档
export async function fetchRecentBrowsed(
  params?: { page?: number; page_size?: number },
  options?: { [key: string]: any },
) {
  return request<{ data: { list: any[]; total: number; page: number; page_size: number } }>(
    '/api/recent/browsed',
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
}

// 记录浏览历史
export async function recordDocBrowse(
  id: number,
  options?: { [key: string]: any },
) {
  return request<{ success: boolean }>(`/api/doc/${id}/browse`, {
    method: 'POST',
    ...(options || {}),
  });
}
