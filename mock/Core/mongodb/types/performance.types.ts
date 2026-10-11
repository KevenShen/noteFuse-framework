/**
 * 性能与批量操作类型定义
 * 包含：QueryPlanStage、QueryPlan、PerformanceStats、BulkOperationType、BulkOperation、BulkWriteResult
 */
import type { ObjectId } from '../ObjectId';

/** 查询计划阶段类型 */
export type QueryPlanStage =
  | 'COLLSCAN'      // 集合扫描
  | 'IXSCAN'        // 索引扫描
  | 'FETCH'         // 获取文档
  | 'SORT'          // 排序
  | 'LIMIT'         // 限制
  | 'SKIP'          // 跳过
  | 'PROJECTION'    // 投影
  | 'COUNT'         // 计数
  | 'GROUP';        // 分组

/** 查询计划 */
export interface QueryPlan {
  /** 查询阶段 */
  stage: QueryPlanStage;
  /** 过滤条件 */
  filter?: object;
  /** 使用的索引名称 */
  indexName?: string;
  /** 索引键 */
  indexKeys?: object;
  /** 扫描的文档数量 */
  docsExamined: number;
  /** 匹配的文档数量 */
  docsMatched: number;
  /** 返回的文档数量 */
  docsReturned: number;
  /** 是否使用索引 */
  indexUsed: boolean;
  /** 是否为覆盖索引查询 */
  isCovered: boolean;
  /** 查询耗时（毫秒） */
  executionTimeMS: number;
  /** 子阶段 */
  inputStage?: QueryPlan;
  /** 排序键 */
  sortKey?: object;
  /** 投影字段 */
  projection?: object;
  /** 限制数量 */
  limit?: number;
  /** 跳过数量 */
  skip?: number;
}

/** 性能统计 */
export interface PerformanceStats {
  /** 总查询次数 */
  totalQueries: number;
  /** 使用索引的查询次数 */
  indexedQueries: number;
  /** 全集合扫描次数 */
  collectionScans: number;
  /** 缓存命中次数 */
  cacheHits: number;
  /** 缓存未命中次数 */
  cacheMisses: number;
  /** 总查询耗时（毫秒） */
  totalExecutionTime: number;
  /** 平均查询耗时（毫秒） */
  avgExecutionTime: number;
  /** 最慢查询（毫秒） */
  slowestQuery: number;
  /** 最快查询（毫秒） */
  fastestQuery: number;
  /** 慢查询列表（超过 100ms） */
  slowQueries: { query: object; executionTime: number; indexUsed: boolean }[];
}

/** 批量操作类型 */
export type BulkOperationType = 'insert' | 'update' | 'delete' | 'replace';

/** 批量操作 */
export interface BulkOperation {
  /** 操作类型 */
  type: BulkOperationType;
  /** 插入的文档 */
  document?: object;
  /** 过滤条件 */
  filter?: object;
  /** 更新内容 */
  update?: object;
  /** 是否为更新多个 */
  multi?: boolean;
  /** 是否 upsert */
  upsert?: boolean;
  /** 替换的文档 */
  replacement?: object;
}

/** 批量操作结果 */
export interface BulkWriteResult {
  /** 是否成功 */
  ok: number;
  /** 插入数量 */
  insertedCount: number;
  /** 匹配数量 */
  matchedCount: number;
  /** 修改数量 */
  modifiedCount: number;
  /** 删除数量 */
  deletedCount: number;
  /** upsert 数量 */
  upsertedCount: number;
  /** 插入的 ID 列表 */
  insertedIds: { [index: number]: ObjectId };
  /** upsert 的 ID 列表 */
  upsertedIds: { [index: number]: ObjectId };
  /** 错误列表 */
  errors: { index: number; code: number; message: string }[];
}
