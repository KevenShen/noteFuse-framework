/**
 * MockRedis 主类
 * 通过 Mixin 组合模式扩展功能
 *
 * 【架构说明】
 * - MockRedisBase: 核心属性 + 构造函数 + 私有工具方法（调试日志/淘汰策略/缓存项管理/命令计时）
 * - 21 个 Mixin: 按功能分组的细粒度功能模块
 * - 嵌套函数调用: 运行时组合所有 Mixin 到基类
 *
 * 【Mixin 组合顺序（从内到外，L1→L6）】
 * L1 数据结构 (01-06): WithString → WithCounter → WithHash → WithList → WithSet → WithSortedSet
 * L2 键管理 (07-08): WithKey → WithBatch
 * L3 事务控制 (09-11): WithAdvanced → WithTransaction → WithPipeline
 * L4 消息/扩展 (12-14): WithPubsub → WithBitmap → WithGeo
 * L5 高可用 (15-17): WithPersistence → WithReplication → WithNotification
 * L6 监控运维 (18-21): WithSlowlog → WithCommandStats → WithInfo → WithUtility
 *
 * 【类型推断说明】
 * TypeScript 对深层 Mixin 组合的类型推断有限制，
 * 因此使用非泛型构造函数类型断言，运行时实际包含所有 21 个 Mixin 的方法。
 */
import type { CacheConfig } from './types';
import { MockRedisBase } from './MockRedisBase';
import type { MixinConstructor } from './mixins';
import {
  WithAdvanced,
  WithBatch,
  WithBitmap,
  WithBloomFilter,
  WithCommandStats,
  WithCounter,
  WithGeo,
  WithHash,
  WithInfo,
  WithKey,
  WithList,
  WithLuaScript,
  WithNotification,
  WithPersistence,
  WithPipeline,
  WithPubsub,
  WithReplication,
  WithSet,
  WithSlowlog,
  WithSortedSet,
  WithString,
  WithTransaction,
  WithUtility,
} from './mixins';

/**
 * 组合所有 Mixin 后的基类
 * 运行时实际包含所有 21 个 Mixin 的方法
 *
 * 组合顺序（从内到外）：
 * 最内层: MockRedisBase（核心属性+构造函数+私有工具方法）
 * L1: String → Counter → Hash → List → Set → SortedSet
 * L2: Key → Batch
 * L3: Advanced → Transaction → Pipeline
 * L4: Pubsub → Bitmap → Geo
 * L5: Persistence → Replication → Notification
 * 最外层: Slowlog → CommandStats → Info → Utility
 */
const ComposedMockRedis = WithLuaScript(
  WithBloomFilter(
    WithUtility(
      WithInfo(
        WithCommandStats(
          WithSlowlog(
            WithNotification(
              WithReplication(
                WithPersistence(
                  WithGeo(
                    WithBitmap(
                      WithPubsub(
                        WithPipeline(
                          WithTransaction(
                            WithAdvanced(
                              WithBatch(
                                WithKey(
                                  WithSortedSet(
                                    WithSet(
                                      WithList(
                                        WithHash(
                                          WithCounter(WithString(MockRedisBase as unknown as MixinConstructor)),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  ),
) as any;

/**
 * 组合后的基类构造函数类型
 * 由于深层 Mixin 组合的类型推断有限制，
 * 因此定义一个非泛型的构造函数类型用于断言
 */
type ComposedMockRedisClass = new (...args: any[]) => any;

/**
 * MockRedis 接口类型声明
 * 
 * 【设计说明】
 * 由于 MockRedis 类通过 Mixin 组合模式构建，继承自 any 类型的基类，
 * TypeScript 无法自动推断其方法类型。
 * 
 * 使用 TypeScript 声明合并（declaration merging）特性：
 * - interface MockRedis 与 class MockRedis 自动合并
 * - 为所有公共方法提供完整的类型声明
 * - 支持泛型参数（如 get<T>、getOrSet<T>）
 */
export interface MockRedis {
  // ==================== 字符串操作 ====================
  set<T = any>(key: string, value: T, ttl?: number): void;
  get<T = any>(key: string): T | null;
  getDel<T = any>(key: string): T | null;
  setIfNotExists<T = any>(key: string, value: T, ttl?: number): boolean;
  setIfExists<T = any>(key: string, value: T, ttl?: number): boolean;

  // ==================== 计数器操作 ====================
  incr(key: string): number;
  incrBy(key: string, increment: number): number;
  decr(key: string): number;
  decrBy(key: string, decrement: number): number;

  // ==================== 哈希操作 ====================
  /** 设置哈希字段（支持单字段和多字段对象两种方式） */
  hset(key: string, field: string | Record<string, any>, value?: any): number;
  hget(key: string, field: string): any | null;
  hgetAll(key: string): Record<string, any> | null;
  hdel(key: string, field: string): number;
  hexists(key: string, field: string): boolean;
  hlen(key: string): number;
  hkeys(key: string): string[];
  hvals(key: string): any[];

  // ==================== 列表操作 ====================
  lpush(key: string, ...values: any[]): number;
  rpush(key: string, ...values: any[]): number;
  lpop(key: string): any | null;
  rpop(key: string): any | null;
  lrange(key: string, start: number, stop: number): any[];
  llen(key: string): number;
  lindex(key: string, index: number): any | null;
  lset(key: string, index: number, value: any): boolean;
  lrem(key: string, count: number, value: any): number;
  ltrim(key: string, start: number, stop: number): boolean;

  // ==================== 集合操作 ====================
  sadd(key: string, ...members: any[]): number;
  srem(key: string, ...members: any[]): number;
  smembers(key: string): any[];
  sismember(key: string, member: any): boolean;
  scard(key: string): number;
  sunion(...keys: string[]): any[];
  sinter(...keys: string[]): any[];
  sdiff(...keys: string[]): any[];
  srandmember(key: string, count?: number): any | any[];
  spop(key: string, count?: number): any | any[];

  // ==================== 有序集合操作 ====================
  zadd(key: string, ...members: Array<{ score: number; member: any }>): number;
  zrem(key: string, ...members: any[]): number;
  zrange(key: string, start: number, stop: number, withScores?: boolean): any[];
  zrevrange(key: string, start: number, stop: number, withScores?: boolean): any[];
  zrangebyscore(
    key: string,
    min: number,
    max: number,
    options?: { withScores?: boolean; limit?: { offset: number; count: number } }
  ): any[];
  zscore(key: string, member: any): number | null;
  zrank(key: string, member: any): number | null;
  zrevrank(key: string, member: any): number | null;
  zincrby(key: string, increment: number, member: any): number;
  zcard(key: string): number;
  zcount(key: string, min: number, max: number): number;
  zremrangebyrank(key: string, start: number, stop: number): number;
  zremrangebyscore(key: string, min: number, max: number): number;

  // ==================== 键操作 ====================
  del(key: string): boolean;
  exists(key: string): boolean;
  expire(key: string, ttl: number): boolean;
  expireAt(key: string, timestamp: number): boolean;
  persist(key: string): boolean;
  ttl(key: string): number;
  rename(oldKey: string, newKey: string): boolean;
  type(key: string): string;

  // ==================== 批量操作 ====================
  mset(items: Array<{ key: string; value: any; ttl?: number }>): void;
  mget<T = any>(keys: string[]): Array<T | null>;
  mdel(keys: string[]): number;
  hmset(key: string, fields: Record<string, any>): void;
  hmget(key: string, fields: string[]): any[];

  // ==================== 高级操作 ====================
  getOrSet<T = any>(
    key: string,
    callback: () => Promise<T | null>,
    ttl?: number,
  ): Promise<T | null>;
  getOrSetWithLock<T = any>(
    key: string,
    callback: () => Promise<T | null>,
    ttl?: number,
    lockTimeout?: number,
  ): Promise<T | null>;

  // ==================== 事务 ====================
  multi(): void;
  exec(): any[];
  discard(): void;
  watch(...keys: string[]): void;
  unwatch(): void;
  isInTransaction(): boolean;

  // ==================== 管道 ====================
  pipeline(): import('./RedisPipeline').RedisPipeline;

  // ==================== 发布订阅 ====================
  publish(channel: string, message: any): number;
  subscribe(channel: string, callback: import('./types').SubscribeCallback): () => void;
  unsubscribe(channel: string, callback?: import('./types').SubscribeCallback): void;
  psubscribe(pattern: string, callback: import('./types').PatternSubscribeCallback): () => void;
  punsubscribe(pattern: string, callback?: import('./types').PatternSubscribeCallback): void;
  pubsubChannels(pattern?: string): string[];
  pubsubNumSub(channel: string): number;
  pubsubNumPat(): number;

  // ==================== 位图 ====================
  setbit(key: string, offset: number, value: 0 | 1): 0 | 1;
  getbit(key: string, offset: number): 0 | 1;
  bitcount(key: string, start?: number, end?: number): number;
  bitop(operation: 'AND' | 'OR' | 'XOR' | 'NOT', destKey: string, ...srcKeys: string[]): number;
  bitpos(key: string, bit: 0 | 1, start?: number, end?: number): number;

  // ==================== 地理空间 ====================
  geoadd(key: string, ...locations: Array<{ longitude: number; latitude: number; member: string }>): number;
  geopos(key: string, ...members: string[]): Array<{ longitude: number; latitude: number } | null>;
  geodist(key: string, member1: string, member2: string, unit?: 'm' | 'km' | 'mi' | 'ft'): number | null;
  geohash(key: string, ...members: string[]): string[];
  georadius(
    key: string,
    longitude: number,
    latitude: number,
    radius: number,
    unit?: 'm' | 'km' | 'mi' | 'ft',
    options?: {
      withCoord?: boolean;
      withDist?: boolean;
      withHash?: boolean;
      count?: number;
      sort?: 'ASC' | 'DESC';
    }
  ): import('./types').GeoRadiusResult[];

  // ==================== 持久化 ====================
  save(): number;
  bgsave(): number;
  lastsave(): number;
  restoreFromRDB(snapshotIndex?: number): boolean;
  getRDBSnapshots(): Array<{ timestamp: number; size: number; keyCount: number }>;
  setAOFEnabled(enabled: boolean): void;
  bgrewriteaof(): boolean;
  getAOFLog(): import('./types').AOFEntry[];
  restoreFromAOF(): boolean;

  // ==================== 主从复制 ====================
  slaveof(master: MockRedis, address?: string): void;
  slaveofNoOne(): void;
  role(): { role: import('./types').ReplicationRole; connectedSlaves: number; masterHost?: string };
  syncFromMaster(): boolean;
  addSlave(id: string, address: string): void;
  removeSlave(id: string): boolean;
  getSlaves(): import('./types').SlaveInfo[];
  getReplicationOffset(): number;

  // ==================== 键空间通知 ====================
  configSetNotifyKeyspaceEvents(flags: string): void;
  subscribeKeyspaceNotifications(callback: import('./types').KeyspaceNotificationCallback): () => void;

  // ==================== 慢查询日志 ====================
  slowlogGet(count?: number): import('./types').SlowlogEntry[];
  slowlogLen(): number;
  slowlogReset(): void;

  // ==================== 命令统计 ====================
  getCommandStats(): Array<{ command: string; calls: number; totalTime: number; avgTime: number }>;
  resetCommandStats(): void;

  // ==================== 监控统计 ====================
  info(section?: string): Record<string, any>;
  getMemoryUsage(): number;
  getBigKeys(topN?: number): Array<{ key: string; size: number; type: string }>;
  configGet(parameter: string): Record<string, string>;
  configSet(parameter: string, value: string): boolean;
  resetStats(): void;

  // ==================== 工具方法 ====================
  flushAll(): void;
  flushExpired(): number;
  size(): number;
  keys(pattern?: string): string[];
  randomKey(): string | null;

  /**
   * SCAN - 迭代当前数据库中的键集合（基于游标的增量式迭代）
   *
   * 【与 KEYS 的区别】
   * - KEYS：一次性返回所有匹配的键，数据量大时会阻塞
   * - SCAN：基于游标的增量式迭代，每次返回一小批，不会阻塞
   *
   * 【使用方式】
   * let cursor = 0;
   * do {
   *   const result = redis.scan(cursor, { match: 'user:*', count: 10 });
   *   console.log(result.elements);
   *   cursor = result.cursor;
   * } while (cursor !== 0);
   *
   * @param cursor 游标（0 表示开始新的迭代）
   * @param options 选项（match 匹配模式 / count 每次返回数量 / type 按类型过滤）
   * @returns 下一个游标和当前批次的键列表
   */
  scan(
    cursor: number,
    options?: {
      match?: string;
      count?: number;
      type?: 'string' | 'hash' | 'list' | 'set' | 'zset';
    },
  ): { cursor: number; elements: string[] };

  /**
   * HSCAN - 迭代哈希表中的键值对
   *
   * 【返回格式】
   * elements 是扁平数组：[field1, value1, field2, value2, ...]
   * 与 Redis 原生 HSCAN 返回格式一致
   *
   * @param key 哈希键
   * @param cursor 游标（0 表示开始新的迭代）
   * @param options 选项（match 匹配字段名 / count 每次返回数量）
   * @returns 下一个游标和当前批次的字段值对（扁平数组）
   */
  hscan(
    key: string,
    cursor: number,
    options?: { match?: string; count?: number },
  ): { cursor: number; elements: any[] };

  /**
   * SSCAN - 迭代集合中的元素
   *
   * @param key 集合键
   * @param cursor 游标（0 表示开始新的迭代）
   * @param options 选项（match 匹配成员 / count 每次返回数量）
   * @returns 下一个游标和当前批次的成员列表
   */
  sscan(
    key: string,
    cursor: number,
    options?: { match?: string; count?: number },
  ): { cursor: number; elements: any[] };

  /**
   * ZSCAN - 迭代有序集合中的元素和分数
   *
   * 【返回格式】
   * elements 是扁平数组：[member1, score1, member2, score2, ...]
   * 与 Redis 原生 ZSCAN 返回格式一致
   *
   * @param key 有序集合键
   * @param cursor 游标（0 表示开始新的迭代）
   * @param options 选项（match 匹配成员 / count 每次返回数量）
   * @returns 下一个游标和当前批次的成员分数对（扁平数组）
   */
  zscan(
    key: string,
    cursor: number,
    options?: { match?: string; count?: number },
  ): { cursor: number; elements: any[] };

  stats(): {
    totalKeys: number;
    expiredKeys: number;
    memoryUsage: string;
    hitRate: number;
  };
  export(): Array<{ key: string; value: any; expireAt: number | null }>;
  import(data: Array<{ key: string; value: any; expireAt: number | null }>): void;

  // ==================== Lua 脚本 ====================
  eval(
    script: string | import('./types').RedisScript,
    numKeys: number,
    keys: string[],
    argv?: any[],
  ): any;
  evalSha(
    sha1: string,
    numKeys: number,
    keys: string[],
    argv?: any[],
  ): any;
  scriptLoad(script: string | import('./types').RedisScript): string;
  scriptExists(...sha1s: string[]): boolean[];
  scriptFlush(): void;
  scriptKill(): boolean;
  listScripts(): import('./types').ScriptInfo[];
  getScriptInfo(sha1: string): import('./types').ScriptInfo | null;
  registerScript(config: import('./types').NamedScriptConfig): void;
  runScript(name: string, keys?: string[], argv?: any[]): any;
  listNamedScripts(): import('./types').NamedScriptConfig[];
  getNamedScript(name: string): import('./types').NamedScriptConfig | null;
  unregisterScript(name: string): boolean;
  hasNamedScript(name: string): boolean;
  getScriptStats(): import('./types').ScriptStats;
  getSupportedCommands(): string[];
  isCommandSupported(command: string): boolean;

  // ==================== 布隆过滤器 ====================
  /**
   * 创建布隆过滤器
   * @param key 键名
   * @param errorRate 期望误判率（如 0.01 表示 1%）
   * @param capacity 期望容量
   */
  bfReserve(key: string, errorRate: number, capacity: number): boolean;
  /**
   * 添加元素到布隆过滤器
   * @param key 键名
   * @param item 元素
   * @returns true
   */
  bfAdd(key: string, item: string): boolean;
  /**
   * 检查元素是否存在于布隆过滤器
   * @param key 键名
   * @param item 元素
   * @returns true=可能存在，false=一定不存在
   */
  bfExists(key: string, item: string): boolean;
  /**
   * 批量添加元素到布隆过滤器
   * @param key 键名
   * @param items 元素数组
   * @returns 结果数组
   */
  bfMAdd(key: string, items: string[]): boolean[];
  /**
   * 批量检查元素是否存在于布隆过滤器
   * @param key 键名
   * @param items 元素数组
   * @returns 结果数组（true=可能存在，false=一定不存在）
   */
  bfMExists(key: string, items: string[]): boolean[];
  /**
   * 获取布隆过滤器信息
   * @param key 键名
   * @returns 布隆过滤器信息
   */
  bfInfo(key: string): {
    capacity: number;
    size: number;
    hashCount: number;
    count: number;
    errorRate: number;
    memoryUsage: string;
  };
}

/**
 * 模拟 Redis 缓存
 * 支持 TTL 过期、LRU 淘汰、缓存穿透/击穿防护
 * 支持字符串、计数器、哈希、列表、集合、有序集合等常用 Redis 数据结构
 * 支持事务、管道、发布订阅、位图、地理空间、持久化、主从复制等高级功能
 *
 * 使用方式：
 * const redis = new MockRedis({ defaultTTL: 5 * 60 * 1000 });
 * redis.set('key', 'value');
 * const value = redis.get('key');
 */
export class MockRedis extends (ComposedMockRedis as ComposedMockRedisClass) {
  constructor(config?: CacheConfig) {
    super(config);
  }
}
