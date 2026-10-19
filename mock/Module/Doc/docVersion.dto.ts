// mock/Doc/docVersion.dto.ts
// 文档版本管理 DTO（Data Transfer Object，数据传输对象）
// 功能：定义文档版本管理相关接口请求和响应的数据结构类型

import type { MockDocVersion } from '../../Entities/doc';

// ==================== 公共类型 ====================

/** 版本状态枚举 */
export type VersionStatus = 'draft' | 'published' | 'archived' | 'deprecated';

// ==================== 创建文档版本 ====================

/** 创建文档版本请求参数 */
export interface CreateDocVersionRequest {
  /** 版本内容（可选） */
  content?: string;
  /** 版本备注（可选） */
  remark?: string;
  /** 版本名称（可选，如 v1.0） */
  version_name?: string;
  /** 版本号（可选，不传则自动生成） */
  version?: string;
  /** 版本状态（draft=草稿/published=已发布/archived=已归档/deprecated=已废弃） */
  status?: VersionStatus;
  /** 基础版本 ID（可选，基于哪个版本创建） */
  base_version_id?: number;
  /** 作者 ID（可选，默认 1） */
  author_id?: number;
  /** 作者名称（可选，默认 admin） */
  author_name?: string;
}

/** 创建文档版本响应数据（data 字段内容） */
export type CreateDocVersionResponse = MockDocVersion;

// ==================== 更新文档版本 ====================

/** 更新文档版本请求参数 */
export interface UpdateDocVersionRequest {
  /** 版本内容（可选） */
  content?: string;
  /** 版本大纲（可选） */
  outline?: string;
  /** 版本备注（可选） */
  remark?: string;
}

/** 更新文档版本响应数据（data 字段内容） */
export type UpdateDocVersionResponse = MockDocVersion;

// ==================== 设为当前版本 ====================

/** 设为当前版本请求参数（versionId 在 URL params 中） */
export interface SetCurrentVersionRequest {
  /** 版本 ID */
  versionId: number;
}

/** 设为当前版本响应数据（data 字段内容） */
export type SetCurrentVersionResponse = MockDocVersion;

// ==================== 保存版本原文 ====================

/** 保存版本原文请求参数 */
export interface SaveVersionContentRequest {
  /** 原文内容（带标记） */
  content: string;
}

/** 保存版本原文响应数据（data 字段内容） */
export interface SaveVersionContentResponse {
  /** 版本 ID */
  id: number;
  /** 保存后的原文内容 */
  content: string;
}

// ==================== 删除文档版本 ====================

/** 删除文档版本请求参数（versionId 在 URL params 中） */
export interface DeleteDocVersionRequest {
  /** 版本 ID */
  versionId: number;
}

/** 删除文档版本响应数据（data 字段内容） */
export interface DeleteDocVersionResponse {
  /** 删除的版本 ID */
  id: number;
}
