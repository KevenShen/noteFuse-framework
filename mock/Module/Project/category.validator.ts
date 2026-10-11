// mock/Project/category.validator.ts
// 分类请求参数校验规则
// 功能：校验分类相关接口请求参数是否符合要求

import type {
  BatchDeleteCategoriesRequest,
  BatchMoveCategoriesRequest,
  CreateCategoryRequest,
  GetCategoryListRequest,
  SaveCategorySortRequest,
  UpdateCategoryRequest,
} from './category.dto';

// ==================== 分类相关校验 ====================

/**
 * 校验获取分类列表请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateGetCategoryListRequest(
  data: GetCategoryListRequest,
): string | null {
  // 父分类 ID 校验（如果提供）
  if (data.parent_id !== undefined && data.parent_id < 0) {
    return '父分类 ID 不能为负数';
  }

  // 搜索关键词长度校验（如果提供）
  if (data.keyword !== undefined && data.keyword.length > 50) {
    return '搜索关键词长度不能超过50个字符';
  }

  return null;
}

/**
 * 校验创建分类请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateCreateCategoryRequest(
  data: CreateCategoryRequest,
): string | null {
  // 1. 必填校验
  if (!data.name) {
    return '分类名称不能为空';
  }

  // 2. 名称长度校验
  if (data.name.length < 1 || data.name.length > 50) {
    return '分类名称长度应为1-50位';
  }

  // 3. 父分类 ID 校验（如果提供）
  if (data.parent_id !== undefined && data.parent_id < 0) {
    return '父分类 ID 不能为负数';
  }

  // 4. 排序值校验（如果提供）
  if (data.sort !== undefined && data.sort < 0) {
    return '排序值不能为负数';
  }

  // 5. 图标长度校验（如果提供）
  if (data.icon !== undefined && data.icon.length > 100) {
    return '图标长度不能超过100个字符';
  }

  // 6. 描述长度校验（如果提供）
  if (data.description !== undefined && data.description.length > 200) {
    return '分类描述长度不能超过200个字符';
  }

  return null;
}

/**
 * 校验更新分类请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateUpdateCategoryRequest(
  data: UpdateCategoryRequest,
): string | null {
  // 1. 至少有一个字段需要更新
  if (
    data.name === undefined &&
    data.parent_id === undefined &&
    data.sort === undefined &&
    data.icon === undefined &&
    data.description === undefined
  ) {
    return '请至少提供一个需要更新的字段';
  }

  // 2. 名称长度校验（如果提供）
  if (
    data.name !== undefined &&
    (data.name.length < 1 || data.name.length > 50)
  ) {
    return '分类名称长度应为1-50位';
  }

  // 3. 父分类 ID 校验（如果提供）
  if (data.parent_id !== undefined && data.parent_id < 0) {
    return '父分类 ID 不能为负数';
  }

  // 4. 排序值校验（如果提供）
  if (data.sort !== undefined && data.sort < 0) {
    return '排序值不能为负数';
  }

  // 5. 图标长度校验（如果提供）
  if (data.icon !== undefined && data.icon.length > 100) {
    return '图标长度不能超过100个字符';
  }

  // 6. 描述长度校验（如果提供）
  if (data.description !== undefined && data.description.length > 200) {
    return '分类描述长度不能超过200个字符';
  }

  return null;
}

/**
 * 校验批量删除分类请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateBatchDeleteCategoriesRequest(
  data: BatchDeleteCategoriesRequest,
): string | null {
  // 1. 必填校验
  if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
    return '分类 ID 数组不能为空';
  }

  // 2. 数组长度校验
  if (data.ids.length === 0) {
    return '请至少选择一个分类';
  }

  if (data.ids.length > 100) {
    return '一次最多删除100个分类';
  }

  // 3. ID 有效性校验
  for (const id of data.ids) {
    if (typeof id !== 'number' || id <= 0) {
      return '分类 ID 必须为正整数';
    }
  }

  return null;
}

/**
 * 校验批量移动分类请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateBatchMoveCategoriesRequest(
  data: BatchMoveCategoriesRequest,
): string | null {
  // 1. 必填校验
  if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
    return '分类 ID 数组不能为空';
  }

  if (data.target_parent_id === undefined || data.target_parent_id === null) {
    return '目标父分类 ID 不能为空';
  }

  // 2. 数组长度校验
  if (data.ids.length === 0) {
    return '请至少选择一个分类';
  }

  if (data.ids.length > 100) {
    return '一次最多移动100个分类';
  }

  // 3. ID 有效性校验
  for (const id of data.ids) {
    if (typeof id !== 'number' || id <= 0) {
      return '分类 ID 必须为正整数';
    }
  }

  // 4. 目标父分类 ID 校验
  if (data.target_parent_id < 0) {
    return '目标父分类 ID 不能为负数';
  }

  // 5. 不能移动到自己的子分类下（在 service 层校验，这里只做基础校验）
  if (data.ids.includes(data.target_parent_id)) {
    return '不能将分类移动到自身下';
  }

  return null;
}

/**
 * 校验保存分类排序请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateSaveCategorySortRequest(
  data: SaveCategorySortRequest,
): string | null {
  // 1. 必填校验
  if (!data.sorts || !Array.isArray(data.sorts)) {
    return '排序数据不能为空';
  }

  // 2. 数组长度校验
  if (data.sorts.length === 0) {
    return '请至少提供一个分类的排序';
  }

  if (data.sorts.length > 500) {
    return '一次最多保存500个分类的排序';
  }

  // 3. 每个排序项的有效性校验
  for (const item of data.sorts) {
    if (typeof item.id !== 'number' || item.id <= 0) {
      return '分类 ID 必须为正整数';
    }
    if (typeof item.sort !== 'number' || item.sort < 0) {
      return '排序值必须为非负整数';
    }
    if (item.parent_id !== undefined && item.parent_id < 0) {
      return '父分类 ID 不能为负数';
    }
  }

  return null;
}
