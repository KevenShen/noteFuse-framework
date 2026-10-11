// src/services/docCategory.ts
// 文档分类 Service 层
import type { DocCategory } from '@/pages/Project/types';
import { request } from '@umijs/max';

/** 文集内文档分类列表（按文集ID获取该文集下的所有文档分类） */
export async function getProjectDocCategories(
  params: { id: number },
  options?: { [key: string]: any },
) {
  const { id } = params;
  return request<{ data: DocCategory[]; success: boolean }>(
    `/api/project/${id}/categories`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

/** 获取所有文档分类列表（跨文集，带文档数量） */
export async function getDocCategoryList(
  params?: { project_id?: number; keyword?: string },
  options?: { [key: string]: any },
) {
  return request<{ data: any[]; success: boolean }>('/api/doc/categories', {
    method: 'GET',
    params: params || {},
    ...(options || {}),
  });
}

/** 创建文档分类 */
export async function createDocCategory(
  data: {
    project_id: number;
    name: string;
    parent_id?: number;
    sort?: number;
    icon?: string;
  },
  options?: { [key: string]: any },
) {
  return request<{ data: any; success: boolean }>('/api/doc/categories', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

/** 更新文档分类 */
export async function updateDocCategory(
  params: { id: number; data: Partial<any> },
  options?: { [key: string]: any },
) {
  const { id, data } = params;
  return request<{ data: any; success: boolean }>(`/api/doc/categories/${id}`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

/** 删除文档分类 */
export async function deleteDocCategory(
  params: { id: number },
  options?: { [key: string]: any },
) {
  const { id } = params;
  return request<{ success: boolean }>(`/api/doc/categories/${id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

/** 批量删除文档分类 */
export async function batchDeleteDocCategories(
  params: { ids: (number | string)[] },
  options?: { [key: string]: any },
) {
  return request<{ success: boolean }>('/api/doc/category/batch-delete', {
    method: 'POST',
    data: params,
    ...(options || {}),
  });
}

/** 批量移动文档分类 */
export async function batchMoveDocCategories(
  params: { ids: (number | string)[]; target_parent_id: number | string },
  options?: { [key: string]: any },
) {
  return request<{ success: boolean }>('/api/doc/category/batch-move', {
    method: 'POST',
    data: params,
    ...(options || {}),
  });
}

/** 保存文档分类排序 */
export async function saveDocCategorySort(
  params: { sorts: any[] },
  options?: { [key: string]: any },
) {
  return request<{ success: boolean }>('/api/doc/category/sort', {
    method: 'POST',
    data: params,
    ...(options || {}),
  });
}
