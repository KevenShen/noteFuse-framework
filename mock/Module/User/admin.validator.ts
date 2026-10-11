// mock/User/admin.validator.ts
// 管理员用户请求参数校验规则
// 功能：校验管理员用户管理接口请求参数是否符合要求

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
 * @returns 错误信息（null 表示校验通过）
 */
export function validateAdminGetUserListRequest(data: AdminGetUserListRequest): string | null {
  // 页码校验
  if (data.page !== undefined && (data.page < 1 || data.page > 1000)) {
    return '页码范围应为1-1000';
  }

  // 每页条数校验
  if (data.pageSize !== undefined && (data.pageSize < 1 || data.pageSize > 100)) {
    return '每页条数范围应为1-100';
  }

  // 状态校验
  if (data.status !== undefined && data.status !== '' && !['active', 'disabled'].includes(data.status)) {
    return '用户状态只能是 active 或 disabled';
  }

  return null;
}

/**
 * 校验管理员创建用户请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateAdminCreateUserRequest(data: AdminCreateUserRequest): string | null {
  // 1. 必填校验
  if (!data.username || !data.email || !data.password) {
    return '请填写必填项（用户名、邮箱、密码）';
  }

  // 2. 用户名格式校验
  if (data.username.length < 3 || data.username.length > 20) {
    return '用户名长度应为3-20位';
  }

  // 3. 邮箱格式校验
  if (!isValidEmail(data.email)) {
    return '邮箱格式不正确';
  }

  // 4. 密码长度校验
  if (data.password.length < 6) {
    return '密码长度至少6位';
  }

  // 5. 昵称长度校验（如果提供）
  if (data.nickname !== undefined && (data.nickname.length < 1 || data.nickname.length > 20)) {
    return '昵称长度应为1-20位';
  }

  return null;
}

/**
 * 校验管理员更新用户请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateAdminUpdateUserRequest(data: AdminUpdateUserRequest): string | null {
  // 1. 至少有一个字段需要更新
  if (
    data.nickname === undefined &&
    data.email === undefined &&
    data.is_staff === undefined &&
    data.status === undefined &&
    data.avatar === undefined
  ) {
    return '请至少提供一个需要更新的字段';
  }

  // 2. 昵称长度校验（如果提供）
  if (data.nickname !== undefined && (data.nickname.length < 1 || data.nickname.length > 20)) {
    return '昵称长度应为1-20位';
  }

  // 3. 邮箱格式校验（如果提供）
  if (data.email !== undefined && !isValidEmail(data.email)) {
    return '邮箱格式不正确';
  }

  // 4. 状态校验（如果提供）
  if (data.status !== undefined && !['active', 'disabled'].includes(data.status)) {
    return '用户状态只能是 active 或 disabled';
  }

  return null;
}
