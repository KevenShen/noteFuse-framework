/**
 * 文档批注管理 DTO（Data Transfer Object，数据传输对象）
 *
 * 【职责】
 * 定义文档批注管理相关接口请求和响应的数据结构类型
 */

import type { MockDocAnnotation } from '../../Entities/doc';

// ==================== 文档批注相关 DTO ====================

/** 获取版本批注列表响应数据（data 字段内容） */
export type GetVersionAnnotationsResponse = MockDocAnnotation[];

/** 添加批注请求参数 */
export interface AddAnnotationRequest {
  /** 标记 ID（必填） */
  marker_id: number;
  /** 批注内容（必填） */
  content: string;
  /** 带标记的原文内容（可选，同时更新版本原文） */
  content_with_marker?: string;
  /** 作者 ID（可选，默认 1） */
  author_id?: number;
  /** 作者名称（可选，默认 admin） */
  author_name?: string;
}

/** 添加批注响应数据（data 字段内容） */
export interface AddAnnotationResponse {
  /** 创建的批注 */
  annotation: MockDocAnnotation;
  /** 更新后的原文内容 */
  content: string;
}

/** 更新批注请求参数 */
export interface UpdateAnnotationRequest {
  /** 批注内容（必填） */
  content: string;
}

/** 更新批注响应数据（data 字段内容） */
export type UpdateAnnotationResponse = MockDocAnnotation;

/** 删除批注请求参数 */
export interface DeleteAnnotationRequest {
  /** 删除标记后的原文内容（可选，同时更新版本原文） */
  content_without_marker?: string;
}

/** 删除批注响应数据（data 字段内容） */
export interface DeleteAnnotationResponse {
  /** 删除的批注 ID */
  id: number;
  /** 更新后的原文内容（可选） */
  content?: string;
}
