/**
 * 文档 CRUD 请求参数校验规则
 *
 * 【职责】
 * 校验文档核心 CRUD 相关接口请求参数是否符合要求，返回错误信息（null 表示校验通过）
 */

import type {
  CreateDocRequest,
  GetDocListRequest,
  UpdateDocRequest,
} from './doc.dto';

// ==================== 文档列表相关校验 ====================

/**
 * 校验获取文档列表请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateGetDocListRequest(data: GetDocListRequest): string | null {
  // 文集 ID 必填校验
  if (!data.project_id) {
    return '文集 ID 不能为空';
  }

  // 页码校验
  if (data.page !== undefined && (data.page < 1 || data.page > 1000)) {
    return '页码范围应为1-1000';
  }

  // 每页条数校验
  if (data.page_size !== undefined && (data.page_size < 1 || data.page_size > 100)) {
    return '每页条数范围应为1-100';
  }

  // 排序方式校验
  if (
    data.sort !== undefined &&
    !['update', 'create', 'name', 'sort'].includes(data.sort)
  ) {
    return '排序方式只能是 update/create/name/sort';
  }

  return null;
}

// ==================== 创建文档相关校验 ====================

/**
 * 校验创建文档请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateCreateDocRequest(data: CreateDocRequest): string | null {
  // 文集 ID 必填校验
  if (!data.project_id) {
    return '文集 ID 不能为空';
  }

  // 文档名称必填校验
  if (!data.name) {
    return '文档名称不能为空';
  }

  // 名称长度校验
  if (data.name.length < 1 || data.name.length > 100) {
    return '文档名称长度应为1-100位';
  }

  return null;
}

// ==================== 更新文档相关校验 ====================

/**
 * 校验更新文档请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateUpdateDocRequest(data: UpdateDocRequest): string | null {
  // 名称长度校验（如果提供）
  if (data.name !== undefined && (data.name.length < 1 || data.name.length > 100)) {
    return '文档名称长度应为1-100位';
  }

  // 摘要长度校验（如果提供）
  if (data.summary !== undefined && data.summary.length > 500) {
    return '文档摘要长度不能超过500位';
  }

  return null;
}

// ==================== 通用分页校验（保留兼容） ====================

/**
 * 通用分页请求校验
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validatePaginationRequest(
  data: { page?: number; pageSize?: number },
): string | null {
  if (data.page !== undefined && (data.page < 1 || data.page > 1000)) {
    return '页码范围应为1-1000';
  }
  if (data.pageSize !== undefined && (data.pageSize < 1 || data.pageSize > 100)) {
    return '每页条数范围应为1-100';
  }
  return null;
}
