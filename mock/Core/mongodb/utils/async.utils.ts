/**
 * MongoDB 异步工具函数
 *
 * 【说明】
 * 参照 Redis 的 async-cache.utils.ts，为 MockMongoCollection 提供异步模式支持的工具函数。
 * 包括延迟模拟、Proxy 包装、统计管理等。
 *
 * 【架构一致性】
 * 与 Redis 的异步架构保持一致：
 * - resolveAsyncDelayConfig: 解析异步延迟配置
 * - simulateDelay: 模拟异步延迟
 * - createAsyncStats / updateAsyncStats: 统计管理
 * - wrapAsync: Proxy 包装所有方法为异步模式
 * - isAsyncMongo: 判断是否为异步 MongoDB 集合
 *
 * 【与 Redis 的区别】
 * MongoDB 的 find 方法返回 FindCursor（不是 Promise），因此 wrapAsync 默认排除 find 方法，
 * 保持 FindCursor 的原类型。FindCursor 的方法（toArray/first/count）本身是异步的。
 */

import type {
  AsyncDelayConfig,
  ResolvedAsyncDelayConfig,
  AsyncMongoStats,
} from '../types/async.types';
import { DEFAULT_ASYNC_DELAY_CONFIG } from '../types/async.types';

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
 * 创建异步操作统计对象
 *
 * @returns 初始化为零的统计对象
 */
export function createAsyncStats(): AsyncMongoStats {
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
 * 更新异步操作统计
 *
 * @param stats 当前统计对象
 * @param delay 本次调用的延迟（毫秒）
 * @param success 是否成功
 */
export function updateAsyncStats(
  stats: AsyncMongoStats,
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
 * 默认排除的方法列表（这些方法不被 wrapAsync 包装）
 *
 * 【说明】
 * - find: 返回 FindCursor，不是 Promise，保持原类型
 * - watch: 返回 ChangeStream，不是 Promise，保持原类型
 * - 其他返回非 Promise 的特殊对象的方法可以按需添加
 */
const DEFAULT_EXCLUDE_METHODS = ['find', 'watch'];

/**
 * 将 MongoDB 集合对象包装为异步模式
 *
 * 【核心原理】
 * 使用 Proxy 拦截所有方法调用：
 * - 非函数属性直接返回
 * - 排除列表中的方法（如 find）直接返回原方法
 * - 其他函数属性包装为异步版本（返回 Promise，内部模拟延迟后执行原方法）
 *
 * 【使用方式】
 * const asyncCollection = wrapAsync(syncCollection, config, stats);
 * const user = await asyncCollection.findOne({ id: 1 });  // 直接 await
 * const cursor = asyncCollection.find({ status: 'active' });  // find 不包装，返回 FindCursor
 * const users = await cursor.toArray();  // FindCursor 的方法是异步的
 *
 * @param target 原始同步集合对象
 * @param delayConfig 延迟配置
 * @param stats 可选的统计对象（用于记录调用统计）
 * @param excludeMethods 可选的排除方法列表（默认排除 find）
 * @returns 包装后的异步集合对象（类型与原对象一致，但大部分方法返回 Promise）
 */
export function wrapAsync<T extends object>(
  target: T,
  delayConfig: ResolvedAsyncDelayConfig,
  stats?: AsyncMongoStats,
  excludeMethods: string[] = DEFAULT_EXCLUDE_METHODS,
): T {
  const excludeSet = new Set(excludeMethods);

  return new Proxy(target, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver);

      // 非函数直接返回
      if (typeof originalValue !== 'function') {
        return originalValue;
      }

      // 排除列表中的方法直接返回原方法（不包装）
      if (typeof prop === 'string' && excludeSet.has(prop)) {
        return originalValue;
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
            updateAsyncStats(stats, delay, success);
          }
        }
      };
    },
  }) as T;
}

/**
 * 判断对象是否为异步 MongoDB 集合（被 wrapAsync 包装过）
 *
 * 【说明】
 * 由于 Proxy 无法直接检测，这里通过检查对象的方法是否返回 Promise 来判断。
 * 简化实现：检查对象是否有 then 方法（Promise 特征）。
 *
 * @param obj 待判断对象
 * @returns 是否为异步 MongoDB 集合
 */
export function isAsyncMongo(obj: any): boolean {
  return obj && typeof obj === 'object' && typeof obj.then === 'function';
}
