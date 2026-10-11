// src/services/project.ts
// 文集列表/管理 Service 层
// 职责：文集列表查询与文集 CRUD（分类管理已拆分到 projectCategory）
import type {
  ProjectFormParams,
  ProjectItem,
  ProjectListParams,
  ProjectListResult,
} from '@/pages/Project/types';
import { request } from '@umijs/max';

// ==================== 文集列表与 CRUD ====================

export async function getProjectList(
  params: ProjectListParams,
  options?: { [key: string]: any },
) {
  return request<{ data: ProjectListResult; success: boolean }>(
    '/api/project/list',
    {
      method: 'GET',
      params: { ...params },
      ...(options || {}),
    },
  );
}

export async function createProject(
  data: ProjectFormParams,
  options?: { [key: string]: any },
) {
  return request<{ data: ProjectItem; success: boolean }>('/api/project', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

export async function updateProject(
  params: { id: number; data: Partial<ProjectFormParams> },
  options?: { [key: string]: any },
) {
  const { id, data } = params;
  return request<{ data: ProjectItem; success: boolean }>(
    `/api/project/${id}`,
    {
      method: 'PUT',
      data,
      ...(options || {}),
    },
  );
}

export async function deleteProject(
  params: { id: number },
  options?: { [key: string]: any },
) {
  const { id } = params;
  return request<{ success: boolean }>(`/api/project/${id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

export async function toggleProjectTop(
  params: { id: number; is_top: boolean },
  options?: { [key: string]: any },
) {
  const { id, is_top } = params;
  return request<{ success: boolean }>(`/api/project/${id}/top`, {
    method: 'PATCH',
    data: { is_top },
    ...(options || {}),
  });
}

// ==================== 工具函数 ====================

/**
 * 扁平化分类数组转树形结构
 * @param list 扁平化分类数组
 * @returns 树形分类数组
 */
export function categoryListToTree(list: any[]): any[] {
  const map = new Map<number | string, any>();
  const roots: any[] = [];

  // 先建立映射
  list.forEach((item) => {
    map.set(item.id, { ...item, children: [] });
  });

  // 组装树形
  list.forEach((item) => {
    const node = map.get(item.id)!;
    if (item.parent_id && item.parent_id !== 0 && map.has(item.parent_id)) {
      const parent = map.get(item.parent_id)!;
      parent.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  // 按 sort 排序
  const sortBySort = (arr: any[]) => {
    arr.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    arr.forEach((item) => {
      if (item.children && item.children.length > 0) {
        sortBySort(item.children);
      }
    });
  };
  sortBySort(roots);

  return roots;
}
