// src/services/docDetail.ts
// 文档详情 Service 层
import type { AiOutline, AiOutlineChapter, DocItem } from '@/pages/Project/types';
import { request } from '@umijs/max';

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
