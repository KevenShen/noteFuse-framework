/**
 * Express 请求日志中间件
 *
 * 【文件职责】
 * 记录每个请求的方法、路径、状态码、耗时等信息
 *
 * 【日志格式】
 * [时间] METHOD PATH STATUS - 耗时ms - 响应大小
 *
 * 【颜色编码】
 * - 2xx：绿色
 * - 3xx：蓝色
 * - 4xx：黄色
 * - 5xx：红色
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * 请求日志中间件
 *
 * @param options 配置选项
 * @param options.enable 是否启用日志，默认 true
 * @returns Express 中间件
 */
export function requestLogger(options?: { enable?: boolean }) {
  const { enable = true } = options || {};

  return (req: Request, res: Response, next: NextFunction): void => {
    // 如果禁用日志，直接跳过
    if (!enable) {
      next();
      return;
    }

    const startTime = Date.now();
    const { method, url } = req;

    // 监听响应完成事件
    res.on('finish', () => {
      // 计算耗时
      const duration = Date.now() - startTime;

      // 获取响应大小
      const responseSize = Number(res.get('Content-Length')) || 0;

      // 根据状态码选择颜色
      const status = res.statusCode;
      let statusColor = '\x1b[0m'; // 默认
      if (status >= 200 && status < 300) {
        statusColor = '\x1b[32m'; // 绿色
      } else if (status >= 300 && status < 400) {
        statusColor = '\x1b[34m'; // 蓝色
      } else if (status >= 400 && status < 500) {
        statusColor = '\x1b[33m'; // 黄色
      } else if (status >= 500) {
        statusColor = '\x1b[31m'; // 红色
      }

      // 格式化时间
      const timestamp = new Date().toLocaleTimeString('zh-CN', {
        hour12: false,
      });

      // 输出日志
      console.log(
        `[${timestamp}] ${method.padEnd(6)} ${url.padEnd(30)} ` +
          `${statusColor}${status}\x1b[0m - ${duration}ms` +
          (responseSize > 0 ? ` - ${formatSize(responseSize)}` : ''),
      );
    });

    // 监听响应错误事件
    res.on('error', (error) => {
      const duration = Date.now() - startTime;
      const timestamp = new Date().toLocaleTimeString('zh-CN', {
        hour12: false,
      });
      console.error(
        `[${timestamp}] ${method.padEnd(6)} ${url.padEnd(30)} ` +
          `\x1b[31mERROR\x1b[0m - ${duration}ms`,
      );
      console.error(error);
    });

    next();
  };
}

/**
 * 格式化文件大小
 *
 * @param bytes 字节数
 * @returns 格式化后的大小字符串
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}
