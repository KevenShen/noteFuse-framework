/**
 * MockMongoCollection 主类
 * 通过 Mixin 组合模式扩展功能
 * 
 * 【架构说明】
 * - MockMongoCollectionBase: 核心属性 + 构造函数 + 基础工具方法（insertDocument/emitChangeEvent）
 * - 14 个 Mixin: 按功能分组的细粒度功能模块
 * - 嵌套函数调用: 运行时组合所有 Mixin 到基类
 * 
 * 【Mixin 组合顺序】
 * L1 基础查询 (01): WithQuery
 * L2 写入操作 (02-04): WithInsert → WithUpdate → WithDelete
 * L3 聚合查询 (05-06): WithAggregation → WithExpression
 * L4 管理功能 (07-08): WithIndex → WithCollection
 * L5 高级功能 (09-10): WithTransaction → WithChangeStream
 * L6 性能优化 (11-14): WithExplain → WithBulk → WithCache → WithPerformance
 * 
 * 【类型推断说明】
 * TypeScript 对深层 Mixin 组合的类型推断有限制，
 * 因此使用非泛型构造函数类型断言，运行时实际包含所有 14 个 Mixin 的方法。
 */
import type {
  Document,
  FilterQuery,
  UpdateQuery,
  FindOptions,
  InsertOneResult,
  InsertManyResult,
  UpdateResult,
  DeleteResult,
  IndexOptions,
  IndexInfo,
  ChangeStreamOptions,
  QueryPlan,
  BulkOperation,
  BulkWriteResult,
  PerformanceStats,
  MongoAsyncConfig,
  AsyncDelayConfig,
  AsyncMongoStats,
} from './types';
import { ObjectId } from './ObjectId';
import { FindCursor } from './FindCursor';
import { ChangeStream } from './ChangeStream';
import { MockMongoCollectionBase } from './MockMongoCollectionBase';
import { wrapAsync, resolveAsyncDelayConfig, createAsyncStats } from './utils';
import {
  WithQuery,
  WithInsert,
  WithUpdate,
  WithDelete,
  WithAggregation,
  WithExpression,
  WithIndex,
  WithCollection,
  WithTransaction,
  WithChangeStream,
  WithExplain,
  WithBulk,
  WithCache,
  WithPerformance,
} from './mixins';

/**
 * 组合所有 Mixin 后的基类
 * 运行时实际包含所有 14 个 Mixin 的方法
 */
const ComposedMockMongoCollection = WithPerformance(
  WithCache(
    WithBulk(
      WithExplain(
        WithChangeStream(
          WithTransaction(
            WithCollection(
              WithIndex(
                WithExpression(
                  WithAggregation(
                    WithDelete(
                      WithUpdate(
                        WithInsert(
                          WithQuery(
                            MockMongoCollectionBase
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
 * 由于 MockMongoCollectionBase 是泛型类，typeof 时需要指定类型参数，
 * 因此定义一个非泛型的构造函数类型用于断言
 */
type ComposedMockMongoCollectionClass = new (...args: any[]) => any;

/**
 * MockMongoCollection 接口类型声明
 *
 * 【设计说明】
 * 由于 MockMongoCollection 类通过 14 层 Mixin 组合模式构建，继承自 any 类型的基类，
 * TypeScript 无法自动推断其方法类型。
 *
 * 使用 TypeScript 声明合并（declaration merging）特性：
 * - interface MockMongoCollection<T> 与 class MockMongoCollection<T> 自动合并
 * - 为所有公共方法提供完整的类型声明
 * - 支持泛型参数 T（文档类型）
 *
 * 【方法分组】（6组，按基础到高级递进）
 * L1 基础查询 (6) / L2 写入操作 (10)
 * L3 聚合查询 (1) / L4 管理功能 (10)
 * L5 高级功能 (5) / L6 性能优化 (4)
 */
export interface MockMongoCollection<T extends Document = any> {
  // ==================== L1 基础查询层 ====================
  find(query?: FilterQuery<T>, options?: FindOptions): FindCursor<T>;
  findOne(query?: FilterQuery<T>, options?: FindOptions): Promise<T | null>;
  findById(id: ObjectId | string): Promise<T | null>;
  countDocuments(query?: FilterQuery<T>): Promise<number>;
  distinct(field: string, query?: FilterQuery<T>): Promise<any[]>;
  exists(query: FilterQuery<T>): Promise<boolean>;

  // ==================== L2 写入操作层 ====================
  // 插入
  insertOne(doc: Partial<T>): Promise<InsertOneResult>;
  insertMany(docs: Array<Partial<T>>): Promise<InsertManyResult>;
  // 更新
  updateOne(query: FilterQuery<T>, update: UpdateQuery<T>, options?: { upsert?: boolean }): Promise<UpdateResult>;
  updateMany(query: FilterQuery<T>, update: UpdateQuery<T>, options?: { upsert?: boolean }): Promise<UpdateResult>;
  replaceOne(query: FilterQuery<T>, replacement: Partial<T>, options?: { upsert?: boolean }): Promise<UpdateResult>;
  findOneAndUpdate(query: FilterQuery<T>, update: UpdateQuery<T>, options?: { upsert?: boolean; returnDocument?: 'before' | 'after' }): Promise<T | null>;
  findOneAndReplace(query: FilterQuery<T>, replacement: Partial<T>, options?: { upsert?: boolean; returnDocument?: 'before' | 'after' }): Promise<T | null>;
  // 删除
  deleteOne(query: FilterQuery<T>): Promise<DeleteResult>;
  deleteMany(query: FilterQuery<T>): Promise<DeleteResult>;
  findOneAndDelete(query: FilterQuery<T>): Promise<T | null>;

  // ==================== L3 聚合查询层 ====================
  aggregate(pipeline: object[]): Promise<any[]>;

  // ==================== L4 管理功能层 ====================
  // 索引管理
  createIndex(keys: { [key: string]: 1 | -1 }, options?: IndexOptions): string;
  listIndexes(): IndexInfo[];
  dropIndex(name: string): boolean;
  dropIndexes(): void;
  // 集合管理
  getName(): string;
  clear(): void;
  count(): number;
  findAll(): T[];
  export(): T[];
  import(data: T[]): void;

  // ==================== L5 高级功能层 ====================
  // 事务快照
  snapshot(): Map<string, T>;
  restore(snapshot: Map<string, T>): void;
  getDocuments(): Map<string, T>;
  setDocuments(docs: Map<string, T>): void;
  // 变更流
  watch(pipeline?: object[], options?: ChangeStreamOptions): ChangeStream<T>;

  // ==================== L6 性能优化层 ====================
  explain(query: FilterQuery<T>, options?: FindOptions): QueryPlan;
  bulkWrite(operations: BulkOperation[], options?: { ordered?: boolean }): Promise<BulkWriteResult>;
  findOptimized(query: FilterQuery<T>, options?: FindOptions & { useCache?: boolean }): Promise<T[]>;
  getPerformanceStats(): PerformanceStats;

  // ==================== L7 异步模式层 ====================
  /** 判断是否为异步模式 */
  isAsyncMode(): boolean;
  /** 获取异步操作统计（未启用异步模式时返回 null） */
  getAsyncStats(): AsyncMongoStats | null;
  /**
   * 动态切换异步模式
   * 注意：由于构造函数返回的是 Proxy 包装的实例，动态切换需要重新创建实例
   * 建议在创建集合时就指定异步模式
   */
  setAsyncMode(enabled: boolean, config?: AsyncDelayConfig): void;
}

/**
 * MongoDB 集合类
 * 模拟 MongoDB 的集合，存储文档数据，提供完整的 CRUD API
 *
 * 【异步模式支持】
 * 构造函数第三个参数 asyncConfig 可启用异步模式：
 * - async: true 时，所有方法（除 find/watch 外）自动包装为返回 Promise 的版本
 * - 可配置延迟模拟（fixed/random/normal 三种模式），更贴近真实 MongoDB 驱动的行为
 * - 启用异步模式后，构造函数返回被 Proxy 包装的实例
 *
 * @example
 * // 同步模式（默认，向后兼容）
 * const syncCollection = new MockMongoCollection('users', initialData);
 * const user = syncCollection.findOne({ id: 1 });  // 返回 Promise（原方法已是 async）
 *
 * // 异步模式（推荐，模拟真实网络延迟）
 * const asyncCollection = new MockMongoCollection('users', initialData, {
 *   async: true,
 *   asyncConfig: { minDelay: 2, maxDelay: 8, delayMode: 'random' },
 * });
 * const user = await asyncCollection.findOne({ id: 1 });  // 直接 await，带延迟模拟
 */
export class MockMongoCollection<T extends Document = any> extends (ComposedMockMongoCollection as ComposedMockMongoCollectionClass) {
  constructor(name: string, initialData?: T[], asyncConfig?: MongoAsyncConfig) {
    super(name, initialData, asyncConfig);

    // 如果启用异步模式，返回被 wrapAsync 包装的实例
    // 注意：构造函数返回对象时，new 操作符会返回该对象而非 this
    if (asyncConfig?.async && this.asyncConfig && this.asyncStats) {
      return wrapAsync(this, this.asyncConfig, this.asyncStats) as any;
    }
  }

  /**
   * 动态切换异步模式
   *
   * 【注意】
   * 由于构造函数返回的是 Proxy 包装的实例，动态切换无法影响已返回的实例。
   * 此方法仅修改内部配置，实际效果有限。
   * 建议在创建集合时就通过构造函数参数指定异步模式。
   *
   * @param enabled 是否启用异步模式
   * @param config 异步延迟配置（仅 enabled=true 时生效）
   */
  setAsyncMode(enabled: boolean, config?: AsyncDelayConfig): void {
    if (enabled) {
      this.asyncConfig = resolveAsyncDelayConfig(config);
      this.asyncStats = this.asyncStats || createAsyncStats();
    } else {
      this.asyncConfig = undefined;
      // 保留统计数据，不清除
    }
  }
}
