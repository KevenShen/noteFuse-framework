// src/services/user.ts
import { request } from '@umijs/max';

export interface RegisterParams {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  invite_code?: string;
}

export interface UpdateProfileParams {
  username: string;
  nickname?: string;
  avatar?: string;
  email?: string;
}

export interface ChangePasswordParams {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export interface EditorSettingsParams {
  editor: 'vditor' | 'mdxeditor' | 'monaco';
  autosave: boolean;
  livepreview: boolean;
}

export async function login(username: string, password: string) {
  if (!username || !password) throw new Error('账号密码不能为空');
  return request('/api/login', {
    method: 'POST',
    data: { username, password },
  });
}

export async function logout() {
  return request('/api/logout', { method: 'POST' });
}

export async function register(data: RegisterParams) {
  if (data.password !== data.confirm_password) {
    throw new Error('两次输入的密码不一致');
  }
  return request('/api/register', { method: 'POST', data });
}

export async function getCurrentUser() {
  return request('/api/currentUser', { method: 'GET' });
}

// 发送重置密码验证码
export async function sendResetCode(email: string) {
  if (!email) {
    throw new Error('邮箱地址不能为空');
  }
  return request('/api/password/send-code', {
    method: 'POST',
    data: { email },
  });
}

// 重置密码（忘记密码）
export async function resetPassword(data: {
  email: string;
  code: string;
  new_password: string;
  confirm_password: string;
}) {
  if (data.new_password !== data.confirm_password) {
    throw new Error('两次输入的密码不一致');
  }
  if (!data.code || data.code.length !== 6) {
    throw new Error('请输入正确的6位验证码');
  }
  return request('/api/password/reset', {
    method: 'POST',
    data,
  });
}

// 更新个人资料
export async function updateProfile(data: UpdateProfileParams) {
  return request('/api/user/profile', {
    method: 'PUT',
    data,
  });
}

// 修改密码（登录状态下）
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

// 获取当前用户的编辑器设置
export async function getEditorSettings() {
  return request('/api/user/editor-settings', { method: 'GET' });
}

// 保存当前用户的编辑器设置
export async function saveEditorSettings(data: EditorSettingsParams) {
  return request('/api/user/editor-settings', {
    method: 'PUT',
    data,
  });
}
