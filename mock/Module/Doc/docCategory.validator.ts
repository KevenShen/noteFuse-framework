/**
 * 文档分类管理请求参数校验规则
 *
 * 【职责】
 * 校验文档分类管理相关接口请求参数是否符合要求，返回错误信息（null 表示校验通过）
 */

import type {
  BatchDeleteDocCategoriesRequest,
  BatchMoveDocCategoriesRequest,
  CreateDocCategoryRequest,
  GetAllDocCategoriesRequest,
  SaveDocCategorySortRequest,
  UpdateDocCategoryRequest,
} from './docCategory.dto';

// ==================== 文档分类相关校验 ====================

/**
 * 校验创建文档分类请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateCreateDocCategoryRequest(
  data: CreateDocCategoryRequest,
): string | null {
  // 文集 ID 必填校验
  if (!data.project_id) {
    return '文集 ID 不能为空';
  }

  // 分类名称必填校验
  if (!data.name) {
    return '分类名称不能为空';
  }

  // 名称长度校验
  if (data.name.length < 1 || data.name.length > 50) {
    return '分类名称长度应为1-50位';
  }

  return null;
}

/**
 * 校验更新文档分类请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateUpdateDocCategoryRequest(
  data: UpdateDocCategoryRequest,
): string | null {
  // 至少提供一个更新字段
  if (
    data.name === undefined &&
    data.parent_id === undefined &&
    data.sort === undefined &&
    data.icon === undefined
  ) {
    return '至少提供一个更新字段（name/parent_id/sort/icon）';
  }

  // 名称长度校验（如果提供）
  if (data.name !== undefined && (data.name.length < 1 || data.name.length > 50)) {
    return '分类名称长度应为1-50位';
  }

  return null;
}


// ==================== 批量操作校验（参照 ProjectCategory） ====================

/**
 * 校验获取所有文档分类列表请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateGetAllDocCategoriesRequest(
  data: GetAllDocCategoriesRequest,
): string | null {
  if (data.project_id !== undefined && data.project_id < 0) {
    return '文集 ID 不能为负数';
  }
  if (data.parent_id !== undefined && data.parent_id < 0) {
    return '父分类 ID 不能为负数';
  }
  if (data.keyword !== undefined && data.keyword.length > 50) {
    return '搜索关键词长度不能超过50个字符';
  }
  return null;
}

/**
 * 校验批量删除文档分类请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateBatchDeleteDocCategoriesRequest(
  data: BatchDeleteDocCategoriesRequest,
): string | null {
  if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
    return '分类 ID 数组不能为空';
  }
  if (data.ids.length > 100) {
    return '一次最多删除100个分类';
  }
  for (const id of data.ids) {
    if (typeof id !== 'number' || id <= 0) {
      return '分类 ID 必须为正整数';
    }
  }
  return null;
}

/**
 * 校验批量移动文档分类请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateBatchMoveDocCategoriesRequest(
  data: BatchMoveDocCategoriesRequest,
): string | null {
  if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
    return '分类 ID 数组不能为空';
  }
  if (data.target_parent_id === undefined || data.target_parent_id === null) {
    return '目标父分类 ID 不能为空';
  }
  if (data.ids.length > 100) {
    return '一次最多移动100个分类';
  }
  for (const id of data.ids) {
    if (typeof id !== 'number' || id <= 0) {
      return '分类 ID 必须为正整数';
    }
  }
  if (data.target_parent_id < 0) {
    return '目标父分类 ID 不能为负数';
  }
  if (data.ids.includes(data.target_parent_id)) {
    return '不能将分类移动到自身下';
  }
  return null;
}

/**
 * 校验保存文档分类排序请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateSaveDocCategorySortRequest(
  data: SaveDocCategorySortRequest,
): string | null {
  if (!data.sorts || !Array.isArray(data.sorts)) {
    return '排序数据不能为空';
  }
  if (data.sorts.length === 0) {
    return '请至少提供一个分类的排序';
  }
  if (data.sorts.length > 500) {
    return '一次最多保存500个分类的排序';
  }
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
