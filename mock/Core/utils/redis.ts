/**
 * Redis 通用工具函数
 *
 * 【功能分组】
 * - scanAllKeys: 使用 SCAN 迭代获取所有匹配的键（替代 KEYS，避免阻塞）
 * - scanAllKeysByPrefixes: 批量获取多个前缀的所有键
 *
 * 【设计说明】
 * 使用 SCAN 而非 KEYS，因为 KEYS 会一次性返回所有匹配的键，
 * 数据量大时会阻塞 Redis 主线程；SCAN 基于游标增量迭代，每次返回一小批。
 */

import { redis, type MockRedis } from '../redis';

/**
 * 使用 SCAN 迭代获取所有匹配的键（替代 KEYS，避免大数据量时阻塞）
 *
 * 【与 KEYS 的区别】
 * - KEYS：一次性返回所有匹配的键，数据量大时会阻塞
 * - SCAN：基于游标的增量式迭代，每次返回一小批，不会阻塞
 *
 * 【使用场景】
 * - 需要获取所有匹配的键进行批量操作（如删除、重命名）
 * - 数据量可能很大，不适合使用 KEYS
 *
 * @param pattern 匹配模式（支持 * ? [abc] 通配符）
 * @param count 每次迭代的数量提示，默认 100
 * @returns 所有匹配的键列表
 */
export async function scanAllKeys(
  pattern: string,
  count: number = 100,
): Promise<string[]> {
  const allKeys: string[] = [];
  let cursor = 0;

  do {
    const result = redis.scan(cursor, { match: pattern, count });
    allKeys.push(...result.elements);
    cursor = result.cursor;
  } while (cursor !== 0);

  return allKeys;
}

/**
 * 批量获取多个前缀的所有键（使用 SCAN 替代 Pipeline.keys）
 *
 * 【功能】
 * 对每个前缀模式调用 scanAllKeys，使用 Promise.all 并行执行，然后聚合所有结果
 *
 * @param prefixes 前缀模式列表
 * @returns 所有匹配的键列表
 */
export async function scanAllKeysByPrefixes(
  prefixes: string[],
): Promise<string[]> {
  const results = await Promise.all(
    prefixes.map((prefix) => scanAllKeys(`${prefix}*`)),
  );
  return results.flat();
}

/**
 * 失效缓存实例的所有键
 *
 * 【功能】
 * 遍历缓存实例的所有键并逐个删除，用于批量失效缓存（如用户数据变更时失效所有列表缓存）
 *
 * 【说明】
 * - cache.keys('*') 返回去掉前缀的键名
 * - cache.del(key) 会自动加上前缀
 * - 适用于 createCache 创建的带命名空间的缓存实例
 * - 同步版本，适用于 mock 环境内存操作
 *
 * @param cache 缓存实例（由 createCache 创建）
 */
export function invalidateCacheAll(cache: MockRedis): void {
  cache.keys('*').forEach((key) => cache.del(key));
}

/**
 * 使用 SCAN 失效缓存实例的所有键（异步版本，适用于大数据量场景）
 *
 * 【功能】
 * 使用 SCAN 迭代获取所有匹配前缀的键，然后通过 Pipeline 批量删除
 *
 * 【与 invalidateCacheAll 的区别】
 * - invalidateCacheAll：同步，使用 cache.keys 内存遍历，适用于 mock 环境
 * - invalidateCacheAllByScan：异步，使用 Redis SCAN + Pipeline，适用于真实 Redis 大数据量场景
 *
 * 【注意】
 * - 需手动传入前缀，因为 cache 实例的前缀不对外暴露
 * - 使用底层 redis.pipeline().del()，避免 cache.del 重复加前缀
 *
 * @param cache 缓存实例（由 createCache 创建）
 * @param prefix 缓存前缀（如 'user:list:'）
 */
export async function invalidateCacheAllByScan(
  cache: MockRedis,
  prefix: string,
): Promise<void> {
  const keys = await scanAllKeysByPrefixes([prefix]);
  if (keys.length === 0) return;

  const pipeline = redis.pipeline();
  keys.forEach((key) => pipeline.del(key));
  await pipeline.execAsync();
}
