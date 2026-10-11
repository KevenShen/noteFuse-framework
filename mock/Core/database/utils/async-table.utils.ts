/**
 * 异步表工具函数
 *
 * 【说明】
 * 为 MockTable 提供异步模式支持的工具函数。
 * 包括延迟模拟、Proxy 包装、统计管理等。
 */

import type {
  AsyncDelayConfig,
  ResolvedAsyncDelayConfig,
  AsyncTableStats,
} from '../types/async-table.types';
import { DEFAULT_ASYNC_DELAY_CONFIG } from '../types/async-table.types';

/**
 * 解析异步延迟配置（填充默认值）
 */
export function resolveAsyncDelayConfig(
  config?: AsyncDelayConfig,
): ResolvedAsyncDelayConfig {
  return {
    delayEnabled: config?.delayEnabled ?? DEFAULT_ASYNC_DELAY_CONFIG.delayEnabled,
    minDelay: config?.minDelay ?? DEFAULT_ASYNC_DELAY_CONFIG.minDelay,
    maxDelay: config?.maxDelay ?? DEFAULT_ASYNC_DELAY_CONFIG.maxDelay,
    delayMode: config?.delayMode ?? DEFAULT_ASYNC_DELAY_CONFIG.delayMode,
  };
}

/**
 * 模拟异步延迟
 * 支持 fixed / random / normal 三种模式
 */
export function simulateDelay(config: ResolvedAsyncDelayConfig): Promise<void> {
  if (!config.delayEnabled) {
    return Promise.resolve();
  }

  let delay: number;

  switch (config.delayMode) {
    case 'fixed':
      delay = config.minDelay;
      break;
    case 'random':
      delay = Math.random() * (config.maxDelay - config.minDelay) + config.minDelay;
      break;
    case 'normal': {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const mean = (config.minDelay + config.maxDelay) / 2;
      const std = (config.maxDelay - config.minDelay) / 4;
      delay = Math.max(config.minDelay, Math.min(config.maxDelay, mean + z * std));
      break;
    }
    default:
      delay = config.minDelay;
  }

  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * 创建异步表统计对象
 */
export function createAsyncTableStats(): AsyncTableStats {
  return {
    totalCalls: 0,
    successCount: 0,
    failureCount: 0,
    totalDelay: 0,
    avgDelay: 0,
    maxDelay: 0,
    minDelay: Infinity,
  };
}

/**
 * 更新异步表统计
 */
export function updateAsyncTableStats(
  stats: AsyncTableStats,
  delay: number,
  success: boolean,
): void {
  stats.totalCalls++;
  if (success) {
    stats.successCount++;
  } else {
    stats.failureCount++;
  }
  stats.totalDelay += delay;
  stats.avgDelay = stats.totalCalls > 0 ? stats.totalDelay / stats.totalCalls : 0;
  stats.maxDelay = Math.max(stats.maxDelay, delay);
  stats.minDelay = Math.min(stats.minDelay, delay);
}

/**
 * 将表对象包装为异步模式
 * 【核心原理】使用 Proxy 拦截所有方法调用，函数包装为异步版本
 */
export function wrapAsyncTable<T extends object>(
  target: T,
  delayConfig: ResolvedAsyncDelayConfig,
  stats?: AsyncTableStats,
): T {
  return new Proxy(target, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver);

      if (typeof originalValue !== 'function') {
        return originalValue;
      }

      return async function (...args: any[]): Promise<any> {
        const startTime = Date.now();
        let success = false;

        try {
          await simulateDelay(delayConfig);
          const result = originalValue.apply(target, args);
          success = true;
          return result;
        } finally {
          if (stats) {
            const delay = Date.now() - startTime;
            updateAsyncTableStats(stats, delay, success);
          }
        }
      };
    },
  }) as T;
}

/**
 * 判断对象是否为异步表
 */
export function isAsyncTable(obj: any): boolean {
  return obj && typeof obj === 'object' && typeof obj.then === 'function';
}
