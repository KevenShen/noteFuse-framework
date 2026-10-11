// src/services/userLogin.ts
// 用户登录/登出/当前用户 Service 层
import { request } from '@umijs/max';

/**
 * 登录
 * @param username 用户名
 * @param password 密码
 */
export async function login(username: string, password: string) {
  if (!username || !password) throw new Error('账号密码不能为空');
  return request('/api/login', {
    method: 'POST',
    data: { username, password },
  });
}

/**
 * 登出
 */
export async function logout() {
  return request('/api/logout', { method: 'POST' });
}

/**
 * 获取当前登录用户信息
 */
export async function getCurrentUser() {
  return request('/api/currentUser', { method: 'GET' });
}
