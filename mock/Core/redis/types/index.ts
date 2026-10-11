/**
 * 类型定义统一导出
 * 
 * 【类型分组】
 * - base.types: 基础类型（CacheItem/CacheConfig/RequiredCacheConfig）
 * - command.types: 命令相关类型（SlowlogEntry/TransactionCommand）
 * - pubsub.types: 发布订阅类型
 * - geo.types: 地理空间类型（GeoLocation/GeoRadiusResult）
 * - notification.types: 键空间通知类型
 * - replication.types: 复制与持久化类型（ReplicationRole/SlaveInfo/RDBSnapshot/AOFEntry）
 * - lua-script.types: Lua 脚本类型（RedisScript/RedisScriptAPI/ScriptStats/ScriptInfo）
 */

// 基础类型
export type {
  CacheItem,
  CacheConfig,
  RequiredCacheConfig,
} from './base.types';

// 命令相关类型
export type {
  SlowlogEntry,
  TransactionCommand,
} from './command.types';

// 发布订阅类型
export type {
  SubscribeCallback,
  PatternSubscribeCallback,
} from './pubsub.types';

// 地理空间类型
export type {
  GeoLocation,
  GeoRadiusResult,
} from './geo.types';

// 键空间通知类型
export type {
  KeyspaceNotificationCallback,
} from './notification.types';

// 复制与持久化类型
export type {
  ReplicationRole,
  SlaveInfo,
  RDBSnapshot,
  AOFEntry,
} from './replication.types';

// Lua 脚本类型
export type {
  RedisScript,
  RedisScriptAPI,
  ScriptInfo,
  ScriptStats,
  ScriptExecutionResult,
  NamedScriptConfig,
  CommandHandler,
  CommandMap,
} from './lua-script.types';
export { ScriptError } from './lua-script.types';

// 异步缓存类型
export type {
  AsyncDelayConfig,
  ResolvedAsyncDelayConfig,
  CreateCacheConfig,
  AsyncVersion,
  AsyncCacheStats,
} from './async-cache.types';
export { DEFAULT_ASYNC_DELAY_CONFIG } from './async-cache.types';
