// mock/User/admin.validator.ts
// 管理员用户请求参数校验规则
// 功能：校验管理员用户管理接口请求参数是否符合要求

import { BusinessError } from '../../Core/common';
import { CommonErrorCodes } from '../../Core/errorCodes';

import type {
  AdminGetUserListRequest,
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
} from './admin.dto';
import { isValidEmail } from './user.validator';

// ==================== 管理员用户管理相关校验 ====================

/**
 * 校验获取用户列表请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateAdminGetUserListRequest(data: AdminGetUserListRequest): void {
  // 页码校验
  if (data.page !== undefined && (data.page < 1 || data.page > 1000)) {
    throw new BusinessError('页码范围应为1-1000', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 每页条数校验
  if (data.pageSize !== undefined && (data.pageSize < 1 || data.pageSize > 100)) {
    throw new BusinessError('每页条数范围应为1-100', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 状态校验
  if (data.status !== undefined && data.status !== '' && !['active', 'disabled'].includes(data.status)) {
    throw new BusinessError('用户状态只能是 active 或 disabled', CommonErrorCodes.VALIDATION_FAILED);
  }

}

/**
 * 校验管理员创建用户请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateAdminCreateUserRequest(data: AdminCreateUserRequest): void {
  // 1. 必填校验
  if (!data.username || !data.email || !data.password) {
    throw new BusinessError('请填写必填项（用户名、邮箱、密码）', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 2. 用户名格式校验
  if (data.username.length < 3 || data.username.length > 20) {
    throw new BusinessError('用户名长度应为3-20位', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 3. 邮箱格式校验
  if (!isValidEmail(data.email)) {
    throw new BusinessError('邮箱格式不正确', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 4. 密码长度校验
  if (data.password.length < 6) {
    throw new BusinessError('密码长度至少6位', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 5. 昵称长度校验（如果提供）
  if (data.nickname !== undefined && (data.nickname.length < 1 || data.nickname.length > 20)) {
    throw new BusinessError('昵称长度应为1-20位', CommonErrorCodes.VALIDATION_FAILED);
  }

}

/**
 * 校验管理员更新用户请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateAdminUpdateUserRequest(data: AdminUpdateUserRequest): void {
  // 1. 至少有一个字段需要更新
  if (
    data.nickname === undefined &&
    data.email === undefined &&
    data.is_staff === undefined &&
    data.status === undefined &&
    data.avatar === undefined
  ) {
    throw new BusinessError('请至少提供一个需要更新的字段', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 2. 昵称长度校验（如果提供）
  if (data.nickname !== undefined && (data.nickname.length < 1 || data.nickname.length > 20)) {
    throw new BusinessError('昵称长度应为1-20位', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 3. 邮箱格式校验（如果提供）
  if (data.email !== undefined && !isValidEmail(data.email)) {
    throw new BusinessError('邮箱格式不正确', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 4. 状态校验（如果提供）
  if (data.status !== undefined && !['active', 'disabled'].includes(data.status)) {
    throw new BusinessError('用户状态只能是 active 或 disabled', CommonErrorCodes.VALIDATION_FAILED);
  }

}
