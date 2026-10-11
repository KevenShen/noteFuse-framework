// mock/Project/project.validator.ts
// 文集请求参数校验规则
// 功能：校验文集相关接口请求参数是否符合要求

import type {
  CreateProjectRequest,
  GetProjectListRequest,
  UpdateProjectRequest,
} from './project.dto';

// ==================== 文集列表相关校验 ====================

/**
 * 校验获取文集列表请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateGetProjectListRequest(
  data: GetProjectListRequest,
): string | null {
  // 页码校验
  if (data.page !== undefined && (data.page < 1 || data.page > 1000)) {
    return '页码范围应为1-1000';
  }

  // 每页条数校验
  if (
    data.page_size !== undefined &&
    (data.page_size < 1 || data.page_size > 100)
  ) {
    return '每页条数范围应为1-100';
  }

  // 筛选类型校验
  if (
    data.filter !== undefined &&
    !['all', 'mine', 'collab', 'private'].includes(data.filter)
  ) {
    return '筛选类型只能是 all/mine/collab/private';
  }

  // 排序方式校验
  if (
    data.sort !== undefined &&
    !['update', 'create', 'count', 'name'].includes(data.sort)
  ) {
    return '排序方式只能是 update/create/count/name';
  }

  return null;
}

// ==================== 创建文集相关校验 ====================

/**
 * 校验创建文集请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateCreateProjectRequest(
  data: CreateProjectRequest,
): string | null {
  // 必填校验
  if (!data.name) {
    return '文集名称不能为空';
  }

  // 名称长度校验
  if (data.name.length < 1 || data.name.length > 50) {
    return '文集名称长度应为1-50位';
  }

  // 简介长度校验（如果提供）
  if (data.intro !== undefined && data.intro.length > 500) {
    return '文集简介长度不能超过500位';
  }

  // 角色校验（如果提供）
  if (data.role !== undefined && ![0, 1].includes(data.role)) {
    return '角色只能是 0（公开）或 1（私有）';
  }

  return null;
}

// ==================== 更新文集相关校验 ====================

/**
 * 校验更新文集请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateUpdateProjectRequest(
  data: UpdateProjectRequest,
): string | null {
  // 至少有一个字段需要更新
  if (
    data.name === undefined &&
    data.intro === undefined &&
    data.icon === undefined &&
    data.color === undefined &&
    data.role === undefined &&
    data.project_category_id === undefined &&
    data.is_top === undefined
  ) {
    return '请至少提供一个需要更新的字段';
  }

  // 名称长度校验（如果提供）
  if (
    data.name !== undefined &&
    (data.name.length < 1 || data.name.length > 50)
  ) {
    return '文集名称长度应为1-50位';
  }

  // 简介长度校验（如果提供）
  if (data.intro !== undefined && data.intro.length > 500) {
    return '文集简介长度不能超过500位';
  }

  // 角色校验（如果提供）
  if (data.role !== undefined && ![0, 1].includes(data.role)) {
    return '角色只能是 0（公开）或 1（私有）';
  }

  return null;
}
