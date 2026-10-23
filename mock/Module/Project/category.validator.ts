// mock/Project/category.validator.ts
// 分类请求参数校验规则
// 功能：校验分类相关接口请求参数是否符合要求

import { BusinessError } from '../../Core/common';
import { CommonErrorCodes } from '../../Core/errorCodes';

import type {
  BatchDeleteCategoriesRequest,
  BatchMoveCategoriesRequest,
  CreateCategoryRequest,
  DeleteCategoryRequest,
  GetCategoryListRequest,
  SaveCategorySortRequest,
  UpdateCategoryRequest,
} from './category.dto';

// ==================== 分类相关校验 ====================

/**
 * 校验获取分类列表请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateGetCategoryListRequest(
  data: GetCategoryListRequest,
): void {
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
 * 校验创建分类请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateCreateCategoryRequest(
  data: CreateCategoryRequest,
): void {
  // 1. 必填校验
  if (!data.name) {
    throw new BusinessError(
      '分类名称不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 2. 名称长度校验
  if (data.name.length < 1 || data.name.length > 50) {
    throw new BusinessError(
      '分类名称长度应为1-50位',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 3. 父分类 ID 校验（如果提供）
  if (data.parent_id !== undefined && data.parent_id < 0) {
    throw new BusinessError(
      '父分类 ID 不能为负数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 4. 排序值校验（如果提供）
  if (data.sort !== undefined && data.sort < 0) {
    throw new BusinessError(
      '排序值不能为负数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 5. 图标长度校验（如果提供）
  if (data.icon !== undefined && data.icon.length > 100) {
    throw new BusinessError(
      '图标长度不能超过100个字符',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 6. 描述长度校验（如果提供）
  if (data.description !== undefined && data.description.length > 200) {
    throw new BusinessError(
      '分类描述长度不能超过200个字符',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 7. max_depth 校验（可选，默认 3，最大 3，最小 1）
  if (data.max_depth !== undefined) {
    if (
      typeof data.max_depth !== 'number' ||
      !Number.isInteger(data.max_depth)
    ) {
      throw new BusinessError(
        'max_depth 必须为整数',
        CommonErrorCodes.VALIDATION_FAILED,
      );
    }
    if (data.max_depth < 1 || data.max_depth > 3) {
      throw new BusinessError(
        'max_depth 取值范围为 1-3',
        CommonErrorCodes.VALIDATION_FAILED,
      );
    }
  }
}

/**
 * 校验更新分类请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateUpdateCategoryRequest(
  data: UpdateCategoryRequest,
): void {
  // 1. 至少有一个字段需要更新
  if (
    data.name === undefined &&
    data.parent_id === undefined &&
    data.sort === undefined &&
    data.icon === undefined &&
    data.description === undefined
  ) {
    throw new BusinessError(
      '请至少提供一个需要更新的字段',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 2. 名称长度校验（如果提供）
  if (
    data.name !== undefined &&
    (data.name.length < 1 || data.name.length > 50)
  ) {
    throw new BusinessError(
      '分类名称长度应为1-50位',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 3. 父分类 ID 校验（如果提供）
  if (data.parent_id !== undefined && data.parent_id < 0) {
    throw new BusinessError(
      '父分类 ID 不能为负数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 4. 排序值校验（如果提供）
  if (data.sort !== undefined && data.sort < 0) {
    throw new BusinessError(
      '排序值不能为负数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 5. 图标长度校验（如果提供）
  if (data.icon !== undefined && data.icon.length > 100) {
    throw new BusinessError(
      '图标长度不能超过100个字符',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 6. 描述长度校验（如果提供）
  if (data.description !== undefined && data.description.length > 200) {
    throw new BusinessError(
      '分类描述长度不能超过200个字符',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }
}

/**
 * 校验删除分类请求（ID 在 URL params 中，validateMiddleware 会自动合并并转换为数字）
 * @param data 请求参数（body + params 合并后的数据，params 中的数字已自动转换）
 * @throws BusinessError 校验失败时抛出
 */
export function validateDeleteCategoryRequest(
  data: DeleteCategoryRequest,
): void {
  // 1. 必填校验
  if (data.id === undefined || data.id === null) {
    throw new BusinessError(
      '分类 ID 不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 2. ID 有效性校验（中间件已将 params 中的数字字符串转换为 number）
  if (typeof data.id !== 'number' || data.id <= 0 || !Number.isInteger(data.id)) {
    throw new BusinessError(
      '分类 ID 必须为正整数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }
}

/**
 * 校验批量删除分类请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateBatchDeleteCategoriesRequest(
  data: BatchDeleteCategoriesRequest,
): void {
  // 1. 必填校验
  if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
    throw new BusinessError(
      '分类 ID 数组不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 2. 数组长度校验
  if (data.ids.length === 0) {
    throw new BusinessError(
      '请至少选择一个分类',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  if (data.ids.length > 100) {
    throw new BusinessError(
      '一次最多删除100个分类',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 3. ID 有效性校验
  for (const id of data.ids) {
    if (typeof id !== 'number' || id <= 0) {
      throw new BusinessError(
        '分类 ID 必须为正整数',
        CommonErrorCodes.VALIDATION_FAILED,
      );
    }
  }
}

/**
 * 校验批量移动分类请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateBatchMoveCategoriesRequest(
  data: BatchMoveCategoriesRequest,
): void {
  // 1. 必填校验
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

  // 2. 数组长度校验
  if (data.ids.length === 0) {
    throw new BusinessError(
      '请至少选择一个分类',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  if (data.ids.length > 100) {
    throw new BusinessError(
      '一次最多移动100个分类',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 3. ID 有效性校验
  for (const id of data.ids) {
    if (typeof id !== 'number' || id <= 0) {
      throw new BusinessError(
        '分类 ID 必须为正整数',
        CommonErrorCodes.VALIDATION_FAILED,
      );
    }
  }

  // 4. 目标父分类 ID 校验
  if (data.target_parent_id < 0) {
    throw new BusinessError(
      '目标父分类 ID 不能为负数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 5. max_depth 校验（可选，默认 3，最大 3，最小 1）
  if (data.max_depth !== undefined) {
    if (
      typeof data.max_depth !== 'number' ||
      !Number.isInteger(data.max_depth)
    ) {
      throw new BusinessError(
        'max_depth 必须为整数',
        CommonErrorCodes.VALIDATION_FAILED,
      );
    }
    if (data.max_depth < 1 || data.max_depth > 3) {
      throw new BusinessError(
        'max_depth 取值范围为 1-3',
        CommonErrorCodes.VALIDATION_FAILED,
      );
    }
  }

  // 6. 不能移动到自己的子分类下（在 service 层校验，这里只做基础校验）
  if (data.ids.includes(data.target_parent_id)) {
    throw new BusinessError(
      '不能将分类移动到自身下',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }
}

/**
 * 校验保存分类排序请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateSaveCategorySortRequest(
  data: SaveCategorySortRequest,
): void {
  // 1. 必填校验
  if (!data.sorts || !Array.isArray(data.sorts)) {
    throw new BusinessError(
      '排序数据不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 2. 数组长度校验
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

  // 3. 每个排序项的有效性校验
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
