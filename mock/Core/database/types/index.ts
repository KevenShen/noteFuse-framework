/**
 * 类型定义统一导出
 * 按功能分组：基础、聚合、事务、索引、JOIN、高级操作、扩展、高级查询、约束、JSON性能、复制分片
 */

// 基础类型
export type {
  FlatItem,
  TableConfig,
  ComparisonOperators,
  QueryCondition,
  SortOption,
  SortObject,
  OrderByOption,
  ProjectionOption,
  FindOptions,
  PaginationOption,
  PaginatedResult,
} from './base.types';

// 聚合查询类型
export type {
  AggregateFunction,
  AggregationConfig,
  GroupByOptions,
  AggregationResult,
  CursorPaginatedResult,
  CursorPaginationOptions,
} from './aggregation.types';

// 事务与锁类型
export type {
  IsolationLevel,
  TransactionState,
  TransactionOptions,
  Savepoint,
  LockType,
  LockInfo,
  OptimisticLockOptions,
  TransactionStats,
} from './transaction.types';

// 索引与缓存类型
export type {
  IndexType,
  IndexDefinition,
  IndexOptions,
  QueryPlan,
  CacheEntry,
  CacheStats,
} from './index-cache.types';

// JOIN/UNION/子查询类型
export type {
  JoinType,
  JoinConfig,
  JoinQueryOptions,
  UnionQueryOptions,
  SubqueryConfig,
} from './join.types';

// 高级操作类型
export type {
  UpdateOperators,
  UpdateData,
  UpsertOptions,
  BulkUpdateOperation,
  BulkDeleteOperation,
  BulkResult,
  CaseWhenConfig,
} from './advanced.types';

// 扩展功能类型
export type {
  SoftDeleteConfig,
  TimestampConfig,
  TreeConfig,
  ExtendedTableConfig,
  TreeNode,
} from './extension.types';

// 高级查询类型
export type {
  WindowFunctionType,
  WindowFunctionConfig,
  WindowSpec,
  WindowQueryOptions,
  CteDefinition,
  FulltextSearchMode,
  FulltextSearchResult,
  FulltextSearchOptions,
} from './advanced-query.types';

// 约束与验证类型
export type {
  ForeignKeyAction,
  ForeignKeyDefinition,
  FieldValidationRule,
  ValidationConfig,
  ValidationError,
  ValidationResult,
  EventType,
  EventHook,
  EventHooksConfig,
} from './constraint.types';

// JSON/性能/导入导出类型
export type {
  JsonPath,
  PerformanceStat,
  SlowQueryRecord,
  PerformanceReport,
  ExportOptions,
  ImportOptions,
} from './json-perf.types';

// 复制/分片/备份类型
export type {
  ReplicationRole,
  ReplicationStatus,
  BinlogEventType,
  BinlogEvent,
  ShardingStrategy,
  ShardConfig,
  ShardingManagerConfig,
  IncrementalBackup,
  PointInTimeRecoveryConfig,
} from './replication.types';

// 异步表类型
export type {
  AsyncDelayConfig,
  ResolvedAsyncDelayConfig,
  AsyncTableStats,
  AsyncVersion,
} from './async-table.types';
export { DEFAULT_ASYNC_DELAY_CONFIG } from './async-table.types';
