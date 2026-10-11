/**
 * 高级查询类型定义
 * 包含：窗口函数、CTE、全文搜索等
 */
import type { QueryCondition } from './base.types';

/** 窗口函数类型 */
export type WindowFunctionType = 
  | 'ROW_NUMBER'
  | 'RANK'
  | 'DENSE_RANK'
  | 'LAG'
  | 'LEAD'
  | 'FIRST_VALUE'
  | 'LAST_VALUE'
  | 'SUM'
  | 'AVG'
  | 'COUNT'
  | 'MIN'
  | 'MAX';

/** 窗口函数配置 */
export interface WindowFunctionConfig<T> {
  /** 函数类型 */
  type: WindowFunctionType;
  /** 目标字段（用于 LAG/LEAD/FIRST_VALUE/LAST_VALUE/SUM/AVG/MIN/MAX） */
  field?: keyof T;
  /** 别名（输出字段名） */
  alias: string;
  /** LAG/LEAD 的偏移量 */
  offset?: number;
  /** LAG/LEAD 的默认值 */
  defaultValue?: any;
}

/** 窗口规范 */
export interface WindowSpec<T> {
  /** 分区字段（PARTITION BY） */
  partitionBy?: Array<keyof T>;
  /** 排序字段（ORDER BY） */
  orderBy?: Record<string, 'asc' | 'desc'>;
  /** 窗口框架（ROWS BETWEEN） */
  frame?: {
    type: 'ROWS' | 'RANGE';
    start: number | 'UNBOUNDED PRECEDING' | 'CURRENT ROW';
    end: number | 'UNBOUNDED FOLLOWING' | 'CURRENT ROW';
  };
}

/** 窗口查询选项 */
export interface WindowQueryOptions<T> {
  /** 窗口函数列表 */
  functions: WindowFunctionConfig<T>[];
  /** 窗口规范 */
  window: WindowSpec<T>;
  /** 过滤条件 */
  where?: QueryCondition<T>;
  /** 结果过滤（HAVING 等价） */
  having?: Record<string, QueryCondition<any>>;
  /** 限制数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
}

/** CTE 定义 */
export interface CteDefinition {
  /** CTE 名称 */
  name: string;
  /** CTE 查询（返回数组） */
  query: () => any[];
  /** 是否递归 */
  recursive?: boolean;
  /** 递归锚点查询 */
  anchorQuery?: () => any[];
  /** 递归成员查询 */
  recursiveQuery?: (prev: any[]) => any[];
  /** 递归最大深度 */
  maxDepth?: number;
}

/** 全文搜索模式 */
export type FulltextSearchMode = 'NATURAL_LANGUAGE' | 'BOOLEAN' | 'QUERY_EXPANSION';

/** 全文搜索结果 */
export interface FulltextSearchResult<T> {
  /** 匹配的记录 */
  item: T;
  /** 相关性得分 */
  score: number;
  /** 匹配的字段 */
  matchedFields: string[];
}

/** 全文搜索选项 */
export interface FulltextSearchOptions {
  /** 搜索模式 */
  mode?: FulltextSearchMode;
  /** 搜索字段（不指定则搜索所有全文索引字段） */
  fields?: string[];
  /** 最小相关性得分 */
  minScore?: number;
  /** 是否按相关性排序 */
  orderByScore?: boolean;
  /** 限制数量 */
  limit?: number;
  /** 布尔模式操作符 */
  booleanOperators?: {
    /** 必须包含的词 */
    mustInclude?: string[];
    /** 必须排除的词 */
    mustExclude?: string[];
    /** 可选包含的词 */
    shouldInclude?: string[];
  };
}
