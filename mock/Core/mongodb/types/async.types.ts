/**
 * MongoDB 异步类型定义
 *
 * 【说明】
 * 参照 Redis 的 async-cache.types.ts，为 MockMongoCollection 提供异步模式支持的类型定义。
 * 允许在创建集合时直接配置异步模式，无需每次调用手动处理 Promise。
 *
 * 【架构一致性】
 * 与 Redis 的异步架构保持一致：
 * - AsyncDelayConfig: 异步延迟配置
 * - MongoAsyncConfig: MongoDB 异步配置（扩展 async + asyncConfig）
 * - AsyncVersion<T>: 类型工具，将对象的所有方法包装为返回 Promise 的版本
 * - AsyncMongoStats: 异步操作统计
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
 * MongoDB 异步配置
 *
 * 【使用方式】
 * const collection = new MockMongoCollection('users', initialData, {
 *   async: true,
 *   asyncConfig: { minDelay: 2, maxDelay: 8, delayMode: 'random' },
 * });
 *
 * // 直接 await
 * const user = await collection.findOne({ id: 1 });
 */
export interface MongoAsyncConfig {
  /** 是否启用异步模式（默认 false，保持向后兼容） */
  async?: boolean;
  /** 异步延迟配置（仅 async=true 时生效） */
  asyncConfig?: AsyncDelayConfig;
}

/**
 * 异步类型工具
 * 将对象的所有方法包装为返回 Promise 的版本
 *
 * @example
 * type SyncCollection = { findOne(query: any): User | null; count(): number };
 * type AsyncCollection = AsyncVersion<SyncCollection>;
 * // AsyncCollection = { findOne(query: any): Promise<User | null>; count(): Promise<number> };
 */
export type AsyncVersion<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : T[K];
};

/**
 * 异步操作统计
 *
 * 【说明】
 * 记录异步模式下的方法调用统计，便于性能分析和调试。
 * 与 Redis 的 AsyncCacheStats 保持一致。
 */
export interface AsyncMongoStats {
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
