// src/services/docAnnotations.ts
// 文档批注 Service 层
import type { MockDocAnnotation as DocAnnotation } from '@/../mock/Entities/doc';
import { request } from '@umijs/max';

/**
 * 获取版本的批注列表
 * @param params versionId: 版本ID
 */
export async function getDocAnnotations(
  params: { versionId: number },
  options?: { [key: string]: any },
) {
  const { versionId } = params;
  return request<{ data: DocAnnotation[]; success: boolean }>(`/api/doc/version/${versionId}/annotations`, {
    method: 'GET',
    ...(options || {}),
  });
}

/**
 * 添加批注（同时保存带标记的原文）
 * @param params versionId: 版本ID, marker_id: 标记ID, content: 批注内容, content_with_marker: 带标记的原文
 */
export async function addDocAnnotation(
  params: {
    versionId: number;
    marker_id: number;
    content: string;
    content_with_marker: string;
    author_id?: number;
    author_name?: string;
  },
  options?: { [key: string]: any },
) {
  const { versionId, ...data } = params;
  return request<{ data: any; success: boolean }>(`/api/doc/version/${versionId}/annotations`, {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

/**
 * 更新批注
 * @param params id: 批注ID, content: 批注内容
 */
export async function updateDocAnnotation(
  params: { id: number; content: string },
  options?: { [key: string]: any },
) {
  const { id, ...data } = params;
  return request<{ data: any; success: boolean }>(`/api/doc/annotation/${id}`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

/**
 * 删除批注（同时删除原文中的标记）
 * @param params id: 批注ID, content_without_marker: 删除标记后的原文
 */
export async function deleteDocAnnotation(
  params: { id: number; content_without_marker?: string },
  options?: { [key: string]: any },
) {
  const { id, ...data } = params;
  return request<{ data: any; success: boolean }>(`/api/doc/annotation/${id}`, {
    method: 'DELETE',
    data,
    ...(options || {}),
  });
}
