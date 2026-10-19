// mock/Doc/docCategory.dto.ts
// 文档分类 DTO（Data Transfer Object，数据传输对象）
// 功能：定义文档分类相关接口请求和响应的数据结构类型

import type { MockDocCategory } from '../../Entities/doc';

// ==================== 公共类型 ====================

/** 分类项（带统计字段：doc_count + children） */
export interface DocCategoryWithStats extends MockDocCategory {
  /** 文档数量（含所有后代分类下的文档总数） */
  doc_count: number;
  /** 直接子分类 ID 列表 */
  children?: number[];
}

/** 文档分类排序项 */
export interface DocCategorySortItem {
  /** 分类 ID */
  id: number;
  /** 排序值 */
  sort: number;
}

/** 获取文档分类详情响应数据（data 字段内容） */
export type GetDocCategoryDetailResponse = MockDocCategory;

// ==================== 获取文档分类列表 ====================

/** 获取文档分类列表请求参数（Query） */
export interface GetDocCategoriesRequest {
  /** 文集 ID（必填） */
  project_id: number;
  /** 父分类 ID（可选，0 表示顶级分类，不传表示全部） */
  parent_id?: number;
  /** 搜索关键词（分类名称） */
  keyword?: string;
  /** 是否包含文档数量（默认 true） */
  include_doc_count?: boolean;
}

/** 获取文档分类列表响应数据（data 字段内容） */
export type GetDocCategoriesResponse = MockDocCategory[];

/** 获取带文档数量的分类列表响应数据（data 字段内容） */
export type GetDocCategoriesWithStatsResponse = DocCategoryWithStats[];

// ==================== 获取所有文档分类（跨文集） ====================

/** 获取所有文档分类列表请求参数（跨文集，可选筛选） */
export interface GetAllDocCategoriesRequest {
  /** 文集 ID（可选，不传表示全部） */
  project_id?: number;
  /** 父分类 ID（可选，0 表示顶级分类，不传表示全部） */
  parent_id?: number;
  /** 搜索关键词（分类名称） */
  keyword?: string;
  /** 是否包含文档数量（默认 true） */
  include_doc_count?: boolean;
}

/** 获取所有文档分类列表响应数据（data 字段内容） */
export type GetAllDocCategoriesResponse = MockDocCategory[];

// ==================== 创建文档分类 ====================

/** 创建文档分类请求参数 */
export interface CreateDocCategoryRequest {
  /** 文集 ID（必填） */
  project_id: number;
  /** 分类名称（必填，1-50个字符） */
  name: string;
  /** 父分类 ID（可选，0 表示顶级分类） */
  parent_id?: number;
  /** 排序（可选，不传则自动计算） */
  sort?: number;
  /** 图标（可选） */
  icon?: string;
}

/** 创建文档分类响应数据（data 字段内容） */
export type CreateDocCategoryResponse = MockDocCategory;

// ==================== 更新文档分类 ====================

/** 更新文档分类请求参数 */
export interface UpdateDocCategoryRequest {
  /** 分类名称（可选，1-50个字符） */
  name?: string;
  /** 父分类 ID（可选，0 表示顶级分类） */
  parent_id?: number;
  /** 排序（可选） */
  sort?: number;
  /** 图标（可选） */
  icon?: string;
}

/** 更新文档分类响应数据（data 字段内容） */
export type UpdateDocCategoryResponse = MockDocCategory;

// ==================== 删除文档分类 ====================

/** 删除文档分类请求参数（ID 在 URL params 中） */
export interface DeleteDocCategoryRequest {
  /** 分类 ID */
  id: number;
}

/** 删除文档分类响应数据（无数据） */
export type DeleteDocCategoryResponse = null;

// ==================== 批量删除文档分类 ====================

/** 批量删除文档分类请求参数 */
export interface BatchDeleteDocCategoriesRequest {
  /** 分类 ID 数组 */
  ids: number[];
}

/** 批量删除文档分类响应数据（无数据） */
export type BatchDeleteDocCategoriesResponse = null;

// ==================== 批量移动文档分类 ====================

/** 批量移动文档分类请求参数 */
export interface BatchMoveDocCategoriesRequest {
  /** 分类 ID 数组 */
  ids: number[];
  /** 目标父分类 ID（0 表示移动到顶级） */
  target_parent_id: number;
}

/** 批量移动文档分类响应数据（无数据） */
export type BatchMoveDocCategoriesResponse = null;

// ==================== 保存文档分类排序 ====================

/** 保存文档分类排序请求参数 */
export interface SaveDocCategorySortRequest {
  /** 分类排序数组（扁平化数据） */
  sorts: DocCategorySortItem[];
}

/** 保存文档分类排序响应数据（无数据） */
export type SaveDocCategorySortResponse = null;
