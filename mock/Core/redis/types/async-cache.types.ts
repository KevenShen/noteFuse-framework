/**
 * 异步缓存类型定义
 *
 * 【说明】
 * 为 createCache 函数提供异步模式支持的类型定义。
 * 允许在创建缓存对象时直接配置异步模式，无需每次调用 setAsyncMode。
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
 * createCache 配置（扩展异步模式支持）
 */
export interface CreateCacheConfig {
  /** 键前缀 */
  prefix: string;
  /** 默认 TTL（秒） */
  ttl?: number;
  /** Redis 实例（默认使用全局 redis） */
  redisInstance?: any;

  // ========== 异步模式配置 ==========
  /** 是否启用异步模式（默认 false，保持向后兼容） */
  async?: boolean;
  /** 异步延迟配置（仅 async=true 时生效） */
  asyncConfig?: AsyncDelayConfig;
}

/**
 * 异步缓存类型工具
 * 将对象的所有方法包装为返回 Promise 的版本
 *
 * @example
 * type SyncCache = { get(key: string): string | null; set(key: string, value: string): void };
 * type AsyncCache = AsyncVersion<SyncCache>;
 * // AsyncCache = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> };
 */
export type AsyncVersion<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : T[K];
};

/**
 * 异步缓存统计
 */
export interface AsyncCacheStats {
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
