/**
 * 索引与缓存类型定义
 * 包含：索引定义、查询执行计划、缓存统计等
 */

/** 索引类型 */
export type IndexType = 'NORMAL' | 'UNIQUE' | 'FULLTEXT' | 'PRIMARY';

/** 索引定义 */
export interface IndexDefinition {
  /** 索引名称 */
  name: string;
  /** 索引字段 */
  columns: string[];
  /** 索引类型 */
  type: IndexType;
  /** 是否唯一 */
  unique: boolean;
  /** 索引注释 */
  comment?: string;
  /** 创建时间 */
  createdAt: Date;
}

/** 索引选项 */
export interface IndexOptions {
  /** 索引名称（不指定则自动生成） */
  name?: string;
  /** 索引类型 */
  type?: IndexType;
  /** 索引注释 */
  comment?: string;
}

/** 查询执行计划 */
export interface QueryPlan {
  /** 查询类型（ALL=全表扫描, index=索引扫描, range=范围扫描, ref=引用查询, const=常量查询） */
  type: 'ALL' | 'index' | 'range' | 'ref' | 'const' | 'system';
  /** 可能使用的索引 */
  possibleKeys: string[];
  /** 实际使用的索引 */
  key: string | null;
  /** 索引长度 */
  keyLen: number;
  /** 引用的值 */
  ref: string[];
  /** 预估扫描行数 */
  rows: number;
  /** 过滤百分比 */
  filtered: number;
  /** 额外信息 */
  Extra: string;
  /** 实际扫描行数 */
  rowsExamined: number;
  /** 实际匹配行数 */
  rowsMatched: number;
  /** 返回行数 */
  rowsReturned: number;
  /** 执行时间（毫秒） */
  executionTimeMS: number;
  /** 是否使用索引 */
  indexUsed: boolean;
  /** 是否为覆盖索引查询 */
  isCovered: boolean;
  /** 查询阶段（用于复杂查询） */
  inputStage?: QueryPlan;
}

/** 查询缓存条目 */
export interface CacheEntry {
  /** 缓存的数据 */
  data: any[];
  /** 缓存时间 */
  timestamp: number;
  /** 过期时间（毫秒） */
  ttl: number;
  /** 查询条件 */
  query: string;
}

/** 缓存统计信息 */
export interface CacheStats {
  /** 缓存条目数 */
  size: number;
  /** 最大缓存数 */
  maxSize: number;
  /** 缓存命中次数 */
  hits: number;
  /** 缓存未命中次数 */
  misses: number;
  /** 缓存命中率 */
  hitRate: number;
  /** 缓存总大小（估算字节） */
  totalSizeBytes: number;
}
