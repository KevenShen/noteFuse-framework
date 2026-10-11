/**
 * MockRedis 统一导出入口
 *
 * 【架构说明】
 * 本模块通过 Mixin 组合模式实现完整的 Redis 模拟功能：
 * - MockRedisBase: 核心属性 + 构造函数 + 私有工具方法
 * - 21 个 Mixin: 按功能分组的细粒度功能模块（L1→L6分层）
 * - MockRedis: 组合所有 Mixin 的最终类
 *
 * 【导出内容】
 * - 类: MockRedis, RedisPipeline
 * - 实例: redis (全局单例)
 * - 类型: CacheConfig, 以及所有内部类型
 * - Mixin: 所有 21 个功能 Mixin（用于自定义组合）
 */

// ==================== 核心类导入与导出 ====================
import { MockRedis } from './MockRedis';
export { MockRedisBase } from './MockRedisBase';
export { RedisPipeline } from './RedisPipeline';
// ==================== 全局实例 ====================
// 全局实例存放在单独的 instance.ts 文件中，避免循环依赖
export { redis, createCache } from './instance';
// ==================== Mixin 导出（用于自定义组合） ====================
export {
  // L3 事务控制
  WithAdvanced,
  WithBatch,
  WithBitmap,
  WithCommandStats,
  WithCounter,
  WithGeo,
  WithHash,
  WithInfo,
  // L2 键管理
  WithKey,
  WithList,
  WithNotification,
  // L5 高可用
  WithPersistence,
  WithPipeline,
  // L4 消息/扩展
  WithPubsub,
  WithReplication,
  WithSet,
  // L6 监控运维
  WithSlowlog,
  WithSortedSet,
  // L1 数据结构
  WithString,
  WithTransaction,
  WithUtility,
  // Mixin 工具
  applyMixins,
} from './mixins';
// ==================== 类型导出 ====================
export type {
  AOFEntry,
  CacheConfig,
  // 基础类型
  CacheItem,
  // 地理空间类型
  GeoLocation,
  GeoRadiusResult,
  // 键空间通知类型
  KeyspaceNotificationCallback,
  PatternSubscribeCallback,
  RDBSnapshot,
  // 复制与持久化类型
  ReplicationRole,
  RequiredCacheConfig,
  SlaveInfo,
  // 命令相关类型
  SlowlogEntry,
  // 发布订阅类型
  SubscribeCallback,
  TransactionCommand,
} from './types';
// ==================== 工具函数导出 ====================
export { isExpired, patternToRegex } from './utils';
export { MockRedis };

// ==================== SCAN 类型导出 ====================
export type { ScanOptions, ScanResult } from './mixins/21-utility.mixin';

// ==================== 使用示例导出 ====================

/**
 * MockRedis 使用示例
 *
 * 包含15个完整的使用示例，展示MockRedis的各种功能
 */
export * from './example';
