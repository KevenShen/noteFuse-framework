/**
 * Elasticsearch 聚合类型定义
 * 
 * 包含：指标聚合、桶聚合、管道聚合等类型定义
 */

// ==================== 聚合基础类型 ====================

/** 聚合类型 */
export type AggregationType =
  // 指标聚合
  | 'avg'
  | 'sum'
  | 'min'
  | 'max'
  | 'value_count'
  | 'stats'
  | 'extended_stats'
  | 'cardinality'
  | 'percentiles'
  | 'percentile_ranks'
  | 'median_absolute_deviation'
  | 'top_hits'
  | 'scripted_metric'
  // 桶聚合
  | 'terms'
  | 'range'
  | 'date_range'
  | 'histogram'
  | 'date_histogram'
  | 'filters'
  | 'nested'
  | 'children'
  | 'missing'
  | 'global'
  | 'ip_range'
  | 'geohash_grid'
  | 'geotile_grid'
  | 'geo_centroid'
  | 'composite'
  | 'adjacency_matrix'
  | 'significant_terms'
  | 'significant_text'
  | 'rare_terms'
  | 'sampler'
  | 'diversified_sampler'
  // 管道聚合
  | 'avg_bucket'
  | 'max_bucket'
  | 'min_bucket'
  | 'sum_bucket'
  | 'stats_bucket'
  | 'extended_stats_bucket'
  | 'percentiles_bucket'
  | 'bucket_script'
  | 'bucket_selector'
  | 'bucket_sort'
  | 'cumulative_sum'
  | 'cumulative_cardinality'
  | 'derivative'
  | 'serial_diff'
  | 'moving_avg'
  | 'moving_percentiles'
  | 'normalized_score';

/** 聚合配置 */
export interface Aggregation {
  /** 字段名 */
  field?: string;
  /** 脚本 */
  script?: {
    source: string;
    lang?: string;
    params?: Record<string, any>;
  };
  /** 缺失值 */
  missing?: any;
  /** 格式 */
  format?: string;
  /** 权重字段 */
  weight_field?: string;
  /** 子聚合 */
  aggs?: Record<string, Aggregation>;
  /** 子聚合（别名） */
  aggregations?: Record<string, Aggregation>;
  /** 其他配置 */
  [key: string]: any;
}

// ==================== 指标聚合类型 ====================

/** avg 聚合 */
export interface AvgAggregation extends Aggregation {
  field: string;
}

/** sum 聚合 */
export interface SumAggregation extends Aggregation {
  field: string;
}

/** min 聚合 */
export interface MinAggregation extends Aggregation {
  field: string;
}

/** max 聚合 */
export interface MaxAggregation extends Aggregation {
  field: string;
}

/** value_count 聚合 */
export interface ValueCountAggregation extends Aggregation {
  field: string;
}

/** stats 聚合 */
export interface StatsAggregation extends Aggregation {
  field: string;
}

/** extended_stats 聚合 */
export interface ExtendedStatsAggregation extends Aggregation {
  field: string;
  sigma?: number;
}

/** cardinality 聚合 */
export interface CardinalityAggregation extends Aggregation {
  field: string;
  precision_threshold?: number;
  rehash?: boolean;
}

/** percentiles 聚合 */
export interface PercentilesAggregation extends Aggregation {
  field: string;
  percents?: number[];
  keyed?: boolean;
  tdigest?: {
    compression?: number;
    execution_hint?: 'accurate' | 'approximate';
  };
  hdr?: {
    number_of_significant_value_digits?: number;
  };
}

/** percentile_ranks 聚合 */
export interface PercentileRanksAggregation extends Aggregation {
  field: string;
  values: number[];
  keyed?: boolean;
  tdigest?: {
    compression?: number;
  };
  hdr?: {
    number_of_significant_value_digits?: number;
  };
}

/** median_absolute_deviation 聚合 */
export interface MedianAbsoluteDeviationAggregation extends Aggregation {
  field: string;
  compression?: number;
}

/** top_hits 聚合 */
export interface TopHitsAggregation extends Aggregation {
  size?: number;
  from?: number;
  sort?: Array<Record<string, any>>;
  _source?: string[] | boolean | { includes?: string[]; excludes?: string[] };
  highlight?: Record<string, any>;
  explain?: boolean;
  script_fields?: Record<string, any>;
  docvalue_fields?: string[];
  stored_fields?: string[] | boolean;
  track_scores?: boolean;
  version?: boolean;
  seq_no_primary_term?: boolean;
}

/** scripted_metric 聚合 */
export interface ScriptedMetricAggregation extends Aggregation {
  init_script?: { source: string; params?: Record<string, any> };
  map_script: { source: string; params?: Record<string, any> };
  combine_script?: { source: string; params?: Record<string, any> };
  reduce_script: { source: string; params?: Record<string, any> };
}

// ==================== 桶聚合类型 ====================

/** terms 聚合 */
export interface TermsAggregation extends Aggregation {
  field: string;
  size?: number;
  shard_size?: number;
  show_term_doc_count_error?: boolean;
  order?: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>;
  min_doc_count?: number;
  shard_min_doc_count?: number;
  include?: string | string[] | { partition?: number; num_partitions?: number };
  exclude?: string | string[];
  missing?: any;
  value_type?: string;
  execution_hint?: 'map' | 'global_ordinals' | 'bytes_hash';
  collect_mode?: 'breadth_first' | 'depth_first';
}

/** range 聚合 */
export interface RangeAggregation extends Aggregation {
  field: string;
  ranges: Array<{
    key?: string;
    from?: number;
    to?: number;
  }>;
  keyed?: boolean;
}

/** date_range 聚合 */
export interface DateRangeAggregation extends Aggregation {
  field: string;
  format?: string;
  time_zone?: string;
  ranges: Array<{
    key?: string;
    from?: string | number;
    to?: string | number;
  }>;
  keyed?: boolean;
}

/** histogram 聚合 */
export interface HistogramAggregation extends Aggregation {
  field: string;
  interval: number;
  min_doc_count?: number;
  extended_bounds?: {
    min: number;
    max: number;
  };
  hard_bounds?: {
    min: number;
    max: number;
  };
  keyed?: boolean;
  order?: Record<string, 'asc' | 'desc'>;
  offset?: number;
  missing?: number;
}

/** date_histogram 聚合 */
export interface DateHistogramAggregation extends Aggregation {
  field: string;
  interval?: string;
  calendar_interval?: string;
  fixed_interval?: string;
  min_doc_count?: number;
  extended_bounds?: {
    min: string | number;
    max: string | number;
  };
  hard_bounds?: {
    min: string | number;
    max: string | number;
  };
  keyed?: boolean;
  order?: Record<string, 'asc' | 'desc'>;
  offset?: string;
  missing?: string | number;
  format?: string;
  time_zone?: string;
}

/** filters 聚合 */
export interface FiltersAggregation extends Aggregation {
  filters: Record<string, any> | Array<Record<string, any>>;
  other_bucket?: boolean;
  other_bucket_key?: string;
  keyed?: boolean;
}

/** nested 聚合 */
export interface NestedAggregation extends Aggregation {
  path: string;
}

/** children 聚合 */
export interface ChildrenAggregation extends Aggregation {
  type: string;
}

/** missing 聚合 */
export interface MissingAggregation extends Aggregation {
  field: string;
}

/** global 聚合 */
export interface GlobalAggregation extends Aggregation {
  [key: string]: any;
}

/** ip_range 聚合 */
export interface IpRangeAggregation extends Aggregation {
  field: string;
  ranges: Array<{
    key?: string;
    from?: string;
    to?: string;
    mask?: string;
  }>;
  keyed?: boolean;
}

/** geohash_grid 聚合 */
export interface GeohashGridAggregation extends Aggregation {
  field: string;
  precision?: number;
  size?: number;
  shard_size?: number;
}

/** geotile_grid 聚合 */
export interface GeotileGridAggregation extends Aggregation {
  field: string;
  precision?: number;
  size?: number;
  shard_size?: number;
  bounds?: {
    top_left: { lat: number; lon: number };
    bottom_right: { lat: number; lon: number };
  };
}

/** geo_centroid 聚合 */
export interface GeoCentroidAggregation extends Aggregation {
  field: string;
  count?: number;
  location?: {
    lat: number;
    lon: number;
  };
}

/** composite 聚合 */
export interface CompositeAggregation extends Aggregation {
  sources: Array<Record<string, any>>;
  size?: number;
  after?: Record<string, any>;
}

/** adjacency_matrix 聚合 */
export interface AdjacencyMatrixAggregation extends Aggregation {
  filters: Record<string, any>;
  separator?: string;
}

/** significant_terms 聚合 */
export interface SignificantTermsAggregation extends Aggregation {
  field: string;
  size?: number;
  shard_size?: number;
  min_doc_count?: number;
  shard_min_doc_count?: number;
  background_filter?: Record<string, any>;
  mutual_information?: Record<string, any>;
  chi_square?: Record<string, any>;
  gnd?: Record<string, any>;
  jlh?: Record<string, any>;
  include?: string | string[];
  exclude?: string | string[];
  execution_hint?: 'map' | 'global_ordinals';
}

/** significant_text 聚合 */
export interface SignificantTextAggregation extends Aggregation {
  field: string;
  size?: number;
  shard_size?: number;
  min_doc_count?: number;
  shard_min_doc_count?: number;
  background_filter?: Record<string, any>;
  source_fields?: string[];
  filter_duplicate_text?: boolean;
  include?: string | string[];
  exclude?: string | string[];
}

/** rare_terms 聚合 */
export interface RareTermsAggregation extends Aggregation {
  field: string;
  max_doc_count?: number;
  include?: string | string[];
  exclude?: string | string[];
  precision?: number;
  missing?: any;
  value_type?: string;
}

/** sampler 聚合 */
export interface SamplerAggregation extends Aggregation {
  shard_size?: number;
}

/** diversified_sampler 聚合 */
export interface DiversifiedSamplerAggregation extends Aggregation {
  shard_size?: number;
  max_docs_per_value?: number;
  execution_hint?: 'map' | 'global_ordinals' | 'bytes_hash';
}

// ==================== 管道聚合类型 ====================

/** avg_bucket 聚合 */
export interface AvgBucketAggregation extends Aggregation {
  buckets_path: string | Record<string, string>;
  gap_policy?: 'skip' | 'insert_zeros';
  format?: string;
}

/** max_bucket 聚合 */
export interface MaxBucketAggregation extends Aggregation {
  buckets_path: string | Record<string, string>;
  gap_policy?: 'skip' | 'insert_zeros';
  format?: string;
}

/** min_bucket 聚合 */
export interface MinBucketAggregation extends Aggregation {
  buckets_path: string | Record<string, string>;
  gap_policy?: 'skip' | 'insert_zeros';
  format?: string;
}

/** sum_bucket 聚合 */
export interface SumBucketAggregation extends Aggregation {
  buckets_path: string | Record<string, string>;
  gap_policy?: 'skip' | 'insert_zeros';
  format?: string;
}

/** stats_bucket 聚合 */
export interface StatsBucketAggregation extends Aggregation {
  buckets_path: string | Record<string, string>;
  gap_policy?: 'skip' | 'insert_zeros';
  format?: string;
}

/** extended_stats_bucket 聚合 */
export interface ExtendedStatsBucketAggregation extends Aggregation {
  buckets_path: string | Record<string, string>;
  gap_policy?: 'skip' | 'insert_zeros';
  sigma?: number;
  format?: string;
}

/** percentiles_bucket 聚合 */
export interface PercentilesBucketAggregation extends Aggregation {
  buckets_path: string | Record<string, string>;
  gap_policy?: 'skip' | 'insert_zeros';
  percents?: number[];
  format?: string;
}

/** bucket_script 聚合 */
export interface BucketScriptAggregation extends Aggregation {
  buckets_path: Record<string, string>;
  script: {
    source: string;
    lang?: string;
    params?: Record<string, any>;
  };
  gap_policy?: 'skip' | 'insert_zeros';
  format?: string;
}

/** bucket_selector 聚合 */
export interface BucketSelectorAggregation extends Aggregation {
  buckets_path: Record<string, string>;
  script: {
    source: string;
    lang?: string;
    params?: Record<string, any>;
  };
  gap_policy?: 'skip' | 'insert_zeros';
}

/** bucket_sort 聚合 */
export interface BucketSortAggregation extends Aggregation {
  sort?: Array<Record<string, any>>;
  from?: number;
  size?: number;
  gap_policy?: 'skip' | 'insert_zeros';
}

/** cumulative_sum 聚合 */
export interface CumulativeSumAggregation extends Aggregation {
  buckets_path: string | Record<string, string>;
  format?: string;
}

/** cumulative_cardinality 聚合 */
export interface CumulativeCardinalityAggregation extends Aggregation {
  buckets_path: string | Record<string, string>;
  format?: string;
}

/** derivative 聚合 */
export interface DerivativeAggregation extends Aggregation {
  buckets_path: string | Record<string, string>;
  gap_policy?: 'skip' | 'insert_zeros';
  format?: string;
}

/** serial_diff 聚合 */
export interface SerialDiffAggregation extends Aggregation {
  buckets_path: string | Record<string, string>;
  lag?: number;
  gap_policy?: 'skip' | 'insert_zeros';
  format?: string;
}

/** moving_avg 聚合 */
export interface MovingAvgAggregation extends Aggregation {
  buckets_path: string | Record<string, string>;
  model?: 'simple' | 'linear' | 'ewma' | 'holt' | 'holt_winters';
  window?: number;
  minimize?: boolean;
  gap_policy?: 'skip' | 'insert_zeros';
  settings?: Record<string, any>;
  predict?: number;
  format?: string;
}

/** moving_percentiles 聚合 */
export interface MovingPercentilesAggregation extends Aggregation {
  buckets_path: string | Record<string, string>;
  window?: number;
  shift?: number;
  keyed?: boolean;
  gap_policy?: 'skip' | 'insert_zeros';
  format?: string;
}

/** normalized_score 聚合 */
export interface NormalizedScoreAggregation extends Aggregation {
  buckets_path: string | Record<string, string>;
  method?: 'rescale_0_1' | 'rescale_0_100' | 'percentile' | 'softmax' | 'simple';
  gap_policy?: 'skip' | 'insert_zeros';
  format?: string;
}

// ==================== 聚合结果类型 ====================

/** 指标聚合结果 */
export interface MetricAggregationResult {
  value?: number | null;
  value_as_string?: string;
  values?: Record<string, number | null>;
  count?: number;
  min?: number | null;
  max?: number | null;
  avg?: number | null;
  sum?: number | null;
  sum_of_squares?: number | null;
  variance?: number | null;
  variance_population?: number | null;
  variance_sampling?: number | null;
  std_deviation?: number | null;
  std_deviation_population?: number | null;
  std_deviation_sampling?: number | null;
  std_deviation_bounds?: {
    upper?: number | null;
    lower?: number | null;
  };
  [key: string]: any;
}

/** 桶聚合结果 */
export interface BucketAggregationResult {
  buckets: Array<{
    key: string | number;
    key_as_string?: string;
    doc_count: number;
    from?: number;
    from_as_string?: string;
    to?: number;
    to_as_string?: string;
    doc_count_error_upper_bound?: number;
    sum_other_doc_count?: number;
    [aggregationName: string]: any;
  }> | Record<string, {
    key?: string | number;
    doc_count: number;
    [aggregationName: string]: any;
  }>;
  doc_count_error_upper_bound?: number;
  sum_other_doc_count?: number;
  [key: string]: any;
}

/** 管道聚合结果 */
export interface PipelineAggregationResult {
  value?: number | null;
  value_as_string?: string;
  values?: Record<string, number | null>;
  [key: string]: any;
}

/** 聚合结果 */
export type AggregationResult =
  | MetricAggregationResult
  | BucketAggregationResult
  | PipelineAggregationResult
  | Record<string, any>;
