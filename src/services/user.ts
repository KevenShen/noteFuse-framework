// src/services/user.ts
// 用户资料/设置 Service 层
// 职责：个人资料更新、修改密码、编辑器设置（登录/注册/重置密码已拆分）
import { request } from '@umijs/max';

/** 更新个人资料参数 */
export interface UpdateProfileParams {
  username: string;
  nickname?: string;
  avatar?: string;
  email?: string;
}

/** 修改密码参数（登录状态下） */
export interface ChangePasswordParams {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

/** 编辑器设置参数 */
export interface EditorSettingsParams {
  editor: 'vditor' | 'mdxeditor' | 'monaco';
  autosave: boolean;
  livepreview: boolean;
}

/**
 * 更新个人资料
 * @param data 更新参数
 */
export async function updateProfile(data: UpdateProfileParams) {
  return request('/api/user/profile', {
    method: 'PUT',
    data,
  });
}

/**
 * 修改密码（登录状态下）
 * @param data 修改密码参数
 */
export async function changePassword(data: ChangePasswordParams) {
  if (data.new_password !== data.confirm_password) {
    throw new Error('两次输入的新密码不一致');
  }
  if (data.new_password.length < 6) {
    throw new Error('新密码长度至少6位');
  }
  return request('/api/user/password', {
    method: 'PUT',
    data,
  });
}

/**
 * 获取当前用户的编辑器设置
 */
export async function getEditorSettings() {
  return request('/api/user/editor-settings', { method: 'GET' });
}

/**
 * 保存当前用户的编辑器设置
 * @param data 编辑器设置
 */
export async function saveEditorSettings(data: EditorSettingsParams) {
  return request('/api/user/editor-settings', {
    method: 'PUT',
    data,
  });
}
