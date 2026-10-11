/**
 * 基础类型定义
 * 包含：CacheItem、CacheConfig、RequiredCacheConfig
 */

/** 缓存项（内部使用）：负责记录每个缓存的元数据（什么时候过期、最后一次访问是什么时候）。 */
export interface CacheItem<T = any> {
  /** 缓存值 */
  value: T;
  /** 过期时间戳（null 表示永不过期） */
  expireAt: number | null;
  /** 创建时间 */
  createdAt: number;
  /** 最后访问时间（用于 LRU） */
  lastAccessedAt: number;
  /** 访问次数 */
  accessCount: number;
}

/** 缓存配置：负责制定规则（能存多少、多久过期、怎么防穿透）。 */
export interface CacheConfig {
  /** 默认 TTL（毫秒），默认 5 分钟 */
  defaultTTL?: number;
  /** 空值缓存 TTL（毫秒），默认 1 分钟 */
  nullValueTTL?: number;
  /** 最大缓存项数，默认 1000 */
  maxItems?: number;
  /** 是否启用缓存穿透防护（空值缓存），默认 true */
  enablePenetrationProtection?: boolean;
  /** 是否启用调试模式，默认 false */
  debug?: boolean;
  /** 淘汰策略，默认 LRU */
  evictionPolicy?: 'LRU' | 'LFU' | 'RANDOM' | 'TTL' | 'NO_EVICTION';
  /** LRU/LFU 采样数，默认 5 */
  evictionSamples?: number;
  /** 慢查询阈值（毫秒），默认 10 */
  slowlogThreshold?: number;
  /** 慢查询最大记录数，默认 128 */
  slowlogMaxLen?: number;
}

/** 必需的缓存配置（内部使用） */
export type RequiredCacheConfig = Required<CacheConfig>;
