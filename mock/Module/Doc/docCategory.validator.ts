// mock/Doc/docCategory.validator.ts
// 文档分类请求参数校验规则
// 功能：校验文档分类相关接口请求参数是否符合要求

import { BusinessError } from '../../Core/common';
import { CommonErrorCodes } from '../../Core/errorCodes';

import type {
  BatchDeleteDocCategoriesRequest,
  BatchMoveDocCategoriesRequest,
  CreateDocCategoryRequest,
  DeleteDocCategoryRequest,
  GetAllDocCategoriesRequest,
  GetDocCategoriesRequest,
  SaveDocCategorySortRequest,
  UpdateDocCategoryRequest,
} from './docCategory.dto';

// ==================== 获取文档分类列表 ====================

/**
 * 校验获取文集下的文档分类列表请求
 * @param data 请求参数（query + params 合并后的数据）
 * @throws BusinessError 校验失败时抛出
 */
export function validateGetDocCategoriesRequest(
  data: GetDocCategoriesRequest,
): void {
  // 文集 ID 必填校验
  if (!data.project_id) {
    throw new BusinessError(
      '文集 ID 不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 文集 ID 有效性校验
  if (
    typeof data.project_id !== 'number' ||
    data.project_id <= 0 ||
    !Number.isInteger(data.project_id)
  ) {
    throw new BusinessError(
      '文集 ID 必须为正整数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 父分类 ID 校验（如果提供）
  if (data.parent_id !== undefined && data.parent_id < 0) {
    throw new BusinessError(
      '父分类 ID 不能为负数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 搜索关键词长度校验（如果提供）
  if (data.keyword !== undefined && data.keyword.length > 50) {
    throw new BusinessError(
      '搜索关键词长度不能超过50个字符',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }
}

/**
 * 校验获取所有文档分类列表请求（跨文集）
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateGetAllDocCategoriesRequest(
  data: GetAllDocCategoriesRequest,
): void {
  // 文集 ID 校验（如果提供）
  if (data.project_id !== undefined && data.project_id < 0) {
    throw new BusinessError(
      '文集 ID 不能为负数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 父分类 ID 校验（如果提供）
  if (data.parent_id !== undefined && data.parent_id < 0) {
    throw new BusinessError(
      '父分类 ID 不能为负数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 搜索关键词长度校验（如果提供）
  if (data.keyword !== undefined && data.keyword.length > 50) {
    throw new BusinessError(
      '搜索关键词长度不能超过50个字符',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }
}

// ==================== 创建文档分类 ====================

/**
 * 校验创建文档分类请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateCreateDocCategoryRequest(
  data: CreateDocCategoryRequest,
): void {
  // 文集 ID 必填校验
  if (!data.project_id) {
    throw new BusinessError(
      '文集 ID 不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 分类名称必填校验
  if (!data.name) {
    throw new BusinessError(
      '分类名称不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 名称长度校验
  if (data.name.length < 1 || data.name.length > 50) {
    throw new BusinessError(
      '分类名称长度应为1-50位',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 父分类 ID 校验（如果提供）
  if (data.parent_id !== undefined && data.parent_id < 0) {
    throw new BusinessError(
      '父分类 ID 不能为负数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 排序值校验（如果提供）
  if (data.sort !== undefined && data.sort < 0) {
    throw new BusinessError(
      '排序值不能为负数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 图标长度校验（如果提供）
  if (data.icon !== undefined && data.icon.length > 100) {
    throw new BusinessError(
      '图标长度不能超过100个字符',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }
}

// ==================== 更新文档分类 ====================

/**
 * 校验更新文档分类请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateUpdateDocCategoryRequest(
  data: UpdateDocCategoryRequest,
): void {
  // 至少提供一个更新字段
  if (
    data.name === undefined &&
    data.parent_id === undefined &&
    data.sort === undefined &&
    data.icon === undefined
  ) {
    throw new BusinessError(
      '至少提供一个更新字段（name/parent_id/sort/icon）',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 名称长度校验（如果提供）
  if (
    data.name !== undefined &&
    (data.name.length < 1 || data.name.length > 50)
  ) {
    throw new BusinessError(
      '分类名称长度应为1-50位',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 父分类 ID 校验（如果提供）
  if (data.parent_id !== undefined && data.parent_id < 0) {
    throw new BusinessError(
      '父分类 ID 不能为负数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 排序值校验（如果提供）
  if (data.sort !== undefined && data.sort < 0) {
    throw new BusinessError(
      '排序值不能为负数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 图标长度校验（如果提供）
  if (data.icon !== undefined && data.icon.length > 100) {
    throw new BusinessError(
      '图标长度不能超过100个字符',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }
}

// ==================== 删除文档分类 ====================

/**
 * 校验删除文档分类请求（ID 在 URL params 中，validateMiddleware 会自动合并并转换为数字）
 * @param data 请求参数（body + params 合并后的数据，params 中的数字已自动转换）
 * @throws BusinessError 校验失败时抛出
 */
export function validateDeleteDocCategoryRequest(
  data: DeleteDocCategoryRequest,
): void {
  // 必填校验
  if (data.id === undefined || data.id === null) {
    throw new BusinessError(
      '分类 ID 不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // ID 有效性校验（中间件已将 params 中的数字字符串转换为 number）
  if (
    typeof data.id !== 'number' ||
    data.id <= 0 ||
    !Number.isInteger(data.id)
  ) {
    throw new BusinessError(
      '分类 ID 必须为正整数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }
}

// ==================== 批量删除文档分类 ====================

/**
 * 校验批量删除文档分类请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateBatchDeleteDocCategoriesRequest(
  data: BatchDeleteDocCategoriesRequest,
): void {
  // 必填校验
  if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
    throw new BusinessError(
      '分类 ID 数组不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 数组长度校验
  if (data.ids.length > 100) {
    throw new BusinessError(
      '一次最多删除100个分类',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // ID 有效性校验
  for (const id of data.ids) {
    if (typeof id !== 'number' || id <= 0) {
      throw new BusinessError(
        '分类 ID 必须为正整数',
        CommonErrorCodes.VALIDATION_FAILED,
      );
    }
  }
}

// ==================== 批量移动文档分类 ====================

/**
 * 校验批量移动文档分类请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateBatchMoveDocCategoriesRequest(
  data: BatchMoveDocCategoriesRequest,
): void {
  // 必填校验
  if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
    throw new BusinessError(
      '分类 ID 数组不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  if (data.target_parent_id === undefined || data.target_parent_id === null) {
    throw new BusinessError(
      '目标父分类 ID 不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 数组长度校验
  if (data.ids.length > 100) {
    throw new BusinessError(
      '一次最多移动100个分类',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // ID 有效性校验
  for (const id of data.ids) {
    if (typeof id !== 'number' || id <= 0) {
      throw new BusinessError(
        '分类 ID 必须为正整数',
        CommonErrorCodes.VALIDATION_FAILED,
      );
    }
  }

  // 目标父分类 ID 校验
  if (data.target_parent_id < 0) {
    throw new BusinessError(
      '目标父分类 ID 不能为负数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 不能移动到自身下
  if (data.ids.includes(data.target_parent_id)) {
    throw new BusinessError(
      '不能将分类移动到自身下',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }
}

// ==================== 保存文档分类排序 ====================

/**
 * 校验保存文档分类排序请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateSaveDocCategorySortRequest(
  data: SaveDocCategorySortRequest,
): void {
  // 必填校验
  if (!data.sorts || !Array.isArray(data.sorts)) {
    throw new BusinessError(
      '排序数据不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 数组长度校验
  if (data.sorts.length === 0) {
    throw new BusinessError(
      '请至少提供一个分类的排序',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  if (data.sorts.length > 500) {
    throw new BusinessError(
      '一次最多保存500个分类的排序',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 每个排序项的有效性校验
  for (const item of data.sorts) {
    if (typeof item.id !== 'number' || item.id <= 0) {
      throw new BusinessError(
        '分类 ID 必须为正整数',
        CommonErrorCodes.VALIDATION_FAILED,
      );
    }
    if (typeof item.sort !== 'number' || item.sort < 0) {
      throw new BusinessError(
        '排序值必须为非负整数',
        CommonErrorCodes.VALIDATION_FAILED,
      );
    }
  }
}
