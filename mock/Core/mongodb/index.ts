/**
 * MongoDB Mock 模块统一导出
 *
 * 【架构说明】
 * 采用 Mixin 组合模式，将 3082 行的单文件拆分为 41 个文件：
 * - 7 个类型定义文件（types/）
 * - 5 个工具函数文件（utils/）
 * - 17 个 Mixin 文件（mixins/，含14个功能mixin+3个基础设施）
 * - 12 个根目录文件（9个独立类+2个主类+1个统一导出）
 *
 * 【向后兼容】
 * 所有原有导出保持不变，外部引用 `from './mongodb'` 无需修改。
 */

// ==================== 类型定义 ====================
export { ChangeStream } from './ChangeStream';
export {
  ChangeStreamManager,
  changeStreamManager,
} from './ChangeStreamManager';
export { ClientSession } from './ClientSession';
export { FindCursor } from './FindCursor';
export { MockMongoCollection } from './MockMongoCollection';
export { MockMongoCollectionBase } from './MockMongoCollectionBase';
export { MockMongoDB, mongodb } from './MockMongoDB';
// ==================== 核心类 ====================
export { ObjectId } from './ObjectId';
export { performanceMonitor } from './PerformanceMonitor';
export { queryCache } from './QueryCache';
export { Transaction } from './Transaction';
// ==================== Mixin 导出（高级用法） ====================
export {
  WithAggregation,
  WithBulk,
  WithCache,
  WithChangeStream,
  WithCollection,
  WithDelete,
  WithExplain,
  WithExpression,
  WithIndex,
  WithInsert,
  WithPerformance,
  WithQuery,
  WithTransaction,
  WithUpdate,
} from './mixins';
export type {
  BulkOperation,
  BulkOperationType,
  BulkWriteResult,
  ChangeEvent,
  ChangeOperationType,
  ChangeStreamCallback,
  ChangeStreamOptions,
  ChangeStreamState,
  DeleteResult,
  Document,
  FilterQuery,
  FindOptions,
  IndexInfo,
  IndexOptions,
  InsertManyResult,
  InsertOneResult,
  OptionalId,
  PerformanceStats,
  QueryPlan,
  QueryPlanStage,
  TransactionOptions,
  TransactionState,
  UpdateQuery,
  UpdateResult,
  // 异步模式类型
  AsyncDelayConfig,
  ResolvedAsyncDelayConfig,
  MongoAsyncConfig,
  AsyncVersion,
  AsyncMongoStats,
} from './types';
export { DEFAULT_ASYNC_DELAY_CONFIG } from './types';
// ==================== 便捷工具函数 ====================
export {
  createObjectId,
  isValidObjectId,
  // 异步模式工具函数
  resolveAsyncDelayConfig,
  simulateDelay,
  createAsyncStats,
  updateAsyncStats,
  wrapAsync,
  isAsyncMongo,
} from './utils';

// ==================== 使用示例导出 ====================

/**
 * MongoDB Mock 使用示例
 * 
 * 包含11个完整的使用示例，展示MongoDB Mock的各种功能
 * （示例11：异步模式支持）
 */
export * from './example';
