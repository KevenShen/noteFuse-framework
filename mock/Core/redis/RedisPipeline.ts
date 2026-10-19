/**
 * Redis 管道（Pipeline）
 * 批量执行命令，减少网络开销
 *
 * 【支持模式】
 * - 同步模式：execute() / exec()，直接返回结果数组
 * - 异步模式：execAsync()，返回 Promise<结果数组>，自动 await 异步命令
 *
 * 【自动适配】
 * - 如果 redis 实例是异步模式（createCache({ async: true })），
 *   execAsync() 会自动 await 每个命令的 Promise 返回值
 * - 如果 redis 实例是同步模式，execAsync() 也能正常工作（直接返回结果）
 *
 * 使用方式：
 * ```typescript
 * // 同步模式
 * const pipeline = redis.pipeline();
 * pipeline.set('key1', 'value1');
 * pipeline.get('key1');
 * const results = pipeline.execute();  // [undefined, 'value1']
 *
 * // 异步模式
 * const pipeline = redis.pipeline();
 * pipeline.set('key1', 'value1');
 * pipeline.get('key1');
 * const results = await pipeline.execAsync();  // Promise<[undefined, 'value1']>
 * ```
 */
import type { MockRedis } from './MockRedis';
import type { ResolvedAsyncDelayConfig } from './types/async-cache.types';
import { simulateDelay } from './utils/async-cache.utils';

export class RedisPipeline {
  private redis: MockRedis;
  private commands: Array<{ command: string; args: any[] }> = [];

  constructor(redis: MockRedis) {
    this.redis = redis;
  }

  // ==================== 命令入队方法（链式调用，返回 this）====================

  /** 字符串操作 */
  set(key: string, value: any, ttl?: number): this {
    this.commands.push({ command: 'set', args: [key, value, ttl] });
    return this;
  }

  get(key: string): this {
    this.commands.push({ command: 'get', args: [key] });
    return this;
  }

  getDel(key: string): this {
    this.commands.push({ command: 'getDel', args: [key] });
    return this;
  }

  setIfNotExists(key: string, value: any, ttl?: number): this {
    this.commands.push({ command: 'setIfNotExists', args: [key, value, ttl] });
    return this;
  }

  setIfExists(key: string, value: any, ttl?: number): this {
    this.commands.push({ command: 'setIfExists', args: [key, value, ttl] });
    return this;
  }

  del(key: string): this {
    this.commands.push({ command: 'del', args: [key] });
    return this;
  }

  exists(key: string): this {
    this.commands.push({ command: 'exists', args: [key] });
    return this;
  }

  expire(key: string, ttl: number): this {
    this.commands.push({ command: 'expire', args: [key, ttl] });
    return this;
  }

  ttl(key: string): this {
    this.commands.push({ command: 'ttl', args: [key] });
    return this;
  }

  type(key: string): this {
    this.commands.push({ command: 'type', args: [key] });
    return this;
  }

  /** 计数器操作 */
  incr(key: string): this {
    this.commands.push({ command: 'incr', args: [key] });
    return this;
  }

  incrBy(key: string, increment: number): this {
    this.commands.push({ command: 'incrBy', args: [key, increment] });
    return this;
  }

  decr(key: string): this {
    this.commands.push({ command: 'decr', args: [key] });
    return this;
  }

  decrBy(key: string, decrement: number): this {
    this.commands.push({ command: 'decrBy', args: [key, decrement] });
    return this;
  }

  /** 哈希操作 */
  /** 设置哈希字段（支持单字段和多字段对象两种方式） */
  hset(key: string, field: string | Record<string, any>, value?: any): this {
    this.commands.push({ command: 'hset', args: [key, field, value] });
    return this;
  }

  hget(key: string, field: string): this {
    this.commands.push({ command: 'hget', args: [key, field] });
    return this;
  }

  hgetAll(key: string): this {
    this.commands.push({ command: 'hgetAll', args: [key] });
    return this;
  }

  hdel(key: string, field: string): this {
    this.commands.push({ command: 'hdel', args: [key, field] });
    return this;
  }

  hexists(key: string, field: string): this {
    this.commands.push({ command: 'hexists', args: [key, field] });
    return this;
  }

  hlen(key: string): this {
    this.commands.push({ command: 'hlen', args: [key] });
    return this;
  }

  hkeys(key: string): this {
    this.commands.push({ command: 'hkeys', args: [key] });
    return this;
  }

  hvals(key: string): this {
    this.commands.push({ command: 'hvals', args: [key] });
    return this;
  }

  hmset(key: string, fields: Record<string, any>): this {
    this.commands.push({ command: 'hmset', args: [key, fields] });
    return this;
  }

  hmget(key: string, fields: string[]): this {
    this.commands.push({ command: 'hmget', args: [key, fields] });
    return this;
  }

  /**
   * 哈希字段自增（HINCRBY）
   * @param key 键名
   * @param field 字段名
   * @param increment 增量（可以为负数）
   */
  hincrby(key: string, field: string, increment: number): this {
    this.commands.push({ command: 'hincrby', args: [key, field, increment] });
    return this;
  }

  /** 列表操作 */
  lpush(key: string, ...values: any[]): this {
    this.commands.push({ command: 'lpush', args: [key, ...values] });
    return this;
  }

  rpush(key: string, ...values: any[]): this {
    this.commands.push({ command: 'rpush', args: [key, ...values] });
    return this;
  }

  lpop(key: string): this {
    this.commands.push({ command: 'lpop', args: [key] });
    return this;
  }

  rpop(key: string): this {
    this.commands.push({ command: 'rpop', args: [key] });
    return this;
  }

  lrange(key: string, start: number, stop: number): this {
    this.commands.push({ command: 'lrange', args: [key, start, stop] });
    return this;
  }

  llen(key: string): this {
    this.commands.push({ command: 'llen', args: [key] });
    return this;
  }

  lindex(key: string, index: number): this {
    this.commands.push({ command: 'lindex', args: [key, index] });
    return this;
  }

  lset(key: string, index: number, value: any): this {
    this.commands.push({ command: 'lset', args: [key, index, value] });
    return this;
  }

  lrem(key: string, count: number, value: any): this {
    this.commands.push({ command: 'lrem', args: [key, count, value] });
    return this;
  }

  ltrim(key: string, start: number, stop: number): this {
    this.commands.push({ command: 'ltrim', args: [key, start, stop] });
    return this;
  }

  /**
   * 在列表的指定元素之前或之后插入元素
   * @param key 键名
   * @param direction 插入方向：'BEFORE'（之前）或 'AFTER'（之后）
   * @param pivot 参考元素
   * @param value 要插入的元素
   */
  linsert(
    key: string,
    direction: 'BEFORE' | 'AFTER',
    pivot: any,
    value: any,
  ): this {
    this.commands.push({ command: 'linsert', args: [key, direction, pivot, value] });
    return this;
  }

  /** 集合操作 */
  sadd(key: string, ...members: any[]): this {
    this.commands.push({ command: 'sadd', args: [key, ...members] });
    return this;
  }

  srem(key: string, ...members: any[]): this {
    this.commands.push({ command: 'srem', args: [key, ...members] });
    return this;
  }

  smembers(key: string): this {
    this.commands.push({ command: 'smembers', args: [key] });
    return this;
  }

  sismember(key: string, member: any): this {
    this.commands.push({ command: 'sismember', args: [key, member] });
    return this;
  }

  scard(key: string): this {
    this.commands.push({ command: 'scard', args: [key] });
    return this;
  }

  /** 有序集合操作 */
  zadd(key: string, ...members: Array<{ score: number; member: any }>): this {
    this.commands.push({ command: 'zadd', args: [key, ...members] });
    return this;
  }

  zrem(key: string, ...members: any[]): this {
    this.commands.push({ command: 'zrem', args: [key, ...members] });
    return this;
  }

  zrange(key: string, start: number, stop: number, withScores?: boolean): this {
    this.commands.push({ command: 'zrange', args: [key, start, stop, withScores] });
    return this;
  }

  zrevrange(key: string, start: number, stop: number, withScores?: boolean): this {
    this.commands.push({ command: 'zrevrange', args: [key, start, stop, withScores] });
    return this;
  }

  zscore(key: string, member: any): this {
    this.commands.push({ command: 'zscore', args: [key, member] });
    return this;
  }

  zrank(key: string, member: any): this {
    this.commands.push({ command: 'zrank', args: [key, member] });
    return this;
  }

  zrevrank(key: string, member: any): this {
    this.commands.push({ command: 'zrevrank', args: [key, member] });
    return this;
  }

  zincrby(key: string, increment: number, member: any): this {
    this.commands.push({ command: 'zincrby', args: [key, increment, member] });
    return this;
  }

  zcard(key: string): this {
    this.commands.push({ command: 'zcard', args: [key] });
    return this;
  }

  zcount(key: string, min: number, max: number): this {
    this.commands.push({ command: 'zcount', args: [key, min, max] });
    return this;
  }

  /** 批量操作 */
  mset(items: Array<{ key: string; value: any; ttl?: number }>): this {
    this.commands.push({ command: 'mset', args: [items] });
    return this;
  }

  mget(keys: string[]): this {
    this.commands.push({ command: 'mget', args: [keys] });
    return this;
  }

  mdel(keys: string[]): this {
    this.commands.push({ command: 'mdel', args: [keys] });
    return this;
  }

  /** 全局操作 */
  keys(pattern?: string): this {
    this.commands.push({ command: 'keys', args: [pattern] });
    return this;
  }

  size(): this {
    this.commands.push({ command: 'size', args: [] });
    return this;
  }

  flushAll(): this {
    this.commands.push({ command: 'flushAll', args: [] });
    return this;
  }

  randomKey(): this {
    this.commands.push({ command: 'randomKey', args: [] });
    return this;
  }

  stats(): this {
    this.commands.push({ command: 'stats', args: [] });
    return this;
  }

  // ==================== 执行方法 ====================

  /**
   * 同步执行所有命令，返回结果数组
   * 【注意】如果 redis 实例是异步模式，命令返回 Promise，结果数组中会包含 Promise
   * 【推荐】异步模式下使用 execAsync()
   * @returns 结果数组（按命令入队顺序）
   */
  execute(): any[] {
    const startTime = Date.now();
    const results: any[] = [];

    for (const cmd of this.commands) {
      try {
        const result = this.executeDirect(cmd.command, cmd.args);
        results.push(result);
      } catch (error) {
        results.push(error);
      }
    }

    const duration = Date.now() - startTime;
    this.commands = [];

    return results;
  }

  /**
   * exec() 别名（与真实 Redis 客户端一致）
   * 同步执行所有命令
   */
  exec(): any[] {
    return this.execute();
  }

  /**
   * 异步执行所有命令，返回 Promise<结果数组>
   *
   * 【核心特性】
   * 1. 自动适配：检测每个命令返回值是否为 Promise，是则 await，否则直接返回
   * 2. 延迟模拟：如果 redis 实例配置了异步延迟，会模拟网络延迟
   * 3. 错误隔离：单个命令失败不影响其他命令，错误会放入结果数组
   * 4. 性能统计：记录执行时间和命令数量
   *
   * @param options 执行选项
   * @param options.delayConfig 自定义延迟配置（可选，默认使用 redis 实例的配置）
   * @param options.parallel 是否并行执行（默认 false，串行执行，与真实 Redis Pipeline 一致）
   * @returns Promise<结果数组>（按命令入队顺序）
   *
   * @example
   * ```typescript
   * const pipeline = redis.pipeline();
   * pipeline.set('key1', 'value1');
   * pipeline.get('key1');
   * pipeline.incr('counter');
   *
   * // 异步执行
   * const results = await pipeline.execAsync();
   * console.log(results);  // [undefined, 'value1', 1]
   *
   * // 并行执行（更快，但不保证顺序）
   * const results2 = await pipeline.execAsync({ parallel: true });
   * ```
   */
  async execAsync(options?: {
    delayConfig?: ResolvedAsyncDelayConfig;
    parallel?: boolean;
  }): Promise<any[]> {
    const startTime = Date.now();
    const { delayConfig, parallel = false } = options || {};

    // 获取 redis 实例的异步配置（如果是 createCache 创建的异步缓存）
    const redisAsyncConfig = (this.redis as any)._asyncConfig as
      | ResolvedAsyncDelayConfig
      | undefined;
    const resolvedDelayConfig = delayConfig || redisAsyncConfig;

    // 模拟 Pipeline 整体延迟（一次网络往返）
    if (resolvedDelayConfig?.delayEnabled) {
      await simulateDelay(resolvedDelayConfig);
    }

    let results: any[];

    if (parallel) {
      // 并行执行（Promise.all）
      const promises = this.commands.map(async (cmd) => {
        try {
          const result = this.executeDirect(cmd.command, cmd.args);
          // 如果返回 Promise，await 它
          return result && typeof result.then === 'function' ? await result : result;
        } catch (error) {
          return error;
        }
      });
      results = await Promise.all(promises);
    } else {
      // 串行执行（与真实 Redis Pipeline 一致，保证顺序）
      results = [];
      for (const cmd of this.commands) {
        try {
          const result = this.executeDirect(cmd.command, cmd.args);
          // 如果返回 Promise，await 它
          const resolvedResult =
            result && typeof result.then === 'function' ? await result : result;
          results.push(resolvedResult);
        } catch (error) {
          results.push(error);
        }
      }
    }

    const duration = Date.now() - startTime;
    this.commands = [];

    return results;
  }

  /**
   * 直接执行命令（内部方法）
   * @param command 命令名
   * @param args 命令参数
   * @returns 命令执行结果（可能是 Promise）
   */
  private executeDirect(command: string, args: any[]): any {
    const redis = this.redis as any;
    const method = redis[command];
    if (typeof method === 'function') {
      return method.apply(redis, args);
    }
    throw new Error(`Unknown command: ${command}`);
  }

  // ==================== 工具方法 ====================

  /** 获取排队的命令数量 */
  length(): number {
    return this.commands.length;
  }

  /** 清空管道 */
  clear(): void {
    this.commands = [];
  }

  /**
   * 查看排队的命令（调试用）
   * @returns 命令列表
   */
  inspect(): Array<{ command: string; args: any[] }> {
    return [...this.commands];
  }
}
