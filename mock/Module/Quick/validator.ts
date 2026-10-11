/**
 * 快捷操作模块请求参数校验规则
 *
 * 【文件职责】
 * 校验快捷操作模块所有接口的请求参数是否符合要求，返回错误信息（null 表示校验通过）
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：使用 withMiddleware 包装，引入校验函数
 * 2. 控制器层（controller.ts）：处理请求响应
 * 3. 服务层（service.ts）：业务逻辑
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/quick.ts）：类型定义、初始数据、表实例
 * 6. 通用层（Core/）：通用工具、中间件、异常处理
 */

import type {
  AddItemToGroupRequest,
  CreateQuickGroupRequest,
  CreateQuickItemRequest,
  GetQuickItemsRequest,
  SaveGroupSortRequest,
  UpdateQuickGroupRequest,
  UpdateQuickItemRequest,
} from './dto';

// ============================================================================
// 1. 快捷操作分组相关校验
// ============================================================================

/**
 * 校验创建分组请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateCreateQuickGroupRequest(
  data: CreateQuickGroupRequest,
): string | null {
  // 必填校验
  if (!data.name || !data.name.trim()) {
    return '分组名称不能为空';
  }

  // 名称长度校验
  if (data.name.trim().length < 1 || data.name.trim().length > 50) {
    return '分组名称长度应为1-50位';
  }

  // 排序值校验
  if (data.sort !== undefined && data.sort < 0) {
    return '排序值不能为负数';
  }

  return null;
}

/**
 * 校验更新分组请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateUpdateQuickGroupRequest(
  data: UpdateQuickGroupRequest,
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

/**
 * 校验保存分组排序请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateSaveGroupSortRequest(
  data: SaveGroupSortRequest,
): string | null {
  // 必填校验
  if (!data.sorts || !Array.isArray(data.sorts) || data.sorts.length === 0) {
    return '排序数据不能为空';
  }

  // 校验每个排序项
  for (const item of data.sorts) {
    if (!item.id || item.id < 1) {
      return '分组 ID 必须大于 0';
    }
    if (item.sort === undefined || item.sort < 0) {
      return '排序值不能为负数';
    }
  }

  return null;
}

// ============================================================================
// 2. 快捷操作项相关校验
// ============================================================================

/**
 * 校验获取快捷操作列表请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateGetQuickItemsRequest(
  data: GetQuickItemsRequest,
): string | null {
  // 操作类型校验
  if (
    data.type !== undefined &&
    !['link', 'action', 'template'].includes(data.type)
  ) {
    return '操作类型只能是 link/action/template';
  }

  return null;
}

/**
 * 校验创建快捷操作项请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateCreateQuickItemRequest(
  data: CreateQuickItemRequest,
): string | null {
  // 必填校验
  if (!data.name || !data.name.trim()) {
    return '操作项名称不能为空';
  }

  // 名称长度校验
  if (data.name.trim().length < 1 || data.name.trim().length > 50) {
    return '操作项名称长度应为1-50位';
  }

  // 操作类型校验
  if (!data.type || !['link', 'action', 'template'].includes(data.type)) {
    return '操作类型只能是 link/action/template';
  }

  // 根据类型校验必填字段
  if (data.type === 'link' && !data.url) {
    return '链接类型必须提供 URL';
  }
  if (data.type === 'action' && !data.action) {
    return '动作类型必须提供动作标识';
  }
  if (data.type === 'template' && !data.template_id) {
    return '模板类型必须提供模板 ID';
  }

  // 排序值校验
  if (data.sort !== undefined && data.sort < 0) {
    return '排序值不能为负数';
  }

  return null;
}

/**
 * 校验更新快捷操作项请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateUpdateQuickItemRequest(
  data: UpdateQuickItemRequest,
): string | null {
  // 名称长度校验（如果提供）
  if (data.name !== undefined && data.name.trim()) {
    if (data.name.trim().length < 1 || data.name.trim().length > 50) {
      return '操作项名称长度应为1-50位';
    }
  }

  // 操作类型校验（如果提供）
  if (
    data.type !== undefined &&
    !['link', 'action', 'template'].includes(data.type)
  ) {
    return '操作类型只能是 link/action/template';
  }

  // 排序值校验（如果提供）
  if (data.sort !== undefined && data.sort < 0) {
    return '排序值不能为负数';
  }

  return null;
}

// ============================================================================
// 3. 分组关联相关校验
// ============================================================================

/**
 * 校验添加操作项到分组请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateAddItemToGroupRequest(
  data: AddItemToGroupRequest,
): string | null {
  // 必填校验
  if (!data.item_id) {
    return '操作项 ID 不能为空';
  }

  // 操作项 ID 校验
  if (data.item_id < 1) {
    return '操作项 ID 必须大于 0';
  }

  // 排序值校验
  if (data.sort !== undefined && data.sort < 0) {
    return '排序值不能为负数';
  }

  return null;
}
