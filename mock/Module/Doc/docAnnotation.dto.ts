// mock/Doc/docAnnotation.dto.ts
// 文档批注管理 DTO（Data Transfer Object，数据传输对象）
// 功能：定义文档批注管理相关接口请求和响应的数据结构类型

import type { MockDocAnnotation } from '../../Entities/doc';

// ==================== 公共类型 ====================

/** 批注项（含原文内容） */
export interface AnnotationWithContent {
  /** 创建的批注 */
  annotation: MockDocAnnotation;
  /** 更新后的原文内容 */
  content: string;
}

// ==================== 获取版本批注列表 ====================

/** 获取版本批注列表请求参数（versionId 在 URL params 中） */
export interface GetVersionAnnotationsRequest {
  /** 版本 ID */
  versionId: number;
}

/** 获取版本批注列表响应数据（data 字段内容） */
export type GetVersionAnnotationsResponse = MockDocAnnotation[];

// ==================== 添加批注 ====================

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
export type AddAnnotationResponse = AnnotationWithContent;

// ==================== 更新批注 ====================

/** 更新批注请求参数 */
export interface UpdateAnnotationRequest {
  /** 批注内容（必填） */
  content: string;
}

/** 更新批注响应数据（data 字段内容） */
export type UpdateAnnotationResponse = MockDocAnnotation;

// ==================== 删除批注 ====================

/** 删除批注请求参数（annotationId 在 URL params 中） */
export interface DeleteAnnotationRequest {
  /** 批注 ID */
  annotationId: number;
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
