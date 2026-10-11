/**
 * 收藏模块请求参数校验规则
 *
 * 【文件职责】
 * 校验收藏模块所有接口的请求参数是否符合要求，返回错误信息（null 表示校验通过）
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：使用 withMiddleware 包装，引入校验函数
 * 2. 控制器层（controller.ts）：处理请求响应
 * 3. 服务层（service.ts）：业务逻辑
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/collect.ts）：类型定义、初始数据、表实例
 * 6. 通用层（Core/）：通用工具、中间件、异常处理
 */

import type {
  CheckCollectedRequest,
  CreateCollectGroupRequest,
  CreateCollectRequest,
  GetCollectGroupsRequest,
  GetCollectListRequest,
  MoveCollectRequest,
  UpdateCollectGroupRequest,
} from './dto';

// ============================================================================
// 1. 收藏分组相关校验
// ============================================================================

/**
 * 校验获取收藏分组列表请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateGetCollectGroupsRequest(
  data: GetCollectGroupsRequest,
): string | null {
  // 收藏类型校验
  if (data.type !== undefined && !['doc', 'project'].includes(data.type)) {
    return '收藏类型只能是 doc 或 project';
  }

  return null;
}

/**
 * 校验创建收藏分组请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateCreateCollectGroupRequest(
  data: CreateCollectGroupRequest,
): string | null {
  // 必填校验
  if (!data.name || !data.name.trim()) {
    return '分组名称不能为空';
  }

  // 名称长度校验
  if (data.name.trim().length < 1 || data.name.trim().length > 50) {
    return '分组名称长度应为1-50位';
  }

  // 收藏类型校验
  if (data.type !== undefined && !['doc', 'project'].includes(data.type)) {
    return '收藏类型只能是 doc 或 project';
  }

  // 排序值校验
  if (data.sort !== undefined && data.sort < 0) {
    return '排序值不能为负数';
  }

  return null;
}

/**
 * 校验更新收藏分组请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateUpdateCollectGroupRequest(
  data: UpdateCollectGroupRequest,
): string | null {
  // 名称长度校验（如果提供）
  if (data.name !== undefined && data.name.trim()) {
    if (data.name.trim().length < 1 || data.name.trim().length > 50) {
      return '分组名称长度应为1-50位';
    }
  }

  // 排序值校验（如果提供）
  if (data.sort !== undefined && data.sort < 0) {
    return '排序值不能为负数';
  }

  return null;
}

// ============================================================================
// 2. 收藏记录相关校验
// ============================================================================

/**
 * 校验获取收藏列表请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateGetCollectListRequest(
  data: GetCollectListRequest,
): string | null {
  // 页码校验
  if (data.page !== undefined && (data.page < 1 || data.page > 1000)) {
    return '页码范围应为1-1000';
  }

  // 每页条数校验
  if (
    data.page_size !== undefined &&
    (data.page_size < 1 || data.page_size > 100)
  ) {
    return '每页条数范围应为1-100';
  }

  // 收藏类型校验
  if (data.type !== undefined && !['doc', 'project'].includes(data.type)) {
    return '收藏类型只能是 doc 或 project';
  }

  // 分组 ID 校验
  if (data.group_id !== undefined && data.group_id < -1) {
    return '分组 ID 不能小于 -1';
  }

  return null;
}

/**
 * 校验添加收藏请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateCreateCollectRequest(
  data: CreateCollectRequest,
): string | null {
  // 必填校验
  if (!data.target_id) {
    return '目标 ID 不能为空';
  }

  // 目标 ID 校验
  if (data.target_id < 1) {
    return '目标 ID 必须大于 0';
  }

  // 收藏类型校验
  if (data.type !== undefined && !['doc', 'project'].includes(data.type)) {
    return '收藏类型只能是 doc 或 project';
  }

  // 分组 ID 校验
  if (data.group_id !== undefined && data.group_id < 0) {
    return '分组 ID 不能为负数';
  }

  return null;
}

/**
 * 校验移动收藏到其他分组请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateMoveCollectRequest(
  data: MoveCollectRequest,
): string | null {
  // 必填校验
  if (data.group_id === undefined || data.group_id === null) {
    return '目标分组 ID 不能为空';
  }

  // 分组 ID 校验
  if (data.group_id < 0) {
    return '分组 ID 不能为负数';
  }

  return null;
}

/**
 * 校验检查是否已收藏请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateCheckCollectedRequest(
  data: CheckCollectedRequest,
): string | null {
  // 必填校验
  if (!data.target_id) {
    return '目标 ID 不能为空';
  }

  // 目标 ID 校验
  if (data.target_id < 1) {
    return '目标 ID 必须大于 0';
  }

  // 收藏类型校验
  if (data.type !== undefined && !['doc', 'project'].includes(data.type)) {
    return '收藏类型只能是 doc 或 project';
  }

  return null;
}
