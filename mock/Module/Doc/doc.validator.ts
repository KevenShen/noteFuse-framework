// mock/Doc/doc.validator.ts
// 文档 CRUD 请求参数校验规则
// 功能：校验文档核心 CRUD 相关接口请求参数是否符合要求

import { BusinessError } from '../../Core/common';
import { CommonErrorCodes } from '../../Core/errorCodes';

import type {
  CreateDocRequest,
  DeleteDocRequest,
  GetDocListRequest,
  UpdateDocRequest,
} from './doc.dto';

// ==================== 获取文档列表 ====================

/**
 * 校验获取文档列表请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateGetDocListRequest(data: GetDocListRequest): void {
  // 文集 ID 必填校验
  if (!data.project_id) {
    throw new BusinessError('文集 ID 不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 页码校验
  if (data.page !== undefined && (data.page < 1 || data.page > 1000)) {
    throw new BusinessError('页码范围应为1-1000', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 每页条数校验
  if (data.page_size !== undefined && (data.page_size < 1 || data.page_size > 100)) {
    throw new BusinessError('每页条数范围应为1-100', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 排序方式校验
  if (
    data.sort !== undefined &&
    !['update', 'create', 'name', 'sort'].includes(data.sort)
  ) {
    throw new BusinessError('排序方式只能是 update/create/name/sort', CommonErrorCodes.VALIDATION_FAILED);
  }
}

// ==================== 创建文档 ====================

/**
 * 校验创建文档请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateCreateDocRequest(data: CreateDocRequest): void {
  // 文集 ID 必填校验
  if (!data.project_id) {
    throw new BusinessError('文集 ID 不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 文档名称必填校验
  if (!data.name) {
    throw new BusinessError('文档名称不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 名称长度校验
  if (data.name.length < 1 || data.name.length > 100) {
    throw new BusinessError('文档名称长度应为1-100位', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 分类 ID 校验（如果提供）
  if (data.doc_category_id !== undefined && data.doc_category_id < 0) {
    throw new BusinessError('分类 ID 不能为负数', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 排序值校验（如果提供）
  if (data.sort !== undefined && data.sort < 0) {
    throw new BusinessError('排序值不能为负数', CommonErrorCodes.VALIDATION_FAILED);
  }
}

// ==================== 更新文档 ====================

/**
 * 校验更新文档请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateUpdateDocRequest(data: UpdateDocRequest): void {
  // 至少提供一个更新字段
  if (
    data.name === undefined &&
    data.summary === undefined &&
    data.doc_category_id === undefined &&
    data.sort === undefined &&
    data.version_overview === undefined &&
    data.content === undefined &&
    data.remark === undefined
  ) {
    throw new BusinessError('至少提供一个更新字段', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 名称长度校验（如果提供）
  if (data.name !== undefined && (data.name.length < 1 || data.name.length > 100)) {
    throw new BusinessError('文档名称长度应为1-100位', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 摘要长度校验（如果提供）
  if (data.summary !== undefined && data.summary.length > 500) {
    throw new BusinessError('文档摘要长度不能超过500位', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 分类 ID 校验（如果提供）
  if (data.doc_category_id !== undefined && data.doc_category_id < 0) {
    throw new BusinessError('分类 ID 不能为负数', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 排序值校验（如果提供）
  if (data.sort !== undefined && data.sort < 0) {
    throw new BusinessError('排序值不能为负数', CommonErrorCodes.VALIDATION_FAILED);
  }
}

// ==================== 删除文档 ====================

/**
 * 校验删除文档请求（ID 在 URL params 中，validateMiddleware 会自动合并并转换为数字）
 * @param data 请求参数（body + params 合并后的数据，params 中的数字已自动转换）
 * @throws BusinessError 校验失败时抛出
 */
export function validateDeleteDocRequest(
  data: DeleteDocRequest,
): void {
  // 必填校验
  if (data.id === undefined || data.id === null) {
    throw new BusinessError('文档 ID 不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

  // ID 有效性校验（中间件已将 params 中的数字字符串转换为 number）
  if (typeof data.id !== 'number' || data.id <= 0 || !Number.isInteger(data.id)) {
    throw new BusinessError('文档 ID 必须为正整数', CommonErrorCodes.VALIDATION_FAILED);
  }
}
