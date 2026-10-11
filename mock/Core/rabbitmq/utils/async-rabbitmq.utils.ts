/**
 * 异步 RabbitMQ 工具函数
 *
 * 【说明】
 * 为 createRabbitMQInstance 函数提供异步模式支持的工具函数。
 * 包括延迟模拟、Proxy 包装、统计管理等。
 *
 * 【设计原则】
 * 与 Redis 异步架构保持一致：
 * - 使用 Proxy 拦截所有方法调用
 * - 支持可配置的异步延迟模拟（fixed/random/normal）
 * - 特殊方法（如 createChannel）不包装，因为它们返回新对象
 */

import type {
  AsyncDelayConfig,
  ResolvedAsyncDelayConfig,
  AsyncRabbitMQStats,
} from '../types/async-rabbitmq.types';
import { DEFAULT_ASYNC_DELAY_CONFIG } from '../types/async-rabbitmq.types';

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
 * 创建异步 RabbitMQ 统计对象
 *
 * @returns 初始化为零的统计对象
 */
export function createAsyncRabbitMQStats(): AsyncRabbitMQStats {
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
 * 更新异步 RabbitMQ 统计
 *
 * @param stats 当前统计对象
 * @param delay 本次调用的延迟（毫秒）
 * @param success 是否成功
 */
export function updateAsyncRabbitMQStats(
  stats: AsyncRabbitMQStats,
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
 * 需要跳过异步包装的方法名列表
 *
 * 【说明】
 * 这些方法返回新的对象（如 Channel），不应该被包装为 Promise。
 * 调用者需要同步获取返回值，然后再对返回值进行操作。
 */
const SKIP_ASYNC_WRAP_METHODS = new Set([
  'createChannel',      // 创建通道，返回 Channel 对象
  'createConfirmChannel', // 创建确认通道
  'getConnection',      // 获取连接对象
  'getChannel',         // 获取通道对象
  'getStats',           // 获取统计信息
  'getConfig',          // 获取配置
  'pipeline',           // 管道（如果有）
]);

/**
 * 将 RabbitMQ 对象包装为异步模式
 *
 * 【核心原理】
 * 使用 Proxy 拦截所有方法调用：
 * - 非函数属性直接返回
 * - 函数属性包装为异步版本（返回 Promise，内部模拟延迟后执行原方法）
 * - 特殊方法（createChannel 等）不包装，直接返回原方法
 *
 * 【使用方式】
 * const asyncRabbitMQ = wrapAsync(syncRabbitMQ, config);
 * await asyncRabbitMQ.declareQueue('my-queue');  // 直接 await
 *
 * @param target 原始同步 RabbitMQ 对象
 * @param delayConfig 延迟配置
 * @param stats 可选的统计对象（用于记录调用统计）
 * @returns 包装后的异步 RabbitMQ 对象（类型与原对象一致，但所有方法返回 Promise）
 */
export function wrapAsync<T extends object>(
  target: T,
  delayConfig: ResolvedAsyncDelayConfig,
  stats?: AsyncRabbitMQStats,
): T {
  return new Proxy(target, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver);

      // 非函数直接返回
      if (typeof originalValue !== 'function') {
        return originalValue;
      }

      // 特殊处理：跳过需要同步返回的方法
      // 这些方法返回新对象（如 Channel），不应该被包装为 Promise
      if (SKIP_ASYNC_WRAP_METHODS.has(prop as string)) {
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
            updateAsyncRabbitMQStats(stats, delay, success);
          }
        }
      };
    },
  }) as T;
}

/**
 * 判断对象是否为异步 RabbitMQ（被 wrapAsync 包装过）
 *
 * @param obj 待判断对象
 * @returns 是否为异步 RabbitMQ
 */
export function isAsyncRabbitMQ(obj: any): boolean {
  // 异步 RabbitMQ 的所有方法都返回 Promise
  // 这里通过检查是否有 _asyncStats 属性来判断
  return obj && typeof obj === 'object' && obj._asyncStats !== undefined;
}
