/**
 * 聚合查询类型定义
 * 包含：聚合函数、GROUP BY、DISTINCT、游标分页等
 */
import type { QueryCondition, OrderByOption } from './base.types';

/** 聚合函数类型 */
export type AggregateFunction = 'COUNT' | 'SUM' | 'AVG' | 'MAX' | 'MIN' | 'GROUP_CONCAT';

/** 聚合配置 */
export interface AggregationConfig {
  /** 聚合函数 */
  fn: AggregateFunction;
  /** 聚合列（COUNT(*) 用 '*'） */
  column: string;
  /** 别名 */
  alias?: string;
  /** GROUP_CONCAT 的分隔符 */
  separator?: string;
  /** 是否去重（COUNT DISTINCT） */
  distinct?: boolean;
}

/** GROUP BY 查询选项 */
export interface GroupByOptions<T> {
  /** 分组字段 */
  groupBy: (keyof T)[];
  /** 聚合配置 */
  aggregations: Record<string, AggregationConfig>;
  /** 过滤条件（WHERE） */
  where?: QueryCondition<T>;
  /** 分组后过滤（HAVING） */
  having?: QueryCondition<any>;
  /** 排序 */
  orderBy?: OrderByOption<any>;
  /** 限制数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
}

/** 聚合结果行 */
export type AggregationResult = Record<string, any>;

/** 游标分页结果 */
export interface CursorPaginatedResult<T> {
  /** 数据列表 */
  data: T[];
  /** 下一页游标（null 表示没有更多） */
  nextCursor: string | null;
  /** 上一页游标 */
  prevCursor: string | null;
  /** 是否有更多数据 */
  hasMore: boolean;
  /** 当前页数量 */
  count: number;
}

/** 游标分页选项 */
export interface CursorPaginationOptions<T> {
  /** 过滤条件 */
  where?: QueryCondition<T>;
  /** 排序（必须包含唯一字段作为游标基准） */
  orderBy: OrderByOption<T>;
  /** 每页数量 */
  limit: number;
  /** 游标（Base64 编码的排序字段值） */
  cursor?: string;
  /** 字段投影 */
  select?: (keyof T)[];
  /** 排除字段 */
  exclude?: (keyof T)[];
}
