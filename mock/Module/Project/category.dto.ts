// mock/Project/category.dto.ts
// 分类 DTO（Data Transfer Object，数据传输对象）
// 功能：定义分类相关接口请求和响应的数据结构类型

import type { MockProjectCategory } from '../../Entities/project';

// ==================== 公共类型 ====================

/** 分类项（带统计字段：project_count + project_ids） */
export interface CategoryWithStats extends MockProjectCategory {
  /** 文集数量（含所有后代分类下的文集总数） */
  project_count: number;
  /** 该分类直接关联的文集 ID 数组 */
  project_ids?: number[];
}

/** 分类排序项 */
export interface CategorySortItem {
  /** 分类 ID */
  id: number;
  /** 排序值 */
  sort: number;
}

/** 获取分类详情响应数据（data 字段内容） */
export type GetCategoryDetailResponse = MockProjectCategory;

// ==================== 获取分类 ====================

/** 获取分类列表请求参数（Query）
 *
 * 【当前实现状态】
 * - include_project_count：已废弃，统一返回带统计字段的列表（project_count + project_ids）
 * - parent_id：预留，service 层暂未支持按父分类过滤（返回全量后前端过滤）
 * - keyword：预留，service 层暂未支持关键词搜索（返回全量后前端过滤）
 */
export interface GetCategoryListRequest {
  /** 父分类 ID（可选，0 表示顶级分类，不传表示全部） */
  parent_id?: number;
  /** 搜索关键词（分类名称） */
  keyword?: string;
  /** 是否包含文集数量（默认 true） */
  include_project_count?: boolean;
}

/** 获取分类列表响应数据（data 字段内容，统一带统计字段） */
export type GetCategoryListResponse = CategoryWithStats[];

// ==================== 创建分类 ====================

/** 创建分类请求参数 */
export interface CreateCategoryRequest {
  /** 分类名称（1-50个字符） */
  name: string;
  /** 父分类 ID（0 表示顶级分类） */
  parent_id?: number;
  /** 排序（可选，不传则自动计算） */
  sort?: number;
  /** 图标（可选） */
  icon?: string;
  /** 描述（可选） */
  description?: string;
}

/** 创建分类响应数据（data 字段内容） */
export type CreateCategoryResponse = CategoryWithStats;

// ==================== 更新分类 ====================

/** 更新分类请求参数 */
export interface UpdateCategoryRequest {
  /** 分类名称（可选，1-50个字符） */
  name?: string;
  /** 父分类 ID（可选，0 表示顶级分类） */
  parent_id?: number;
  /** 排序（可选） */
  sort?: number;
  /** 图标（可选） */
  icon?: string;
  /** 描述（可选） */
  description?: string;
}

/** 更新分类响应数据（data 字段内容，统一带统计字段） */
export type UpdateCategoryResponse = CategoryWithStats;

// ==================== 删除分类 ====================

/** 删除分类请求参数（ID 在 URL params 中） */
export interface DeleteCategoryRequest {
  /** 分类 ID */
  id: number;
}

/** 删除分类响应数据（与批量删除一致） */
export type DeleteCategoryResponse = BatchDeleteCategoriesResponse;

// ==================== 批量删除分类 ====================

/** 批量删除分类请求参数 */
export interface BatchDeleteCategoriesRequest {
  /** 分类 ID 数组 */
  ids: number[];
}

/** 批量删除分类响应数据 */
export interface BatchDeleteCategoriesResponse {
  /** 成功删除的分类 ID 列表（含所有后代分类） */
  deletedIds: number[];
}

// ==================== 批量移动分类 ====================

/** 批量移动分类请求参数 */
export interface BatchMoveCategoriesRequest {
  /** 分类 ID 数组 */
  ids: number[];
  /** 目标父分类 ID（0 表示移动到顶级） */
  target_parent_id: number;
}

/** 批量移动分类响应数据（data 字段内容） */
export interface BatchMoveCategoriesResponse {
  /** 移动的分类 ID 列表 */
  movedIds: number[];
  /** 目标父分类 ID */
  targetParentId: number;
  /** 更新的链路数量 */
  updatedChains: number;
  /** 更新的计数器数量 */
  updatedCounters: number;
  /** 受影响的分类 ID 集合（自身 + 所有后代 + 旧祖先 + 新祖先） */
  affectedIds: number[];
  /** 耗时（毫秒） */
  duration: number;
  /** 更新后的全部分类列表（扁平化，用于前端乐观更新，无需重新请求） */
  categories: MockProjectCategory[];
}

// ==================== 保存分类排序 ====================

/** 保存分类排序请求参数 */
export interface SaveCategorySortRequest {
  /** 分类排序数组（扁平化数据） */
  sorts: CategorySortItem[];
}

/** 保存分类排序响应数据 */
export interface SaveCategorySortResponse {
  /** 更新后的全部分类列表（扁平化，用于前端乐观更新，无需重新请求） */
  categories: MockProjectCategory[];
}
