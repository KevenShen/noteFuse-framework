// app.ts
import {
  DEFAULT_LOGIN_REDIRECT,
  getPurePath,
  isAuthPath,
  isWhiteListPath,
} from '@/constants/auth';
import type { CurrentUser } from '@/models';
import { getCurrentUser } from '@/services';
import { RequestConfig, history } from '@umijs/max';
import { message } from 'antd';

// 全局配置message
message.config({
  top: 80,
  duration: 2,
  maxCount: 3,
  rtl: false,
});

export async function getInitialState(): Promise<{
  currentUser?: CurrentUser;
  settings?: any;
}> {
  const pathname = getPurePath(history.location.pathname);
  const token = localStorage.getItem('note_fuse_token');

  // 已登录用户访问（登录/注册/忘记密码）认证页面，直接重定向到首页
  if (token && isAuthPath(pathname)) {
    history.replace(DEFAULT_LOGIN_REDIRECT);
    return {};
  }

  // 白名单页面直接返回，不请求用户信息
  if (isWhiteListPath(pathname)) {
    return {};
  }

  // 没有 token 且不在白名单，跳转到登录页
  if (!token) {
    history.push('/login');
    return {};
  }

  // 有 token，调用 API 获取当前用户信息
  try {
    const res = await getCurrentUser();
    if (res.success && res.data) {
      return {
        currentUser: res.data,
        settings: {},
      };
    }
    // 请求成功但没有数据，清除 token 跳转登录
    localStorage.removeItem('note_fuse_token');
    history.push('/login');
    return {};
  } catch (error) {
    // token 无效或请求失败，清除 token 跳转登录
    localStorage.removeItem('note_fuse_token');
    history.push('/login');
    return {};
  }
}

/**
 * 路由变化时的登录校验
 * 1. 未登录访问受保护页面 → 跳转登录
 * 2. 已登录访问认证页面（登录/注册/忘记密码）→ 跳转首页
 */
export function onRouteChange({ location }: { location: any }) {
  const pathname = getPurePath(location.pathname);
  const token = localStorage.getItem('note_fuse_token');

  // 已登录用户访问认证页面，重定向到首页
  if (token && isAuthPath(pathname)) {
    history.replace(DEFAULT_LOGIN_REDIRECT);
    return;
  }

  // 非白名单路径且无 token，跳转登录页
  if (!isWhiteListPath(pathname) && !token) {
    history.push('/login');
  }
}

// 请求配置
export const request: RequestConfig = {
  timeout: 30000,
  errorConfig: {
    errorHandler: (error: any) => {
      if (error.name === 'BizError') {
        message.error(error.message);
      } else if (error.response) {
        if (error.response.status === 401) {
          message.error('登录已过期，请重新登录');
          localStorage.removeItem('note_fuse_token');
          history.push('/login');
        } else if (error.response.status === 403) {
          message.error('没有权限访问');
        } else {
          message.error(`请求错误: ${error.response.status}`);
        }
      } else {
        message.error('网络异常，请检查网络连接');
      }
      // 重新抛出异常，让上层 try/catch 能正确捕获
      throw error;
    },
    errorThrower: (res: any) => {
      // 兼容两种响应格式：{ success, errorCode } 或 { code }
      const isSuccess =
        res.success !== undefined
          ? res.success
          : res.code === 0 || res.code === 200;
      if (!isSuccess) {
        const error: any = new Error(res.message || '请求失败');
        error.name = 'BizError';
        error.info = res;
        throw error;
      }
    },
  },
  requestInterceptors: [
    (url: string, options: any) => {
      const token = localStorage.getItem('note_fuse_token');
      if (token) {
        options.headers = {
          ...options.headers,
          Authorization: `Token ${token}`,
        };
      }
      return { url, options };
    },
  ],
  responseInterceptors: [
    (response: any) => {
      return response;
    },
  ],
};
