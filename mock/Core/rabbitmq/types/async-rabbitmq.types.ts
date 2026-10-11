/**
 * 异步 RabbitMQ 类型定义
 *
 * 【说明】
 * 为 createRabbitMQInstance 函数提供异步模式支持的类型定义。
 * 允许在创建 RabbitMQ 实例时直接配置异步模式，无需每次调用单独的异步方法。
 *
 * 【设计原则】
 * 与 Redis 异步架构保持一致：
 * - 使用 Proxy 包装同步对象，所有方法自动返回 Promise
 * - 支持可配置的异步延迟模拟（fixed/random/normal）
 * - 保持向后兼容，默认同步模式
 */

/**
 * 异步延迟配置
 */
export interface AsyncDelayConfig {
  /** 是否启用模拟延迟（默认 true） */
  delayEnabled?: boolean;
  /** 最小延迟（毫秒，默认 1） */
  minDelay?: number;
  /** 最大延迟（毫秒，默认 5） */
  maxDelay?: number;
  /** 延迟模式（默认 'random'） */
  delayMode?: 'fixed' | 'random' | 'normal';
}

/**
 * 解析后的异步延迟配置（所有字段都有默认值）
 */
export interface ResolvedAsyncDelayConfig {
  delayEnabled: boolean;
  minDelay: number;
  maxDelay: number;
  delayMode: 'fixed' | 'random' | 'normal';
}

/**
 * 创建 RabbitMQ 实例配置（扩展异步模式支持）
 */
export interface CreateRabbitMQInstanceConfig {
  // ========== 连接配置 ==========
  /** 主机地址（默认 'localhost'） */
  host?: string;
  /** 端口（默认 5672） */
  port?: number;
  /** 用户名（默认 'guest'） */
  username?: string;
  /** 密码（默认 'guest'） */
  password?: string;
  /** 虚拟主机（默认 '/'） */
  vhost?: string;
  /** 心跳间隔（秒，默认 60） */
  heartbeat?: number;
  /** 连接超时（毫秒，默认 10000） */
  connectionTimeout?: number;

  // ========== 异步模式配置 ==========
  /** 是否启用异步模式（默认 false，保持向后兼容） */
  async?: boolean;
  /** 异步延迟配置（仅 async=true 时生效） */
  asyncConfig?: AsyncDelayConfig;
}

/**
 * 异步 RabbitMQ 类型工具
 * 将对象的所有方法包装为返回 Promise 的版本
 *
 * @example
 * type SyncRabbitMQ = { declareQueue(name: string): void; publish(...): boolean };
 * type AsyncRabbitMQ = AsyncVersion<SyncRabbitMQ>;
 * // AsyncRabbitMQ = { declareQueue(name: string): Promise<void>; publish(...): Promise<boolean> };
 */
export type AsyncVersion<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : T[K];
};

/**
 * 异步 RabbitMQ 统计
 */
export interface AsyncRabbitMQStats {
  /** 总调用次数 */
  totalCalls: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 总延迟时间（毫秒） */
  totalDelay: number;
  /** 平均延迟时间（毫秒） */
  avgDelay: number;
  /** 最大延迟时间（毫秒） */
  maxDelay: number;
  /** 最小延迟时间（毫秒） */
  minDelay: number;
}

/**
 * 默认异步延迟配置
 */
export const DEFAULT_ASYNC_DELAY_CONFIG: ResolvedAsyncDelayConfig = {
  delayEnabled: true,
  minDelay: 1,
  maxDelay: 5,
  delayMode: 'random',
};
