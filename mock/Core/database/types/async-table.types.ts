/**
 * 异步表类型定义
 *
 * 【说明】
 * 为 MockTable 提供异步模式支持的类型定义。
 * 包括延迟配置、统计信息、异步版本工具类型等。
 *
 * 【使用方式】
 * const userTable = new MockTable<MockUser>({
 *   name: 'users',
 *   initialData: users,
 *   async: true,  // 启用异步模式
 *   asyncConfig: { minDelay: 5, maxDelay: 20, delayMode: 'random' },
 * });
 *
 * // 所有方法自动返回 Promise
 * const user = await userTable.findById(1);
 */

/**
 * 异步延迟配置
 */
export interface AsyncDelayConfig {
  /** 是否启用延迟模拟（默认 true） */
  delayEnabled?: boolean;
  /** 最小延迟（毫秒，默认 1） */
  minDelay?: number;
  /** 最大延迟（毫秒，默认 5） */
  maxDelay?: number;
  /** 延迟模式（默认 random） */
  delayMode?: 'fixed' | 'random' | 'normal';
}

/**
 * 已解析的异步延迟配置（所有字段都有值）
 */
export interface ResolvedAsyncDelayConfig {
  /** 是否启用延迟模拟 */
  delayEnabled: boolean;
  /** 最小延迟（毫秒） */
  minDelay: number;
  /** 最大延迟（毫秒） */
  maxDelay: number;
  /** 延迟模式 */
  delayMode: 'fixed' | 'random' | 'normal';
}

/**
 * 异步表统计信息
 */
export interface AsyncTableStats {
  /** 总调用次数 */
  totalCalls: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 总延迟时间（毫秒） */
  totalDelay: number;
  /** 平均延迟（毫秒） */
  avgDelay: number;
  /** 最大延迟（毫秒） */
  maxDelay: number;
  /** 最小延迟（毫秒） */
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

/**
 * 将对象的所有方法转为异步版本
 *
 * 【使用方式】
 * type AsyncMockTable = AsyncVersion<MockTable<User>>;
 * const asyncTable = createTable({ ..., async: true }) as AsyncVersion<MockTable<User>>;
 *
 * @template T 原始对象类型
 */
export type AsyncVersion<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : T[K];
};
