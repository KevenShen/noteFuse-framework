/**
 * Elasticsearch Mock 统一导出入口
 * 
 * 提供完整的 Elasticsearch 模拟功能，包括：
 * - L1 基础层：索引管理、文档CRUD、批量操作
 * - L2 搜索层：基础搜索、高级搜索、高亮排序、分页
 * - L3 分析层：指标聚合、桶聚合、管道聚合
 * - L4 高级功能层：映射管理、分词器、别名、地理空间
 * - L5 运维管理层：集群管理、设置管理、缓存管理、工具方法
 * 
 * 使用方式：
 * import { MockElasticsearch, elasticsearch, createElasticsearch } from '@/mock/Core/elasticsearch';
 * 
 * // 使用全局实例
 * elasticsearch.createIndex('my-index');
 * elasticsearch.index('my-index', { title: 'Hello' });
 * const result = elasticsearch.search({ index: 'my-index', query: { match_all: {} } });
 * 
 * // 创建独立实例
 * const es = new MockElasticsearch({ clusterName: 'my-cluster' });
 * 
 * // 使用工厂函数
 * const es2 = createElasticsearch({ clusterName: 'another-cluster' });
 */

// ==================== 主类导出 ====================

import { MockElasticsearch } from './MockElasticsearch';

/** Elasticsearch Mock 主类 */
export { MockElasticsearch };

/** Elasticsearch Mock 基类（用于自定义扩展） */
export { MockElasticsearchBase } from './MockElasticsearchBase';

// ==================== 全局实例导出 ====================

/** 全局 Elasticsearch 实例（单例模式） */
export { elasticsearch, createElasticsearchInstance } from './instance';

/**
 * 创建 Elasticsearch 实例的便捷函数
 * 
 * @param config 配置
 * @returns Elasticsearch 实例
 */
export function createElasticsearch(config?: ConstructorParameters<typeof MockElasticsearch>[0]) {
  return new MockElasticsearch(config);
}

// ==================== 类型导出 ====================

export * from './types';

// ==================== 工具函数导出 ====================

export * from './utils';

// ==================== Mixin 导出 ====================

export * from './mixins';

// ==================== 便捷类型别名 ====================

/**
 * Elasticsearch 配置类型
 */
export type { ElasticsearchConfig } from './types';

/**
 * 文档类型
 */
export type { Document } from './types';

/**
 * 搜索请求类型
 */
export type { SearchRequest } from './types';

/**
 * 搜索结果类型
 */
export type { SearchResult } from './types';

/**
 * 查询DSL类型
 */
export type { QueryDSL } from './types';

/**
 * 聚合类型
 */
export type { Aggregation } from './types';

/**
 * 索引映射类型
 */
export type { IndexMappings } from './types';

/**
 * 索引设置类型
 */
export type { IndexSettings } from './types';

// ==================== 便捷常量导出 ====================

/**
 * 默认 Elasticsearch 配置
 */
export { DEFAULT_ELASTICSEARCH_CONFIG } from './types';

/**
 * 内置分析器列表
 */
export const BUILT_IN_ANALYZERS = [
  'standard',
  'simple',
  'whitespace',
  'keyword',
  'pattern',
  'stop',
  'snowball',
] as const;

/**
 * 支持的字段类型列表
 */
export const SUPPORTED_FIELD_TYPES = [
  'text',
  'keyword',
  'long',
  'integer',
  'short',
  'byte',
  'double',
  'float',
  'date',
  'boolean',
  'binary',
  'object',
  'nested',
  'geo_point',
  'geo_shape',
  'ip',
  'completion',
  'token_count',
  'dense_vector',
  'sparse_vector',
  'rank_feature',
  'rank_features',
  'flattened',
  'search_as_you_type',
  'alias',
  'version',
  'wildcard',
  'constant_keyword',
  'percolator',
  'join',
  'murmur3',
  'histogram',
] as const;

/**
 * 集群健康状态
 */
export const CLUSTER_HEALTH_STATUS = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
} as const;

/**
 * 距离单位
 */
export const DISTANCE_UNITS = {
  MILLIMETERS: 'mm',
  CENTIMETERS: 'cm',
  METERS: 'm',
  KILOMETERS: 'km',
  INCHES: 'in',
  FEET: 'ft',
  YARDS: 'yd',
  MILES: 'mi',
  NAUTICAL_MILES: 'nmi',
} as const;

// ==================== 使用示例 ====================

/**
 * 使用示例（仅用于文档，不会被执行）
 * 
 * @example
 * ```typescript
 * import { elasticsearch } from '@/mock/Core/elasticsearch';
 * 
 * // 1. 创建索引
 * elasticsearch.createIndex('products', {
 *   settings: { number_of_shards: 1, number_of_replicas: 0 },
 *   mappings: {
 *     properties: {
 *       title: { type: 'text' },
 *       price: { type: 'float' },
 *       category: { type: 'keyword' },
 *       location: { type: 'geo_point' },
 *     },
 *   },
 * });
 * 
 * // 2. 索引文档
 * elasticsearch.index('products', {
 *   title: 'iPhone 15 Pro',
 *   price: 9999,
 *   category: '手机',
 *   location: { lat: 39.9042, lon: 116.4074 },
 * });
 * 
 * // 3. 搜索
 * const result = elasticsearch.search({
 *   index: 'products',
 *   query: {
 *     bool: {
 *       must: [{ match: { title: 'iPhone' } }],
 *       filter: [{ range: { price: { gte: 5000, lte: 15000 } } }],
 *     },
 *   },
 *   sort: [{ price: { order: 'asc' } }],
 *   aggs: {
 *     avg_price: { avg: { field: 'price' } },
 *     category_terms: { terms: { field: 'category' } },
 *   },
 * });
 * 
 * // 4. 地理距离查询
 * const nearby = elasticsearch.geoDistanceQuery(
 *   elasticsearch.getDocuments('products'),
 *   'location',
 *   { lat: 39.9, lon: 116.4 },
 *   '10km'
 * );
 * 
 * // 5. 分词测试
 * const tokens = elasticsearch.analyzeFull('Hello World, Elasticsearch!', 'standard');
 * 
 * // 6. 集群健康
 * const health = elasticsearch.clusterHealth();
 * 
 * // 7. 缓存管理
 * elasticsearch.cacheQueryResult('search:products:iphone', result);
 * const cached = elasticsearch.getCachedQueryResult('search:products:iphone');
 * ```
 */
export const __USAGE_EXAMPLE__ = undefined;
