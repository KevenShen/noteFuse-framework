/**
 * 收藏模块 DTO（Data Transfer Object，数据传输对象）
 *
 * 【文件职责】
 * 定义收藏模块所有接口的请求和响应的数据结构类型
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：只做路由定义
 * 2. 控制器层（controller.ts）：处理请求响应
 * 3. 服务层（service.ts）：业务逻辑
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/collect.ts）：类型定义、初始数据、表实例
 * 6. 通用层（Core/）：通用工具、中间件、异常处理
 */

import type { MockCollect, MockCollectGroup, CollectType } from '../../Entities/collect';
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
// 2. 收藏分组 DTO
// ============================================================================

/** 获取收藏分组列表请求参数 */
export interface GetCollectGroupsRequest {
  /** 收藏类型（doc=文档收藏，project=文集收藏） */
  type?: CollectType;
}

/** 收藏分组（含收藏数量） */
export interface CollectGroupWithCount extends MockCollectGroup {
  /** 该分组下的收藏数量 */
  count: number;
}

/** 获取收藏分组列表响应数据 */
export interface GetCollectGroupsResponse {
  /** 分组列表（含收藏数量） */
  list: CollectGroupWithCount[];
  /** 未分组收藏数量 */
  ungrouped_count: number;
  /** 全部收藏数量 */
  total_count: number;
}

/** 创建收藏分组请求参数 */
export interface CreateCollectGroupRequest {
  /** 分组名称 */
  name: string;
  /** 分组描述 */
  description?: string;
  /** 排序值 */
  sort?: number;
  /** 收藏类型（doc=文档收藏，project=文集收藏） */
  type?: CollectType;
  /** 图标 */
  icon?: string;
}

/** 创建收藏分组响应数据 */
export type CreateCollectGroupResponse = MockCollectGroup;

/** 更新收藏分组请求参数 */
export interface UpdateCollectGroupRequest {
  /** 分组名称 */
  name?: string;
  /** 分组描述 */
  description?: string;
  /** 排序值 */
  sort?: number;
  /** 图标 */
  icon?: string;
}

/** 更新收藏分组响应数据 */
export type UpdateCollectGroupResponse = MockCollectGroup;

/** 删除收藏分组响应数据 */
export type DeleteCollectGroupResponse = null;

// ============================================================================
// 3. 收藏记录 DTO
// ============================================================================

/** 获取收藏列表请求参数 */
export interface GetCollectListRequest {
  /** 页码 */
  page?: number;
  /** 每页数量 */
  page_size?: number;
  /** 分组 ID（-1 表示全部，0 表示未分组，其他表示指定分组） */
  group_id?: number;
  /** 关键词搜索 */
  keyword?: string;
  /** 收藏类型（doc=文档收藏，project=文集收藏） */
  type?: CollectType;
}

/** 收藏项（含目标信息和分组信息） */
export interface CollectItem extends MockCollect {
  /** 分组名称 */
  group_name: string;
  // ========== 文档收藏特有字段 ==========
  /** 所属文集名称（文档收藏特有） */
  project_name?: string;
  /** 作者名称（文档收藏特有） */
  author_name?: string;
  /** 作者 ID（文档收藏特有） */
  author_id?: number;
  // ========== 文集收藏特有字段 ==========
  /** 分类名称（文集收藏特有） */
  category_name?: string;
}

/** 获取收藏列表响应数据 */
export type GetCollectListResponse = PaginatedResponse<CollectItem>;

/** 添加收藏请求参数 */
export interface CreateCollectRequest {
  /** 收藏类型（doc=文档收藏，project=文集收藏） */
  type?: CollectType;
  /** 目标 ID（文档 ID 或文集 ID） */
  target_id: number;
  /** 分组 ID（0 表示未分组） */
  group_id?: number;
}

/** 添加收藏响应数据 */
export type CreateCollectResponse = MockCollect;

/** 取消收藏响应数据 */
export type DeleteCollectResponse = null;

/** 移动收藏到其他分组请求参数 */
export interface MoveCollectRequest {
  /** 目标分组 ID */
  group_id: number;
}

/** 移动收藏到其他分组响应数据 */
export type MoveCollectResponse = MockCollect;

/** 检查是否已收藏请求参数 */
export interface CheckCollectedRequest {
  /** 收藏类型（doc=文档收藏，project=文集收藏） */
  type?: CollectType;
  /** 目标 ID（文档 ID 或文集 ID） */
  target_id: number;
}

/** 检查是否已收藏响应数据 */
export interface CheckCollectedResponse {
  /** 是否已收藏 */
  collected: boolean;
  /** 收藏 ID（如果已收藏） */
  collect_id?: number;
  /** 分组 ID（如果已收藏） */
  group_id?: number;
}
