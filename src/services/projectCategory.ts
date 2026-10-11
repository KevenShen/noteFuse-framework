// src/services/projectCategory.ts
// 文集分类管理 Service 层
// 职责：文集分类的 CRUD、批量操作、排序保存
import type { ProjectCategoryItem } from '@/pages/Project/types';
import { request } from '@umijs/max';

/** 获取分类列表（扁平化） */
export async function getCategoryList(options?: { [key: string]: any }) {
  return request<{ data: ProjectCategoryItem[]; success: boolean }>(
    '/api/project/categories',
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

/** 新建分类 */
export async function createCategory(
  data: Partial<ProjectCategoryItem>,
  options?: { [key: string]: any },
) {
  return request<{ data: ProjectCategoryItem; success: boolean }>(
    '/api/project/category',
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}

/** 更新分类 */
export async function updateCategory(
  params: { id: number; data: Partial<ProjectCategoryItem> },
  options?: { [key: string]: any },
) {
  const { id, data } = params;
  return request<{ data: ProjectCategoryItem; success: boolean }>(
    `/api/project/category/${id}`,
    {
      method: 'PUT',
      data,
      ...(options || {}),
    },
  );
}

/** 删除分类 */
export async function deleteCategory(
  params: { id: number },
  options?: { [key: string]: any },
) {
  const { id } = params;
  return request<{ success: boolean }>(`/api/project/category/${id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

/** 批量删除分类 */
export async function batchDeleteCategories(
  params: { ids: (number | string)[] },
  options?: { [key: string]: any },
) {
  return request<{ success: boolean }>('/api/project/category/batch-delete', {
    method: 'POST',
    data: params,
    ...(options || {}),
  });
}

/** 批量移动分类 */
export async function batchMoveCategories(
  params: { ids: (number | string)[]; target_parent_id: number | string },
  options?: { [key: string]: any },
) {
  return request<{ success: boolean }>('/api/project/category/batch-move', {
    method: 'POST',
    data: params,
    ...(options || {}),
  });
}

/** 保存分类排序 */
export async function saveCategorySort(
  params: { sorts: ProjectCategoryItem[] },
  options?: { [key: string]: any },
) {
  return request<{ success: boolean }>('/api/project/category/sort', {
    method: 'POST',
    data: params,
    ...(options || {}),
  });
}
