/**
 * Mixin 基础设施类型定义
 * 用于将 MockRedis 按功能拆分为多个 mixin 类，然后组合成最终类
 */
import type { CacheItem, RequiredCacheConfig, SlowlogEntry, TransactionCommand, SubscribeCallback, PatternSubscribeCallback, KeyspaceNotificationCallback, ReplicationRole, SlaveInfo, RDBSnapshot, AOFEntry } from '../types';

/** 
 * Mixin 构造函数类型
 * 默认类型参数为 IMockRedisBase，这样所有 Mixin 类继承的 Base 类
 * 都自动拥有 IMockRedisBase 接口的所有核心属性和方法
 */
export type MixinConstructor<T = IMockRedisBase> = new (...args: any[]) => T;

/** MockRedis 基础接口（所有 mixin 都需要访问的核心属性和方法） */
export interface IMockRedisBase {
  // 核心属性
  cache: Map<string, CacheItem>;
  config: RequiredCacheConfig;

  // 慢查询
  slowlog: SlowlogEntry[];
  slowlogIdCounter: number;

  // 事务
  watchedKeys: Map<string, any>;
  transactionCommands: TransactionCommand[] | null;

  // 命令统计
  commandStats: Map<string, { calls: number; totalTime: number }>;

  // 发布订阅
  subscribers: Map<string, Set<SubscribeCallback>>;
  patternSubscribers: Map<string, Set<PatternSubscribeCallback>>;
  keyspaceSubscribers: Set<KeyspaceNotificationCallback>;

  // 主从复制
  _role: ReplicationRole;
  master: any | null;
  slaves: Map<string, SlaveInfo>;
  replicationOffset: number;

  // 持久化
  rdbSnapshots: RDBSnapshot[];
  aofLog: AOFEntry[];
  lastSaveTime: number;
  aofEnabled: boolean;
  rdbEnabled: boolean;

  // 键空间通知
  keyspaceNotifications: string;

  // 统计
  totalCommandsProcessed: number;
  totalConnections: number;
  uptime: number;

  // 核心方法
  debugLog(message: string, ...args: any[]): void;
  evictIfNeeded(): void;
  updateAccess(item: CacheItem): void;
  getCacheItem(key: string): CacheItem | null;
  createCacheItem<T>(value: T, ttl?: number): CacheItem<T>;
  recordCommand(command: string, args: any[], startTime: number): void;
  executeWithTiming<T>(command: string, args: any[], fn: () => T): T;

  // ==================== 跨 Mixin 调用的方法 ====================
  // 这些方法在其他 Mixin 中定义，但需要被多个 Mixin 调用

  // 持久化相关（15-persistence）
  recordAOF(command: string, args: any[]): void;
  createSnapshot(): RDBSnapshot;

  // 键空间通知相关（17-notification）
  isNotificationEnabled(flag: string): boolean;
  notifyKeyspace(event: string, key: string): void;

  // 主从复制相关（16-replication）
  replicateToSlaves(command: string, args: any[]): void;

  // 事务相关（10-transaction）
  executeCommand(command: string, args: any[]): any;

  // 地理空间相关（14-geo）
  calculateDistance(
    lon1: number, lat1: number,
    lon2: number, lat2: number,
    unit?: string
  ): number;
  encodeGeohash(longitude: number, latitude: number, precision?: number): string;

  // 高级操作相关（09-advanced）
  sleep(ms: number): Promise<void>;

  // 监控统计相关（20-info）
  getKeyspaceInfo(): Record<string, any>;
  formatBytes(bytes: number): string;

  // 有序集合内部方法（06-sorted-set）
  getZSet(key: string): Map<any, number> | null;
  saveZSet(key: string, zset: Map<any, number>, ttl?: number): void;

  // ==================== 跨 Mixin 调用的公共方法 ====================
  // 这些方法在其他 Mixin 中定义，但需要被多个 Mixin 调用

  // 字符串操作（01-string）
  set<T = any>(key: string, value: T, ttl?: number): void;
  get<T = any>(key: string): T | null;
  setIfNotExists<T = any>(key: string, value: T, ttl?: number): boolean;

  // 计数器操作（02-counter）
  incr(key: string): number;
  incrBy(key: string, increment: number): number;
  decr(key: string): number;
  decrBy(key: string, decrement: number): number;

  // 哈希操作（03-hash）
  hset(key: string, field: string, value: any): number;
  hget(key: string, field: string): any | null;
  hgetAll(key: string): Record<string, any> | null;
  hdel(key: string, field: string): number;
  hexists(key: string, field: string): boolean;
  hlen(key: string): number;
  hkeys(key: string): string[];
  hvals(key: string): any[];
  hincrby(key: string, field: string, increment: number): number;

  // 键操作（07-key）
  exists(key: string): boolean;
  del(key: string): boolean;
  type(key: string): string;
  ttl(key: string): number;
  expire(key: string, ttl: number): boolean;

  // 列表操作（04-list）
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
  linsert(
    key: string,
    direction: 'BEFORE' | 'AFTER',
    pivot: any,
    value: any,
  ): number;

  // 集合操作（05-set）
  sadd(key: string, ...members: any[]): number;
  srem(key: string, ...members: any[]): number;
  smembers(key: string): any[];

  // 有序集合操作（06-sorted-set）
  zadd(key: string, ...members: Array<{ score: number; member: any }>): number;
  zrange(key: string, start: number, stop: number, withScores?: boolean): any[];

  // 发布订阅（12-pubsub）
  unsubscribe(channel: string, callback?: SubscribeCallback): void;
  punsubscribe(pattern: string, callback?: PatternSubscribeCallback): void;

  // 主从复制（16-replication）
  syncFromMaster(): boolean;

  // 慢查询日志（18-slowlog）
  slowlogReset(): void;
}
