/**
 * Express 全局错误处理中间件
 *
 * 【文件职责】
 * 捕获所有未处理的异常，统一返回标准错误响应格式
 *
 * 【响应格式】
 * 与 Umi 模式保持一致：
 * {
 *   success: false,
 *   errorCode: 500,
 *   message: '错误信息',
 *   data: null
 * }
 *
 * 【错误类型处理】
 * - BusinessError：业务错误，返回自定义错误码和消息
 * - 其他错误：未知错误，返回 500 状态码
 */

import type { Request, Response, NextFunction } from 'express';
import { BusinessError } from '../../Core';

/**
 * 全局错误处理中间件
 *
 * 【使用方式】
 * 必须放在所有路由之后，确保能捕获所有异常
 * Express 错误处理中间件必须有 4 个参数：(err, req, res, next)
 *
 * @param err 错误对象
 * @param req 请求对象
 * @param res 响应对象
 * @param next 下一个中间件
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void {
  // ========== 业务错误（BusinessError）==========
  if (err instanceof BusinessError) {
    const statusCode =
      err.errorCode && err.errorCode >= 400 ? err.errorCode : 200;

    res.status(statusCode).json({
      success: false,
      errorCode: err.errorCode || 400,
      message: err.message,
      data: null,
    });

    // 记录业务错误日志（警告级别）
    console.warn(
      `[BusinessError] ${req.method} ${req.url} - ` +
        `${err.errorCode}: ${err.message}`,
    );
    return;
  }

  // ========== 未知错误 ==========
  console.error(`[Error] ${req.method} ${req.url}`);
  console.error(err.stack || err.message);

  // 返回 500 错误
  res.status(500).json({
    success: false,
    errorCode: 500,
    message:
      process.env.NODE_ENV === 'production'
        ? '服务器内部错误'
        : err.message || '服务器内部错误',
    data: null,
  });
}

/**
 * 404 处理中间件
 *
 * 【使用方式】
 * 放在所有路由之后、错误处理中间件之前
 *
 * @param req 请求对象
 * @param res 响应对象
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    errorCode: 404,
    message: `接口不存在：${req.method} ${req.url}`,
    data: null,
  });
}
