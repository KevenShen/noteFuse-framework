/**
 * 类型定义统一导出
 * 
 * 【类型分组】
 * - base.types: 基础类型（Document/OptionalId/FilterQuery/UpdateQuery/FindOptions）
 * - result.types: 操作结果类型（InsertOneResult/InsertManyResult/UpdateResult/DeleteResult）
 * - index.types: 索引类型（IndexOptions/IndexInfo）
 * - changestream.types: 变更流类型
 * - performance.types: 性能与批量操作类型
 * - transaction.types: 事务类型
 * - async.types: 异步模式类型（AsyncDelayConfig/MongoAsyncConfig/AsyncMongoStats 等）
 */

// 基础类型
export type {
  Document,
  OptionalId,
  FilterQuery,
  UpdateQuery,
  FindOptions,
} from './base.types';

// 操作结果类型
export type {
  InsertOneResult,
  InsertManyResult,
  UpdateResult,
  DeleteResult,
} from './result.types';

// 索引类型
export type {
  IndexOptions,
  IndexInfo,
} from './index.types';

// 变更流类型
export type {
  ChangeOperationType,
  ChangeEvent,
  ChangeStreamOptions,
  ChangeStreamCallback,
  ChangeStreamState,
} from './changestream.types';

// 性能与批量操作类型
export type {
  QueryPlanStage,
  QueryPlan,
  PerformanceStats,
  BulkOperationType,
  BulkOperation,
  BulkWriteResult,
} from './performance.types';

// 事务类型
export type {
  TransactionState,
  TransactionOptions,
} from './transaction.types';

// 异步模式类型
export type {
  AsyncDelayConfig,
  ResolvedAsyncDelayConfig,
  MongoAsyncConfig,
  AsyncVersion,
  AsyncMongoStats,
} from './async.types';
export { DEFAULT_ASYNC_DELAY_CONFIG } from './async.types';
