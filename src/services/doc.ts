// src/services/doc.ts
// 文档模块 Service 层
import type {
  DocCategory,
  DocItem,
  AiOutline,
  AiOutlineChapter,
} from '@/pages/Project/types';
import type { DocVersion } from '@/components/DocTree/types';
import type { MockDocAnnotation as DocAnnotation } from '@/../mock/Entities/doc';
import { request } from '@umijs/max';

// ==================== 文档列表相关 ====================

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

/** 文集内分类列表 */
export async function getProjectCategories(
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

// ==================== 文档详情相关 ====================

/** 文档详情（含指定版本 content，version 可选，不传取当前版本） */
export async function getDocDetail(
  params: { id: number; version?: number },
  options?: { [key: string]: any },
) {
  const { id, version } = params;
  const query = version ? `?version=${version}` : '';
  return request<{ data: DocItem; success: boolean }>(`/api/doc/${id}${query}`, {
    method: 'GET',
    ...(options || {}),
  });
}

/** 保存文档内容（更新当前版本） */
export async function saveDocContent(
  params: { id: number; content: string; name?: string; remark?: string },
  options?: { [key: string]: any },
) {
  const { id, ...data } = params;
  return request<{ data: any; success: boolean }>(`/api/doc/${id}`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

// ==================== 文档管理（增删改） ====================

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

// ==================== 文档版本相关 ====================

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

/** 更新版本内容（支持 content、outline、remark） */
export async function updateDocVersion(
  params: { versionId: number; content?: string; outline?: string; remark?: string },
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

// ==================== AI 大纲相关 ====================

/** 获取 AI 总结大纲 */
export async function getAiOutline(
  params: { id: number },
  options?: { [key: string]: any },
) {
  const { id } = params;
  return request<{ data: AiOutline | null; success: boolean }>(`/api/project/${id}/ai-outline`, {
    method: 'GET',
    ...(options || {}),
  });
}

/** 生成 AI 总结大纲 */
export async function generateAiOutline(
  params: { id: number },
  options?: { [key: string]: any },
) {
  const { id } = params;
  return request<{ data: AiOutline; success: boolean }>(`/api/project/${id}/ai-outline/generate`, {
    method: 'POST',
    ...(options || {}),
  });
}

/** 保存 AI 总结大纲 */
export async function saveAiOutline(
  params: { id: number; summary: string; chapters: AiOutlineChapter[] },
  options?: { [key: string]: any },
) {
  const { id, ...data } = params;
  return request<{ data: AiOutline; success: boolean }>(`/api/project/${id}/ai-outline`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

// ==================== 文档批注相关接口 ====================

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


// ==================== 文档分类管理（参照 ProjectCategory） ====================

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
