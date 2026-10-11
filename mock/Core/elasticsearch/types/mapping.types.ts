/**
 * Elasticsearch 映射类型定义
 * 
 * 包含：字段类型、属性映射、动态映射、字段能力等类型定义
 */

// ==================== 字段类型枚举 ====================

/** 核心字段类型 */
export type CoreFieldType =
  | 'text'
  | 'keyword'
  | 'long'
  | 'integer'
  | 'short'
  | 'byte'
  | 'double'
  | 'float'
  | 'half_float'
  | 'scaled_float'
  | 'date'
  | 'date_nanos'
  | 'boolean'
  | 'binary'
  | 'integer_range'
  | 'float_range'
  | 'long_range'
  | 'double_range'
  | 'date_range'
  | 'ip_range';

/** 复杂字段类型 */
export type ComplexFieldType =
  | 'object'
  | 'nested'
  | 'flattened'
  | 'join'
  | 'percolator'
  | 'rank_feature'
  | 'rank_features'
  | 'shape'
  | 'geo_point'
  | 'geo_shape'
  | 'point'
  | 'knn_vector'
  | 'dense_vector'
  | 'sparse_vector'
  | 'search_as_you_type'
  | 'completion'
  | 'token_count'
  | 'murmur3'
  | 'ip'
  | 'version'
  | 'wildcard'
  | 'constant_keyword'
  | 'alias'
  | 'histogram';

/** 字段类型（联合） */
export type FieldType = CoreFieldType | ComplexFieldType | string;

// ==================== 属性映射类型 ====================

/** 基础属性映射 */
export interface BasePropertyMapping {
  type: FieldType;
  /** 字段是否可搜索 */
  index?: boolean;
  /** 字段是否存储 */
  store?: boolean;
  /** 字段是否可以在脚本中访问 */
  doc_values?: boolean;
  /** 字段是否可以参与聚合 */
  fielddata?: boolean;
  /** 字段数据频率过滤 */
  fielddata_frequency_filter?: {
    min?: number;
    max?: number;
    min_segment_size?: number;
  };
  /** 提升权重 */
  boost?: number;
  /** 空值替换 */
  null_value?: any;
  /** 复制到字段 */
  copy_to?: string | string[];
  /** 元数据 */
  meta?: Record<string, string>;
  /** 忽略上面 */
  ignore_above?: number;
  /** 忽略 malformed */
  ignore_malformed?: boolean;
  /** 动态映射 */
  dynamic?: 'true' | 'false' | 'strict' | boolean;
  /** 启用 */
  enabled?: boolean;
}

/** text 类型属性映射 */
export interface TextPropertyMapping extends BasePropertyMapping {
  type: 'text';
  /** 分析器 */
  analyzer?: string;
  /** 搜索分析器 */
  search_analyzer?: string;
  /** 搜索引用分析器 */
  search_quote_analyzer?: string;
  /** 索引选项 */
  index_options?: 'docs' | 'freqs' | 'positions' | 'offsets';
  /** 术语向量 */
  term_vector?: 'no' | 'yes' | 'with_positions' | 'with_offsets' | 'with_positions_offsets' | 'with_positions_payloads' | 'with_positions_offsets_payloads';
  /** 位置增量缺口 */
  position_increment_gap?: number;
  /** 子字段 */
  fields?: Record<string, PropertyMapping>;
  /** 相似度 */
  similarity?: 'BM25' | 'boolean' | 'classic' | string;
  /** 正常化 */
  normalizer?: string;
  /**  eager_global_ordinals */
  eager_global_ordinals?: boolean;
  /** index_phrases */
  index_phrases?: boolean;
  /** index_prefixes */
  index_prefixes?: {
    min_chars?: number;
    max_chars?: number;
  };
}

/** keyword 类型属性映射 */
export interface KeywordPropertyMapping extends BasePropertyMapping {
  type: 'keyword';
  /** 正常化 */
  normalizer?: string;
  /** 忽略上面 */
  ignore_above?: number;
  /** 子字段 */
  fields?: Record<string, PropertyMapping>;
  /** eager_global_ordinals */
  eager_global_ordinals?: boolean;
  /** 相似度 */
  similarity?: 'BM25' | 'boolean' | 'classic' | string;
  /** split_queries_on_whitespace */
  split_queries_on_whitespace?: boolean;
  /** time_series_dimension */
  time_series_dimension?: boolean;
}

/** 数值类型属性映射 */
export interface NumericPropertyMapping extends BasePropertyMapping {
  type: 'long' | 'integer' | 'short' | 'byte' | 'double' | 'float' | 'half_float' | 'scaled_float';
  /** 缩放因子 */
  scaling_factor?: number;
  /**  coerce */
  coerce?: boolean;
  /** 子字段 */
  fields?: Record<string, PropertyMapping>;
  /** time_series_metric */
  time_series_metric?: 'gauge' | 'counter';
  /** time_series_dimension */
  time_series_dimension?: boolean;
}

/** 日期类型属性映射 */
export interface DatePropertyMapping extends BasePropertyMapping {
  type: 'date' | 'date_nanos';
  /** 格式 */
  format?: string;
  /** 时区 */
  locale?: string;
  /** 子字段 */
  fields?: Record<string, PropertyMapping>;
  /** time_series_metric */
  time_series_metric?: 'gauge' | 'counter';
}

/** 布尔类型属性映射 */
export interface BooleanPropertyMapping extends BasePropertyMapping {
  type: 'boolean';
  /** 子字段 */
  fields?: Record<string, PropertyMapping>;
}

/** 二进制类型属性映射 */
export interface BinaryPropertyMapping extends BasePropertyMapping {
  type: 'binary';
}

/** 范围类型属性映射 */
export interface RangePropertyMapping extends BasePropertyMapping {
  type: 'integer_range' | 'float_range' | 'long_range' | 'double_range' | 'date_range' | 'ip_range';
  /**  coerce */
  coerce?: boolean;
  /** 格式 */
  format?: string;
  /** 子字段 */
  fields?: Record<string, PropertyMapping>;
}

/** object 类型属性映射 */
export interface ObjectPropertyMapping extends BasePropertyMapping {
  type: 'object';
  /** 属性 */
  properties?: Record<string, PropertyMapping>;
  /** 动态映射 */
  dynamic?: 'true' | 'false' | 'strict' | boolean;
  /** 启用 */
  enabled?: boolean;
  /** subobjects */
  subobjects?: boolean;
}

/** nested 类型属性映射 */
export interface NestedPropertyMapping extends BasePropertyMapping {
  type: 'nested';
  /** 属性 */
  properties?: Record<string, PropertyMapping>;
  /** 动态映射 */
  dynamic?: 'true' | 'false' | 'strict' | boolean;
  /** include_in_parent */
  include_in_parent?: boolean;
  /** include_in_root */
  include_in_root?: boolean;
}

/** 地理点类型属性映射 */
export interface GeoPointPropertyMapping extends BasePropertyMapping {
  type: 'geo_point';
  /** 子字段 */
  fields?: Record<string, PropertyMapping>;
  /** ignore_z_value */
  ignore_z_value?: boolean;
  /** ignore_malformed */
  ignore_malformed?: boolean;
}

/** 地理形状类型属性映射 */
export interface GeoShapePropertyMapping extends BasePropertyMapping {
  type: 'geo_shape';
  /** tree */
  tree?: 'geohash' | 'quadtree';
  /** precision */
  precision?: string;
  /** tree_levels */
  tree_levels?: string;
  /** strategy */
  strategy?: 'recursive' | 'term' | 'points_only';
  /** distance_error_pct */
  distance_error_pct?: number;
  /** orientation */
  orientation?: 'ccw' | 'cw' | 'right' | 'left';
  /** points_only */
  points_only?: boolean;
  /** ignore_malformed */
  ignore_malformed?: boolean;
  /** coerce */
  coerce?: boolean;
  /** ignore_z_value */
  ignore_z_value?: boolean;
}

/** IP 类型属性映射 */
export interface IpPropertyMapping extends BasePropertyMapping {
  type: 'ip';
  /** 子字段 */
  fields?: Record<string, PropertyMapping>;
}

/** 版本类型属性映射 */
export interface VersionPropertyMapping extends BasePropertyMapping {
  type: 'version';
}

/** 通配符类型属性映射 */
export interface WildcardPropertyMapping extends BasePropertyMapping {
  type: 'wildcard';
  /** null_value */
  null_value?: string;
  /** ignore_above */
  ignore_above?: number;
}

/** 常量关键字类型属性映射 */
export interface ConstantKeywordPropertyMapping extends BasePropertyMapping {
  type: 'constant_keyword';
  /** value */
  value?: string;
}

/** 别名类型属性映射 */
export interface AliasPropertyMapping extends BasePropertyMapping {
  type: 'alias';
  /** path */
  path: string;
}

/** token_count 类型属性映射 */
export interface TokenCountPropertyMapping extends BasePropertyMapping {
  type: 'token_count';
  /** analyzer */
  analyzer: string;
  /** enable_position_increments */
  enable_position_increments?: boolean;
}

/** completion 类型属性映射 */
export interface CompletionPropertyMapping extends BasePropertyMapping {
  type: 'completion';
  /** analyzer */
  analyzer?: string;
  /** search_analyzer */
  search_analyzer?: string;
  /** preserve_separators */
  preserve_separators?: boolean;
  /** preserve_position_increments */
  preserve_position_increments?: boolean;
  /** max_input_length */
  max_input_length?: number;
  /** contexts */
  contexts?: Array<Record<string, any>>;
}

/** search_as_you_type 类型属性映射 */
export interface SearchAsYouTypePropertyMapping extends BasePropertyMapping {
  type: 'search_as_you_type';
  /** analyzer */
  analyzer?: string;
  /** search_analyzer */
  search_analyzer?: string;
  /** max_shingle_size */
  max_shingle_size?: 2 | 3 | 4;
  /** index */
  index?: boolean;
  /** index_options */
  index_options?: 'docs' | 'freqs' | 'positions' | 'offsets';
  /** store */
  store?: boolean;
  /** similarity */
  similarity?: string;
  /** term_vector */
  term_vector?: string;
}

/** 稠密向量类型属性映射 */
export interface DenseVectorPropertyMapping extends BasePropertyMapping {
  type: 'dense_vector';
  /** dims */
  dims?: number;
  /** element_type */
  element_type?: 'float' | 'byte';
  /** similarity */
  similarity?: 'l2_norm' | 'dot_product' | 'cosine' | 'max_inner_product';
  /** index */
  index?: boolean;
  /** index_options */
  index_options?: {
    type?: 'hnsw' | 'int8_hnsw' | 'int4_hnsw' | 'flat' | 'int8_flat';
    m?: number;
    ef_construction?: number;
    confidence_interval?: number;
  };
}

/** 稀疏向量类型属性映射 */
export interface SparseVectorPropertyMapping extends BasePropertyMapping {
  type: 'sparse_vector';
}

/** rank_feature 类型属性映射 */
export interface RankFeaturePropertyMapping extends BasePropertyMapping {
  type: 'rank_feature';
  /** positive_score_impact */
  positive_score_impact?: boolean;
}

/** rank_features 类型属性映射 */
export interface RankFeaturesPropertyMapping extends BasePropertyMapping {
  type: 'rank_features';
}

/** flattened 类型属性映射 */
export interface FlattenedPropertyMapping extends BasePropertyMapping {
  type: 'flattened';
  /** depth_limit */
  depth_limit?: number;
  /** ignore_above */
  ignore_above?: number;
  /** normalizer */
  normalizer?: string;
  /** split_queries_on_whitespace */
  split_queries_on_whitespace?: boolean;
  /** time_series_dimension */
  time_series_dimension?: boolean;
}

/** join 类型属性映射 */
export interface JoinPropertyMapping extends BasePropertyMapping {
  type: 'join';
  /** relations */
  relations: Record<string, string | string[]>;
  /** eager_global_ordinals */
  eager_global_ordinals?: boolean;
}

/** percolator 类型属性映射 */
export interface PercolatorPropertyMapping extends BasePropertyMapping {
  type: 'percolator';
}

/** shape 类型属性映射 */
export interface ShapePropertyMapping extends BasePropertyMapping {
  type: 'shape';
  /** orientation */
  orientation?: 'ccw' | 'cw' | 'right' | 'left';
  /** ignore_malformed */
  ignore_malformed?: boolean;
  /** coerce */
  coerce?: boolean;
  /** ignore_z_value */
  ignore_z_value?: boolean;
}

/** point 类型属性映射 */
export interface PointPropertyMapping extends BasePropertyMapping {
  type: 'point';
  /** ignore_malformed */
  ignore_malformed?: boolean;
  /** ignore_z_value */
  ignore_z_value?: boolean;
}

/** histogram 类型属性映射 */
export interface HistogramPropertyMapping extends BasePropertyMapping {
  type: 'histogram';
}

/** murmur3 类型属性映射 */
export interface Murmur3PropertyMapping extends BasePropertyMapping {
  type: 'murmur3';
}

/** 属性映射（联合类型） */
export type PropertyMapping =
  | TextPropertyMapping
  | KeywordPropertyMapping
  | NumericPropertyMapping
  | DatePropertyMapping
  | BooleanPropertyMapping
  | BinaryPropertyMapping
  | RangePropertyMapping
  | ObjectPropertyMapping
  | NestedPropertyMapping
  | GeoPointPropertyMapping
  | GeoShapePropertyMapping
  | IpPropertyMapping
  | VersionPropertyMapping
  | WildcardPropertyMapping
  | ConstantKeywordPropertyMapping
  | AliasPropertyMapping
  | TokenCountPropertyMapping
  | CompletionPropertyMapping
  | SearchAsYouTypePropertyMapping
  | DenseVectorPropertyMapping
  | SparseVectorPropertyMapping
  | RankFeaturePropertyMapping
  | RankFeaturesPropertyMapping
  | FlattenedPropertyMapping
  | JoinPropertyMapping
  | PercolatorPropertyMapping
  | ShapePropertyMapping
  | PointPropertyMapping
  | HistogramPropertyMapping
  | Murmur3PropertyMapping
  | BasePropertyMapping
  | Record<string, any>;

// ==================== 索引映射类型 ====================

/** 索引映射 */
export interface IndexMappings {
  /** 动态映射 */
  dynamic?: 'true' | 'false' | 'strict' | boolean;
  /** 动态模板 */
  dynamic_templates?: Array<Record<string, any>>;
  /** 属性 */
  properties?: Record<string, PropertyMapping>;
  /** 元数据 */
  _meta?: Record<string, any>;
  /** 源字段过滤 */
  _source?: {
    enabled?: boolean;
    includes?: string[];
    excludes?: string[];
  };
  /** 路由 */
  _routing?: {
    required?: boolean;
  };
  /** 启用 */
  enabled?: boolean;
  /** 日期检测 */
  date_detection?: boolean;
  /** 数值检测 */
  numeric_detection?: boolean;
  /** 动态日期格式 */
  dynamic_date_formats?: string[];
  /** 子对象 */
  subobjects?: boolean;
  /** 数据流时间戳 */
  _data_stream_timestamp?: {
    enabled?: boolean;
  };
  /** 运行时字段 */
  runtime?: Record<string, {
    type: string;
    script?: {
      source: string;
      lang?: string;
      params?: Record<string, any>;
    };
    format?: string;
    [key: string]: any;
  }>;
  /** 其他配置 */
  [key: string]: any;
}

// ==================== 动态映射类型 ====================

/** 动态映射策略 */
export type DynamicMappingStrategy = 'true' | 'false' | 'strict';

/** 动态模板匹配类型 */
export type DynamicTemplateMatchType =
  | 'match'
  | 'unmatch'
  | 'match_mapping_type'
  | 'unmatch_mapping_type'
  | 'match_pattern'
  | 'path_match'
  | 'path_unmatch';

/** 动态模板 */
export interface DynamicTemplate {
  /** 模板名 */
  [templateName: string]: {
    /** 匹配类型 */
    match_mapping_type?: string;
    /** 匹配模式 */
    match?: string;
    /** 不匹配模式 */
    unmatch?: string;
    /** 匹配模式类型 */
    match_pattern?: 'regex' | 'simple';
    /** 路径匹配 */
    path_match?: string;
    /** 路径不匹配 */
    path_unmatch?: string;
    /** 映射配置 */
    mapping?: PropertyMapping;
  };
}

// ==================== 字段能力类型 ====================

/** 字段能力 */
export interface FieldCapability {
  /** 字段类型 */
  type: FieldType;
  /** 是否可搜索 */
  searchable: boolean;
  /** 是否可聚合 */
  aggregatable: boolean;
  /** 索引列表 */
  indices?: string[];
  /** 非搜索索引 */
  non_searchable_indices?: string[];
  /** 非聚合索引 */
  non_aggregatable_indices?: string[];
  /** 元数据 */
  meta?: Record<string, string[]>;
}

/** 字段能力响应 */
export interface FieldCapsResponse {
  /** 索引列表 */
  indices: string[];
  /** 字段能力 */
  fields: Record<string, Record<string, FieldCapability>>;
}

// ==================== 映射验证类型 ====================

/** 映射验证错误 */
export interface MappingValidationError {
  /** 字段路径 */
  field: string;
  /** 错误类型 */
  error: string;
  /** 错误详情 */
  detail?: string;
}

/** 映射验证结果 */
export interface MappingValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors: MappingValidationError[];
  /** 警告列表 */
  warnings: MappingValidationError[];
}
