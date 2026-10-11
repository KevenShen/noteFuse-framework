/**
 * RabbitMQ Mock 全局单例实例
 *
 * 提供全局共享的 MockRabbitMQ 实例，便于在 mock 接口中直接使用
 *
 * 【配置说明】
 * - 默认连接 localhost:5672
 * - 默认虚拟主机 /
 * - 用户名/密码 guest/guest
 * - 心跳间隔 60 秒
 * - 连接超时 10 秒
 *
 * 【异步模式支持】
 * - 默认同步模式（async=false）：保持向后兼容，现有代码不受影响
 * - 异步模式（async=true）：所有方法自动返回 Promise，可直接 await
 * - 异步延迟可配置：fixed/random/normal 三种延迟模式
 *
 * 【使用方式】
 * ```typescript
 * import { rabbitmq, createRabbitMQInstance } from '@/mock/Core/rabbitmq';
 *
 * // ========== 同步模式（默认，向后兼容）==========
 * rabbitmq.declareQueue('my-queue');
 * rabbitmq.publish('', 'my-queue', Buffer.from('hello'));
 *
 * // ========== 异步模式（新增）==========
 * const asyncRabbitMQ = createRabbitMQInstance({
 *   async: true,  // 启用异步模式
 * });
 *
 * // 直接 await，不需要单独的异步方法
 * await asyncRabbitMQ.declareQueue('my-queue');
 * await asyncRabbitMQ.publish('', 'my-queue', Buffer.from('hello'));
 *
 * // 自定义异步延迟
 * const asyncRabbitMQ = createRabbitMQInstance({
 *   async: true,
 *   asyncConfig: {
 *     delayEnabled: true,
 *     minDelay: 10,
 *     maxDelay: 50,
 *     delayMode: 'random',
 *   },
 * });
 * ```
 */

import { MockRabbitMQ } from './MockRabbitMQ';
import type { PartialRabbitMQConfig } from './types';
import type { CreateRabbitMQInstanceConfig } from './types/async-rabbitmq.types';
import {
  wrapAsync,
  resolveAsyncDelayConfig,
  createAsyncRabbitMQStats,
} from './utils/async-rabbitmq.utils';

/**
 * 默认配置
 */
const DEFAULT_INSTANCE_CONFIG: PartialRabbitMQConfig = {
  host: 'localhost',
  port: 5672,
  username: 'guest',
  password: 'guest',
  vhost: '/',
  heartbeat: 60,
  connectionTimeout: 10000,
};

/**
 * 全局 RabbitMQ Mock 实例
 *
 * 单例模式，整个应用共享一个实例
 * 所有 mock 接口都使用此实例，确保数据一致性
 *
 * 【注意】全局实例默认使用同步模式，保持向后兼容
 */
export const rabbitmq = new MockRabbitMQ(DEFAULT_INSTANCE_CONFIG);

/**
 * 创建新的 RabbitMQ Mock 实例
 *
 * 用于需要隔离环境的场景（如测试），或需要启用异步模式的场景
 *
 * 【异步模式】
 * 当 config.async = true 时，返回的实例所有方法都返回 Promise，
 * 可以直接使用 await 调用，模拟真实 RabbitMQ 客户端的异步行为。
 *
 * @param config 可选配置（连接配置 + 异步模式配置）
 * @returns 新的 MockRabbitMQ 实例（同步或异步模式）
 *
 * @example
 * ```typescript
 * // 同步模式（默认）
 * const syncRabbitMQ = createRabbitMQInstance({ vhost: '/test' });
 * syncRabbitMQ.declareQueue('my-queue');
 *
 * // 异步模式
 * const asyncRabbitMQ = createRabbitMQInstance({
 *   async: true,
 *   asyncConfig: { delayEnabled: true, minDelay: 5, maxDelay: 20 },
 * });
 * await asyncRabbitMQ.declareQueue('my-queue');
 * ```
 */
export function createRabbitMQInstance(
  config?: CreateRabbitMQInstanceConfig,
): MockRabbitMQ {
  // 分离连接配置和异步配置
  const {
    async: asyncMode = false,
    asyncConfig,
    ...connectionConfig
  } = config || {};

  // 创建同步实例
  const instance = new MockRabbitMQ({
    ...DEFAULT_INSTANCE_CONFIG,
    ...connectionConfig,
  });

  // 异步模式包装
  if (asyncMode) {
    // 解析异步延迟配置
    const resolvedAsyncConfig = resolveAsyncDelayConfig(asyncConfig);

    // 创建统计对象（用于记录异步调用统计）
    const asyncStats = createAsyncRabbitMQStats();

    // 用 wrapAsync 包装，所有方法自动返回 Promise
    const asyncInstance = wrapAsync(instance, resolvedAsyncConfig, asyncStats);

    // 将统计对象和配置挂载到实例上，便于外部查询
    (asyncInstance as any)._asyncStats = asyncStats;
    (asyncInstance as any)._asyncConfig = resolvedAsyncConfig;

    console.log(
      `[MockRabbitMQ] 异步实例创建完成: ` +
        `host=${connectionConfig.host || DEFAULT_INSTANCE_CONFIG.host}, ` +
        `vhost=${connectionConfig.vhost || DEFAULT_INSTANCE_CONFIG.vhost}, ` +
        `delay=${resolvedAsyncConfig.delayEnabled ? `${resolvedAsyncConfig.minDelay}-${resolvedAsyncConfig.maxDelay}ms` : 'disabled'}`,
    );

    return asyncInstance;
  }

  // 同步模式，直接返回实例
  return instance;
}

/**
 * 重置全局实例（清空所有数据）
 *
 * 用于测试环境的清理
 */
export function resetRabbitMQInstance(): void {
  // 阶段 1 暂时只有基础类，后续阶段添加 reset 方法
  // rabbitmq.resetAll();
  console.warn('[MockRabbitMQ] resetAll 方法将在后续阶段实现');
}
