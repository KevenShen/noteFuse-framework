// src/pages/Project/types.ts
// 文集模块私有类型定义
import type { DocVersion } from '@/components/DocTree/types';

// ==================== 文集分类（全局三级分类，用于文集列表筛选） ====================

export interface ProjectCategoryItem {
  /** 分类 ID */
  id: number;
  /** 分类名称 */
  name: string;
  /** 父级 ID，0 表示顶级 */
  parent_id: number;
  /** 排序 */
  sort: number;
  /** 图标（可选） */
  icon?: string;
  /** 描述（可选） */
  description?: string;
  /** 该分类下的文集数量（只读，后端统计返回） */
  project_count?: number;
  /** 创建时间（时间戳） */
  create_time?: number;
  /** 子分类（树形展示时使用，扁平化存储时不存在） */
  children?: ProjectCategoryItem[];
}

// 兼容旧命名
export type CategoryItem = ProjectCategoryItem;

// ==================== 文集 ====================

export type ProjectRole = 0 | 1;

export interface ProjectItem {
  id: number;
  name: string;
  intro: string;
  icon: string;
  color: string;
  doc_count: number;
  /** 0=公开，1=私有 */
  role: ProjectRole;
  is_top: boolean;
  /** 置顶时间，未置顶时为 null */
  top_time: number | null;
  is_collaborator: boolean;
  /** 所属文集分类 ID（外键，关联 project_categories） */
  project_category_id: number;
  create_user: string;
  create_user_id: number;
  create_time: number;
  modify_time: number;
}

// ==================== 文档分类（文集内的文档分组） ====================

export interface DocCategory {
  id: number;
  project_id: number;
  name: string;
  parent_id: number | null;
  sort: number;
  create_time: number;
}

// 兼容旧命名
export type ProjectCategory = DocCategory;

// ==================== 文档 ====================

/** 文档标签 */
export interface TagItem {
  id: number;
  name: string;
  color: string;
  category_id: number;
  usage_count?: number;
}

export interface DocItem {
  id: number;
  project_id: number;
  /** 所属文档分类 ID（外键，关联 doc_categories） */
  doc_category_id: number;
  name: string;
  sort: number;
  modify_time: number;
  /** 文档摘要（简略内容，用于列表渲染预览） */
  summary?: string;
  /** 版本更新总览（MDX 格式，文档级别的版本变更记录汇总） */
  version_overview?: string;
  /** 文档内容（从当前版本聚合，不同版本内容不同） */
  content?: string;
  /** 当前版本作者 ID（从当前版本聚合，协作场景下不同版本可能由不同作者编辑） */
  author_id?: number;
  /** 当前版本作者名（从当前版本聚合） */
  author_name?: string;
  /** 版本列表（接口聚合返回，启用多版本功能时使用） */
  versions?: DocVersion[];
  /** 当前查看的版本（接口聚合返回，可能是指定版本或当前版本） */
  current_version?: DocVersion;
  /** 文档标签（接口聚合返回） */
  tags?: TagItem[];
}

// ==================== API 参数 ====================

export interface ProjectListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  filter?: string;
  project_category_id?: number;
  sort?: string;
  user_id?: number;
}

export interface ProjectListResult {
  list: ProjectItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProjectFormParams {
  id?: number;
  name: string;
  intro: string;
  icon: string;
  color: string;
  role: ProjectRole;
  project_category_id: number;
  is_top?: boolean;
  is_collaborator?: boolean;
}

// ==================== 页面 UI 状态 ====================

export type ViewMode = 'card' | 'list';

export interface ProjectFilterState {
  keyword: string;
  filter: string;
  project_category_id: number;
  sort: string;
  view_mode: ViewMode;
}

export interface PaginationState {
  current: number;
  page_size: number;
  total: number;
}

// ==================== AI 总结大纲 ====================

export interface AiOutlineChapter {
  title: string;
  desc: string;
  docs: string[];
}

export interface AiOutline {
  id?: number;
  project_id: number;
  summary: string;
  chapters: AiOutlineChapter[];
  created_at?: string;
  updated_at?: string;
}
