// src/services/collect.ts
// 收藏模块 Service 层
// 统一接口，type 区分文档/文集收藏
// 不传 user_id，后端从请求头 token 解析当前用户
import { request } from '@umijs/max';

// ==================== 收藏分组 ====================

// 获取收藏分组列表
export async function fetchCollectGroups(
  params?: { type?: 'doc' | 'project' },
  options?: { [key: string]: any },
) {
  return request<{ data: any[] }>('/api/collect/groups', {
    method: 'GET',
    params,
    ...(options || {}),
  });
}

// 新建收藏分组
export async function createCollectGroup(
  data: { name: string; description?: string; sort?: number; type?: 'doc' | 'project' },
  options?: { [key: string]: any },
) {
  return request<{ data: any }>('/api/collect/group', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

// 更新收藏分组
export async function updateCollectGroup(
  params: { id: number; name?: string; description?: string; sort?: number },
  options?: { [key: string]: any },
) {
  const { id, ...rest } = params;
  return request<{ data: any }>(`/api/collect/group/${id}`, {
    method: 'PUT',
    data: rest,
    ...(options || {}),
  });
}

// 删除收藏分组
export async function deleteCollectGroup(
  params: { id: number },
  options?: { [key: string]: any },
) {
  return request<{ success: boolean }>(`/api/collect/group/${params.id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

// ==================== 收藏记录（统一接口，type 区分文档/文集） ====================

// 获取收藏列表
export async function fetchCollectList(
  params?: { page?: number; page_size?: number; group_id?: number; keyword?: string; type?: 'doc' | 'project' },
  options?: { [key: string]: any },
) {
  return request<{ data: { list: any[]; total: number; page: number; page_size: number } }>(
    '/api/collect',
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
}

// 添加收藏
export async function addCollect(
  data: { type?: 'doc' | 'project'; target_id: number; group_id?: number },
  options?: { [key: string]: any },
) {
  return request<{ data: any }>('/api/collect', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

// 取消收藏
export async function cancelCollect(
  params: { id: number },
  options?: { [key: string]: any },
) {
  return request<{ success: boolean }>(`/api/collect/${params.id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

// 移动收藏到其他分组
export async function moveCollect(
  params: { id: number; group_id: number },
  options?: { [key: string]: any },
) {
  const { id, ...rest } = params;
  return request<{ data: any }>(`/api/collect/${id}/move`, {
    method: 'PUT',
    data: rest,
    ...(options || {}),
  });
}
