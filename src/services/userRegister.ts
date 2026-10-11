// src/services/userRegister.ts
// 用户注册 Service 层
import { request } from '@umijs/max';

/** 注册参数 */
export interface RegisterParams {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  invite_code?: string;
}

/**
 * 注册
 * @param data 注册参数
 */
export async function register(data: RegisterParams) {
  if (data.password !== data.confirm_password) {
    throw new Error('两次输入的密码不一致');
  }
  return request('/api/register', { method: 'POST', data });
}
