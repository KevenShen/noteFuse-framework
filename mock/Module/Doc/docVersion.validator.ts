/**
 * 文档版本管理请求参数校验规则
 *
 * 【职责】
 * 校验文档版本管理相关接口请求参数是否符合要求，返回错误信息（null 表示校验通过）
 */

import type {
  CreateDocVersionRequest,
  SaveVersionContentRequest,
  UpdateDocVersionRequest,
} from './docVersion.dto';

// ==================== 文档版本相关校验 ====================

/**
 * 校验创建文档版本请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateCreateDocVersionRequest(
  data: CreateDocVersionRequest,
): string | null {
  // 版本状态校验（如果提供）
  if (
    data.status !== undefined &&
    !['draft', 'published', 'archived', 'deprecated'].includes(data.status)
  ) {
    return '版本状态只能是 draft/published/archived/deprecated';
  }

  return null;
}

/**
 * 校验更新文档版本请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateUpdateDocVersionRequest(
  data: UpdateDocVersionRequest,
): string | null {
  // 至少提供一个更新字段
  if (
    data.content === undefined &&
    data.outline === undefined &&
    data.remark === undefined
  ) {
    return '至少提供一个更新字段（content/outline/remark）';
  }

  return null;
}

/**
 * 校验保存版本原文请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateSaveVersionContentRequest(
  data: SaveVersionContentRequest,
): string | null {
  // 原文内容必填校验
  if (data.content === undefined || data.content === null) {
    return '原文内容不能为空';
  }

  return null;
}
