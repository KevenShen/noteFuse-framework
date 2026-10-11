/**
 * 文档批注管理请求参数校验规则
 *
 * 【职责】
 * 校验文档批注管理相关接口请求参数是否符合要求，返回错误信息（null 表示校验通过）
 */

import type {
  AddAnnotationRequest,
  UpdateAnnotationRequest,
} from './docAnnotation.dto';

// ==================== 文档批注相关校验 ====================

/**
 * 校验添加批注请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateAddAnnotationRequest(data: AddAnnotationRequest): string | null {
  // 标记 ID 必填校验
  if (data.marker_id === undefined || data.marker_id === null) {
    return '标记 ID 不能为空';
  }

  // 批注内容必填校验
  if (!data.content) {
    return '批注内容不能为空';
  }

  return null;
}

/**
 * 校验更新批注请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateUpdateAnnotationRequest(
  data: UpdateAnnotationRequest,
): string | null {
  // 批注内容必填校验
  if (!data.content) {
    return '批注内容不能为空';
  }

  return null;
}
