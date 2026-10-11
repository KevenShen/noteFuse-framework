/**
 * 异步缓存工具函数
 *
 * 【说明】
 * 为 createCache 函数提供异步模式支持的工具函数。
 * 包括延迟模拟、Proxy 包装、统计管理等。
 */

import type {
  AsyncDelayConfig,
  ResolvedAsyncDelayConfig,
  AsyncCacheStats,
} from '../types/async-cache.types';
import { DEFAULT_ASYNC_DELAY_CONFIG } from '../types/async-cache.types';

/**
 * 解析异步延迟配置（填充默认值）
 *
 * @param config 用户配置
 * @returns 解析后的完整配置
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
 *
 * 【支持的延迟模式】
 * - fixed: 固定延迟（minDelay）
 * - random: 随机延迟（minDelay ~ maxDelay）
 * - normal: 正态分布延迟（Box-Muller 变换）
 *
 * @param config 延迟配置
 * @returns Promise，延迟完成后 resolve
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
      // Box-Muller 变换生成正态分布随机数
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
 * 创建异步缓存统计对象
 *
 * @returns 初始化为零的统计对象
 */
export function createAsyncCacheStats(): AsyncCacheStats {
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
 * 更新异步缓存统计
 *
 * @param stats 当前统计对象
 * @param delay 本次调用的延迟（毫秒）
 * @param success 是否成功
 */
export function updateAsyncCacheStats(
  stats: AsyncCacheStats,
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
 * 将缓存对象包装为异步模式
 *
 * 【核心原理】
 * 使用 Proxy 拦截所有方法调用：
 * - 非函数属性直接返回
 * - 函数属性包装为异步版本（返回 Promise，内部模拟延迟后执行原方法）
 *
 * 【使用方式】
 * const asyncCache = wrapAsync(syncCache, config);
 * const value = await asyncCache.get('key');  // 直接 await
 *
 * @param target 原始同步缓存对象
 * @param delayConfig 延迟配置
 * @param stats 可选的统计对象（用于记录调用统计）
 * @returns 包装后的异步缓存对象（类型与原对象一致，但所有方法返回 Promise）
 */
export function wrapAsync<T extends object>(
  target: T,
  delayConfig: ResolvedAsyncDelayConfig,
  stats?: AsyncCacheStats,
): T {
  return new Proxy(target, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver);

      // 非函数直接返回
      if (typeof originalValue !== 'function') {
        return originalValue;
      }

      // 特殊处理：pipeline() 方法不需要异步包装
      // 因为 pipeline() 只是创建一个管道对象，不涉及网络请求
      // 真正的异步执行在 execAsync() 中处理
      if (prop === 'pipeline') {
        return originalValue.bind(target);
      }

      // 返回异步包装函数
      return async function (...args: any[]): Promise<any> {
        const startTime = Date.now();
        let success = false;

        try {
          // 模拟延迟
          await simulateDelay(delayConfig);

          // 执行原方法
          const result = originalValue.apply(target, args);
          success = true;
          return result;
        } finally {
          // 更新统计
          if (stats) {
            const delay = Date.now() - startTime;
            updateAsyncCacheStats(stats, delay, success);
          }
        }
      };
    },
  }) as T;
}

/**
 * 判断对象是否为异步缓存（被 wrapAsync 包装过）
 *
 * @param obj 待判断对象
 * @returns 是否为异步缓存
 */
export function isAsyncCache(obj: any): boolean {
  // 异步缓存的所有方法都返回 Promise
  // 这里通过检查是否有 then 方法来判断（简化实现）
  return obj && typeof obj === 'object' && typeof obj.then === 'function';
}
