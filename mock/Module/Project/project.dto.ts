// mock/Project/project.dto.ts
// 文集 DTO（Data Transfer Object，数据传输对象）
// 功能：定义文集相关接口请求和响应的数据结构类型

import type { MockProject } from '../../Entities/project';

// ==================== 文集列表相关 DTO ====================

/** 获取文集列表请求参数 */
export interface GetProjectListRequest {
  /** 当前页（默认 1） */
  page?: number;
  /** 每页条数（默认 12） */
  page_size?: number;
  /** 搜索关键词（文集名称/简介） */
  keyword?: string;
  /** 筛选类型（all=全部/mine=我的/collab=协作/private=私有） */
  filter?: 'all' | 'mine' | 'collab' | 'private';
  /** 分类 ID（0 表示全部，-1 表示未分类） */
  project_category_id?: number;
  /** 排序方式（update=更新时间/create=创建时间/count=文档数/name=名称） */
  sort?: 'update' | 'create' | 'count' | 'name';
  /** 用户 ID（用于筛选我的文集/私有文集） */
  user_id?: number;
}

/** 获取文集列表响应数据（data 字段内容） */
export interface GetProjectListResponse {
  /** 文集列表 */
  list: MockProject[];
  /** 总条数 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页条数 */
  page_size: number;
}

// ==================== 文集详情相关 DTO ====================

/** 获取文集详情响应数据（data 字段内容） */
export type GetProjectDetailResponse = MockProject;

// ==================== 创建文集相关 DTO ====================

/** 创建文集请求参数 */
export interface CreateProjectRequest {
  /** 文集名称（1-50个字符） */
  name: string;
  /** 文集简介 */
  intro?: string;
  /** 图标（默认 FolderOutlined） */
  icon?: string;
  /** 主题色（默认 #1890ff） */
  color?: string;
  /** 可见性（0=公开，1=私有，默认 0） */
  role?: number;
  /** 分类 ID（0 表示未分类） */
  project_category_id?: number;
  /** 是否置顶（默认 false） */
  is_top?: boolean;
  /** 是否协作文集（默认 false） */
  is_collaborator?: boolean;
  /** 排序（默认 0） */
  sort?: number;
}

/** 创建文集响应数据（data 字段内容） */
export type CreateProjectResponse = MockProject;

// ==================== 更新文集相关 DTO ====================

/** 更新文集请求参数 */
export interface UpdateProjectRequest {
  /** 文集名称（可选，1-50个字符） */
  name?: string;
  /** 文集简介（可选） */
  intro?: string;
  /** 图标（可选） */
  icon?: string;
  /** 主题色（可选） */
  color?: string;
  /** 可见性（可选，0=公开，1=私有） */
  role?: number;
  /** 分类 ID（可选，0 表示未分类） */
  project_category_id?: number;
  /** 是否置顶（可选） */
  is_top?: boolean;
  /** 是否协作者（可选） */
  is_collaborator?: boolean;
  /** 排序（可选） */
  sort?: number;
}

/** 更新文集响应数据（data 字段内容） */
export type UpdateProjectResponse = MockProject;

// ==================== 删除文集相关 DTO ====================

/** 删除文集响应数据（无数据） */
export type DeleteProjectResponse = null;
