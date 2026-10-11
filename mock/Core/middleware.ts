// mock/Core/middleware.ts
// 通用中间件工具
// 职责：提供可复用的中间件组合器和通用中间件（含认证、权限、校验、日志）
// 【核心层】模拟后端架构的通用中间件基础设施

import type { Request, Response, NextFunction } from 'express';
import { fail } from './common';
// 从 Core/auth 导入认证函数，避免循环依赖
import { getCurrentUserFromToken } from './auth';

// ==================== 类型定义 ====================

/** 中间件函数类型（允许返回 any，mock 环境中返回值不会被使用） */
export type Middleware = (req: Request, res: Response, next: NextFunction) => any;

/** 请求处理函数类型（允许返回 any，mock 环境中返回值不会被使用）
 *  注意：express 5.x 的 RequestHandler 要求返回 void | Promise<void>，
 *  但在 mock 环境中，我们的处理函数通常返回 res.json() 的结果（Promise<Response>），
 *  因此这里使用更宽松的类型定义，避免类型错误。
 */
export type RequestHandler = (req: Request, res: Response) => any;

/** 中间件配置（支持认证、权限、校验、自定义中间件） */
export interface MiddlewareConfig {
  /** 是否需要认证 */
  auth?: boolean;
  /** 是否需要管理员权限 */
  admin?: boolean;
  /** 是否需要超级管理员权限 */
  superAdmin?: boolean;
  /** 参数校验函数 */
  validate?: (data: any) => string | null;
  /** 参数来源（body/query/params） */
  validateSource?: 'body' | 'query' | 'params';
  /** 自定义中间件列表 */
  custom?: Middleware[];
}

// ==================== 认证中间件 ====================

/**
 * 认证中间件
 * 验证用户是否登录，未登录返回 401
 * 将用户信息挂载到 req.currentUser 上
 */
export const authMiddleware: Middleware = (req, res, next) => {
  const user = getCurrentUserFromToken(req);
  if (!user) {
    res.status(401).json(fail('未登录或登录已过期', 401));
    return;
  }
  // 将用户信息挂载到 req 对象上，供后续中间件和控制器使用
  (req as any).currentUser = user;
  next();
};

// ==================== 权限中间件 ====================

/**
 * 管理员权限中间件
 * 验证用户是否为管理员，不是返回 403
 * 依赖 authMiddleware 先执行（req.currentUser）
 */
export const adminMiddleware: Middleware = (req, res, next) => {
  const user = (req as any).currentUser;
  if (!user || !user.is_staff) {
    res.status(403).json(fail('没有权限访问', 403));
    return;
  }
  next();
};

/**
 * 超级管理员权限中间件
 * 验证用户是否为超级管理员，不是返回 403
 * 依赖 authMiddleware 先执行（req.currentUser）
 */
export const superAdminMiddleware: Middleware = (req, res, next) => {
  const user = (req as any).currentUser;
  if (!user || !user.is_superuser) {
    res.status(403).json(fail('只有超级管理员可以访问', 403));
    return;
  }
  next();
};

// ==================== 参数校验中间件 ====================

/**
 * 参数校验中间件工厂
 * @param validate 校验函数，返回错误信息（null 表示校验通过）
 * @param source 参数来源（body/query/params）
 */
export const validateMiddleware = (
  validate: (data: any) => string | null,
  source: 'body' | 'query' | 'params' = 'body',
): Middleware => {
  return (req, res, next) => {
    const data = req[source];
    const error = validate(data);
    if (error) {
      res.json(fail(error));
      return;
    }
    next();
  };
};

// ==================== 日志中间件 ====================

/**
 * 日志中间件
 * 记录请求方法、路径、状态码、耗时
 */
export const logMiddleware: Middleware = (req, res, next) => {
  const start = Date.now();
  const { method, url } = req;

  // 响应完成时记录日志
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    console.log(`[Mock] ${method} ${url} ${statusCode} ${duration}ms`);
  });

  next();
};

// ==================== 错误处理中间件 ====================

/**
 * 错误处理中间件
 * 统一处理未捕获的异常
 */
export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error('[Mock Error]', err);
  res.status(500).json(fail('服务器内部错误', 500));
};

// ==================== 中间件组合器 ====================

/**
 * 组合多个中间件
 * @param middlewares 中间件列表（按顺序执行）
 * @param handler 请求处理函数（所有中间件通过后执行）
 */
export const compose = (
  middlewares: Middleware[],
  handler: RequestHandler,
): RequestHandler => {
  return async (req: Request, res: Response) => {
    let index = 0;

    // 将 next 包装为返回 Promise 的函数，支持等待异步中间件执行完成
    const next = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (index < middlewares.length) {
          const middleware = middlewares[index++];
          let nextCalled = false;

          try {
            // 调用中间件，传入 next 回调
            const result = middleware(req, res, () => {
              nextCalled = true;
              // 中间件调用 next() 后，递归执行下一个中间件
              next().then(resolve).catch(reject);
            });

            // 如果中间件返回 Promise，等待它执行完成
            if (result && typeof (result as Promise<void>).then === 'function') {
              (result as Promise<void>).then(() => {
                // 中间件执行完成后，如果没有调用 next()，说明直接发送了响应
                if (!nextCalled) {
                  resolve();
                }
              }).catch(reject);
            } else {
              // 同步中间件：使用 setImmediate 检查是否调用了 next()
              // 如果没有调用，说明中间件直接发送了响应
              setImmediate(() => {
                if (!nextCalled) {
                  resolve();
                }
              });
            }
          } catch (err) {
            console.error('[Mock Middleware Error]', err);
            res.status(500).json(fail('服务器内部错误', 500));
            resolve();
          }
        } else {
          // 所有中间件执行完毕，执行请求处理函数
          try {
            const result = handler(req, res);
            // 如果 handler 返回 Promise，等待它执行完成
            if (result && typeof (result as Promise<void>).then === 'function') {
              (result as Promise<void>).then(resolve).catch(reject);
            } else {
              resolve();
            }
          } catch (err) {
            console.error('[Mock Handler Error]', err);
            res.status(500).json(fail('服务器内部错误', 500));
            resolve();
          }
        }
      });
    };

    // 等待所有中间件和 handler 执行完成
    await next();
  };
};

/**
 * 带自定义中间件的包装器
 * @param middlewares 中间件列表
 * @param handler 请求处理函数
 */
export const withCustomMiddleware = (
  middlewares: Middleware[],
  handler: RequestHandler,
): RequestHandler => {
  return compose(middlewares, handler);
};

// ==================== 带配置的中间件包装器 ====================

/**
 * 带配置的中间件包装器
 * 根据配置自动组合中间件（认证 → 权限 → 校验 → 自定义）
 * @param config 中间件配置
 * @param handler 请求处理函数
 */
export const withMiddleware = (
  config: MiddlewareConfig,
  handler: RequestHandler,
): RequestHandler => {
  const middlewares: Middleware[] = [];

  // 认证中间件（需要认证或权限时自动启用）
  if (config.auth || config.admin || config.superAdmin) {
    middlewares.push(authMiddleware);
  }

  // 管理员权限中间件
  if (config.admin) {
    middlewares.push(adminMiddleware);
  }

  // 超级管理员权限中间件
  if (config.superAdmin) {
    middlewares.push(superAdminMiddleware);
  }

  // 参数校验中间件
  if (config.validate) {
    middlewares.push(validateMiddleware(config.validate, config.validateSource || 'body'));
  }

  // 自定义中间件
  if (config.custom) {
    middlewares.push(...config.custom);
  }

  return compose(middlewares, handler);
};
