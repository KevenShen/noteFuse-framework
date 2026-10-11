// src/constants/auth.ts
// 登录鉴权相关的公共配置

/** 不需要登录的白名单路径 */
export const WHITE_LIST = [
  '/login',
  '/register',
  '/forget-password',
  '/project',
  '/projectDetail',
];

/** 认证相关页面（已登录用户不应再访问） */
export const AUTH_PATHS = ['/login', '/register', '/forget-password'];

/** 登录后默认跳转路径 */
export const DEFAULT_LOGIN_REDIRECT = '/project';

/** 获取纯净路径（去除 query 和 hash） */
export const getPurePath = (url: string): string => {
  if (!url) return '/'; // 防御性编程，防止空值报错
  return url.split('?')[0].split('#')[0];
};

/**
 * 判断路径是否为认证页面（登录/注册/忘记密码）
 * 已登录用户访问这些页面时应被重定向
 */
export const isAuthPath = (path: string): boolean => {
  return AUTH_PATHS.includes(path);
};

/**
 * 判断路径是否在白名单中
 * - 精确匹配
 * - /project 前缀匹配（含 /project/xxx）
 */
export const isWhiteListPath = (path: string): boolean => {
  return WHITE_LIST.some((whitePath) => {
    if (path === whitePath) return true;
    // /project 匹配 /project 及其子路径
    if (whitePath === '/project' && path.startsWith('/project/')) return true;
    return false;
  });
};

/** 路径合并，自动清理多余斜杠 */
export const joinPath = (...paths: string[]): string => {
  return paths.filter(Boolean).join('/').replace(/\/+/g, '/');
};
