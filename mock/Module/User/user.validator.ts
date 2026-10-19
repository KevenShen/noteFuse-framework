// mock/User/user.validator.ts
// 普通用户请求参数校验规则
// 功能：校验普通用户接口请求参数是否符合要求

import { BusinessError } from '../../Core/common';
import { CommonErrorCodes } from '../../Core/errorCodes';

import type {
  LoginRequest,
  RegisterRequest,
  SendResetCodeRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
  ChangePasswordRequest,
  SaveEditorSettingsRequest,
} from './user.dto';

// ==================== 认证相关校验 ====================

/**
 * 校验登录请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateLoginRequest(data: LoginRequest): void {
  // 1. 必填校验
  if (!data.username || !data.password) {
    throw new BusinessError('用户名和密码不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 2. 格式校验
  if (data.username.length < 3 || data.username.length > 20) {
    throw new BusinessError('用户名长度应为3-20位', CommonErrorCodes.VALIDATION_FAILED);
  }

  if (data.password.length < 6) {
    throw new BusinessError('密码长度至少6位', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 3. 校验通过

}

// ==================== 注册相关校验 ====================

/**
 * 校验注册请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateRegisterRequest(data: RegisterRequest): void {
  // 1. 必填校验
  if (!data.username || !data.email || !data.password) {
    throw new BusinessError('请填写完整的注册信息', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 2. 密码一致性校验
  if (data.password !== data.confirm_password) {
    throw new BusinessError('两次输入的密码不一致', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 3. 格式校验
  if (data.username.length < 3 || data.username.length > 20) {
    throw new BusinessError('用户名长度应为3-20位', CommonErrorCodes.VALIDATION_FAILED);
  }

  if (data.password.length < 6) {
    throw new BusinessError('密码长度至少6位', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 4. 邮箱格式校验（简单校验）
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    throw new BusinessError('邮箱格式不正确', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 5. 校验通过

}

// ==================== 密码重置相关校验 ====================

/**
 * 校验发送重置密码验证码请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateSendResetCodeRequest(data: SendResetCodeRequest): void {
  // 1. 必填校验
  if (!data.email) {
    throw new BusinessError('邮箱地址不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 2. 邮箱格式校验
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    throw new BusinessError('邮箱格式不正确', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 3. 校验通过

}

/**
 * 校验重置密码请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateResetPasswordRequest(data: ResetPasswordRequest): void {
  // 1. 必填校验
  if (!data.email || !data.code || !data.new_password) {
    throw new BusinessError('请填写完整信息', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 2. 密码一致性校验
  if (data.new_password !== data.confirm_password) {
    throw new BusinessError('两次输入的密码不一致', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 3. 格式校验
  if (data.new_password.length < 6) {
    throw new BusinessError('密码长度至少6位', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 4. 验证码格式校验（6位数字）
  if (!/^\d{6}$/.test(data.code)) {
    throw new BusinessError('验证码格式不正确', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 5. 校验通过

}

// ==================== 个人中心相关校验 ====================

/**
 * 校验更新个人资料请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateUpdateProfileRequest(data: UpdateProfileRequest): void {
  // 1. 至少有一个字段需要更新
  if (data.nickname === undefined && data.avatar === undefined && data.email === undefined) {
    throw new BusinessError('请至少提供一个需要更新的字段', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 2. 昵称长度校验（如果提供）
  if (data.nickname !== undefined) {
    if (data.nickname.length < 1 || data.nickname.length > 20) {
      throw new BusinessError('昵称长度应为1-20位', CommonErrorCodes.VALIDATION_FAILED);
    }
  }

  // 3. 邮箱格式校验（如果提供）
  if (data.email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new BusinessError('邮箱格式不正确', CommonErrorCodes.VALIDATION_FAILED);
    }
  }

  // 4. 校验通过

}

/**
 * 校验修改密码请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateChangePasswordRequest(data: ChangePasswordRequest): void {
  // 1. 必填校验
  if (!data.old_password || !data.new_password) {
    throw new BusinessError('请填写完整信息', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 2. 密码一致性校验
  if (data.new_password !== data.confirm_password) {
    throw new BusinessError('两次输入的新密码不一致', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 3. 格式校验
  if (data.new_password.length < 6) {
    throw new BusinessError('新密码长度至少6位', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 4. 新密码不能与旧密码相同
  if (data.old_password === data.new_password) {
    throw new BusinessError('新密码不能与旧密码相同', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 5. 校验通过

}

// ==================== 编辑器设置相关校验 ====================

/**
 * 校验保存编辑器设置请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateSaveEditorSettingsRequest(data: SaveEditorSettingsRequest): void {
  // 1. 必填校验
  if (!data.editor) {
    throw new BusinessError('编辑器类型不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 2. 编辑器类型校验
  const validEditors = ['vditor', 'mdxeditor', 'monaco'];
  if (!validEditors.includes(data.editor)) {
    throw new BusinessError('不支持的编辑器类型', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 3. 校验通过

}

// ==================== 通用校验工具 ====================

/**
 * 校验邮箱格式
 * @param email 邮箱地址
 * @returns 是否有效
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 校验用户名格式
 * @param username 用户名
 * @returns 是否有效
 */
export function isValidUsername(username: string): boolean {
  // 用户名：3-20位，字母、数字、下划线
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

/**
 * 校验密码强度
 * @param password 密码
 * @returns 密码强度等级（0-3）
 */
export function getPasswordStrength(password: string): number {
  let strength = 0;

  // 长度 >= 6
  if (password.length >= 6) strength++;
  // 包含数字
  if (/\d/.test(password)) strength++;
  // 包含字母
  if (/[a-zA-Z]/.test(password)) strength++;
  // 包含特殊字符
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  return Math.min(strength, 3);
}
