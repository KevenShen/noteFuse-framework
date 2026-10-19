// mock/Doc/docVersion.validator.ts
// 文档版本管理请求参数校验规则
// 功能：校验文档版本管理相关接口请求参数是否符合要求

import { BusinessError } from '../../Core/common';
import { CommonErrorCodes } from '../../Core/errorCodes';

import type {
  CreateDocVersionRequest,
  DeleteDocVersionRequest,
  SaveVersionContentRequest,
  SetCurrentVersionRequest,
  UpdateDocVersionRequest,
} from './docVersion.dto';

// ==================== 创建文档版本 ====================

/**
 * 校验创建文档版本请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateCreateDocVersionRequest(
  data: CreateDocVersionRequest,
): void {
  // 版本状态校验（如果提供）
  if (
    data.status !== undefined &&
    !['draft', 'published', 'archived', 'deprecated'].includes(data.status)
  ) {
    throw new BusinessError('版本状态只能是 draft/published/archived/deprecated', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 基础版本 ID 校验（如果提供）
  if (data.base_version_id !== undefined && data.base_version_id <= 0) {
    throw new BusinessError('基础版本 ID 必须为正整数', CommonErrorCodes.VALIDATION_FAILED);
  }
}

// ==================== 更新文档版本 ====================

/**
 * 校验更新文档版本请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateUpdateDocVersionRequest(
  data: UpdateDocVersionRequest,
): void {
  // 至少提供一个更新字段
  if (
    data.content === undefined &&
    data.outline === undefined &&
    data.remark === undefined
  ) {
    throw new BusinessError('至少提供一个更新字段（content/outline/remark）', CommonErrorCodes.VALIDATION_FAILED);
  }
}

// ==================== 设为当前版本 ====================

/**
 * 校验设为当前版本请求（versionId 在 URL params 中）
 * @param data 请求参数（body + params 合并后的数据，params 中的数字已自动转换）
 * @throws BusinessError 校验失败时抛出
 */
export function validateSetCurrentVersionRequest(
  data: SetCurrentVersionRequest,
): void {
  // 必填校验
  if (data.versionId === undefined || data.versionId === null) {
    throw new BusinessError('版本 ID 不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

  // ID 有效性校验
  if (typeof data.versionId !== 'number' || data.versionId <= 0 || !Number.isInteger(data.versionId)) {
    throw new BusinessError('版本 ID 必须为正整数', CommonErrorCodes.VALIDATION_FAILED);
  }
}

// ==================== 保存版本原文 ====================

/**
 * 校验保存版本原文请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateSaveVersionContentRequest(
  data: SaveVersionContentRequest,
): void {
  // 原文内容必填校验
  if (data.content === undefined || data.content === null) {
    throw new BusinessError('原文内容不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }
}

// ==================== 删除文档版本 ====================

/**
 * 校验删除文档版本请求（versionId 在 URL params 中）
 * @param data 请求参数（body + params 合并后的数据，params 中的数字已自动转换）
 * @throws BusinessError 校验失败时抛出
 */
export function validateDeleteDocVersionRequest(
  data: DeleteDocVersionRequest,
): void {
  // 必填校验
  if (data.versionId === undefined || data.versionId === null) {
    throw new BusinessError('版本 ID 不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

  // ID 有效性校验
  if (typeof data.versionId !== 'number' || data.versionId <= 0 || !Number.isInteger(data.versionId)) {
    throw new BusinessError('版本 ID 必须为正整数', CommonErrorCodes.VALIDATION_FAILED);
  }
}
