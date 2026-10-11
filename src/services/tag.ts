// src/services/tag.ts
// 标签模块 Service 层
// 统一响应格式：{ success, errorCode, message, data }
import { request } from '@umijs/max';

// ==================== 标签列表（含分类+文档关联） ====================

// 获取所有标签+分类+文档关联（用于 TagManager，支持 type 筛选）
export async function fetchTags(
  params?: { type?: 'doc' | 'project' },
  options?: { [key: string]: any },
) {
  return request<{
    data: {
      categories: any[];
      tags: any[];
      doc_tag_relations: Record<number, number[]>;
    };
  }>('/api/tags', {
    method: 'GET',
    params,
    ...(options || {}),
  });
}

// ==================== 标签分类 ====================

// 获取标签分类列表（含标签）
export async function fetchTagCategories(
  options?: { [key: string]: any },
) {
  return request<{ data: any[] }>('/api/tag/categories', {
    method: 'GET',
    ...(options || {}),
  });
}

// 新建标签分类
export async function createTagCategory(
  data: { name: string; parent_id?: number; type?: string },
  options?: { [key: string]: any },
) {
  return request<{ data: any }>('/api/tag/category', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

// 重命名标签分类
export async function updateTagCategory(
  id: number,
  data: { name: string },
  options?: { [key: string]: any },
) {
  return request<{ data: any }>(`/api/tag/category/${id}`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

// 删除标签分类
export async function deleteTagCategory(
  id: number,
  options?: { [key: string]: any },
) {
  return request<{ data: any }>(`/api/tag/category/${id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

// 分类排序（同级上下移动）
export async function moveTagCategory(
  id: number,
  direction: 'up' | 'down',
  options?: { [key: string]: any },
) {
  return request<{ data: any }>(`/api/tag/category/${id}/sort`, {
    method: 'PUT',
    data: { direction },
    ...(options || {}),
  });
}

// ==================== 标签项 ====================

// 新建标签
export async function createTag(
  data: { name: string; color?: string; category_id: number; type?: string },
  options?: { [key: string]: any },
) {
  return request<{ data: any }>('/api/tag', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

// 修改标签
export async function updateTag(
  id: number,
  data: { name?: string; color?: string },
  options?: { [key: string]: any },
) {
  return request<{ data: any }>(`/api/tag/${id}`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

// 删除标签
export async function deleteTag(
  id: number,
  options?: { [key: string]: any },
) {
  return request<{ data: any }>(`/api/tag/${id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

// ==================== 标签文档 ====================

// 按标签获取文档列表
export async function fetchTagDocs(
  params: { id: number; page?: number; page_size?: number },
  options?: { [key: string]: any },
) {
  const { id, ...rest } = params;
  return request<{ data: { list: any[]; total: number; page: number; page_size: number } }>(
    `/api/tag/${id}/docs`,
    {
      method: 'GET',
      params: rest,
      ...(options || {}),
    },
  );
}

// ==================== 文档标签关联 ====================

// 获取文档已关联的标签列表
export async function fetchDocTags(
  params: { doc_id: number },
  options?: { [key: string]: any },
) {
  const { doc_id } = params;
  return request<{ data: any[] }>(`/api/doc/${doc_id}/tags`, {
    method: 'GET',
    ...(options || {}),
  });
}

// 给文档添加标签（关联）
export async function addDocTag(
  params: { doc_id: number; tag_id: number },
  options?: { [key: string]: any },
) {
  const { doc_id, tag_id } = params;
  return request<{ data: any }>(`/api/doc/${doc_id}/tags`, {
    method: 'POST',
    data: { tag_id },
    ...(options || {}),
  });
}

// 移除文档标签（取消关联）
export async function removeDocTag(
  params: { doc_id: number; tag_id: number },
  options?: { [key: string]: any },
) {
  const { doc_id, tag_id } = params;
  return request<{ data: any }>(`/api/doc/${doc_id}/tags/${tag_id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}
