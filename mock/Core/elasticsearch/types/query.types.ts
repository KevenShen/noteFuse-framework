/**
 * Elasticsearch 查询类型定义
 * 
 * 包含：QueryDSL、各种查询类型（match/term/range/bool/fuzzy/wildcard/geo等）
 */

// ==================== 全文查询类型 ====================

/** match 查询 */
export interface MatchQuery {
  query: string;
  operator?: 'and' | 'or';
  analyzer?: string;
  boost?: number;
  fuzziness?: string | number;
  fuzzy_transpositions?: boolean;
  fuzzy_rewrite?: string;
  lenient?: boolean;
  prefix_length?: number;
  max_expansions?: number;
  zero_terms_query?: 'none' | 'all';
  auto_generate_synonyms_phrase_query?: boolean;
  minimum_should_match?: string | number;
}

/** match_phrase 查询 */
export interface MatchPhraseQuery {
  query: string;
  analyzer?: string;
  boost?: number;
  slop?: number;
  zero_terms_query?: 'none' | 'all';
}

/** match_phrase_prefix 查询 */
export interface MatchPhrasePrefixQuery {
  query: string;
  analyzer?: string;
  boost?: number;
  slop?: number;
  max_expansions?: number;
  zero_terms_query?: 'none' | 'all';
}

/** multi_match 查询 */
export interface MultiMatchQuery {
  query: string;
  fields: string[];
  type?: 'best_fields' | 'most_fields' | 'cross_fields' | 'phrase' | 'phrase_prefix' | 'bool_prefix';
  operator?: 'and' | 'or';
  analyzer?: string;
  boost?: number;
  fuzziness?: string | number;
  fuzzy_transpositions?: boolean;
  lenient?: boolean;
  prefix_length?: number;
  max_expansions?: number;
  minimum_should_match?: string | number;
  tie_breaker?: number;
  auto_generate_synonyms_phrase_query?: boolean;
}

/** query_string 查询 */
export interface QueryStringQuery {
  query: string;
  default_field?: string;
  fields?: string[];
  default_operator?: 'and' | 'or';
  analyzer?: string;
  allow_leading_wildcard?: boolean;
  enable_position_increments?: boolean;
  fuzzy_max_expansions?: number;
  fuzziness?: string | number;
  fuzzy_prefix_length?: number;
  fuzzy_transpositions?: boolean;
  phrase_slop?: number;
  boost?: number;
  auto_generate_phrase_queries?: boolean;
  analyze_wildcard?: boolean;
  max_determinized_states?: number;
  minimum_should_match?: string | number;
  lenient?: boolean;
  time_zone?: string;
  quote_analyzer?: string;
  quote_field_suffix?: string;
  auto_generate_synonyms_phrase_query?: boolean;
  rewrite?: string;
  tie_breaker?: number;
}

/** simple_query_string 查询 */
export interface SimpleQueryStringQuery {
  query: string;
  fields?: string[];
  default_operator?: 'and' | 'or';
  analyzer?: string;
  flags?: string;
  lenient?: boolean;
  minimum_should_match?: string | number;
  quote_field_suffix?: string;
  auto_generate_synonyms_phrase_query?: boolean;
  fuzzy_max_expansions?: number;
  fuzziness?: string | number;
  fuzzy_prefix_length?: number;
  fuzzy_transpositions?: boolean;
  boost?: number;
}

// ==================== 词项查询类型 ====================

/** term 查询 */
export interface TermQuery {
  value: any;
  boost?: number;
}

/** terms 查询 */
export interface TermsQuery {
  index?: string;
  id?: string;
  path?: string;
  routing?: string;
  [key: string]: any;
}

/** range 查询 */
export interface RangeQuery {
  gt?: any;
  gte?: any;
  lt?: any;
  lte?: any;
  format?: string;
  relation?: 'INTERSECTS' | 'CONTAINS' | 'WITHIN';
  time_zone?: string;
  boost?: number;
}

/** exists 查询 */
export interface ExistsQuery {
  field: string;
}

/** ids 查询 */
export interface IdsQuery {
  values: string[];
}

// ==================== 复合查询类型 ====================

/** bool 查询 */
export interface BoolQuery {
  must?: QueryDSL[];
  should?: QueryDSL[];
  must_not?: QueryDSL[];
  filter?: QueryDSL[];
  minimum_should_match?: string | number;
  boost?: number;
}

/** boosting 查询 */
export interface BoostingQuery {
  positive: QueryDSL;
  negative: QueryDSL;
  negative_boost: number;
}

/** constant_score 查询 */
export interface ConstantScoreQuery {
  filter: QueryDSL;
  boost?: number;
}

/** dis_max 查询 */
export interface DisMaxQuery {
  queries: QueryDSL[];
  tie_breaker?: number;
  boost?: number;
}

/** function_score 查询 */
export interface FunctionScoreQuery {
  query?: QueryDSL;
  functions?: Array<Record<string, any>>;
  max_boost?: number;
  score_mode?: 'multiply' | 'sum' | 'avg' | 'first' | 'max' | 'min';
  boost_mode?: 'multiply' | 'replace' | 'sum' | 'avg' | 'max' | 'min';
  min_score?: number;
  boost?: number;
}

// ==================== 模糊查询类型 ====================

/** fuzzy 查询 */
export interface FuzzyQuery {
  value: string;
  fuzziness?: string | number;
  prefix_length?: number;
  max_expansions?: number;
  transpositions?: boolean;
  rewrite?: string;
  boost?: number;
}

/** wildcard 查询 */
export interface WildcardQuery {
  value: string;
  boost?: number;
  rewrite?: string;
  case_insensitive?: boolean;
}

/** regexp 查询 */
export interface RegexpQuery {
  value: string;
  flags?: string;
  max_determinized_states?: number;
  boost?: number;
  rewrite?: string;
  case_insensitive?: boolean;
}

/** prefix 查询 */
export interface PrefixQuery {
  value: string;
  boost?: number;
  rewrite?: string;
}

// ==================== 地理位置查询类型 ====================

/** 地理坐标点 */
export interface GeoPoint {
  lat: number;
  lon: number;
}

/** geo_distance 查询 */
export interface GeoDistanceQuery {
  distance: string;
  distance_type?: 'arc' | 'plane';
  validation_method?: 'STRICT' | 'IGNORE_MALFORMED' | 'COERCE';
  point?: GeoPoint;
  [field: string]: any;
}

/** geo_bounding_box 查询 */
export interface GeoBoundingBoxQuery {
  top_left: GeoPoint;
  bottom_right: GeoPoint;
  validation_method?: 'STRICT' | 'IGNORE_MALFORMED' | 'COERCE';
  type?: 'memory' | 'indexed';
  [field: string]: any;
}

/** geo_polygon 查询 */
export interface GeoPolygonQuery {
  points: GeoPoint[];
  validation_method?: 'STRICT' | 'IGNORE_MALFORMED' | 'COERCE';
  [field: string]: any;
}

/** geo_shape 查询 */
export interface GeoShapeQuery {
  shape: {
    type: string;
    coordinates: any;
  };
  relation?: 'intersects' | 'disjoint' | 'within' | 'contains';
  indexed_shape?: {
    index: string;
    id: string;
    path: string;
    routing?: string;
  };
  ignore_unmapped?: boolean;
  [field: string]: any;
}

// ==================== 其他查询类型 ====================

/** match_all 查询 */
export interface MatchAllQuery {
  boost?: number;
}

/** match_none 查询 */
export interface MatchNoneQuery {
  [key: string]: never;
}

/** nested 查询 */
export interface NestedQuery {
  path: string;
  query: QueryDSL;
  score_mode?: 'avg' | 'sum' | 'min' | 'max' | 'none';
  boost?: number;
  ignore_unmapped?: boolean;
  inner_hits?: Record<string, any>;
}

/** has_child 查询 */
export interface HasChildQuery {
  type: string;
  query: QueryDSL;
  score_mode?: 'avg' | 'sum' | 'min' | 'max' | 'none';
  min_children?: number;
  max_children?: number;
  boost?: number;
  ignore_unmapped?: boolean;
  inner_hits?: Record<string, any>;
}

/** has_parent 查询 */
export interface HasParentQuery {
  parent_type: string;
  query: QueryDSL;
  score?: boolean;
  boost?: number;
  ignore_unmapped?: boolean;
  inner_hits?: Record<string, any>;
}

/** parent_id 查询 */
export interface ParentIdQuery {
  type: string;
  id: string;
  ignore_unmapped?: boolean;
}

/** script 查询 */
export interface ScriptQuery {
  script: {
    source: string;
    lang?: string;
    params?: Record<string, any>;
  };
  boost?: number;
}

/** script_score 查询 */
export interface ScriptScoreQuery {
  query: QueryDSL;
  script: {
    source: string;
    lang?: string;
    params?: Record<string, any>;
  };
  min_score?: number;
  boost?: number;
}

/** percolate 查询 */
export interface PercolateQuery {
  field: string;
  document?: Record<string, any>;
  documents?: Array<Record<string, any>>;
  index?: string;
  id?: string;
  routing?: string;
  preference?: string;
  version?: number;
}

/** more_like_this 查询 */
export interface MoreLikeThisQuery {
  fields?: string[];
  like: string | Array<string | { _index: string; _id: string }>;
  unlike?: string | Array<string | { _index: string; _id: string }>;
  min_term_freq?: number;
  max_query_terms?: number;
  min_doc_freq?: number;
  max_doc_freq?: number;
  min_word_length?: number;
  max_word_length?: number;
  stop_words?: string[];
  analyzer?: string;
  minimum_should_match?: string | number;
  boost_terms?: number;
  include?: boolean;
  boost?: number;
}

/** wrapper 查询 */
export interface WrapperQuery {
  query: string;
}

/** span 查询（基础） */
export interface SpanQuery {
  [key: string]: any;
}

// ==================== QueryDSL 联合类型 ====================

/** 查询DSL（支持Elasticsearch常用查询类型） */
export type QueryDSL =
  | { match: Record<string, MatchQuery | string> }
  | { match_phrase: Record<string, MatchPhraseQuery | string> }
  | { match_phrase_prefix: Record<string, MatchPhrasePrefixQuery | string> }
  | { multi_match: MultiMatchQuery }
  | { query_string: QueryStringQuery }
  | { simple_query_string: SimpleQueryStringQuery }
  | { term: Record<string, TermQuery | any> }
  | { terms: Record<string, any[] | TermsQuery> }
  | { range: Record<string, RangeQuery> }
  | { exists: ExistsQuery }
  | { ids: IdsQuery }
  | { bool: BoolQuery }
  | { boosting: BoostingQuery }
  | { constant_score: ConstantScoreQuery }
  | { dis_max: DisMaxQuery }
  | { function_score: FunctionScoreQuery }
  | { fuzzy: Record<string, FuzzyQuery | string> }
  | { wildcard: Record<string, WildcardQuery | string> }
  | { regexp: Record<string, RegexpQuery | string> }
  | { prefix: Record<string, PrefixQuery | string> }
  | { geo_distance: GeoDistanceQuery }
  | { geo_bounding_box: GeoBoundingBoxQuery }
  | { geo_polygon: GeoPolygonQuery }
  | { geo_shape: GeoShapeQuery }
  | { match_all: MatchAllQuery }
  | { match_none: MatchNoneQuery }
  | { nested: NestedQuery }
  | { has_child: HasChildQuery }
  | { has_parent: HasParentQuery }
  | { parent_id: ParentIdQuery }
  | { script: ScriptQuery }
  | { script_score: ScriptScoreQuery }
  | { percolate: PercolateQuery }
  | { more_like_this: MoreLikeThisQuery }
  | { wrapper: WrapperQuery }
  | { span_term: Record<string, any> }
  | { span_multi: Record<string, any> }
  | { span_first: Record<string, any> }
  | { span_near: Record<string, any> }
  | { span_or: Record<string, any> }
  | { span_not: Record<string, any> }
  | { span_containing: Record<string, any> }
  | { span_within: Record<string, any> }
  | { type: { value: string } }
  | Record<string, any>;

// ==================== 查询辅助类型 ====================

/** 查询类型枚举 */
export type QueryType =
  | 'match'
  | 'match_phrase'
  | 'match_phrase_prefix'
  | 'multi_match'
  | 'query_string'
  | 'simple_query_string'
  | 'term'
  | 'terms'
  | 'range'
  | 'exists'
  | 'ids'
  | 'bool'
  | 'boosting'
  | 'constant_score'
  | 'dis_max'
  | 'function_score'
  | 'fuzzy'
  | 'wildcard'
  | 'regexp'
  | 'prefix'
  | 'geo_distance'
  | 'geo_bounding_box'
  | 'geo_polygon'
  | 'geo_shape'
  | 'match_all'
  | 'match_none'
  | 'nested'
  | 'has_child'
  | 'has_parent'
  | 'parent_id'
  | 'script'
  | 'script_score'
  | 'percolate'
  | 'more_like_this'
  | 'wrapper'
  | 'span_term'
  | 'span_multi'
  | 'span_first'
  | 'span_near'
  | 'span_or'
  | 'span_not'
  | 'span_containing'
  | 'span_within'
  | 'type';

/** 布尔子句类型 */
export type BoolClauseType = 'must' | 'should' | 'must_not' | 'filter';

/** 范围比较操作符 */
export type RangeOperator = 'gt' | 'gte' | 'lt' | 'lte';

/** 距离单位 */
export type DistanceUnit = 'm' | 'km' | 'cm' | 'mm' | 'mi' | 'yd' | 'ft' | 'in' | 'nmi';

/** 排序方向 */
export type SortOrder = 'asc' | 'desc';
