// mock/Doc/docAnnotation.validator.ts
// 文档批注管理请求参数校验规则
// 功能：校验文档批注管理相关接口请求参数是否符合要求

import { BusinessError } from '../../Core/common';
import { CommonErrorCodes } from '../../Core/errorCodes';

import type {
  AddAnnotationRequest,
  DeleteAnnotationRequest,
  GetVersionAnnotationsRequest,
  UpdateAnnotationRequest,
} from './docAnnotation.dto';

// ==================== 获取版本批注列表 ====================

/**
 * 校验获取版本批注列表请求（versionId 在 URL params 中）
 * @param data 请求参数（body + params 合并后的数据，params 中的数字已自动转换）
 * @throws BusinessError 校验失败时抛出
 */
export function validateGetVersionAnnotationsRequest(
  data: GetVersionAnnotationsRequest,
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

// ==================== 添加批注 ====================

/**
 * 校验添加批注请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateAddAnnotationRequest(data: AddAnnotationRequest): void {
  // 标记 ID 必填校验
  if (data.marker_id === undefined || data.marker_id === null) {
    throw new BusinessError('标记 ID 不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 标记 ID 有效性校验
  if (typeof data.marker_id !== 'number' || data.marker_id <= 0) {
    throw new BusinessError('标记 ID 必须为正整数', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 批注内容必填校验
  if (!data.content) {
    throw new BusinessError('批注内容不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }
}

// ==================== 更新批注 ====================

/**
 * 校验更新批注请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateUpdateAnnotationRequest(
  data: UpdateAnnotationRequest,
): void {
  // 批注内容必填校验
  if (!data.content) {
    throw new BusinessError('批注内容不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }
}

// ==================== 删除批注 ====================

/**
 * 校验删除批注请求（annotationId 在 URL params 中）
 * @param data 请求参数（body + params 合并后的数据，params 中的数字已自动转换）
 * @throws BusinessError 校验失败时抛出
 */
export function validateDeleteAnnotationRequest(
  data: DeleteAnnotationRequest,
): void {
  // 必填校验
  if (data.annotationId === undefined || data.annotationId === null) {
    throw new BusinessError('批注 ID 不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

  // ID 有效性校验
  if (typeof data.annotationId !== 'number' || data.annotationId <= 0 || !Number.isInteger(data.annotationId)) {
    throw new BusinessError('批注 ID 必须为正整数', CommonErrorCodes.VALIDATION_FAILED);
  }
}
