// src/services/userResetPassword.ts
// 重置密码（忘记密码）Service 层
import { request } from '@umijs/max';

/** 重置密码参数 */
export interface ResetPasswordParams {
  email: string;
  code: string;
  new_password: string;
  confirm_password: string;
}

/**
 * 发送重置密码验证码
 * @param email 邮箱地址
 */
export async function sendResetCode(email: string) {
  if (!email) {
    throw new Error('邮箱地址不能为空');
  }
  return request('/api/password/send-code', {
    method: 'POST',
    data: { email },
  });
}

/**
 * 重置密码（忘记密码）
 * @param data 重置密码参数
 */
export async function resetPassword(data: ResetPasswordParams) {
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
