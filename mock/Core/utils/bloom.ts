/**
 * 布隆过滤器工具函数
 *
 * 【功能】通用布隆过滤器操作，支持两种使用方式：
 * 1. 通用函数：bloomMayExist(key, value) / bloomAdd(key, value) 等
 * 2. 实例方式：createBloomFilter(config) 创建实例，调用实例方法
 *
 * 【说明】
 * 布隆过滤器用于快速判断"值是否一定不存在"，减少数据库查询。
 * - false：一定不存在（100% 准确，可直接通过）
 * - true：可能存在（需要查数据库确认，有误判率）
 *
 * 【实例使用方式】
 * ```typescript
 * const usernameBloom = createBloomFilter({ key: 'user:bloom:username', capacity: 100000, errorRate: 0.01 });
 * usernameBloom.mayExist('admin');  // 检查
 * usernameBloom.add('newuser');     // 添加
 * usernameBloom.batchAdd([...]);    // 批量添加
 * ```
 */

import { redis } from '../redis';

// ============================================================================
// 类型定义
// ============================================================================

/** 布隆过滤器配置 */
export interface BloomFilterConfig {
  /** Redis Key */
  key: string;
  /** 预估容量 */
  capacity: number;
  /** 期望误判率（0-1） */
  errorRate: number;
}

/** 布隆过滤器实例 */
export interface BloomFilter {
  /** Redis Key */
  readonly key: string;
  /** 预估容量 */
  readonly capacity: number;
  /** 期望误判率 */
  readonly errorRate: number;
  /** 检查值是否可能存在 */
  mayExist(value: string): boolean;
  /** 添加单个值 */
  add(value: string): void;
  /** 批量添加值 */
  batchAdd(values: string[]): void;
  /** 获取过滤器信息 */
  info(): ReturnType<typeof redis.bfInfo>;
  /** 预留（创建）过滤器 */
  reserve(): void;
}

// ============================================================================
// 实例工厂
// ============================================================================

/**
 * 创建布隆过滤器实例
 *
 * @param config 配置（key、capacity、errorRate）
 * @returns 布隆过滤器实例
 *
 * @example
 * ```typescript
 * const usernameBloom = createBloomFilter({
 *   key: 'user:bloom:username',
 *   capacity: 100000,
 *   errorRate: 0.01,
 * });
 *
 * if (usernameBloom.mayExist('admin')) {
 *   // 可能存在，查数据库确认
 * }
 * usernameBloom.add('newuser');
 * ```
 */
export function createBloomFilter(config: BloomFilterConfig): BloomFilter {
  const { key, capacity, errorRate } = config;

  return {
    key,
    capacity,
    errorRate,
    mayExist: (value) => bloomMayExist(key, value),
    add: (value) => bloomAdd(key, value),
    batchAdd: (values) => bloomBatchAdd(key, values),
    info: () => bloomInfo(key),
    reserve: () => bloomReserve(key, errorRate, capacity),
  };
}

// ============================================================================
// 通用布隆过滤器操作（接受 Key 参数）
// ============================================================================

/**
 * 检查值是否可能存在于布隆过滤器中
 *
 * @param key 布隆过滤器 Key
 * @param value 待检查的值
 * @returns false=一定不存在，true=可能存在
 */
export function bloomMayExist(key: string, value: string): boolean {
  return redis.bfExists(key, value);
}

/**
 * 添加单个值到布隆过滤器
 *
 * @param key 布隆过滤器 Key
 * @param value 待添加的值
 */
export function bloomAdd(key: string, value: string): void {
  redis.bfAdd(key, value);
}

/**
 * 批量添加值到布隆过滤器
 *
 * @param key 布隆过滤器 Key
 * @param values 待添加的值数组
 */
export function bloomBatchAdd(key: string, values: string[]): void {
  if (values.length > 0) {
    redis.bfMAdd(key, values);
  }
}

/**
 * 获取布隆过滤器信息（用于调试和监控）
 *
 * @param key 布隆过滤器 Key
 * @returns 过滤器信息
 */
export function bloomInfo(key: string): ReturnType<typeof redis.bfInfo> {
  return redis.bfInfo(key);
}

/**
 * 预留（创建）布隆过滤器
 *
 * @param key 布隆过滤器 Key
 * @param errorRate 期望误判率
 * @param capacity 容量
 */
export function bloomReserve(
  key: string,
  errorRate: number,
  capacity: number,
): void {
  redis.bfReserve(key, errorRate, capacity);
}
