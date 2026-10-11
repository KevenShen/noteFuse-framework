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
