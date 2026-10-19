// mock/Project/project.validator.ts
// 文集请求参数校验规则
// 功能：校验文集相关接口请求参数是否符合要求

import { BusinessError } from '../../Core/common';
import { CommonErrorCodes } from '../../Core/errorCodes';

import type {
  CreateProjectRequest,
  DeleteProjectRequest,
  GetProjectListRequest,
  UpdateProjectRequest,
} from './project.dto';

// ==================== 文集列表相关校验 ====================

/**
 * 校验获取文集列表请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateGetProjectListRequest(
  data: GetProjectListRequest,
): void {
  // 页码校验
  if (data.page !== undefined && (data.page < 1 || data.page > 1000)) {
    throw new BusinessError(
      '页码范围应为1-1000',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 每页条数校验
  if (
    data.page_size !== undefined &&
    (data.page_size < 1 || data.page_size > 100)
  ) {
    throw new BusinessError(
      '每页条数范围应为1-100',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 筛选类型校验
  if (
    data.filter !== undefined &&
    !['all', 'mine', 'collab', 'private'].includes(data.filter)
  ) {
    throw new BusinessError(
      '筛选类型只能是 all/mine/collab/private',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 排序方式校验
  if (
    data.sort !== undefined &&
    !['update', 'create', 'count', 'name'].includes(data.sort)
  ) {
    throw new BusinessError(
      '排序方式只能是 update/create/count/name',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }
}

// ==================== 创建文集相关校验 ====================

/**
 * 校验创建文集请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateCreateProjectRequest(data: CreateProjectRequest): void {
  // 名称必填校验
  if (!data.name) {
    throw new BusinessError(
      '文集名称不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 名称长度校验
  if (data.name.length < 1 || data.name.length > 50) {
    throw new BusinessError(
      '文集名称长度应为1-50位',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 简介长度校验（如果提供）
  if (data.intro !== undefined && data.intro.length > 500) {
    throw new BusinessError(
      '文集简介长度不能超过500位',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 图标非空校验（如果提供）
  if (data.icon !== undefined && data.icon.trim() === '') {
    throw new BusinessError(
      '图标名称不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 主题色格式校验（如果提供）
  if (data.color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
    throw new BusinessError(
      '主题色格式应为 #RRGGBB',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 角色校验（如果提供）
  if (data.role !== undefined && ![0, 1].includes(data.role)) {
    throw new BusinessError(
      '角色只能是 0（公开）或 1（私有）',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 分类 ID 校验（如果提供）
  if (
    data.project_category_id !== undefined &&
    (data.project_category_id < 0 || !Number.isInteger(data.project_category_id))
  ) {
    throw new BusinessError(
      '分类 ID 必须为非负整数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 是否置顶校验（如果提供）
  if (data.is_top !== undefined && typeof data.is_top !== 'boolean') {
    throw new BusinessError(
      '是否置顶必须为布尔值',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 是否协作文集校验（如果提供）
  if (
    data.is_collaborator !== undefined &&
    typeof data.is_collaborator !== 'boolean'
  ) {
    throw new BusinessError(
      '是否协作文集必须为布尔值',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 排序值校验（如果提供）
  if (
    data.sort !== undefined &&
    (data.sort < 0 || !Number.isInteger(data.sort))
  ) {
    throw new BusinessError(
      '排序值必须为非负整数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }
}

// ==================== 更新文集相关校验 ====================

/**
 * 校验更新文集请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateUpdateProjectRequest(data: UpdateProjectRequest): void {
  // 至少有一个字段需要更新
  if (
    data.name === undefined &&
    data.intro === undefined &&
    data.icon === undefined &&
    data.color === undefined &&
    data.role === undefined &&
    data.project_category_id === undefined &&
    data.is_top === undefined &&
    data.is_collaborator === undefined &&
    data.sort === undefined
  ) {
    throw new BusinessError(
      '请至少提供一个需要更新的字段',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 名称长度校验（如果提供）
  if (
    data.name !== undefined &&
    (data.name.length < 1 || data.name.length > 50)
  ) {
    throw new BusinessError(
      '文集名称长度应为1-50位',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 简介长度校验（如果提供）
  if (data.intro !== undefined && data.intro.length > 500) {
    throw new BusinessError(
      '文集简介长度不能超过500位',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 图标非空校验（如果提供）
  if (data.icon !== undefined && data.icon.trim() === '') {
    throw new BusinessError(
      '图标名称不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 主题色格式校验（如果提供）
  if (data.color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
    throw new BusinessError(
      '主题色格式应为 #RRGGBB',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 角色校验（如果提供）
  if (data.role !== undefined && ![0, 1].includes(data.role)) {
    throw new BusinessError(
      '角色只能是 0（公开）或 1（私有）',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 分类 ID 校验（如果提供）
  if (
    data.project_category_id !== undefined &&
    (data.project_category_id < 0 || !Number.isInteger(data.project_category_id))
  ) {
    throw new BusinessError(
      '分类 ID 必须为非负整数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 是否置顶校验（如果提供）
  if (data.is_top !== undefined && typeof data.is_top !== 'boolean') {
    throw new BusinessError(
      '是否置顶必须为布尔值',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 是否协作者校验（如果提供）
  if (
    data.is_collaborator !== undefined &&
    typeof data.is_collaborator !== 'boolean'
  ) {
    throw new BusinessError(
      '是否协作者必须为布尔值',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 排序值校验（如果提供）
  if (
    data.sort !== undefined &&
    (data.sort < 0 || !Number.isInteger(data.sort))
  ) {
    throw new BusinessError(
      '排序值必须为非负整数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }
}

// ==================== 删除文集相关校验 ====================

/**
 * 校验删除文集请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateDeleteProjectRequest(data: DeleteProjectRequest): void {
  // 文集 ID 必填校验
  if (data.id === undefined || data.id === null) {
    throw new BusinessError(
      '文集 ID 不能为空',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }

  // 文集 ID 必须为正整数
  if (data.id <= 0 || !Number.isInteger(data.id)) {
    throw new BusinessError(
      '文集 ID 必须为正整数',
      CommonErrorCodes.VALIDATION_FAILED,
    );
  }
}
