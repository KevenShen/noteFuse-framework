/**
 * 时间计算工具函数
 */

/**
 * 格式化时间戳为可读字符串
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化后的字符串
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

/**
 * 计算两个时间戳之间的差值（毫秒）
 */
export function timeDiff(from: number, to: number): number {
  return to - from;
}

/**
 * 格式化耗时为可读字符串
 * @param ms 毫秒数
 * @returns 格式化后的字符串，如 "1.5s"、"2.3min"、"1.2h"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60 * 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 60 * 60 * 1000) {
    return `${(ms / (60 * 1000)).toFixed(1)}min`;
  }
  return `${(ms / (60 * 60 * 1000)).toFixed(1)}h`;
}

/**
 * 生成唯一 ID（基于时间戳 + 随机数）
 */
export function generateId(prefix: string = 'id'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * 延迟指定时间（Promise 版本）
 * @param ms 毫秒数
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 计算指数退避时间
 * @param baseDelay 基础延迟
 * @param retryCount 当前重试次数
 * @param factor 退避因子
 * @param maxDelay 最大延迟（可选）
 */
export function calculateExponentialBackoff(
  baseDelay: number,
  retryCount: number,
  factor: number = 2,
  maxDelay?: number,
): number {
  const delay = baseDelay * Math.pow(factor, retryCount);
  if (maxDelay !== undefined) {
    return Math.min(delay, maxDelay);
  }
  return delay;
}

/**
 * 判断时间戳是否已过期
 * @param timestamp 时间戳
 * @param ttl 存活时间（毫秒）
 */
export function isExpired(timestamp: number, ttl: number): boolean {
  return Date.now() - timestamp > ttl;
}

/**
 * 获取当天开始时间戳
 */
export function getStartOfDay(date: Date = new Date()): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * 获取当天结束时间戳
 */
export function getEndOfDay(date: Date = new Date()): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
