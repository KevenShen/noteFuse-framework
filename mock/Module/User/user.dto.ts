// mock/User/user.dto.ts
// 普通用户 DTO（Data Transfer Object，数据传输对象）
// 功能：定义普通用户接口请求参数和响应数据的类型结构

import type { MockUser, MockEditorSettings } from '../../Entities/user';

// ==================== 认证相关 DTO ====================

/** 登录请求参数 */
export interface LoginRequest {
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
}

/** 登录响应数据（data 字段内容） */
export interface LoginResponse {
  /** 访问令牌 */
  token: string;
  /** 用户信息（已过滤敏感字段） */
  user: Omit<MockUser, 'password'>;
}

/** 退出登录请求参数（无需参数，保留空接口用于扩展） */
export interface LogoutRequest {}

/** 退出登录响应数据（无数据） */
export type LogoutResponse = null;

// ==================== 注册相关 DTO ====================

/** 注册请求参数 */
export interface RegisterRequest {
  /** 用户名（3-20位） */
  username: string;
  /** 邮箱 */
  email: string;
  /** 密码（至少6位） */
  password: string;
  /** 确认密码 */
  confirm_password: string;
}

/** 注册响应数据（data 字段内容） */
export interface RegisterResponse {
  /** 用户 ID */
  id: number;
  /** 用户名 */
  username: string;
}

// ==================== 密码重置相关 DTO ====================

/** 发送重置密码验证码请求参数 */
export interface SendResetCodeRequest {
  /** 邮箱 */
  email: string;
}

/** 发送重置密码验证码响应数据（无数据） */
export type SendResetCodeResponse = null;

/** 重置密码请求参数 */
export interface ResetPasswordRequest {
  /** 邮箱 */
  email: string;
  /** 验证码 */
  code: string;
  /** 新密码（至少6位） */
  new_password: string;
  /** 确认新密码 */
  confirm_password: string;
}

/** 重置密码响应数据（无数据） */
export type ResetPasswordResponse = null;

// ==================== 个人中心相关 DTO ====================

/** 获取当前用户信息响应数据（data 字段内容） */
export type CurrentUserResponse = Omit<MockUser, 'password'>;

/** 更新个人资料请求参数 */
export interface UpdateProfileRequest {
  /** 昵称（可选） */
  nickname?: string;
  /** 头像 URL（可选） */
  avatar?: string;
  /** 邮箱（可选） */
  email?: string;
}

/** 更新个人资料响应数据（data 字段内容） */
export type UpdateProfileResponse = Omit<MockUser, 'password'>;

/** 修改密码请求参数 */
export interface ChangePasswordRequest {
  /** 原密码 */
  old_password: string;
  /** 新密码（至少6位） */
  new_password: string;
  /** 确认新密码 */
  confirm_password: string;
}

/** 修改密码响应数据（无数据） */
export type ChangePasswordResponse = null;

// ==================== 编辑器设置相关 DTO ====================

/** 获取编辑器设置响应数据（data 字段内容） */
export type GetEditorSettingsResponse = MockEditorSettings;

/** 保存编辑器设置请求参数 */
export interface SaveEditorSettingsRequest {
  /** 编辑器类型（vditor/mdxeditor/monaco） */
  editor: 'vditor' | 'mdxeditor' | 'monaco';
  /** 是否自动保存 */
  autosave?: boolean;
  /** 是否实时预览 */
  livepreview?: boolean;
}

/** 保存编辑器设置响应数据（data 字段内容） */
export type SaveEditorSettingsResponse = MockEditorSettings;
