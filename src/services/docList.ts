// src/services/docList.ts
// 文档列表 Service 层
import type { DocItem } from '@/pages/Project/types';
import { request } from '@umijs/max';

/** 文集文档列表（扁平化数组，带 doc_category_id，前端按需转树） */
export async function getProjectDocs(
  params: { id: number },
  options?: { [key: string]: any },
) {
  const { id } = params;
  return request<{ data: DocItem[]; success: boolean }>(
    `/api/project/${id}/docs`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

/**
 * 新建文档
 * @param params project_id: 文集ID, name: 文档名称, doc_category_id: 分类ID(可选), content: 初始内容(可选)
 */
export async function createDoc(
  params: {
    project_id: number;
    name: string;
    doc_category_id?: number;
    content?: string;
  },
  options?: { [key: string]: any },
) {
  return request<{ data: any; success: boolean }>('/api/doc/create', {
    method: 'POST',
    data: params,
    ...(options || {}),
  });
}

/**
 * 编辑文档（重命名/移动分类/更新副标题/排序等）
 * @param params id: 文档ID, name: 文档名称(可选), doc_category_id: 分类ID(可选), summary: 副标题(可选), sort: 排序(可选)
 */
export async function updateDoc(
  params: {
    id: number;
    name?: string;
    doc_category_id?: number;
    summary?: string;
    sort?: number;
    [key: string]: any;
  },
  options?: { [key: string]: any },
) {
  const { id, ...data } = params;
  return request<{ data: any; success: boolean }>(`/api/doc/${id}`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

/**
 * 删除文档
 * @param params id: 文档ID
 */
export async function deleteDoc(
  params: { id: number },
  options?: { [key: string]: any },
) {
  const { id } = params;
  return request<{ data: any; success: boolean }>(`/api/doc/${id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}
