/**
 * 标签模块 DTO（Data Transfer Object，数据传输对象）
 *
 * 【文件职责】
 * 定义标签模块所有接口的请求和响应的数据结构类型
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：只做路由定义
 * 2. 控制器层（controller.ts）：处理请求响应
 * 3. 服务层（service.ts）：业务逻辑
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/tag.ts）：类型定义、初始数据、表实例
 * 6. 通用层（Core/）：通用工具、中间件、异常处理
 */

import type { MockTag, MockTagCategory, MockTagRelation, TagType } from '../../Entities/tag';
import type { ApiResponse, PaginatedResponse } from '../../Core';

// ============================================================================
// 1. 通用响应类型（统一从 Core 导入，避免重复定义）
// ============================================================================

/** 分页响应格式 */
export interface PaginatedResponse<T = any> {
  /** 数据列表 */
  list: T[];
  /** 总数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  page_size: number;
}

// ============================================================================
// 2. 标签分类 DTO
// ============================================================================

/** 获取标签列表请求参数 */
export interface GetTagListRequest {
  /** 标签类型（doc=文档标签，project=文集标签） */
  type?: TagType;
}

/** 获取标签列表响应数据 */
export interface GetTagListResponse {
  /** 标签分类列表 */
  categories: MockTagCategory[];
  /** 标签列表 */
  tags: MockTag[];
  /** 文档-标签关联（targetId -> tagIds） */
  doc_tag_relations: Record<number, number[]>;
}

/** 获取标签分类列表请求参数 */
export interface GetTagCategoriesRequest {
  /** 标签类型（doc=文档标签，project=文集标签） */
  type?: TagType;
}

/** 标签分类（含该分类下的标签） */
export interface TagCategoryWithTags extends MockTagCategory {
  /** 该分类下的标签列表 */
  tags: Array<MockTag & {
    /** 实时计算的使用次数 */
    usage_count: number;
  }>;
}

/** 获取标签分类列表响应数据 */
export type GetTagCategoriesResponse = TagCategoryWithTags[];

/** 创建标签分类请求参数 */
export interface CreateTagCategoryRequest {
  /** 分类名称 */
  name: string;
  /** 父分类 ID（0 表示顶级分类） */
  parent_id?: number;
  /** 标签类型（doc=文档标签，project=文集标签） */
  type?: TagType;
  /** 分类颜色 */
  color?: string;
}

/** 创建标签分类响应数据 */
export type CreateTagCategoryResponse = MockTagCategory;

/** 更新标签分类请求参数 */
export interface UpdateTagCategoryRequest {
  /** 分类名称 */
  name?: string;
  /** 分类颜色 */
  color?: string;
}

/** 更新标签分类响应数据 */
export type UpdateTagCategoryResponse = MockTagCategory;

/** 分类排序请求参数 */
export interface SortTagCategoryRequest {
  /** 移动方向（up=上移，down=下移） */
  direction: 'up' | 'down';
}

/** 分类排序响应数据 */
export type SortTagCategoryResponse = null;

/** 删除标签分类响应数据 */
export type DeleteTagCategoryResponse = null;

// ============================================================================
// 3. 标签 DTO
// ============================================================================

/** 创建标签请求参数 */
export interface CreateTagRequest {
  /** 标签名称 */
  name: string;
  /** 标签颜色 */
  color?: string;
  /** 所属分类 ID */
  category_id: number;
  /** 标签类型（doc=文档标签，project=文集标签） */
  type?: TagType;
}

/** 创建标签响应数据 */
export type CreateTagResponse = MockTag;

/** 更新标签请求参数 */
export interface UpdateTagRequest {
  /** 标签名称 */
  name?: string;
  /** 标签颜色 */
  color?: string;
}

/** 更新标签响应数据 */
export type UpdateTagResponse = MockTag;

/** 删除标签响应数据 */
export type DeleteTagResponse = null;

/** 按标签获取目标列表请求参数 */
export interface GetTagDocsRequest {
  /** 页码 */
  page?: number;
  /** 每页数量 */
  page_size?: number;
  /** 标签类型（doc=文档标签，project=文集标签） */
  type?: TagType;
}

/** 文档标签项（含文集名称、作者信息、标签列表） */
export interface DocTagItem {
  /** 文档 ID */
  id: number;
  /** 文档名称 */
  name: string;
  /** 文档简介 */
  summary: string;
  /** 所属文集 ID */
  project_id: number;
  /** 文集名称 */
  project_name: string;
  /** 作者 ID */
  author_id: number;
  /** 作者名称 */
  author_name: string;
  /** 更新时间 */
  update_time: string;
  /** 标签列表 */
  tags: MockTag[];
  [key: string]: any;
}

/** 文集标签项（含标签列表） */
export interface ProjectTagItem {
  /** 文集 ID */
  id: number;
  /** 文集名称 */
  name: string;
  /** 标签列表 */
  tags: MockTag[];
  [key: string]: any;
}

/** 按标签获取目标列表响应数据 */
export type GetTagDocsResponse = PaginatedResponse<DocTagItem | ProjectTagItem>;

// ============================================================================
// 4. 标签关联 DTO
// ============================================================================

/** 获取文档标签列表响应数据 */
export type GetDocTagsResponse = MockTag[];

/** 添加文档标签请求参数 */
export interface AddDocTagRequest {
  /** 标签 ID */
  tag_id: number;
}

/** 添加文档标签响应数据 */
export interface AddDocTagResponse extends MockTag {
  /** 关联 ID */
  relation_id: number;
}

/** 移除文档标签响应数据 */
export type RemoveDocTagResponse = null;
