// src/services/quick.ts
// 快捷操作模块 Service 层
import { request } from '@umijs/max';

// ==================== 快捷操作项 ====================

// 获取快捷操作列表
export async function fetchQuickItems(
  params?: { category_id?: number | 'all' },
  options?: { [key: string]: any },
) {
  return request<{ data: any[] }>('/api/quick/items', {
    method: 'GET',
    params,
    ...(options || {}),
  });
}

// ==================== 快捷操作分组 ====================

// 获取分组列表（不传 user_id，后端从 token 解析当前用户）
export async function fetchQuickGroups(
  params?: { [key: string]: any },
  options?: { [key: string]: any },
) {
  return request<{ data: any[] }>('/api/quick/groups', {
    method: 'GET',
    params,
    ...(options || {}),
  });
}

// 创建分组（不传 user_id，后端从 token 解析当前用户）
export async function createQuickGroup(
  data: { name: string },
  options?: { [key: string]: any },
) {
  return request<{ data: any }>('/api/quick/groups', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

// 重命名分组
export async function updateQuickGroup(
  id: number,
  data: { name: string },
  options?: { [key: string]: any },
) {
  return request<{ data: any }>(`/api/quick/groups/${id}`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

// 删除分组
export async function deleteQuickGroup(
  id: number,
  options?: { [key: string]: any },
) {
  return request<{ data: any }>(`/api/quick/groups/${id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

// 添加操作项到分组（不传 user_id，后端从 token 解析当前用户）
export async function addQuickItemToGroup(
  groupId: number,
  data: { item_id: number },
  options?: { [key: string]: any },
) {
  return request<{ data: any }>(`/api/quick/groups/${groupId}/items`, {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

// 从分组移除操作项
export async function removeQuickItemFromGroup(
  groupId: number,
  itemId: number,
  options?: { [key: string]: any },
) {
  return request<{ data: any }>(`/api/quick/groups/${groupId}/items/${itemId}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}
