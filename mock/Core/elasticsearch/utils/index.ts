/**
 * Elasticsearch 工具函数统一导出
 */

// 核心工具函数
export {
  generateUUID,
  generateSimpleId,
  calculateBM25,
  calculateMultiFieldBM25,
  levenshteinDistance,
  standardTokenizer,
  textSimilarity,
  fuzzyMatch,
  wildcardMatch,
  prefixMatch,
  phraseMatch,
  parseDate,
  parseRelativeDate,
  formatDate,
  inRange,
  calculateGeoDistance,
  pointInBoundingBox,
  pointInPolygon,
  calculateAverage,
  calculateStdDev,
  calculatePercentile,
  estimateCardinality,
  debugLog,
  deepClone,
  getNestedValue,
  setNestedValue,
  safeJsonParse,
  safeJsonStringify,
} from './elasticsearch.utils';

export type { BM25Params } from './elasticsearch.utils';

// 查询工具函数
export {
  parseQueryDSL,
  getQueryType,
  matchesQuery,
  parseGeoPoint,
  parseDistance,
  calculateScore,
  filterDocuments,
  sortDocuments,
  paginateDocuments,
  highlightDocument,
} from './query.utils';
