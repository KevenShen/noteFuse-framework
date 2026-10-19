// mock/$module/middleware.ts
// $module 模块中间件层
// 职责：处理请求的预处理和后处理（认证、权限、校验、日志等）

import type { Request, Response, NextFunction } from 'express';
import { fail } from '../../Core';
import { getCurrentUserFromToken } from '../../Core/auth';
import { validateMiddleware, logMiddleware, compose, type Middleware, type RequestHandler } from '../../Core/middleware';

/**
 * 认证中间件
 */
export const authMiddleware: Middleware = async (req, res, next) => {
  const user = await getCurrentUserFromToken(req);
  if (!user) {
    res.status(401).json(fail('未登录或登录已过期', 401));
    return;
  }
  (req as any).currentUser = user;
  next();
};

export { validateMiddleware, logMiddleware, compose };
export type { Middleware, RequestHandler };

export const withAuth = (handler: RequestHandler): RequestHandler => {
  return compose([authMiddleware], handler);
};
