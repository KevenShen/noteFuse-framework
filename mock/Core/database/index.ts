/**
 * 模拟数据库 ORM 核心
 * 功能：表定义、CRUD、查询、分页、排序、聚合、事务、索引、JOIN 等高级功能
 * 
 * 目录结构：
 * - types/       类型定义（按功能分组）
 * - Transaction.ts    事务类
 * - ShardingManager.ts 分片管理器
 * - MockTable.ts      数据库表主类
 */

// 类型定义
export * from './types';

// 核心类
export { Transaction } from './Transaction';
export { ShardingManager } from './ShardingManager';
export { MockTable } from './MockTable';

// 重新导出常用类型（保持向后兼容）
export type {
  FlatItem,
  TableConfig,
  ExtendedTableConfig,
  QueryCondition,
  FindOptions,
  OrderByOption,
  SortOption,
  SortObject,
  PaginationOption,
  PaginatedResult,
  AggregateFunction,
  AggregationConfig,
  AggregationResult,
  GroupByOptions,
  CursorPaginatedResult,
  CursorPaginationOptions,
  IsolationLevel,
  TransactionState,
  TransactionOptions,
  Savepoint,
  LockType,
  LockInfo,
  OptimisticLockOptions,
  TransactionStats,
  IndexType,
  IndexDefinition,
  IndexOptions,
  QueryPlan,
  CacheStats,
  JoinType,
  JoinConfig,
  JoinQueryOptions,
  UnionQueryOptions,
  SubqueryConfig,
  UpdateOperators,
  UpdateData,
  UpsertOptions,
  BulkUpdateOperation,
  BulkDeleteOperation,
  BulkResult,
  CaseWhenConfig,
  SoftDeleteConfig,
  TimestampConfig,
  TreeConfig,
  TreeNode,
  WindowFunctionType,
  WindowFunctionConfig,
  WindowSpec,
  WindowQueryOptions,
  CteDefinition,
  FulltextSearchMode,
  FulltextSearchResult,
  FulltextSearchOptions,
  ForeignKeyAction,
  ForeignKeyDefinition,
  FieldValidationRule,
  ValidationConfig,
  ValidationError,
  ValidationResult,
  EventType,
  EventHook,
  EventHooksConfig,
  JsonPath,
  PerformanceStat,
  SlowQueryRecord,
  PerformanceReport,
  ExportOptions,
  ImportOptions,
  ReplicationRole,
  ReplicationStatus,
  BinlogEventType,
  BinlogEvent,
  ShardingStrategy,
  ShardConfig,
  ShardingManagerConfig,
  IncrementalBackup,
  PointInTimeRecoveryConfig,
} from './types';

// ==================== 全局实例与工厂函数（系统通用） ====================

/**
 * 全局数据库管理器实例（单例模式）
 * 管理多个表，提供表的注册、获取、删除等功能
 * 
 * 示例数据和示例表请参考 example.ts
 */
export {
  db,
  DatabaseManager,
  createTable,
  registerTable,
  getTable,
} from './instance';

// ==================== 使用示例与示例数据导出 ====================

/**
 * MockTable 使用示例与示例数据
 * 
 * 包含：
 * - 示例数据类型（User/Product/Order）
 * - 示例初始数据（initialUsers/initialProducts/initialOrders）
 * - 示例表创建函数（createUserTable/createProductTable/createOrderTable）
 * - 示例表全局实例（userTable/productTable/orderTable）
 * - 初始化示例数据库函数（initExampleDatabase）
 * - 10个完整的使用示例
 */
export * from './example';
