// mock/Doc/docBrowse.validator.ts
// 文档浏览历史请求参数校验规则
// 功能：校验文档浏览历史相关接口请求参数是否符合要求

import { BusinessError } from '../../Core/common';
import { CommonErrorCodes } from '../../Core/errorCodes';

import type { RecordDocBrowseRequest } from './docBrowse.dto';

// ==================== 记录文档浏览历史 ====================

/**
 * 校验记录文档浏览历史请求（docId 在 URL params 中）
 * @param data 请求参数（body + params 合并后的数据，params 中的数字已自动转换）
 * @throws BusinessError 校验失败时抛出
 */
export function validateRecordDocBrowseRequest(
  data: RecordDocBrowseRequest,
): void {
  // 必填校验
  if (data.docId === undefined || data.docId === null) {
    throw new BusinessError('文档 ID 不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

  // ID 有效性校验
  if (typeof data.docId !== 'number' || data.docId <= 0 || !Number.isInteger(data.docId)) {
    throw new BusinessError('文档 ID 必须为正整数', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 用户 ID 校验（如果提供）
  if (data.user_id !== undefined && (data.user_id <= 0 || !Number.isInteger(data.user_id))) {
    throw new BusinessError('用户 ID 必须为正整数', CommonErrorCodes.VALIDATION_FAILED);
  }
}
