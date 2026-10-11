/**
 * 标签模块请求参数校验规则
 *
 * 【文件职责】
 * 校验标签模块所有接口的请求参数是否符合要求，返回错误信息（null 表示校验通过）
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：使用 withMiddleware 包装，引入校验函数
 * 2. 控制器层（controller.ts）：处理请求响应
 * 3. 服务层（service.ts）：业务逻辑
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/tag.ts）：类型定义、初始数据、表实例
 * 6. 通用层（Core/）：通用工具、中间件、异常处理
 */

import type {
  AddDocTagRequest,
  CreateTagCategoryRequest,
  CreateTagRequest,
  GetTagCategoriesRequest,
  GetTagDocsRequest,
  GetTagListRequest,
  SortTagCategoryRequest,
  UpdateTagCategoryRequest,
  UpdateTagRequest,
} from './dto';

// ============================================================================
// 1. 标签列表相关校验
// ============================================================================

/**
 * 校验获取标签列表请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateGetTagListRequest(data: GetTagListRequest): string | null {
  // 标签类型校验
  if (data.type !== undefined && !['doc', 'project'].includes(data.type)) {
    return '标签类型只能是 doc 或 project';
  }

  return null;
}

/**
 * 校验获取标签分类列表请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateGetTagCategoriesRequest(
  data: GetTagCategoriesRequest,
): string | null {
  // 标签类型校验
  if (data.type !== undefined && !['doc', 'project'].includes(data.type)) {
    return '标签类型只能是 doc 或 project';
  }

  return null;
}

// ============================================================================
// 2. 标签分类相关校验
// ============================================================================

/**
 * 校验创建标签分类请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateCreateTagCategoryRequest(
  data: CreateTagCategoryRequest,
): string | null {
  // 必填校验
  if (!data.name || !data.name.trim()) {
    return '分类名称不能为空';
  }

  // 名称长度校验
  if (data.name.trim().length < 1 || data.name.trim().length > 50) {
    return '分类名称长度应为1-50位';
  }

  // 标签类型校验
  if (data.type !== undefined && !['doc', 'project'].includes(data.type)) {
    return '标签类型只能是 doc 或 project';
  }

  // 父分类 ID 校验
  if (data.parent_id !== undefined && data.parent_id < 0) {
    return '父分类 ID 不能为负数';
  }

  return null;
}

/**
 * 校验更新标签分类请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateUpdateTagCategoryRequest(
  data: UpdateTagCategoryRequest,
): string | null {
  // 名称长度校验（如果提供）
  if (data.name !== undefined && data.name.trim()) {
    if (data.name.trim().length < 1 || data.name.trim().length > 50) {
      return '分类名称长度应为1-50位';
    }
  }

  return null;
}

/**
 * 校验分类排序请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateSortTagCategoryRequest(
  data: SortTagCategoryRequest,
): string | null {
  // 必填校验
  if (!data.direction) {
    return '移动方向不能为空';
  }

  // 移动方向校验
  if (!['up', 'down'].includes(data.direction)) {
    return '移动方向只能是 up 或 down';
  }

  return null;
}

// ============================================================================
// 3. 标签相关校验
// ============================================================================

/**
 * 校验创建标签请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateCreateTagRequest(data: CreateTagRequest): string | null {
  // 必填校验
  if (!data.name || !data.name.trim()) {
    return '标签名称不能为空';
  }

  // 名称长度校验
  if (data.name.trim().length < 1 || data.name.trim().length > 50) {
    return '标签名称长度应为1-50位';
  }

  // 必填校验
  if (!data.category_id) {
    return '请选择标签分类';
  }

  // 标签类型校验
  if (data.type !== undefined && !['doc', 'project'].includes(data.type)) {
    return '标签类型只能是 doc 或 project';
  }

  return null;
}

/**
 * 校验更新标签请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateUpdateTagRequest(data: UpdateTagRequest): string | null {
  // 名称长度校验（如果提供）
  if (data.name !== undefined && data.name.trim()) {
    if (data.name.trim().length < 1 || data.name.trim().length > 50) {
      return '标签名称长度应为1-50位';
    }
  }

  return null;
}

/**
 * 校验按标签获取目标列表请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateGetTagDocsRequest(data: GetTagDocsRequest): string | null {
  // 页码校验
  if (data.page !== undefined && (data.page < 1 || data.page > 1000)) {
    return '页码范围应为1-1000';
  }

  // 每页条数校验
  if (data.page_size !== undefined && (data.page_size < 1 || data.page_size > 100)) {
    return '每页条数范围应为1-100';
  }

  // 标签类型校验
  if (data.type !== undefined && !['doc', 'project'].includes(data.type)) {
    return '标签类型只能是 doc 或 project';
  }

  return null;
}

// ============================================================================
// 4. 标签关联相关校验
// ============================================================================

/**
 * 校验添加文档标签请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateAddDocTagRequest(data: AddDocTagRequest): string | null {
  // 必填校验
  if (!data.tag_id) {
    return '标签 ID 不能为空';
  }

  // 标签 ID 校验
  if (data.tag_id < 1) {
    return '标签 ID 必须大于 0';
  }

  return null;
}
