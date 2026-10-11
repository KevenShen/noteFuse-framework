/**
 * 文档 CRUD DTO（Data Transfer Object，数据传输对象）
 *
 * 【职责】
 * 定义文档核心 CRUD 相关接口请求和响应的数据结构类型
 */

import type { MockDoc, MockDocVersion } from '../../Entities/doc';

// ==================== 文档列表相关 DTO（预留） ====================

/** 获取文档列表请求参数 */
export interface GetDocListRequest {
  /** 文集 ID（必填） */
  project_id: number;
  /** 分类 ID（0 表示全部，-1 表示未分类） */
  doc_category_id?: number;
  /** 当前页（默认 1） */
  page?: number;
  /** 每页条数（默认 20） */
  page_size?: number;
  /** 搜索关键词（文档名称/摘要） */
  keyword?: string;
  /** 排序方式（update=更新时间/create=创建时间/name=名称/sort=排序） */
  sort?: 'update' | 'create' | 'name' | 'sort';
  /** 作者 ID（可选，用于筛选我的文档） */
  author_id?: number;
}

/** 获取文档列表响应数据（data 字段内容） */
export interface GetDocListResponse {
  /** 文档列表 */
  list: MockDoc[];
  /** 总条数 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页条数 */
  page_size: number;
}

// ==================== 文档详情相关 DTO ====================

/** 获取文档详情响应数据（data 字段内容） */
export interface GetDocDetailResponse {
  /** 文档基本信息 */
  doc: MockDoc;
  /** 文档内容（从当前版本聚合） */
  content?: string;
  /** 作者 ID */
  author_id?: number;
  /** 作者名称 */
  author_name?: string;
  /** 当前版本 */
  current_version: MockDocVersion | null;
  /** 所有版本列表（可选） */
  versions?: MockDocVersion[];
  /** 文档标签 */
  tags: any[];
}

// ==================== 创建文档相关 DTO ====================

/** 创建文档请求参数 */
export interface CreateDocRequest {
  /** 文集 ID（必填） */
  project_id: number;
  /** 文档名称（必填，1-100个字符） */
  name: string;
  /** 文档分类 ID（可选，0 表示未分类） */
  doc_category_id?: number;
  /** 文档内容（可选） */
  content?: string;
  /** 作者 ID（可选，默认 1） */
  author_id?: number;
  /** 作者名称（可选，默认 admin） */
  author_name?: string;
  /** 排序（可选，不传则自动计算） */
  sort?: number;
}

/** 创建文档响应数据（data 字段内容） */
export interface CreateDocResponse {
  /** 创建的文档 */
  doc: MockDoc;
  /** 当前版本（初始版本） */
  current_version: MockDocVersion;
}

// ==================== 更新文档相关 DTO ====================

/** 更新文档请求参数 */
export interface UpdateDocRequest {
  /** 文档名称（可选，1-100个字符） */
  name?: string;
  /** 文档摘要（可选，最多500个字符） */
  summary?: string;
  /** 文档分类 ID（可选，0 表示未分类） */
  doc_category_id?: number;
  /** 排序（可选） */
  sort?: number;
  /** 版本概览（可选） */
  version_overview?: string;
  /** 文档内容（更新当前版本） */
  content?: string;
  /** 版本备注（更新当前版本） */
  remark?: string;
}

/** 更新文档响应数据（data 字段内容） */
export interface UpdateDocResponse {
  /** 文档 ID */
  id: number;
  /** 文档名称 */
  name: string;
  /** 文档摘要 */
  summary: string;
  /** 版本概览 */
  version_overview: string;
}

// ==================== 删除文档相关 DTO ====================

/** 删除文档响应数据（data 字段内容） */
export interface DeleteDocResponse {
  /** 删除的文档 ID */
  id: number;
}
