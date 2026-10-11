/**
 * MockRedis 基础类
 * 包含：核心属性、构造函数、私有工具方法
 * 所有 mixin 都继承自此基类
 */
import type {
  CacheItem,
  CacheConfig,
  RequiredCacheConfig,
  SlowlogEntry,
  TransactionCommand,
  SubscribeCallback,
  PatternSubscribeCallback,
  KeyspaceNotificationCallback,
  ReplicationRole,
  SlaveInfo,
  RDBSnapshot,
  AOFEntry,
} from './types';
import { isExpired } from './utils';

export class MockRedisBase {
  // 核心属性
  protected cache: Map<string, CacheItem>;
  protected config: RequiredCacheConfig;

  // 慢查询
  protected slowlog: SlowlogEntry[] = [];
  protected slowlogIdCounter: number = 0;

  // 事务
  protected watchedKeys: Map<string, any> = new Map();
  protected transactionCommands: TransactionCommand[] | null = null;

  // 命令统计
  protected commandStats: Map<string, { calls: number; totalTime: number }> = new Map();

  // 发布订阅
  protected subscribers: Map<string, Set<SubscribeCallback>> = new Map();
  protected patternSubscribers: Map<string, Set<PatternSubscribeCallback>> = new Map();
  protected keyspaceSubscribers: Set<KeyspaceNotificationCallback> = new Set();

  // 主从复制
  protected _role: ReplicationRole = 'master';
  protected master: any | null = null;
  protected slaves: Map<string, SlaveInfo> = new Map();
  protected replicationOffset: number = 0;

  // 持久化
  protected rdbSnapshots: RDBSnapshot[] = [];
  protected aofLog: AOFEntry[] = [];
  protected lastSaveTime: number = Date.now();
  protected aofEnabled: boolean = false;
  protected rdbEnabled: boolean = true;

  // 键空间通知
  protected keyspaceNotifications: string = '';  // 如 'Kx' 表示键过期通知

  // 统计
  protected totalCommandsProcessed: number = 0;
  protected totalConnections: number = 0;
  protected uptime: number = Date.now();

  constructor(config?: CacheConfig) {
    this.config = {
      defaultTTL: config?.defaultTTL ?? 5 * 60 * 1000,
      nullValueTTL: config?.nullValueTTL ?? 60 * 1000,
      maxItems: config?.maxItems ?? 1000,
      enablePenetrationProtection:
        config?.enablePenetrationProtection !== false,
      debug: config?.debug ?? false,
      evictionPolicy: config?.evictionPolicy ?? 'LRU',
      evictionSamples: config?.evictionSamples ?? 5,
      slowlogThreshold: config?.slowlogThreshold ?? 10,
      slowlogMaxLen: config?.slowlogMaxLen ?? 128,
    };
    this.cache = new Map();
  }

  // ==================== 私有工具方法 ====================

  /** 调试日志 */
  protected debugLog(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.log(`[MockRedis] ${message}`, ...args);
    }
  }

  /** 淘汰：超过最大项数时根据策略删除项 */
  protected evictIfNeeded(): void {
    if (this.cache.size < this.config.maxItems) return;

    const policy = this.config.evictionPolicy;

    switch (policy) {
      case 'NO_EVICTION':
        // 不淘汰，抛出错误（模拟 Redis 的 OOM）
        throw new Error('OOM command not allowed when used memory > maxmemory (eviction policy: NO_EVICTION)');

      case 'RANDOM':
        this.evictRandom();
        break;

      case 'TTL':
        this.evictByTTL();
        break;

      case 'LFU':
        this.evictByLFU();
        break;

      case 'LRU':
      default:
        this.evictByLRU();
        break;
    }
  }

  /** LRU 淘汰：采样后删除最久未使用的项 */
  protected evictByLRU(): void {
    const samples = this.getEvictionSamples();
    if (samples.length === 0) return;

    // 找到采样中最久未使用的项
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, item] of samples) {
      if (item.lastAccessedAt < oldestTime) {
        oldestTime = item.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.debugLog('LRU evict:', oldestKey);
      this.cache.delete(oldestKey);
    }
  }

  /** LFU 淘汰：采样后删除访问次数最少的项 */
  protected evictByLFU(): void {
    const samples = this.getEvictionSamples();
    if (samples.length === 0) return;

    let leastKey: string | null = null;
    let leastCount = Infinity;

    for (const [key, item] of samples) {
      if (item.accessCount < leastCount) {
        leastCount = item.accessCount;
        leastKey = key;
      }
    }

    if (leastKey) {
      this.debugLog('LFU evict:', leastKey, 'accessCount:', leastCount);
      this.cache.delete(leastKey);
    }
  }

  /** 随机淘汰 */
  protected evictRandom(): void {
    const keys = Array.from(this.cache.keys());
    if (keys.length === 0) return;

    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    this.debugLog('RANDOM evict:', randomKey);
    this.cache.delete(randomKey);
  }

  /** TTL 淘汰：删除最快过期的项 */
  protected evictByTTL(): void {
    let targetKey: string | null = null;
    let nearestExpire = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.expireAt !== null && item.expireAt < nearestExpire) {
        nearestExpire = item.expireAt;
        targetKey = key;
      }
    }

    // 如果没有设置 TTL 的项，回退到随机淘汰
    if (!targetKey) {
      this.evictRandom();
      return;
    }

    this.debugLog('TTL evict:', targetKey, 'expireAt:', new Date(nearestExpire).toISOString());
    this.cache.delete(targetKey);
  }

  /** 获取淘汰采样（近似 LRU/LFU） */
  protected getEvictionSamples(): Array<[string, CacheItem]> {
    const entries = Array.from(this.cache.entries());
    const sampleCount = Math.min(this.config.evictionSamples, entries.length);
    
    // 随机采样
    const samples: Array<[string, CacheItem]> = [];
    const usedIndices = new Set<number>();
    
    while (samples.length < sampleCount) {
      const index = Math.floor(Math.random() * entries.length);
      if (!usedIndices.has(index)) {
        usedIndices.add(index);
        samples.push(entries[index]);
      }
    }
    
    return samples;
  }

  /** 更新缓存项的访问信息（LRU） */
  protected updateAccess(item: CacheItem): void {
    item.accessCount++;
    item.lastAccessedAt = Date.now();
  }

  /** 获取并检查缓存项（过期则删除） */
  protected getCacheItem(key: string): CacheItem | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (isExpired(item)) {
      this.debugLog('Expired:', key);
      this.cache.delete(key);
      return null;
    }

    return item;
  }

  /** 创建缓存项 */
  protected createCacheItem<T>(value: T, ttl?: number): CacheItem<T> {
    const now = Date.now();
    return {
      value,
      expireAt: ttl !== undefined ? now + ttl : null,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
    };
  }

  /** 记录命令执行时间（用于慢查询和统计） */
  protected recordCommand(command: string, args: any[], startTime: number): void {
    const duration = Date.now() - startTime;
    
    // 命令统计
    let stat = this.commandStats.get(command);
    if (!stat) {
      stat = { calls: 0, totalTime: 0 };
      this.commandStats.set(command, stat);
    }
    stat.calls++;
    stat.totalTime += duration;
    
    // 慢查询记录（毫秒转微秒，*1000）
    if (duration >= this.config.slowlogThreshold) {
      this.slowlog.push({
        id: ++this.slowlogIdCounter,
        timestamp: Date.now(),
        duration: duration * 1000,
        command,
        args,
      });
      
      // 限制慢查询记录数
      if (this.slowlog.length > this.config.slowlogMaxLen) {
        this.slowlog.shift();
      }
    }
  }

  /** 包装方法，自动记录执行时间 */
  protected executeWithTiming<T>(command: string, args: any[], fn: () => T): T {
    const startTime = Date.now();
    try {
      return fn();
    } finally {
      this.recordCommand(command, args, startTime);
    }
  }
}
