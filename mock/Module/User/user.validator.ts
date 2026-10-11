// mock/User/user.validator.ts
// 普通用户请求参数校验规则
// 功能：校验普通用户接口请求参数是否符合要求

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
 * @returns 错误信息（null 表示校验通过）
 */
export function validateLoginRequest(data: LoginRequest): string | null {
  // 1. 必填校验
  if (!data.username || !data.password) {
    return '用户名和密码不能为空';
  }

  // 2. 格式校验
  if (data.username.length < 3 || data.username.length > 20) {
    return '用户名长度应为3-20位';
  }

  if (data.password.length < 6) {
    return '密码长度至少6位';
  }

  // 3. 校验通过
  return null;
}

// ==================== 注册相关校验 ====================

/**
 * 校验注册请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateRegisterRequest(data: RegisterRequest): string | null {
  // 1. 必填校验
  if (!data.username || !data.email || !data.password) {
    return '请填写完整的注册信息';
  }

  // 2. 密码一致性校验
  if (data.password !== data.confirm_password) {
    return '两次输入的密码不一致';
  }

  // 3. 格式校验
  if (data.username.length < 3 || data.username.length > 20) {
    return '用户名长度应为3-20位';
  }

  if (data.password.length < 6) {
    return '密码长度至少6位';
  }

  // 4. 邮箱格式校验（简单校验）
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    return '邮箱格式不正确';
  }

  // 5. 校验通过
  return null;
}

// ==================== 密码重置相关校验 ====================

/**
 * 校验发送重置密码验证码请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateSendResetCodeRequest(data: SendResetCodeRequest): string | null {
  // 1. 必填校验
  if (!data.email) {
    return '邮箱地址不能为空';
  }

  // 2. 邮箱格式校验
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    return '邮箱格式不正确';
  }

  // 3. 校验通过
  return null;
}

/**
 * 校验重置密码请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateResetPasswordRequest(data: ResetPasswordRequest): string | null {
  // 1. 必填校验
  if (!data.email || !data.code || !data.new_password) {
    return '请填写完整信息';
  }

  // 2. 密码一致性校验
  if (data.new_password !== data.confirm_password) {
    return '两次输入的密码不一致';
  }

  // 3. 格式校验
  if (data.new_password.length < 6) {
    return '密码长度至少6位';
  }

  // 4. 验证码格式校验（6位数字）
  if (!/^\d{6}$/.test(data.code)) {
    return '验证码格式不正确';
  }

  // 5. 校验通过
  return null;
}

// ==================== 个人中心相关校验 ====================

/**
 * 校验更新个人资料请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateUpdateProfileRequest(data: UpdateProfileRequest): string | null {
  // 1. 至少有一个字段需要更新
  if (data.nickname === undefined && data.avatar === undefined && data.email === undefined) {
    return '请至少提供一个需要更新的字段';
  }

  // 2. 昵称长度校验（如果提供）
  if (data.nickname !== undefined) {
    if (data.nickname.length < 1 || data.nickname.length > 20) {
      return '昵称长度应为1-20位';
    }
  }

  // 3. 邮箱格式校验（如果提供）
  if (data.email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return '邮箱格式不正确';
    }
  }

  // 4. 校验通过
  return null;
}

/**
 * 校验修改密码请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateChangePasswordRequest(data: ChangePasswordRequest): string | null {
  // 1. 必填校验
  if (!data.old_password || !data.new_password) {
    return '请填写完整信息';
  }

  // 2. 密码一致性校验
  if (data.new_password !== data.confirm_password) {
    return '两次输入的新密码不一致';
  }

  // 3. 格式校验
  if (data.new_password.length < 6) {
    return '新密码长度至少6位';
  }

  // 4. 新密码不能与旧密码相同
  if (data.old_password === data.new_password) {
    return '新密码不能与旧密码相同';
  }

  // 5. 校验通过
  return null;
}

// ==================== 编辑器设置相关校验 ====================

/**
 * 校验保存编辑器设置请求
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validateSaveEditorSettingsRequest(data: SaveEditorSettingsRequest): string | null {
  // 1. 必填校验
  if (!data.editor) {
    return '编辑器类型不能为空';
  }

  // 2. 编辑器类型校验
  const validEditors = ['vditor', 'mdxeditor', 'monaco'];
  if (!validEditors.includes(data.editor)) {
    return '不支持的编辑器类型';
  }

  // 3. 校验通过
  return null;
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
