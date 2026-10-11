// src/services/projectDetail.ts
// 文集详情模块 Service 层
// 职责：文集详情页相关的 API 调用（详情、文档、版本、批注、AI大纲）
import type { DocVersion } from '@/components/DocTree/types';
import type {
  AiOutline,
  AiOutlineChapter,
  DocCategory,
  DocItem,
  ProjectItem,
} from '@/pages/Project/types';
import { request } from '@umijs/max';

// ==================== 文集详情 ====================

/** 获取文集详情 */
export async function getProjectDetail(
  params: { id: number },
  options?: { [key: string]: any },
) {
  const { id } = params;
  return request<{ data: ProjectItem; success: boolean }>(
    `/api/project/${id}`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

/** 保存文集简介 */
export async function updateProjectIntro(
  params: { id: number; intro: string },
  options?: { [key: string]: any },
) {
  const { id, intro } = params;
  return request<{ data: ProjectItem; success: boolean }>(
    `/api/project/${id}/intro`,
    {
      method: 'PUT',
      data: { intro },
      ...(options || {}),
    },
  );
}

// ==================== 文集内文档结构 ====================

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

/** 文集下所有文档的版本列表（扁平化） */
export async function getProjectDocVersions(
  params: { id: number },
  options?: { [key: string]: any },
) {
  const { id } = params;
  return request<{ data: DocVersion[]; success: boolean }>(
    `/api/project/${id}/doc-versions`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

// ==================== 文档详情与内容 ====================

/** 文档详情（含指定版本 content，version 可选，不传取当前版本） */
export async function getDocDetail(
  params: { id: number; version?: number },
  options?: { [key: string]: any },
) {
  const { id, version } = params;
  const query = version ? `?version=${version}` : '';
  return request<{ data: DocItem; success: boolean }>(
    `/api/doc/${id}${query}`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
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

// ==================== 文档版本管理 ====================

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
  return request<{ data: DocVersion; success: boolean }>(
    `/api/doc/${id}/version`,
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}

/** 更新版本内容（支持 content、outline、remark） */
export async function updateDocVersion(
  params: {
    versionId: number;
    content?: string;
    outline?: string;
    remark?: string;
  },
  options?: { [key: string]: any },
) {
  const { versionId, ...data } = params;
  return request<{ data: DocVersion; success: boolean }>(
    `/api/doc/version/${versionId}`,
    {
      method: 'PUT',
      data,
      ...(options || {}),
    },
  );
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

/**
 * 保存版本原文（带标记，同时检测孤立批注）
 * @param params versionId: 版本ID, content: 原文内容
 */
export async function saveVersionContent(
  params: { versionId: number; content: string },
  options?: { [key: string]: any },
) {
  const { versionId, ...data } = params;
  return request<{ data: any; success: boolean }>(
    `/api/doc/version/${versionId}/content`,
    {
      method: 'PUT',
      data,
      ...(options || {}),
    },
  );
}

// ==================== 文档批注 ====================

/**
 * 获取版本的批注列表
 * @param params versionId: 版本ID
 */
export async function getDocAnnotations(
  params: { versionId: number },
  options?: { [key: string]: any },
) {
  const { versionId } = params;
  return request<{ data: any[]; success: boolean }>(
    `/api/doc/version/${versionId}/annotations`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
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
  return request<{ data: any; success: boolean }>(
    `/api/doc/version/${versionId}/annotations`,
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
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
  return request<{ data: any; success: boolean }>(
    `/api/doc/annotation/${id}`,
    {
      method: 'PUT',
      data,
      ...(options || {}),
    },
  );
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
  return request<{ data: any; success: boolean }>(
    `/api/doc/annotation/${id}`,
    {
      method: 'DELETE',
      data,
      ...(options || {}),
    },
  );
}

// ==================== AI 大纲 ====================

/** 获取 AI 总结大纲 */
export async function getAiOutline(
  params: { id: number },
  options?: { [key: string]: any },
) {
  const { id } = params;
  return request<{ data: AiOutline | null; success: boolean }>(
    `/api/project/${id}/ai-outline`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

/** 生成 AI 总结大纲 */
export async function generateAiOutline(
  params: { id: number },
  options?: { [key: string]: any },
) {
  const { id } = params;
  return request<{ data: AiOutline; success: boolean }>(
    `/api/project/${id}/ai-outline/generate`,
    {
      method: 'POST',
      ...(options || {}),
    },
  );
}

/** 保存 AI 总结大纲 */
export async function saveAiOutline(
  params: { id: number; summary: string; chapters: AiOutlineChapter[] },
  options?: { [key: string]: any },
) {
  const { id, ...data } = params;
  return request<{ data: AiOutline; success: boolean }>(
    `/api/project/${id}/ai-outline`,
    {
      method: 'PUT',
      data,
      ...(options || {}),
    },
  );
}
