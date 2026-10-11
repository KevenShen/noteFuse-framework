/**
 * Elasticsearch 基础类型定义
 * 
 * 包含：文档、索引元数据、索引数据、搜索请求、搜索结果、配置等核心类型
 */

import type { IndexMappings } from './mapping.types';
import type { QueryDSL } from './query.types';
import type { Aggregation } from './aggregation.types';

// ==================== 文档相关类型 ====================

/** Elasticsearch 文档 */
export interface Document<T = Record<string, any>> {
  /** 索引名 */
  _index: string;
  /** 文档ID */
  _id: string;
  /** 版本号 */
  _version: number;
  /** 序列号 */
  _seq_no: number;
  /** 主分片任期 */
  _primary_term: number;
  /** 文档源数据 */
  _source: T;
  /** 相关性评分 */
  _score?: number;
  /** 高亮结果 */
  _highlight?: Record<string, string[]>;
  /** 路由值 */
  _routing?: string;
  /** 文档类型（ES7后默认_doc） */
  _type?: string;
  /** 排序值（用于search_after） */
  sort?: any[];
  /** 匹配的查询名称 */
  matched_queries?: string[];
}

/** 文档源数据（不含元数据） */
export type DocumentSource<T = Record<string, any>> = T;

// ==================== 索引相关类型 ====================

/** 索引设置 */
export interface IndexSettings {
  /** 分片数 */
  number_of_shards?: number;
  /** 副本数 */
  number_of_replicas?: number;
  /** 刷新间隔 */
  refresh_interval?: string;
  /** 最大结果窗口 */
  max_result_window?: number;
  /** 最大内联结果窗口 */
  max_inner_result_window?: number;
  /** 最大字段长度 */
  max_ngram_diff?: number;
  /** 最大shingle差异 */
  max_shingle_diff?: number;
  /** 分析器 */
  analysis?: Record<string, any>;
  /** 其他设置 */
  [key: string]: any;
}

/** 索引元数据 */
export interface IndexMetadata {
  /** 索引名 */
  name: string;
  /** 索引设置 */
  settings: IndexSettings;
  /** 字段映射 */
  mappings: IndexMappings;
  /** 别名列表 */
  aliases: string[];
  /** 创建时间 */
  creationDate: number;
  /** 索引UUID */
  uuid: string;
  /** 版本号 */
  version: number;
  /** 索引状态 */
  state: 'open' | 'close';
  /** 提供的名称 */
  provided_name?: string;
}

/** 索引数据存储 */
export interface IndexData {
  /** 索引元数据 */
  metadata: IndexMetadata;
  /** 文档存储（文档ID -> 文档） */
  documents: Map<string, Document>;
  /** 版本映射（文档ID -> 版本号） */
  versionMap: Map<string, number>;
  /** 序列号计数器 */
  seqNo: number;
  /** 主分片任期 */
  primaryTerm: number;
  /** 倒排索引（字段名 -> Map<词条, Set<文档ID>>） */
  invertedIndex: Map<string, Map<string, Set<string>>>;
  /** 字段值缓存（字段名 -> Map<文档ID, 值>） */
  fieldCache: Map<string, Map<string, any>>;
}

/** 索引模板 */
export interface IndexTemplate {
  /** 模板名 */
  name: string;
  /** 索引模式 */
  index_patterns: string[];
  /** 模板设置 */
  settings?: IndexSettings;
  /** 模板映射 */
  mappings?: IndexMappings;
  /** 模板别名 */
  aliases?: Record<string, any>;
  /** 优先级 */
  priority?: number;
  /** 版本 */
  version?: number;
}

// ==================== 搜索相关类型 ====================

/** 排序选项 */
export interface SortOption {
  /** 字段名 */
  [field: string]: {
    /** 排序方向 */
    order?: 'asc' | 'desc';
    /** 缺失值处理 */
    missing?: '_first' | '_last' | any;
    /** 未映射字段处理 */
    unmapped_type?: string;
    /** 排序模式 */
    mode?: 'min' | 'max' | 'sum' | 'avg' | 'median';
    /** 嵌套排序 */
    nested?: Record<string, any>;
  } | 'asc' | 'desc';
}

/** 高亮选项 */
export interface HighlightOption {
  /** 字段配置 */
  fields: Record<string, {
    /** 前置标签 */
    pre_tags?: string[];
    /** 后置标签 */
    post_tags?: string[];
    /** 片段数量 */
    number_of_fragments?: number;
    /** 片段大小 */
    fragment_size?: number;
    /** 是否需要匹配 */
    require_field_match?: boolean;
    /** 高亮类型 */
    type?: 'unified' | 'plain' | 'fvh';
  }>;
  /** 全局前置标签 */
  pre_tags?: string[];
  /** 全局后置标签 */
  post_tags?: string[];
  /** 编码器 */
  encoder?: 'default' | 'html';
}

/** 搜索请求 */
export interface SearchRequest<T = Record<string, any>> {
  /** 索引名（支持多索引） */
  index: string | string[];
  /** 查询DSL */
  query?: QueryDSL;
  /** 起始位置 */
  from?: number;
  /** 返回数量 */
  size?: number;
  /** 排序条件 */
  sort?: SortOption[];
  /** 字段过滤 */
  _source?: string[] | boolean | { includes?: string[]; excludes?: string[] };
  /** 高亮配置 */
  highlight?: HighlightOption;
  /** 聚合配置 */
  aggs?: Record<string, Aggregation>;
  /** search_after 分页 */
  search_after?: any[];
  /** scroll 过期时间 */
  scroll?: string;
  /** 是否返回评分解释 */
  explain?: boolean;
  /** 是否跟踪评分 */
  track_scores?: boolean;
  /** 最小评分阈值 */
  min_score?: number;
  /** 建议器 */
  suggest?: Record<string, any>;
  /** 脚本字段 */
  script_fields?: Record<string, any>;
  /** 文档值字段 */
  docvalue_fields?: string[];
  /** 存储字段 */
  stored_fields?: string[] | boolean;
  /** 版本 */
  version?: boolean;
  /** seq_no和primary_term */
  seq_no_primary_term?: boolean;
  /** 终止后 */
  terminate_after?: number;
  /** 超时 */
  timeout?: string;
  /** 允许部分搜索结果 */
  allow_partial_search_results?: boolean;
  /** 搜索类型 */
  search_type?: 'query_then_fetch' | 'dfs_query_then_fetch';
  /**  batched_reduce_size */
  batched_reduce_size?: number;
}

/** 搜索命中 */
export interface SearchHit<T = Record<string, any>> {
  /** 索引 */
  _index: string;
  /** 文档ID */
  _id: string;
  /** 版本号 */
  _version?: number;
  /** 序列号 */
  _seq_no?: number;
  /** 主分片任期 */
  _primary_term?: number;
  /** 评分 */
  _score: number | null;
  /** 源数据 */
  _source?: T;
  /** 高亮 */
  highlight?: Record<string, string[]>;
  /** 排序值 */
  sort?: any[];
  /** 匹配的查询 */
  matched_queries?: string[];
  /** 解释 */
  _explanation?: Record<string, any>;
  /** 嵌套 */
  _nested?: Record<string, any>;
  /** 忽略字段 */
  ignored?: string[];
  /** 忽略字段值 */
  ignored_field_values?: Record<string, any[]>;
  /** 路由值 */
  _routing?: string;
  /** 文档类型 */
  _type?: string;
}

/** 搜索结果 */
export interface SearchResult<T = Record<string, any>> {
  /** 耗时（毫秒） */
  took: number;
  /** 是否超时 */
  timed_out: boolean;
  /** _shards信息 */
  _shards: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  /** 命中信息 */
  hits: {
    total: {
      value: number;
      relation: 'eq' | 'gte';
    };
    max_score: number | null;
    hits: SearchHit<T>[];
  };
  /** 聚合结果 */
  aggregations?: Record<string, any>;
  /** 建议结果 */
  suggest?: Record<string, any>;
  /** scroll_id */
  _scroll_id?: string;
  /** 终止后 */
  terminated_early?: boolean;
  /** 数量减少 */
  num_reduce_phases?: number;
}

/** 计数结果 */
export interface CountResult {
  count: number;
  _shards: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
}

// ==================== 批量操作类型 ====================

/** 批量操作项 */
export interface BulkOperation {
  /** 操作类型 */
  index?: {
    _index: string;
    _id?: string;
    _version?: number;
    routing?: string;
  };
  /** 创建操作 */
  create?: {
    _index: string;
    _id: string;
    _version?: number;
    routing?: string;
  };
  /** 更新操作 */
  update?: {
    _index: string;
    _id: string;
    _version?: number;
    routing?: string;
    retry_on_conflict?: number;
  };
  /** 删除操作 */
  delete?: {
    _index: string;
    _id: string;
    _version?: number;
    routing?: string;
  };
}

/** 批量操作结果 */
export interface BulkResult {
  took: number;
  errors: boolean;
  items: Array<{
    [operation: string]: {
      _index: string;
      _id: string;
      _version: number;
      result?: string;
      _shards?: Record<string, any>;
      _seq_no?: number;
      _primary_term?: number;
      status: number;
      error?: Record<string, any>;
    };
  }>;
}

// ==================== 配置类型 ====================

/** Elasticsearch 配置 */
export interface ElasticsearchConfig {
  /** 集群名 */
  clusterName?: string;
  /** 默认分片数 */
  defaultNumberOfShards?: number;
  /** 默认副本数 */
  defaultNumberOfReplicas?: number;
  /** 默认刷新间隔 */
  defaultRefreshInterval?: string;
  /** 启用查询缓存 */
  enableQueryCache?: boolean;
  /** 查询缓存TTL（毫秒） */
  queryCacheTTL?: number;
  /** 最大结果窗口 */
  maxResultWindow?: number;
  /** 超过窗口是否报错 */
  maxResultWindowError?: boolean;
  /** 默认分词器 */
  defaultAnalyzer?: string;
  /** 启用动态映射 */
  enableDynamicMapping?: boolean;
  /** 启用倒排索引 */
  enableInvertedIndex?: boolean;
  /** 启用字段缓存 */
  enableFieldCache?: boolean;
  /** 调试模式 */
  debug?: boolean;
}

/** 默认配置 */
export const DEFAULT_ELASTICSEARCH_CONFIG: Required<ElasticsearchConfig> = {
  clusterName: 'note-fuse-cluster',
  defaultNumberOfShards: 1,
  defaultNumberOfReplicas: 0,
  defaultRefreshInterval: '1s',
  enableQueryCache: true,
  queryCacheTTL: 60 * 1000,
  maxResultWindow: 10000,
  maxResultWindowError: true,
  defaultAnalyzer: 'standard',
  enableDynamicMapping: true,
  enableInvertedIndex: true,
  enableFieldCache: true,
  debug: false,
};

// ==================== 脚本类型 ====================

/** 脚本 */
export interface Script {
  source: string;
  lang?: string;
  params?: Record<string, any>;
}

/** 内联脚本 */
export type InlineScript = string | Script;

// ==================== 错误类型 ====================

/** Elasticsearch 错误 */
export interface ElasticsearchError {
  error: {
    type: string;
    reason: string;
    index?: string;
    index_uuid?: string;
    shard?: string;
    root_cause?: Array<Record<string, any>>;
    caused_by?: Record<string, any>;
  };
  status: number;
}
