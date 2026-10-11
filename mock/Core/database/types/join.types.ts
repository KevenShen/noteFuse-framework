/**
 * JOIN、UNION 和子查询类型定义
 */
import type { QueryCondition } from './base.types';
import type { MockTable } from '../MockTable';

/** JOIN 类型 */
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

/** JOIN 配置 */
export interface JoinConfig<T, U> {
  /** JOIN 类型 */
  type: JoinType;
  /** 关联的表 */
  table: MockTable<U>;
  /** 关联条件 { 左表字段: 右表字段 } */
  on: Record<string, string>;
  /** 右表别名 */
  alias?: string;
}

/** JOIN 查询选项 */
export interface JoinQueryOptions<T, U> {
  /** 左表过滤条件 */
  where?: QueryCondition<T>;
  /** 右表过滤条件 */
  rightWhere?: QueryCondition<U>;
  /** 关联配置（支持多表 JOIN） */
  joins: JoinConfig<T, U>[];
  /** 字段选择（支持表名前缀） */
  select?: string[];
  /** 排序 */
  orderBy?: Record<string, 'asc' | 'desc'>;
  /** 限制数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
}

/** UNION 查询选项 */
export interface UnionQueryOptions {
  /** 是否去重（true = UNION DISTINCT, false = UNION ALL） */
  distinct?: boolean;
  /** 排序 */
  orderBy?: Record<string, 'asc' | 'desc'>;
  /** 限制数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
}

/** 子查询配置 */
export interface SubqueryConfig<T> {
  /** 子查询来源表 */
  table: MockTable<T>;
  /** 子查询选择的字段 */
  select: string;
  /** 子查询过滤条件 */
  where?: QueryCondition<T>;
  /** 关联条件 { 父表字段: 子表字段 }（用于 EXISTS 子查询） */
  correlation?: Record<string, string>;
}
