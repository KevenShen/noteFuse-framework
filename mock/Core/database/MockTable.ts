/**
 * MockTable 主类
 * 通过 Mixin 组合模式扩展功能
 * 
 * 【架构说明】
 * - MockTableBase: 核心属性 + 构造函数 + 基础工具方法（matchCondition/applySort/applyProjection）
 * - 31 个 Mixin: 按功能分组的细粒度功能模块
 * - composeMixins: 运行时组合所有 Mixin 到基类
 * 
 * 【类型推断说明】
 * TypeScript 对深层 Mixin 组合的类型推断有限制，
 * 因此使用接口合并（interface merging）声明组合后的类型，
 * 运行时通过 composeMixins 实际组合所有功能。
 */
import type { FlatItem } from './types/base.types';
import type {
  QueryCondition,
  FindOptions,
  OrderByOption,
  PaginationOption,
  PaginatedResult,
  GroupByOptions,
  AggregationResult,
  CursorPaginatedResult,
  TransactionOptions,
  TransactionStats,
  LockType,
  LockInfo,
  OptimisticLockOptions,
  IndexDefinition,
  IndexOptions,
  QueryPlan,
  CacheStats,
  JoinQueryOptions,
  UnionQueryOptions,
  SubqueryConfig,
  UpsertOptions,
  BulkUpdateOperation,
  BulkDeleteOperation,
  BulkResult,
  CaseWhenConfig,
  TreeNode,
  FulltextSearchResult,
  FulltextSearchOptions,
  ForeignKeyDefinition,
  ValidationConfig,
  ValidationResult,
  EventType,
  EventHook,
  EventHooksConfig,
  PerformanceReport,
  SlowQueryRecord,
  ReplicationStatus,
  BinlogEvent,
  TableConfig,
  AsyncTableStats,
} from './types';
import { MockTableBase } from './MockTableBase';
import {
  resolveAsyncDelayConfig,
  createAsyncTableStats,
  wrapAsyncTable,
} from './utils/async-table.utils';
import {
  WithQuery,
  WithAggregation,
  WithCursorPagination,
  WithTransaction,
  WithLock,
  WithIndex,
  WithExplain,
  WithQueryCache,
  WithJoin,
  WithUnion,
  WithSubquery,
  WithUpsert,
  WithBulk,
  WithCaseWhen,
  WithSoftDelete,
  WithTimestamp,
  WithTree,
  WithWindowFunction,
  WithCte,
  WithFulltext,
  WithForeignKey,
  WithValidation,
  WithEventHook,
  WithJson,
  WithPerformance,
  WithImportExport,
  WithBinlog,
  WithReplication,
  WithBackup,
  WithWrite,
  WithUtility,
} from './mixins';

/**
 * 组合所有 Mixin 后的基类
 * 运行时实际包含所有 31 个 Mixin 的方法
 */
const ComposedMockTable = WithUtility(
  WithWrite(
    WithBackup(
      WithReplication(
        WithBinlog(
          WithImportExport(
            WithPerformance(
              WithJson(
                WithEventHook(
                  WithValidation(
                    WithForeignKey(
                      WithFulltext(
                        WithCte(
                          WithWindowFunction(
                            WithTree(
                              WithTimestamp(
                                WithSoftDelete(
                                  WithCaseWhen(
                                    WithBulk(
                                      WithUpsert(
                                        WithSubquery(
                                          WithUnion(
                                            WithJoin(
                                              WithQueryCache(
                                                WithExplain(
                                                  WithIndex(
                                                    WithLock(
                                                      WithTransaction(
                                                        WithCursorPagination(
                                                          WithAggregation(
                                                            WithQuery(MockTableBase)
                                                          )
                                                        )
                                                      )
                                                    )
                                                  )
                                                )
                                              )
                                            )
                                          )
                                        )
                                      )
                                    )
                                  )
                                )
                              )
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  )
) as any;

/**
 * 组合后的基类构造函数类型
 * 由于 MockTableBase 是泛型类，typeof 时需要指定类型参数，
 * 因此定义一个非泛型的构造函数类型用于断言
 */
type ComposedMockTableClass = new (...args: any[]) => any;

/**
 * MockTable 接口类型声明
 *
 * 【设计说明】
 * 由于 MockTable 类通过 31 层 Mixin 组合模式构建，继承自 any 类型的基类，
 * TypeScript 无法自动推断其方法类型。
 *
 * 使用 TypeScript 声明合并（declaration merging）特性：
 * - interface MockTable<T> 与 class MockTable<T> 自动合并
 * - 为所有 142 个公共方法提供完整的类型声明
 * - 支持泛型参数 T（数据项类型）
 *
 * 【方法分组】（16组，按基础到高级递进）
 * L1 基础查询（7）/ L2 聚合查询（7）/ L3 游标分页（1）
 * L4 事务管理（9）/ L5 锁机制（5）/ L6 索引管理（6）
 * L7 执行计划（3）/ L8 查询缓存（5）/ L9 关联查询（9）
 * L10 写入操作（14）/ L11 扩展功能（18）/ L12 高级查询（8）
 * L13 约束验证（13）/ L14 数据操作（12）/ L15 高可用（13）
 * L16 工具方法（12）
 */
export interface MockTable<T extends FlatItem = any> {
  // ==================== L1 基础查询层 ====================
  findAll(options?: FindOptions<T>): T[];
  findById(id: number | string, options?: FindOptions<T>): T | undefined;
  findOne(condition: QueryCondition<T>, options?: FindOptions<T>): T | undefined;
  find(condition?: QueryCondition<T>, options?: FindOptions<T>): T[];
  paginate(
    condition?: QueryCondition<T>,
    sort?: OrderByOption<T>,
    pagination?: PaginationOption,
    options?: Omit<FindOptions<T>, 'orderBy' | 'limit' | 'offset'>,
  ): PaginatedResult<T>;
  count(condition?: QueryCondition<T>): number;
  exists(condition?: QueryCondition<T>): boolean;

  // ==================== L2 聚合查询层 ====================
  groupBy(options: GroupByOptions<T>): AggregationResult[];
  distinct(columns: string | string[], where?: QueryCondition<T>): any[];
  sum(field: keyof T, condition?: QueryCondition<T>): number;
  avg(field: keyof T, condition?: QueryCondition<T>): number;
  min(field: keyof T, condition?: QueryCondition<T>): any;
  max(field: keyof T, condition?: QueryCondition<T>): any;
  aggregate(pipeline: Array<Record<string, any>>): any[];

  // ==================== L3 游标分页层 ====================
  cursorPaginate(condition?: QueryCondition<T>, options?: any): CursorPaginatedResult<T>;

  // ==================== L4 事务管理层 ====================
  beginTransaction(options?: TransactionOptions): any;
  commit(): void;
  rollback(): void;
  transaction<R>(callback: (tx: any) => Promise<R>): Promise<R>;
  savepoint(name: string): void;
  rollbackTo(name: string): void;
  releaseSavepoint(name: string): void;
  getTransactionStats(): TransactionStats;
  isInTransaction(): boolean;

  // ==================== L5 锁机制层 ====================
  lockTable(type: LockType, timeout?: number): void;
  lockRow(recordId: number | string, type: LockType): void;
  releaseLock(lock: LockInfo): void;
  releaseAllLocks(): void;
  optimisticUpdate(condition: QueryCondition<T>, data: Partial<T>, options?: OptimisticLockOptions): number;

  // ==================== L6 索引管理层 ====================
  createIndex(columns: string[], options?: IndexOptions): string;
  dropIndex(name: string): boolean;
  getIndexes(): IndexDefinition[];
  hasIndex(name: string): boolean;
  rebuildIndex(name: string): void;
  indexStats(): any[];

  // ==================== L7 执行计划层 ====================
  explain(condition?: QueryCondition<T>): QueryPlan;
  analyze(condition?: QueryCondition<T>): any;
  getBestIndex(condition: QueryCondition<T>): string | null;

  // ==================== L8 查询缓存层 ====================
  findCached(condition: QueryCondition<T>, options?: FindOptions<T>, ttl?: number): T[];
  cacheStats(): CacheStats;
  clearCache(): void;
  invalidateCache(condition: QueryCondition<T>): void;
  getCacheHitRate(): number;

  // ==================== L9 关联查询层 ====================
  join(options: JoinQueryOptions<T, any>): any[];
  leftJoin(options: JoinQueryOptions<T, any>): any[];
  rightJoin(options: JoinQueryOptions<T, any>): any[];
  union(queries: Array<() => any[]>, options?: UnionQueryOptions): any[];
  unionAll(queries: Array<() => any[]>, options?: UnionQueryOptions): any[];
  whereIn(field: string, subquery: SubqueryConfig<any>): T[];
  whereNotIn(field: string, subquery: SubqueryConfig<any>): T[];
  whereExists(subquery: SubqueryConfig<any>): T[];
  whereNotExists(subquery: SubqueryConfig<any>): T[];

  // ==================== L10 写入操作层 ====================
  create(data: Partial<T>): T;
  update(condition: QueryCondition<T>, data: Partial<T>): number;
  updateById(id: number | string, data: Partial<T>): T | undefined;
  delete(condition: QueryCondition<T>): number;
  deleteById(id: number | string): boolean;
  upsert(data: Partial<T>, options: UpsertOptions): T;
  bulkCreate(items: Array<Partial<T>>): BulkResult;
  bulkUpdate(operations: Array<BulkUpdateOperation<T>>): BulkResult;
  bulkDelete(operations: Array<BulkDeleteOperation<T>>): BulkResult;
  bulkUpsert(items: Array<Partial<T>>, options: UpsertOptions): BulkResult;
  caseWhenUpdate(config: CaseWhenConfig<T>): number;
  increment(field: keyof T, amount?: number, condition?: QueryCondition<T>): number;
  decrement(field: keyof T, amount?: number, condition?: QueryCondition<T>): number;

  // ==================== L11 扩展功能层 ====================
  // 软删除
  withTrashed(): this;
  onlyTrashed(): this;
  softDelete(condition: QueryCondition<T>): number;
  softDeleteById(id: number | string): boolean;
  restore(condition: QueryCondition<T>): number;
  restoreById(id: number | string): boolean;
  forceDelete(condition: QueryCondition<T>): number;
  // 时间戳
  touch(condition?: QueryCondition<T>): number;
  updateTimestamps(data: Partial<T>): Partial<T>;
  // 树形结构
  buildTree(rootId?: number | string | null): TreeNode<T>[];
  getDescendants(id: number | string): T[];
  getAncestors(id: number | string): T[];
  getChildren(parentId: number | string): T[];
  getSiblings(id: number | string): T[];
  isDescendant(ancestorId: number | string, descendantId: number | string): boolean;
  getLeafNodes(): T[];
  moveNode(id: number | string, newParentId: number | string): boolean;

  // ==================== L12 高级查询层 ====================
  // 窗口函数
  window(options: any): any[];
  rowNumber(partitionBy?: string[], orderBy?: OrderByOption<T>): any[];
  rank(partitionBy?: string[], orderBy?: OrderByOption<T>): any[];
  denseRank(partitionBy?: string[], orderBy?: OrderByOption<T>): any[];
  // CTE
  cte(name: string, query: () => any[]): any;
  withRecursive(name: string, anchorQuery: () => any[], recursiveQuery: (cte: any[]) => any[]): any[];
  // 全文搜索
  fulltextSearch(keyword: string, options?: FulltextSearchOptions): FulltextSearchResult<T>[];
  search(keyword: string, fields?: string[]): T[];

  // ==================== L13 约束验证层 ====================
  // 外键约束
  addForeignKey(definition: ForeignKeyDefinition): void;
  dropForeignKey(name: string): boolean;
  getForeignKeys(): ForeignKeyDefinition[];
  // 数据验证
  validate(data: Partial<T>): ValidationResult;
  validateField(field: string, value: any): ValidationResult;
  setValidation(config: ValidationConfig): void;
  // 事件钩子
  setHooks(hooks: EventHooksConfig<T>): void;
  on(event: EventType, hook: EventHook<T>): void;
  off(event: EventType): void;
  trigger(event: EventType, data: any): boolean;
  getEventListeners(event: EventType): EventHook<T>[];
  hasEventListener(event: EventType): boolean;
  removeAllListeners(): void;

  // ==================== L14 数据操作层 ====================
  // JSON操作
  jsonExtract(field: string, path: string): any;
  jsonSet(field: string, path: string, value: any): number;
  jsonRemove(field: string, path: string): number;
  jsonKeys(field: string, path?: string): string[];
  // 性能监控
  getPerformanceReport(): PerformanceReport;
  getSlowQueries(): SlowQueryRecord[];
  resetPerformanceStats(): void;
  // 导入导出
  export(format?: 'json' | 'csv'): string;
  import(data: string, format?: 'json' | 'csv'): number;
  toCSV(): string;
  fromCSV(csv: string): number;
  toJSON(): string;

  // ==================== L15 高可用层 ====================
  // Binlog
  getBinlog(): BinlogEvent[];
  enableBinlog(): void;
  disableBinlog(): void;
  purgeBinlog(beforeTime?: Date): number;
  // 主从复制
  setAsPrimary(config?: Partial<any>): void;
  setAsReplica(primaryTable: any, config?: Partial<any>): void;
  syncFromPrimary(): number;
  getReplicationStatus(): ReplicationStatus;
  // 备份恢复
  createBackup(options?: any): any;
  restoreBackup(backupId: string): boolean;
  listBackups(): any[];
  deleteBackup(backupId: string): boolean;
  pointInTimeRecovery(targetTime: Date): boolean;

  // ==================== L16 工具方法层 ====================
  truncate(): void;
  getTableName(): string;
  getConfig(): TableConfig<T>;
  getData(): T[];
  setData(data: T[]): void;
  clone(): MockTable<T>;
  toString(): string;
  getSchema(): Record<string, string>;
  getFieldNames(): string[];
  hasField(field: string): boolean;
  getNextId(): number;
  toArray(): T[];

  // ==================== L17 异步模式辅助方法 ====================
  /** 是否为异步模式 */
  isAsync(): boolean;
  /** 获取异步调用统计（异步模式下有效） */
  getAsyncStats(): AsyncTableStats | null;
}

/**
 * MockTable 主类
 * 继承自组合后的基类，对外提供完整的数据库表功能
 *
 * 【异步模式支持】
 * - 默认同步模式：所有方法直接返回结果
 * - 异步模式：配置 async: true 后，所有方法返回 Promise，可直接 await
 * - 使用工厂方法 MockTable.create() 创建实例，自动应用异步 Proxy 包装
 */
export class MockTable<T extends FlatItem = any> extends (ComposedMockTable as ComposedMockTableClass) {
  /** 是否为异步模式 */
  protected _isAsync: boolean = false;
  /** 异步延迟配置（已解析） */
  protected _asyncConfig?: import('./types/async-table.types').ResolvedAsyncDelayConfig;
  /** 异步调用统计 */
  protected _asyncStats?: AsyncTableStats;

  constructor(config: any) {
    super(config);

    // 初始化异步模式
    if (config && config.async) {
      this._isAsync = true;
      this._asyncConfig = resolveAsyncDelayConfig(config.asyncConfig);
      this._asyncStats = createAsyncTableStats();
    }
  }

  /**
   * 工厂方法：创建 MockTable 实例
   *
   * 【核心功能】
   * - 如果配置了 async: true，用 Proxy 包装实例，所有方法自动返回 Promise
   * - 如果没有配置 async，返回普通同步实例
   *
   * @param config 表配置
   * @returns MockTable 实例（异步模式下所有方法返回 Promise）
   *
   * @example
   * ```typescript
   * // 同步模式
   * const syncTable = MockTable.create({ name: 'users', initialData: [] });
   * const user = syncTable.findById(1);  // 直接返回结果
   *
   * // 异步模式
   * const asyncTable = MockTable.create({
   *   name: 'users',
   *   initialData: [],
   *   async: true,
   *   asyncConfig: { minDelay: 5, maxDelay: 20, delayMode: 'random' },
   * });
   * const user = await asyncTable.findById(1);  // 返回 Promise，可 await
   * ```
   */
  static create<T extends FlatItem = any>(config: TableConfig<T>): MockTable<T> {
    const instance = new MockTable<T>(config);

    // 如果配置了异步模式，用 Proxy 包装
    if (config.async) {
      return wrapAsyncTable(
        instance,
        instance._asyncConfig!,
        instance._asyncStats,
      ) as MockTable<T>;
    }

    return instance;
  }

  /**
   * 是否为异步模式
   */
  isAsync(): boolean {
    return this._isAsync;
  }

  /**
   * 获取异步调用统计
   * @returns 统计信息（异步模式下有效，同步模式返回 null）
   */
  getAsyncStats(): AsyncTableStats | null {
    return this._asyncStats || null;
  }
}
