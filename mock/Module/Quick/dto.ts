/**
 * 快捷操作模块 DTO（Data Transfer Object，数据传输对象）
 *
 * 【文件职责】
 * 定义快捷操作模块所有接口的请求和响应的数据结构类型
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：只做路由定义
 * 2. 控制器层（controller.ts）：处理请求响应
 * 3. 服务层（service.ts）：业务逻辑
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/quick.ts）：类型定义、初始数据、表实例
 * 6. 通用层（Core/）：通用工具、中间件、异常处理
 */

import type {
  MockQuickGroup,
  MockQuickGroupRelation,
  MockQuickItem,
  QuickItemType,
} from '../../Entities/quick';
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
// 2. 快捷操作分组 DTO
// ============================================================================

/** 快捷操作分组（含分组下的操作项） */
export interface QuickGroupWithItems extends MockQuickGroup {
  /** 分组下的操作项列表 */
  items: MockQuickItem[];
  /** 操作项数量 */
  item_count: number;
}

/** 获取分组列表响应数据 */
export type GetQuickGroupsResponse = QuickGroupWithItems[];

/** 创建分组请求参数 */
export interface CreateQuickGroupRequest {
  /** 分组名称 */
  name: string;
  /** 分组图标 */
  icon?: string;
  /** 排序值 */
  sort?: number;
}

/** 创建分组响应数据 */
export type CreateQuickGroupResponse = MockQuickGroup;

/** 更新分组请求参数 */
export interface UpdateQuickGroupRequest {
  /** 分组名称 */
  name?: string;
  /** 分组图标 */
  icon?: string;
  /** 排序值 */
  sort?: number;
}

/** 更新分组响应数据 */
export type UpdateQuickGroupResponse = MockQuickGroup;

/** 删除分组响应数据 */
export type DeleteQuickGroupResponse = null;

// ============================================================================
// 3. 快捷操作项 DTO
// ============================================================================

/** 获取快捷操作列表请求参数 */
export interface GetQuickItemsRequest {
  /** 分类 ID（可选，all 表示全部） */
  category_id?: number | string;
  /** 操作类型（link/action/template） */
  type?: QuickItemType;
}

/** 获取快捷操作列表响应数据 */
export type GetQuickItemsResponse = MockQuickItem[];

/** 创建快捷操作项请求参数 */
export interface CreateQuickItemRequest {
  /** 操作项名称 */
  name: string;
  /** 操作项描述 */
  description?: string;
  /** 图标 */
  icon?: string;
  /** 操作类型（link=链接，action=动作，template=模板） */
  type: QuickItemType;
  /** 链接 URL（type=link 时使用） */
  url?: string;
  /** 动作标识（type=action 时使用） */
  action?: string;
  /** 模板 ID（type=template 时使用） */
  template_id?: number;
  /** 排序值 */
  sort?: number;
}

/** 创建快捷操作项响应数据 */
export type CreateQuickItemResponse = MockQuickItem;

/** 更新快捷操作项请求参数 */
export interface UpdateQuickItemRequest {
  /** 操作项名称 */
  name?: string;
  /** 操作项描述 */
  description?: string;
  /** 图标 */
  icon?: string;
  /** 操作类型 */
  type?: QuickItemType;
  /** 链接 URL */
  url?: string;
  /** 动作标识 */
  action?: string;
  /** 模板 ID */
  template_id?: number;
  /** 排序值 */
  sort?: number;
}

/** 更新快捷操作项响应数据 */
export type UpdateQuickItemResponse = MockQuickItem;

/** 删除快捷操作项响应数据 */
export type DeleteQuickItemResponse = null;

/** 增加使用次数响应数据 */
export type IncrementUsageResponse = MockQuickItem;

// ============================================================================
// 4. 分组关联 DTO
// ============================================================================

/** 添加操作项到分组请求参数 */
export interface AddItemToGroupRequest {
  /** 操作项 ID */
  item_id: number;
  /** 排序值 */
  sort?: number;
}

/** 添加操作项到分组响应数据 */
export type AddItemToGroupResponse = MockQuickGroupRelation;

/** 从分组移除操作项响应数据 */
export type RemoveItemFromGroupResponse = null;

/** 保存分组排序请求参数 */
export interface SaveGroupSortRequest {
  /** 排序数据（每个 item 自带 id/sort） */
  sorts: Array<{
    /** 分组 ID */
    id: number;
    /** 排序值 */
    sort: number;
  }>;
}

/** 保存分组排序响应数据 */
export type SaveGroupSortResponse = null;
