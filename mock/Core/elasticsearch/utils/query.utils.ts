/**
 * Elasticsearch 查询工具函数
 * 
 * 包含：查询DSL解析、过滤条件匹配、布尔查询组合、字段值提取等
 */

import type {
  QueryDSL,
  BoolQuery,
  MatchQuery,
  TermQuery,
  RangeQuery,
  FuzzyQuery,
  WildcardQuery,
  PrefixQuery,
  GeoPoint,
  Document,
} from '../types';

import {
  fuzzyMatch,
  wildcardMatch,
  prefixMatch,
  phraseMatch,
  inRange,
  calculateGeoDistance,
  pointInBoundingBox,
  pointInPolygon,
  getNestedValue,
} from './elasticsearch.utils';

// ==================== 查询DSL解析 ====================

/**
 * 解析查询DSL，提取查询类型和参数
 * 
 * @param query 查询DSL
 * @returns 解析后的查询信息
 */
export function parseQueryDSL(query: QueryDSL): {
  type: string;
  field?: string;
  params: any;
} {
  if (!query || typeof query !== 'object') {
    return { type: 'match_all', params: {} };
  }

  const keys = Object.keys(query);
  if (keys.length === 0) {
    return { type: 'match_all', params: {} };
  }

  const type = keys[0];
  const value = (query as Record<string, any>)[type];

  // 对于 match、term、range 等查询，value 是 { field: params }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const fieldKeys = Object.keys(value);
    if (fieldKeys.length === 1) {
      return {
        type,
        field: fieldKeys[0],
        params: value[fieldKeys[0]],
      };
    }
  }

  return { type, params: value };
}

/**
 * 获取查询类型
 */
export function getQueryType(query: QueryDSL): string {
  if (!query || typeof query !== 'object') return 'match_all';
  const keys = Object.keys(query);
  return keys.length > 0 ? keys[0] : 'match_all';
}

// ==================== 文档匹配判断 ====================

/**
 * 判断文档是否匹配查询
 * 
 * @param doc 文档
 * @param query 查询DSL
 * @returns 是否匹配
 */
export function matchesQuery(doc: Document, query: QueryDSL): boolean {
  if (!query) return true;

  const queryType = getQueryType(query);

  switch (queryType) {
    case 'match_all':
      return true;

    case 'match_none':
      return false;

    case 'match':
      return matchesMatchQuery(doc, (query as any).match);

    case 'match_phrase':
      return matchesMatchPhraseQuery(doc, (query as any).match_phrase);

    case 'match_phrase_prefix':
      return matchesMatchPhrasePrefixQuery(doc, (query as any).match_phrase_prefix);

    case 'multi_match':
      return matchesMultiMatchQuery(doc, (query as any).multi_match);

    case 'term':
      return matchesTermQuery(doc, (query as any).term);

    case 'terms':
      return matchesTermsQuery(doc, (query as any).terms);

    case 'range':
      return matchesRangeQuery(doc, (query as any).range);

    case 'exists':
      return matchesExistsQuery(doc, (query as any).exists);

    case 'ids':
      return matchesIdsQuery(doc, (query as any).ids);

    case 'bool':
      return matchesBoolQuery(doc, (query as any).bool);

    case 'fuzzy':
      return matchesFuzzyQuery(doc, (query as any).fuzzy);

    case 'wildcard':
      return matchesWildcardQuery(doc, (query as any).wildcard);

    case 'regexp':
      return matchesRegexpQuery(doc, (query as any).regexp);

    case 'prefix':
      return matchesPrefixQuery(doc, (query as any).prefix);

    case 'geo_distance':
      return matchesGeoDistanceQuery(doc, (query as any).geo_distance);

    case 'geo_bounding_box':
      return matchesGeoBoundingBoxQuery(doc, (query as any).geo_bounding_box);

    case 'geo_polygon':
      return matchesGeoPolygonQuery(doc, (query as any).geo_polygon);

    case 'nested':
      return matchesNestedQuery(doc, (query as any).nested);

    case 'constant_score':
      return matchesQuery(doc, (query as any).constant_score?.filter || {});

    case 'function_score':
      return matchesQuery(doc, (query as any).function_score?.query || { match_all: {} });

    case 'boosting':
      return matchesQuery(doc, (query as any).boosting?.positive || {});

    case 'dis_max':
      return matchesDisMaxQuery(doc, (query as any).dis_max);

    case 'query_string':
      return matchesQueryStringQuery(doc, (query as any).query_string);

    case 'simple_query_string':
      return matchesSimpleQueryStringQuery(doc, (query as any).simple_query_string);

    case 'script':
      return true; // 简化处理：脚本查询默认匹配

    case 'script_score':
      return matchesQuery(doc, (query as any).script_score?.query || {});

    case 'has_child':
    case 'has_parent':
    case 'parent_id':
      return true; // 简化处理：父子查询默认匹配

    case 'percolate':
      return true; // 简化处理：渗透查询默认匹配

    case 'more_like_this':
      return true; // 简化处理：相似查询默认匹配

    case 'wrapper':
      return true; // 简化处理：包装查询默认匹配

    default:
      // 未知查询类型，默认匹配
      return true;
  }
}

// ==================== 具体查询匹配 ====================

/**
 * match 查询匹配
 */
function matchesMatchQuery(doc: Document, matchQuery: Record<string, MatchQuery | string>): boolean {
  for (const [field, queryValue] of Object.entries(matchQuery)) {
    const fieldValue = getNestedValue(doc._source, field);
    if (fieldValue === undefined || fieldValue === null) return false;

    const queryText = typeof queryValue === 'string' ? queryValue : queryValue.query;
    const operator = typeof queryValue === 'object' ? queryValue.operator : 'or';

    if (!queryText) return true;

    const queryTerms = queryText.toLowerCase().split(/\s+/).filter(t => t);
    const fieldText = String(fieldValue).toLowerCase();

    if (operator === 'and') {
      return queryTerms.every(term => fieldText.includes(term));
    } else {
      return queryTerms.some(term => fieldText.includes(term));
    }
  }
  return true;
}

/**
 * match_phrase 查询匹配
 */
function matchesMatchPhraseQuery(doc: Document, query: Record<string, any>): boolean {
  for (const [field, queryValue] of Object.entries(query)) {
    const fieldValue = getNestedValue(doc._source, field);
    if (fieldValue === undefined || fieldValue === null) return false;

    const phrase = typeof queryValue === 'string' ? queryValue : queryValue.query;
    const slop = typeof queryValue === 'object' ? (queryValue.slop || 0) : 0;

    if (!phrase) return true;

    return phraseMatch(String(fieldValue), phrase, slop);
  }
  return true;
}

/**
 * match_phrase_prefix 查询匹配
 */
function matchesMatchPhrasePrefixQuery(doc: Document, query: Record<string, any>): boolean {
  for (const [field, queryValue] of Object.entries(query)) {
    const fieldValue = getNestedValue(doc._source, field);
    if (fieldValue === undefined || fieldValue === null) return false;

    const phrase = typeof queryValue === 'string' ? queryValue : queryValue.query;
    if (!phrase) return true;

    const fieldText = String(fieldValue).toLowerCase();
    const phraseText = phrase.toLowerCase();

    // 简化处理：检查短语是否是字段文本的前缀或包含
    return fieldText.includes(phraseText) || fieldText.startsWith(phraseText);
  }
  return true;
}

/**
 * multi_match 查询匹配
 */
function matchesMultiMatchQuery(doc: Document, query: any): boolean {
  const { query: queryText, fields = [] } = query;
  if (!queryText) return true;

  return fields.some((field: string) => {
    const fieldValue = getNestedValue(doc._source, field.replace(/\^.*$/, ''));
    if (fieldValue === undefined || fieldValue === null) return false;
    return String(fieldValue).toLowerCase().includes(queryText.toLowerCase());
  });
}

/**
 * term 查询匹配
 */
function matchesTermQuery(doc: Document, termQuery: Record<string, TermQuery | any>): boolean {
  for (const [field, queryValue] of Object.entries(termQuery)) {
    const fieldValue = getNestedValue(doc._source, field);
    if (fieldValue === undefined || fieldValue === null) return false;

    const termValue = typeof queryValue === 'object' ? queryValue.value : queryValue;
    return String(fieldValue) === String(termValue);
  }
  return true;
}

/**
 * terms 查询匹配
 */
function matchesTermsQuery(doc: Document, termsQuery: Record<string, any[] | any>): boolean {
  for (const [field, queryValue] of Object.entries(termsQuery)) {
    const fieldValue = getNestedValue(doc._source, field);
    if (fieldValue === undefined || fieldValue === null) return false;

    const values = Array.isArray(queryValue) ? queryValue : (queryValue.values || []);
    return values.some((v: any) => String(fieldValue) === String(v));
  }
  return true;
}

/**
 * range 查询匹配
 */
function matchesRangeQuery(doc: Document, rangeQuery: Record<string, RangeQuery>): boolean {
  for (const [field, queryValue] of Object.entries(rangeQuery)) {
    const fieldValue = getNestedValue(doc._source, field);
    if (fieldValue === undefined || fieldValue === null) return false;

    return inRange(fieldValue, queryValue);
  }
  return true;
}

/**
 * exists 查询匹配
 */
function matchesExistsQuery(doc: Document, query: { field: string }): boolean {
  const fieldValue = getNestedValue(doc._source, query.field);
  return fieldValue !== undefined && fieldValue !== null;
}

/**
 * ids 查询匹配
 */
function matchesIdsQuery(doc: Document, query: { values: string[] }): boolean {
  return query.values.includes(doc._id);
}

/**
 * bool 查询匹配
 */
function matchesBoolQuery(doc: Document, boolQuery: BoolQuery): boolean {
  const { must = [], should = [], must_not = [], filter = [] } = boolQuery;

  // must：所有查询都必须匹配
  const mustMatch = must.every(q => matchesQuery(doc, q));
  if (!mustMatch) return false;

  // filter：所有过滤条件都必须匹配（不影响评分）
  const filterMatch = filter.every(q => matchesQuery(doc, q));
  if (!filterMatch) return false;

  // must_not：所有查询都必须不匹配
  const mustNotMatch = must_not.every(q => !matchesQuery(doc, q));
  if (!mustNotMatch) return false;

  // should：至少一个查询匹配（如果有 minimum_should_match 则按要求）
  if (should.length > 0) {
    const shouldMatchCount = should.filter(q => matchesQuery(doc, q)).length;
    const minimumShouldMatch = boolQuery.minimum_should_match;

    if (typeof minimumShouldMatch === 'number') {
      return shouldMatchCount >= minimumShouldMatch;
    } else if (typeof minimumShouldMatch === 'string') {
      // 简化处理：百分比
      const percent = parseInt(minimumShouldMatch, 10);
      if (!isNaN(percent)) {
        return shouldMatchCount >= Math.ceil(should.length * percent / 100);
      }
    }

    // 默认：如果有 must 或 filter，则 should 不强制；否则至少一个匹配
    if (must.length > 0 || filter.length > 0) {
      return true;
    }
    return shouldMatchCount > 0;
  }

  return true;
}

/**
 * fuzzy 查询匹配
 */
function matchesFuzzyQuery(doc: Document, fuzzyQuery: Record<string, FuzzyQuery | string>): boolean {
  for (const [field, queryValue] of Object.entries(fuzzyQuery)) {
    const fieldValue = getNestedValue(doc._source, field);
    if (fieldValue === undefined || fieldValue === null) return false;

    const queryText = typeof queryValue === 'string' ? queryValue : queryValue.value;
    const fuzziness = typeof queryValue === 'object' ? queryValue.fuzziness : 'AUTO';

    if (!queryText) return true;

    // 检查字段值中的每个词是否与查询词模糊匹配
    const fieldWords = String(fieldValue).toLowerCase().split(/\s+/);
    return fieldWords.some(word => fuzzyMatch(word, queryText.toLowerCase(), fuzziness));
  }
  return true;
}

/**
 * wildcard 查询匹配
 */
function matchesWildcardQuery(doc: Document, wildcardQuery: Record<string, WildcardQuery | string>): boolean {
  for (const [field, queryValue] of Object.entries(wildcardQuery)) {
    const fieldValue = getNestedValue(doc._source, field);
    if (fieldValue === undefined || fieldValue === null) return false;

    const pattern = typeof queryValue === 'string' ? queryValue : queryValue.value;
    if (!pattern) return true;

    return wildcardMatch(String(fieldValue), pattern);
  }
  return true;
}

/**
 * regexp 查询匹配
 */
function matchesRegexpQuery(doc: Document, regexpQuery: Record<string, any>): boolean {
  for (const [field, queryValue] of Object.entries(regexpQuery)) {
    const fieldValue = getNestedValue(doc._source, field);
    if (fieldValue === undefined || fieldValue === null) return false;

    const pattern = typeof queryValue === 'string' ? queryValue : queryValue.value;
    if (!pattern) return true;

    try {
      const regex = new RegExp(pattern);
      return regex.test(String(fieldValue));
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * prefix 查询匹配
 */
function matchesPrefixQuery(doc: Document, prefixQuery: Record<string, PrefixQuery | string>): boolean {
  for (const [field, queryValue] of Object.entries(prefixQuery)) {
    const fieldValue = getNestedValue(doc._source, field);
    if (fieldValue === undefined || fieldValue === null) return false;

    const prefix = typeof queryValue === 'string' ? queryValue : queryValue.value;
    if (!prefix) return true;

    return prefixMatch(String(fieldValue), prefix);
  }
  return true;
}

/**
 * geo_distance 查询匹配
 */
function matchesGeoDistanceQuery(doc: Document, query: any): boolean {
  const { distance, distance_type = 'arc' } = query;

  for (const [field, value] of Object.entries(query)) {
    if (field === 'distance' || field === 'distance_type' || field === 'validation_method') continue;

    const fieldValue = getNestedValue(doc._source, field);
    if (!fieldValue) return false;

    const point = parseGeoPoint(fieldValue);
    const center = parseGeoPoint(value);

    if (!point || !center) return false;

    const calculatedDistance = calculateGeoDistance(point, center, 'm');
    const queryDistance = parseDistance(distance);

    return calculatedDistance <= queryDistance;
  }
  return true;
}

/**
 * geo_bounding_box 查询匹配
 */
function matchesGeoBoundingBoxQuery(doc: Document, query: any): boolean {
  const { top_left, bottom_right } = query;

  for (const [field, value] of Object.entries(query)) {
    if (field === 'top_left' || field === 'bottom_right' || field === 'validation_method' || field === 'type') continue;

    const fieldValue = getNestedValue(doc._source, field);
    if (!fieldValue) return false;

    const point = parseGeoPoint(fieldValue);
    const topLeft = parseGeoPoint(top_left);
    const bottomRight = parseGeoPoint(bottom_right);

    if (!point || !topLeft || !bottomRight) return false;

    return pointInBoundingBox(point, topLeft, bottomRight);
  }
  return true;
}

/**
 * geo_polygon 查询匹配
 */
function matchesGeoPolygonQuery(doc: Document, query: any): boolean {
  for (const [field, value] of Object.entries(query)) {
    if (field === 'validation_method') continue;

    const fieldValue = getNestedValue(doc._source, field);
    if (!fieldValue) return false;

    const point = parseGeoPoint(fieldValue);
    const queryValue = value as any;
    const points = Array.isArray(queryValue) ? queryValue : (queryValue.points || []);
    const polygon = points.map((p: any) => parseGeoPoint(p)).filter(Boolean) as GeoPoint[];

    if (!point || polygon.length < 3) return false;

    return pointInPolygon(point, polygon);
  }
  return true;
}

/**
 * nested 查询匹配
 */
function matchesNestedQuery(doc: Document, query: any): boolean {
  const { path, query: nestedQuery } = query;
  const nestedValue = getNestedValue(doc._source, path);

  if (!nestedValue || !Array.isArray(nestedValue)) return false;

  return nestedValue.some((item: any) => {
    const pseudoDoc: Document = {
      _index: doc._index,
      _id: doc._id,
      _version: doc._version,
      _seq_no: doc._seq_no,
      _primary_term: doc._primary_term,
      _source: item,
    };
    return matchesQuery(pseudoDoc, nestedQuery);
  });
}

/**
 * dis_max 查询匹配
 */
function matchesDisMaxQuery(doc: Document, query: any): boolean {
  const { queries = [] } = query;
  return queries.some((q: QueryDSL) => matchesQuery(doc, q));
}

/**
 * query_string 查询匹配
 */
function matchesQueryStringQuery(doc: Document, query: any): boolean {
  const { query: queryText, default_field = '_all', fields = [] } = query;
  if (!queryText) return true;

  const searchFields = fields.length > 0 ? fields : [default_field];
  const terms = queryText.toLowerCase().split(/\s+(AND|OR|NOT)\s+/).filter((t: string) => t && t !== 'AND' && t !== 'OR' && t !== 'NOT');

  return searchFields.some((field: string) => {
    const fieldName = field.replace(/\^.*$/, '');
    const fieldValue = getNestedValue(doc._source, fieldName);
    if (!fieldValue) return false;
    return terms.some((term: string) => String(fieldValue).toLowerCase().includes(term));
  });
}

/**
 * simple_query_string 查询匹配
 */
function matchesSimpleQueryStringQuery(doc: Document, query: any): boolean {
  return matchesQueryStringQuery(doc, query);
}

// ==================== 辅助函数 ====================

/**
 * 解析地理坐标点
 */
export function parseGeoPoint(value: any): GeoPoint | null {
  if (!value) return null;

  // 格式：{ lat: 1, lon: 2 }
  if (typeof value === 'object' && 'lat' in value && 'lon' in value) {
    return { lat: Number(value.lat), lon: Number(value.lon) };
  }

  // 格式：[lon, lat]
  if (Array.isArray(value) && value.length >= 2) {
    return { lat: Number(value[1]), lon: Number(value[0]) };
  }

  // 格式："lat,lon"
  if (typeof value === 'string') {
    const parts = value.split(',');
    if (parts.length >= 2) {
      return { lat: Number(parts[0].trim()), lon: Number(parts[1].trim()) };
    }
  }

  return null;
}

/**
 * 解析距离字符串（如 "100m", "1km", "50mi"）
 */
export function parseDistance(distance: string | number): number {
  if (typeof distance === 'number') return distance;

  const match = distance.match(/^([\d.]+)\s*(m|km|mi|ft|nmi|yd|in|cm|mm)?$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2] || 'm';

  const unitToMeters: Record<string, number> = {
    m: 1,
    km: 1000,
    mi: 1609.344,
    ft: 0.3048,
    nmi: 1852,
    yd: 0.9144,
    in: 0.0254,
    cm: 0.01,
    mm: 0.001,
  };

  return value * (unitToMeters[unit] || 1);
}

// ==================== 评分计算 ====================

/**
 * 计算文档与查询的相关性评分
 * 
 * @param doc 文档
 * @param query 查询DSL
 * @param params 评分参数
 * @returns 相关性评分
 */
export function calculateScore(
  doc: Document,
  query: QueryDSL,
  params: {
    totalDocuments?: number;
    avgDocumentLength?: number;
  } = {},
): number {
  if (!query) return 1;

  const queryType = getQueryType(query);

  switch (queryType) {
    case 'match_all':
      return 1;

    case 'match':
    case 'match_phrase':
    case 'match_phrase_prefix':
    case 'multi_match':
      return calculateTextScore(doc, query, params);

    case 'term':
    case 'terms':
      return 1; // 精确匹配评分固定为1

    case 'range':
      return 1; // 范围查询评分固定为1

    case 'bool':
      return calculateBoolScore(doc, (query as any).bool, params);

    case 'constant_score':
      return (query as any).constant_score?.boost || 1;

    case 'function_score':
      return calculateFunctionScore(doc, (query as any).function_score, params);

    case 'boosting':
      return calculateBoostingScore(doc, (query as any).boosting, params);

    case 'dis_max':
      return calculateDisMaxScore(doc, (query as any).dis_max, params);

    default:
      return 1;
  }
}

/**
 * 计算文本查询评分
 */
function calculateTextScore(
  doc: Document,
  query: QueryDSL,
  params: { totalDocuments?: number; avgDocumentLength?: number },
): number {
  const parsed = parseQueryDSL(query);
  if (!parsed.field) return 1;

  const fieldValue = getNestedValue(doc._source, parsed.field);
  if (!fieldValue) return 0;

  const queryText = typeof parsed.params === 'string' ? parsed.params : parsed.params?.query;
  if (!queryText) return 1;

  const queryTerms = queryText.toLowerCase().split(/\s+/).filter((t: string) => t);
  const fieldText = String(fieldValue).toLowerCase();
  const fieldWords = fieldText.split(/\s+/).filter((w: string) => w);

  let totalScore = 0;
  for (const term of queryTerms) {
    const termFrequency = fieldWords.filter(w => w === term).length;
    if (termFrequency > 0) {
      // 简化的 BM25 评分
      const k1 = 1.2;
      const b = 0.75;
      const avgdl = params.avgDocumentLength || fieldWords.length || 1;
      const dl = fieldWords.length;

      const tf = (termFrequency * (k1 + 1)) / (termFrequency + k1 * (1 - b + (b * dl) / avgdl));
      totalScore += tf;
    }
  }

  return totalScore;
}

/**
 * 计算 bool 查询评分
 */
function calculateBoolScore(
  doc: Document,
  boolQuery: BoolQuery,
  params: { totalDocuments?: number; avgDocumentLength?: number },
): number {
  const { must = [], should = [] } = boolQuery;

  let score = 0;

  // must 查询的评分相加
  for (const q of must) {
    score += calculateScore(doc, q, params);
  }

  // should 查询的评分取最大值
  if (should.length > 0) {
    const shouldScores = should.map(q => calculateScore(doc, q, params));
    score += Math.max(...shouldScores, 0);
  }

  return score;
}

/**
 * 计算 function_score 查询评分
 */
function calculateFunctionScore(
  doc: Document,
  query: any,
  params: { totalDocuments?: number; avgDocumentLength?: number },
): number {
  const baseScore = calculateScore(doc, query.query || { match_all: {} }, params);
  const { boost_mode = 'multiply', functions = [] } = query;

  let functionScore = 1;
  for (const func of functions) {
    if (func.filter && !matchesQuery(doc, func.filter)) continue;
    if (func.weight) functionScore *= func.weight;
    if (func.script_score) {
      // 简化处理：脚本评分固定为1
      functionScore *= 1;
    }
    if (func.field_value_factor) {
      const value = getNestedValue(doc._source, func.field_value_factor.field);
      if (value !== undefined && value !== null) {
        const factor = func.field_value_factor.factor || 1;
        const modifier = func.field_value_factor.modifier || 'none';
        let modifiedValue = Number(value) * factor;

        switch (modifier) {
          case 'log': modifiedValue = Math.log(modifiedValue); break;
          case 'log1p': modifiedValue = Math.log1p(modifiedValue); break;
          case 'log2p': modifiedValue = Math.log(modifiedValue + 2); break;
          case 'ln': modifiedValue = Math.log(modifiedValue); break;
          case 'ln1p': modifiedValue = Math.log1p(modifiedValue); break;
          case 'ln2p': modifiedValue = Math.log(modifiedValue + 2); break;
          case 'square': modifiedValue = modifiedValue ** 2; break;
          case 'sqrt': modifiedValue = Math.sqrt(modifiedValue); break;
          case 'reciprocal': modifiedValue = 1 / modifiedValue; break;
        }

        functionScore *= modifiedValue;
      }
    }
  }

  switch (boost_mode) {
    case 'multiply': return baseScore * functionScore;
    case 'replace': return functionScore;
    case 'sum': return baseScore + functionScore;
    case 'avg': return (baseScore + functionScore) / 2;
    case 'max': return Math.max(baseScore, functionScore);
    case 'min': return Math.min(baseScore, functionScore);
    default: return baseScore * functionScore;
  }
}

/**
 * 计算 boosting 查询评分
 */
function calculateBoostingScore(
  doc: Document,
  query: any,
  params: { totalDocuments?: number; avgDocumentLength?: number },
): number {
  const positiveScore = calculateScore(doc, query.positive || { match_all: {} }, params);
  const negativeScore = calculateScore(doc, query.negative || { match_none: {} }, params);
  const negativeBoost = query.negative_boost || 0.5;

  return positiveScore - negativeScore * negativeBoost;
}

/**
 * 计算 dis_max 查询评分
 */
function calculateDisMaxScore(
  doc: Document,
  query: any,
  params: { totalDocuments?: number; avgDocumentLength?: number },
): number {
  const { queries = [], tie_breaker = 0 } = query;
  const scores = queries.map((q: QueryDSL) => calculateScore(doc, q, params));

  if (scores.length === 0) return 0;

  const maxScore = Math.max(...scores);
  const otherScores = scores.filter((s: number) => s !== maxScore);
  const otherSum = otherScores.reduce((sum: number, s: number) => sum + s, 0);

  return maxScore + tie_breaker * otherSum;
}

// ==================== 过滤与排序 ====================

/**
 * 过滤文档列表
 */
export function filterDocuments(docs: Document[], query: QueryDSL): Document[] {
  return docs.filter(doc => matchesQuery(doc, query));
}

/**
 * 排序文档列表
 */
export function sortDocuments(
  docs: Document[],
  sortOptions: Array<Record<string, any>>,
): Document[] {
  if (!sortOptions || sortOptions.length === 0) {
    // 默认按评分降序
    return docs.sort((a, b) => (b._score || 0) - (a._score || 0));
  }

  return docs.sort((a, b) => {
    for (const sortOption of sortOptions) {
      for (const [field, config] of Object.entries(sortOption)) {
        if (field === '_score') {
          const order = typeof config === 'string' ? config : config.order;
          const diff = (b._score || 0) - (a._score || 0);
          if (diff !== 0) return order === 'asc' ? diff : -diff;
        } else {
          const aValue = getNestedValue(a._source, field);
          const bValue = getNestedValue(b._source, field);
          const order = typeof config === 'string' ? config : config.order;

          if (aValue === bValue) continue;
          if (aValue === undefined || aValue === null) return order === 'asc' ? -1 : 1;
          if (bValue === undefined || bValue === null) return order === 'asc' ? 1 : -1;

          const diff = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
          return order === 'asc' ? diff : -diff;
        }
      }
    }
    return 0;
  });
}

/**
 * 分页文档列表
 */
export function paginateDocuments(
  docs: Document[],
  from: number = 0,
  size: number = 10,
): Document[] {
  return docs.slice(from, from + size);
}

/**
 * 高亮文档字段
 */
export function highlightDocument(
  doc: Document,
  highlightConfig: Record<string, any>,
  queryText: string,
): Document {
  const highlighted: Record<string, string[]> = {};

  for (const [field, config] of Object.entries(highlightConfig.fields || {})) {
    const fieldConfig = config as {
      pre_tags?: string[];
      post_tags?: string[];
      number_of_fragments?: number;
      fragment_size?: number;
    };
    const fieldValue = getNestedValue(doc._source, field);
    if (!fieldValue) continue;

    const preTags = highlightConfig.pre_tags || fieldConfig.pre_tags || ['<em>'];
    const postTags = highlightConfig.post_tags || fieldConfig.post_tags || ['</em>'];
    const numberOfFragments = fieldConfig.number_of_fragments || 5;
    const fragmentSize = fieldConfig.fragment_size || 100;

    const text = String(fieldValue);
    const terms = queryText.toLowerCase().split(/\s+/).filter(t => t);

    let highlightedText = text;
    for (const term of terms) {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(regex, `${preTags[0]}$1${postTags[0]}`);
    }

    // 简化处理：返回完整文本作为一个片段
    highlighted[field] = [highlightedText];
  }

  return { ...doc, _highlight: highlighted };
}
