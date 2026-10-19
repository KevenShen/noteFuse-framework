// src/services/docVersions.ts
// 文档版本 Service 层
import type { DocVersion } from '@/components/DocTree/types';
import { request } from '@umijs/max';

/** 文集下所有文档的版本列表（扁平化） */
export async function getDocVersions(
  params: { projectId: number },
  options?: { [key: string]: any },
) {
  const { projectId } = params;
  return request<{ data: DocVersion[]; success: boolean }>(
    `/api/project/${projectId}/doc-versions`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

/** 新建版本 */
export async function createDocVersion(
  params: {
    id: number;
    content: string;
    remark?: string;
    version_name?: string;
    version?: string;
    status?: string;
    base_version_id?: number;
    [key: string]: any;
  },
  options?: { [key: string]: any },
) {
  const { id, ...data } = params;
  return request<{ data: DocVersion; success: boolean }>(`/api/doc/${id}/version`, {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

/** 更新版本信息（支持 content、outline、remark、version、status） */
export async function updateDocVersion(
  params: {
    versionId: number;
    content?: string;
    outline?: string;
    remark?: string;
    version?: string;
    status?: string;
  },
  options?: { [key: string]: any },
) {
  const { versionId, ...data } = params;
  return request<{ data: DocVersion; success: boolean }>(`/api/doc/version/${versionId}`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

/** 设为当前版本 */
export async function setCurrentVersion(
  params: { versionId: number },
  options?: { [key: string]: any },
) {
  const { versionId } = params;
  return request<{ data: DocVersion; success: boolean }>(
    `/api/doc/version/${versionId}/set-current`,
    {
      method: 'PUT',
      ...(options || {}),
    },
  );
}

/** 删除版本 */
export async function deleteDocVersion(
  params: { versionId: number },
  options?: { [key: string]: any },
) {
  const { versionId } = params;
  return request<{ data: any; success: boolean }>(`/api/doc/version/${versionId}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

/**
 * 保存版本原文（带标记，同时检测孤立批注）
 * @param params versionId: 版本ID, content: 原文内容
 */
export async function saveVersionContent(
  params: { versionId: number; content: string },
  options?: { [key: string]: any },
) {
  const { versionId, ...data } = params;
  return request<{ data: any; success: boolean }>(`/api/doc/version/${versionId}/content`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}
