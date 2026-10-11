/**
 * MockTable 方法签名清单（阶段1：提取所有方法签名）
 *
 * 按功能分组，共16组，约140个公共方法
 * 用于后续定义 interface MockTable<T>
 */

// ==================== L1 基础查询层（01-query.mixin.ts）====================
// 7个方法
const L1_Query = {
  findAll: 'findAll(options?: FindOptions<T>): T[]',
  findById: 'findById(id: number | string, options?: FindOptions<T>): T | undefined',
  findOne: 'findOne(condition: QueryCondition<T>, options?: FindOptions<T>): T | undefined',
  find: 'find(condition?: QueryCondition<T>, options?: FindOptions<T>): T[]',
  paginate: 'paginate(condition?: QueryCondition<T>, sort?: OrderByOption<T>, pagination?: PaginationOption, options?: Omit<FindOptions<T>, "orderBy" | "limit" | "offset">): PaginatedResult<T>',
  count: 'count(condition?: QueryCondition<T>): number',
  exists: 'exists(condition?: QueryCondition<T>): boolean',
};

// ==================== L2 聚合查询层（02-aggregation.mixin.ts）====================
// 7个方法
const L2_Aggregation = {
  groupBy: 'groupBy(options: GroupByOptions<T>): AggregationResult[]',
  distinct: 'distinct(columns: string | string[], where?: QueryCondition<T>): any[]',
  sum: 'sum(field: keyof T, condition?: QueryCondition<T>): number',
  avg: 'avg(field: keyof T, condition?: QueryCondition<T>): number',
  min: 'min(field: keyof T, condition?: QueryCondition<T>): any',
  max: 'max(field: keyof T, condition?: QueryCondition<T>): any',
  aggregate: 'aggregate(pipeline: Array<Record<string, any>>): any[]',
};

// ==================== L3 游标分页层（03-cursor-pagination.mixin.ts）====================
// 1个方法
const L3_CursorPagination = {
  cursorPaginate: 'cursorPaginate(condition?: QueryCondition<T>, options?: CursorPaginationOptions): CursorPaginatedResult<T>',
};

// ==================== L4 事务管理层（04-transaction.mixin.ts）====================
// 8个方法
const L4_Transaction = {
  beginTransaction: 'beginTransaction(options?: TransactionOptions): Transaction<T>',
  commit: 'commit(): void',
  rollback: 'rollback(): void',
  transaction: 'transaction<T>(callback: (tx: Transaction<T>) => Promise<T>): Promise<T>',
  savepoint: 'savepoint(name: string): void',
  rollbackTo: 'rollbackTo(name: string): void',
  releaseSavepoint: 'releaseSavepoint(name: string): void',
  getTransactionStats: 'getTransactionStats(): TransactionStats',
  isInTransaction: 'isInTransaction(): boolean',
};

// ==================== L5 锁机制层（05-lock.mixin.ts）====================
// 5个方法
const L5_Lock = {
  lockTable: 'lockTable(type: LockType, timeout?: number): void',
  lockRow: 'lockRow(recordId: number | string, type: LockType): void',
  releaseLock: 'releaseLock(lock: LockInfo): void',
  releaseAllLocks: 'releaseAllLocks(): void',
  optimisticUpdate: 'optimisticUpdate(condition: any, data: any, options?: OptimisticLockOptions): number',
};

// ==================== L6 索引管理层（06-index.mixin.ts）====================
// 6个方法
const L6_Index = {
  createIndex: 'createIndex(columns: string[], options?: IndexOptions): string',
  dropIndex: 'dropIndex(name: string): boolean',
  getIndexes: 'getIndexes(): IndexDefinition[]',
  hasIndex: 'hasIndex(name: string): boolean',
  rebuildIndex: 'rebuildIndex(name: string): void',
  indexStats: 'indexStats(): IndexStats[]',
};

// ==================== L7 执行计划层（07-explain.mixin.ts）====================
// 3个方法
const L7_Explain = {
  explain: 'explain(condition?: QueryCondition<T>): QueryPlan',
  analyze: 'analyze(condition?: QueryCondition<T>): QueryAnalysis',
  getBestIndex: 'getBestIndex(condition: QueryCondition<T>): string | null',
};

// ==================== L8 查询缓存层（08-query-cache.mixin.ts）====================
// 5个方法
const L8_QueryCache = {
  findCached: 'findCached(condition: QueryCondition<T>, options?: FindOptions<T>, ttl?: number): T[]',
  cacheStats: 'cacheStats(): CacheStats',
  clearCache: 'clearCache(): void',
  invalidateCache: 'invalidateCache(condition: QueryCondition<T>): void',
  getCacheHitRate: 'getCacheHitRate(): number',
};

// ==================== L9 关联查询层（09-join, 10-union, 11-subquery）====================
// 6个方法
const L9_Join = {
  join: 'join(options: JoinQueryOptions<T, any>): any[]',
  leftJoin: 'leftJoin(options: JoinQueryOptions<T, any>): any[]',
  rightJoin: 'rightJoin(options: JoinQueryOptions<T, any>): any[]',
  union: 'union(queries: Array<() => any[]>, options?: UnionQueryOptions): any[]',
  unionAll: 'unionAll(queries: Array<() => any[]>, options?: UnionQueryOptions): any[]',
  whereIn: 'whereIn(field: string, subquery: SubqueryConfig<any>): T[]',
  whereNotIn: 'whereNotIn(field: string, subquery: SubqueryConfig<any>): T[]',
  whereExists: 'whereExists(subquery: SubqueryConfig<any>): T[]',
  whereNotExists: 'whereNotExists(subquery: SubqueryConfig<any>): T[]',
};

// ==================== L10 写入操作层（12-upsert, 13-bulk, 14-case-when, 30-write）====================
// 12个方法
const L10_Write = {
  create: 'create(data: Partial<T>): T',
  update: 'update(condition: QueryCondition<T>, data: Partial<T>): number',
  updateById: 'updateById(id: number | string, data: Partial<T>): T | undefined',
  delete: 'delete(condition: QueryCondition<T>): number',
  deleteById: 'deleteById(id: number | string): boolean',
  upsert: 'upsert(data: Partial<T>, options: UpsertOptions): T',
  bulkCreate: 'bulkCreate(items: Array<Partial<T>>): BulkResult',
  bulkUpdate: 'bulkUpdate(operations: BulkUpdateOperation<T>[]): BulkResult',
  bulkDelete: 'bulkDelete(operations: BulkDeleteOperation<T>[]): BulkResult',
  bulkUpsert: 'bulkUpsert(items: Array<Partial<T>>, options: UpsertOptions): BulkResult',
  caseWhenUpdate: 'caseWhenUpdate(config: CaseWhenConfig<T>): number',
  increment: 'increment(field: string, amount?: number, condition?: QueryCondition<T>): number',
  decrement: 'decrement(field: string, amount?: number, condition?: QueryCondition<T>): number',
};

// ==================== L11 扩展功能层（15-soft-delete, 16-timestamp, 17-tree）====================
// 16个方法
const L11_Extension = {
  // 软删除
  withTrashed: 'withTrashed(): this',
  onlyTrashed: 'onlyTrashed(): this',
  softDelete: 'softDelete(condition: QueryCondition<T>): number',
  softDeleteById: 'softDeleteById(id: number | string): boolean',
  restore: 'restore(condition: QueryCondition<T>): number',
  restoreById: 'restoreById(id: number | string): boolean',
  forceDelete: 'forceDelete(condition: QueryCondition<T>): number',
  // 时间戳
  touch: 'touch(condition?: QueryCondition<T>): number',
  updateTimestamps: 'updateTimestamps(data: Partial<T>): Partial<T>',
  // 树形结构
  buildTree: 'buildTree(rootId?: number | string | null): TreeNode<T>[]',
  getDescendants: 'getDescendants(id: number | string): T[]',
  getAncestors: 'getAncestors(id: number | string): T[]',
  getChildren: 'getChildren(parentId: number | string): T[]',
  getSiblings: 'getSiblings(id: number | string): T[]',
  isDescendant: 'isDescendant(ancestorId: number | string, descendantId: number | string): boolean',
  getLeafNodes: 'getLeafNodes(): T[]',
  moveNode: 'moveNode(id: number | string, newParentId: number | string): boolean',
};

// ==================== L12 高级查询层（18-window-function, 19-cte, 20-fulltext）====================
// 8个方法
const L12_AdvancedQuery = {
  // 窗口函数
  window: 'window(options: WindowFunctionOptions): any[]',
  rowNumber: 'rowNumber(partitionBy?: string[], orderBy?: OrderByOption<T>): any[]',
  rank: 'rank(partitionBy?: string[], orderBy?: OrderByOption<T>): any[]',
  denseRank: 'denseRank(partitionBy?: string[], orderBy?: OrderByOption<T>): any[]',
  // CTE
  cte: 'cte(name: string, query: () => any[]): CteBuilder',
  withRecursive: 'withRecursive(name: string, anchorQuery: () => any[], recursiveQuery: (cte: any[]) => any[]): any[]',
  // 全文搜索
  fulltextSearch: 'fulltextSearch(keyword: string, options?: FulltextSearchOptions): FulltextSearchResult<T>[]',
  search: 'search(keyword: string, fields?: string[]): T[]',
};

// ==================== L13 约束验证层（21-foreign-key, 22-validation, 23-event-hook）====================
// 12个方法
const L13_Constraint = {
  // 外键约束
  addForeignKey: 'addForeignKey(definition: ForeignKeyDefinition): void',
  dropForeignKey: 'dropForeignKey(name: string): boolean',
  getForeignKeys: 'getForeignKeys(): ForeignKeyDefinition[]',
  // 数据验证
  validate: 'validate(data: Partial<T>): ValidationResult',
  validateField: 'validateField(field: string, value: any): ValidationResult',
  setValidation: 'setValidation(config: ValidationConfig): void',
  // 事件钩子
  setHooks: 'setHooks(hooks: EventHooksConfig<T>): void',
  on: 'on(event: EventType, hook: EventHook<T>): void',
  off: 'off(event: EventType): void',
  trigger: 'trigger(event: EventType, data: any): boolean',
  getEventListeners: 'getEventListeners(event: EventType): EventHook<T>[]',
  hasEventListener: 'hasEventListener(event: EventType): boolean',
  removeAllListeners: 'removeAllListeners(): void',
};

// ==================== L14 数据操作层（24-json, 25-performance, 26-import-export）====================
// 12个方法
const L14_DataOperation = {
  // JSON操作
  jsonExtract: 'jsonExtract(field: string, path: string): any',
  jsonSet: 'jsonSet(field: string, path: string, value: any): number',
  jsonRemove: 'jsonRemove(field: string, path: string): number',
  jsonKeys: 'jsonKeys(field: string, path?: string): string[]',
  // 性能监控
  getPerformanceReport: 'getPerformanceReport(): PerformanceReport',
  getSlowQueries: 'getSlowQueries(): SlowQuery[]',
  resetPerformanceStats: 'resetPerformanceStats(): void',
  // 导入导出
  export: 'export(format?: "json" | "csv"): string',
  import: 'import(data: string, format?: "json" | "csv"): number',
  toCSV: 'toCSV(): string',
  fromCSV: 'fromCSV(csv: string): number',
  toJSON: 'toJSON(): string',
};

// ==================== L15 高可用层（27-binlog, 28-replication, 29-backup）====================
// 13个方法
const L15_HighAvailability = {
  // Binlog
  getBinlog: 'getBinlog(): BinlogEvent[]',
  enableBinlog: 'enableBinlog(): void',
  disableBinlog: 'disableBinlog(): void',
  purgeBinlog: 'purgeBinlog(beforeTime?: Date): number',
  // 主从复制
  setAsPrimary: 'setAsPrimary(config?: Partial<ReplicationConfig>): void',
  setAsReplica: 'setAsReplica(primaryTable: any, config?: Partial<ReplicationConfig>): void',
  syncFromPrimary: 'syncFromPrimary(): number',
  getReplicationStatus: 'getReplicationStatus(): ReplicationStatus',
  // 备份恢复
  createBackup: 'createBackup(options?: BackupOptions): BackupInfo',
  restoreBackup: 'restoreBackup(backupId: string): boolean',
  listBackups: 'listBackups(): BackupInfo[]',
  deleteBackup: 'deleteBackup(backupId: string): boolean',
  pointInTimeRecovery: 'pointInTimeRecovery(targetTime: Date): boolean',
};

// ==================== L16 工具方法层（31-utility.mixin.ts）====================
// 7个方法
const L16_Utility = {
  truncate: 'truncate(): void',
  getTableName: 'getTableName(): string',
  getConfig: 'getConfig(): TableConfig<T>',
  getData: 'getData(): T[]',
  setData: 'setData(data: T[]): void',
  clone: 'clone(): MockTable<T>',
  toString: 'toString(): string',
  getSchema: 'getSchema(): Record<string, string>',
  getFieldNames: 'getFieldNames(): string[]',
  hasField: 'hasField(field: string): boolean',
  getNextId: 'getNextId(): number',
  toArray: 'toArray(): T[]',
};

// ==================== 统计汇总 ====================
const methodStats = {
  L1_Query: 7,
  L2_Aggregation: 7,
  L3_CursorPagination: 1,
  L4_Transaction: 9,
  L5_Lock: 5,
  L6_Index: 6,
  L7_Explain: 3,
  L8_QueryCache: 5,
  L9_Join: 9,
  L10_Write: 14,
  L11_Extension: 18,
  L12_AdvancedQuery: 8,
  L13_Constraint: 13,
  L14_DataOperation: 12,
  L15_HighAvailability: 13,
  L16_Utility: 12,
  total: 7+7+1+9+5+6+3+5+9+14+18+8+13+12+13+12,
};

console.log('MockTable 方法签名清单统计：', methodStats);
