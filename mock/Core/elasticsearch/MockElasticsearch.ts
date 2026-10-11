/**
 * Elasticsearch Mock 主类
 * 
 * 通过 Mixin 组合模式，将功能 Mixin 组合到基类上
 * 
 * 组合顺序（从内到外）：
 * 最内层: MockElasticsearchBase（核心属性+构造函数+私有工具方法）
 * L1: IndexManagement → DocumentCRUD → Bulk
 * L2: SearchBasic → SearchAdvanced → HighlightSort → Pagination
 * L3: AggregationMetric → AggregationBucket → AggregationPipeline
 * L4: Mapping → Analyzer → Alias → Geo
 * L5: Cluster → Settings → Cache → Utility
 * 
 * 已完成：全部18个功能Mixin
 */

import { MockElasticsearchBase } from './MockElasticsearchBase';
import type { MixinConstructor } from './mixins';
import type {
  SearchRequest,
  SearchResult,
  CountResult,
  BulkOperation,
  BulkResult,
  Document,
  IndexSettings,
  IndexMetadata,
  IndexData,
  SortOption,
  HighlightOption,
  AnalyzeRequest,
  AnalyzeResponse,
  ClusterHealth,
  ClusterState,
  NodeInfo,
  NodeStats,
  IndexStats,
  IndexMappings,
  FieldCapsResponse,
} from './types';

// ==================== Mixin 导入 ====================
import { WithIndexManagement } from './mixins/01-index-management.mixin';
import { WithDocumentCRUD } from './mixins/02-document-crud.mixin';
import { WithBulk } from './mixins/03-bulk.mixin';
import { WithSearchBasic } from './mixins/04-search-basic.mixin';
import { WithSearchAdvanced } from './mixins/05-search-advanced.mixin';
import { WithHighlightSort } from './mixins/06-highlight-sort.mixin';
import { WithPagination } from './mixins/07-pagination.mixin';
import { WithAggregationMetric } from './mixins/08-aggregation-metric.mixin';
import { WithAggregationBucket } from './mixins/09-aggregation-bucket.mixin';
import { WithAggregationPipeline } from './mixins/10-aggregation-pipeline.mixin';
import { WithMapping } from './mixins/11-mapping.mixin';
import { WithAnalyzer } from './mixins/12-analyzer.mixin';
import { WithAlias } from './mixins/13-alias.mixin';
import { WithGeo } from './mixins/14-geo.mixin';
import { WithCluster } from './mixins/15-cluster.mixin';
import { WithSettings } from './mixins/16-settings.mixin';
import { WithCache } from './mixins/17-cache.mixin';
import { WithUtility } from './mixins/18-utility.mixin';

// ==================== Mixin 组合 ====================
// 注意：组合顺序很重要，外层 Mixin 可以访问内层 Mixin 的方法
// 完整组合：Base → L1基础层 → L2搜索层 → L3分析层 → L4高级功能层 → L5运维管理层
const ComposedMockElasticsearch = WithUtility(
  WithCache(
    WithSettings(
      WithCluster(
        WithGeo(
          WithAlias(
            WithAnalyzer(
              WithMapping(
                WithAggregationPipeline(
                  WithAggregationBucket(
                    WithAggregationMetric(
                      WithPagination(
                        WithHighlightSort(
                          WithSearchAdvanced(
                            WithSearchBasic(
                              WithBulk(
                                WithDocumentCRUD(
                                  WithIndexManagement(
                                    MockElasticsearchBase as unknown as MixinConstructor
                                  )
                                )
                              )
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  )
) as any;

/**
 * MockElasticsearch 接口类型声明
 *
 * 【设计说明】
 * 由于 MockElasticsearch 类通过 18 层 Mixin 组合模式构建，继承自 any 类型的基类，
 * TypeScript 无法自动推断其方法类型。
 *
 * 使用 TypeScript 声明合并（declaration merging）特性：
 * - interface MockElasticsearch 与 class MockElasticsearch 自动合并
 * - 为所有公共方法提供完整的类型声明
 *
 * 【方法分组】（5组，按基础到高级递进）
 * L1 基础层（索引管理/文档CRUD/批量操作）
 * L2 搜索层（基础搜索/高级搜索/高亮排序/分页）
 * L3 分析层（指标聚合/桶聚合/管道聚合）
 * L4 高级功能层（映射管理/分词器/别名管理/地理空间）
 * L5 运维管理层（集群管理/设置管理/缓存管理/工具方法）
 */
export interface MockElasticsearch {
  // ==================== L1 基础层 ====================
  // 索引管理
  createIndex(indexName: string, settings?: IndexSettings, mappings?: IndexMappings): boolean;
  deleteIndex(indexName: string): boolean;
  indexExists(indexName: string): boolean;
  getIndex(indexName: string): IndexData | null;
  listIndices(): string[];
  openIndex(indexName: string): boolean;
  closeIndex(indexName: string): boolean;
  refreshIndex(indexName: string): boolean;
  flushIndex(indexName: string): boolean;
  forceMerge(indexName: string, maxNumSegments?: number): boolean;
  reindex(sourceIndex: string, destIndex: string, options?: any): boolean;

  // 文档CRUD
  index(indexName: string, document: Partial<Document>, id?: string): Document;
  get(indexName: string, id: string): Document | null;
  update(indexName: string, id: string, document: Partial<Document>): Document | null;
  delete(indexName: string, id: string): boolean;
  updateByQuery(indexName: string, query: any, script: any): number;
  deleteByQuery(indexName: string, query: any): number;
  mget(indexName: string, ids: string[]): Document[];
  count(indexName: string, query?: any): CountResult;
  exists(indexName: string, id: string): boolean;

  // 批量操作
  bulk(operations: BulkOperation[]): BulkResult;
  msearch(requests: SearchRequest[]): SearchResult[];

  // ==================== L2 搜索层 ====================
  // 基础搜索
  search(request: SearchRequest): SearchResult;
  simpleSearch(indexName: string, query: any, options?: any): SearchResult;

  // 高级搜索
  explain(indexName: string, id: string, query: any): any;
  validate(indexName: string, query: any): any;
  fieldCaps(indexName: string, fields: string[]): FieldCapsResponse;

  // 高亮排序
  highlight(document: Document, query: any, options?: HighlightOption): Record<string, string[]>;
  sort(documents: Document[], sortOptions: SortOption[]): Document[];

  // 分页
  searchAfter(indexName: string, query: any, searchAfter: any[], size?: number): SearchResult;
  scroll(indexName: string, query: any, scroll?: string, size?: number): SearchResult;
  clearScroll(scrollId: string): boolean;

  // ==================== L3 分析层 ====================
  // 指标聚合
  valueCountAggregation(docs: Document[], field: string): number;
  avgAggregation(docs: Document[], field: string): number | null;
  sumAggregation(docs: Document[], field: string): number;
  minAggregation(docs: Document[], field: string): number | null;
  maxAggregation(docs: Document[], field: string): number | null;
  statsAggregation(docs: Document[], field: string): any;
  extendedStatsAggregation(docs: Document[], field: string, sigma?: number): any;
  percentilesAggregation(docs: Document[], field: string, percents?: number[]): any;
  percentileRanksAggregation(docs: Document[], field: string, values?: number[]): any;
  cardinalityAggregation(docs: Document[], field: string, precisionThreshold?: number): number;

  // 桶聚合
  termsAggregation(docs: Document[], field: string, size?: number, order?: any): any[];
  rangeAggregation(docs: Document[], field: string, ranges: any[]): any[];
  dateRangeAggregation(docs: Document[], field: string, ranges: any[], format?: string): any[];
  histogramAggregation(docs: Document[], field: string, interval: number, minDocCount?: number): any[];
  dateHistogramAggregation(docs: Document[], field: string, calendarInterval?: string, fixedInterval?: string, format?: string): any[];
  filtersAggregation(docs: Document[], filters: Record<string, any>): any[];
  nestedAggregation(docs: Document[], path: string): any[];
  missingAggregation(docs: Document[], field: string): any;
  globalAggregation(docs: Document[]): any;
  geohashGridAggregation(docs: Document[], field: string, precision?: number, size?: number): any[];
  geoCentroidAggregation(docs: Document[], field: string): any | null;

  // 管道聚合
  avgBucketAggregation(buckets: any[], bucketsPath: string): number | null;
  maxBucketAggregation(buckets: any[], bucketsPath: string): any;
  minBucketAggregation(buckets: any[], bucketsPath: string): any;
  sumBucketAggregation(buckets: any[], bucketsPath: string): number;
  statsBucketAggregation(buckets: any[], bucketsPath: string): any;
  extendedStatsBucketAggregation(buckets: any[], bucketsPath: string, sigma?: number): any;
  bucketScriptAggregation(buckets: any[], script: any, bucketsPath: Record<string, string>): any[];
  bucketSelectorAggregation(buckets: any[], script: any, bucketsPath: Record<string, string>): any[];
  bucketSortAggregation(buckets: any[], sort?: any, from?: number, size?: number): any[];
  cumulativeSumAggregation(buckets: any[], bucketsPath: string): any[];
  derivativeAggregation(buckets: any[], bucketsPath: string): any[];
  serialDiffAggregation(buckets: any[], bucketsPath: string, lag?: number): any[];
  movingAvgAggregation(buckets: any[], bucketsPath: string, window?: number, model?: string): any[];

  // ==================== L4 高级功能层 ====================
  // 映射管理
  putMapping(indexName: string, mappings: IndexMappings): boolean;
  getMapping(indexName: string): IndexMappings | null;
  getFieldMapping(indexName: string, fields: string[]): any;
  validateMapping(mappings: IndexMappings): any;

  // 分词器
  analyze(request: AnalyzeRequest): AnalyzeResponse;
  analyzeFull(text: string, analyzer: string | any, indexName?: string): any[];
  standardAnalyzer(text: string): any[];
  simpleAnalyzer(text: string): any[];
  whitespaceAnalyzer(text: string): any[];
  keywordAnalyzer(text: string): any[];
  patternAnalyzer(text: string, pattern?: string): any[];
  getAnalyzers(indexName: string): Record<string, any> | null;
  setAnalyzers(indexName: string, analyzers: Record<string, any>): boolean;
  addAnalyzer(indexName: string, name: string, analyzer: any): boolean;

  // 别名管理
  createAlias(indexName: string, aliasName: string, options?: any): boolean;
  bulkCreateAliases(aliases: Array<{ index: string; alias: string; options?: any }>): number;
  deleteAlias(indexName: string, aliasName: string): boolean;
  deleteAllAliases(indexName: string): number;
  getAliases(indexName?: string): Record<string, any>;
  getAliasIndex(aliasName: string): string | null;
  getAliasInfo(aliasName: string): any | null;
  aliasExists(aliasName: string): boolean;
  indexHasAlias(indexName: string, aliasName: string): boolean;
  renameAlias(oldAliasName: string, newAliasName: string): boolean;
  switchAlias(oldIndexName: string, newIndexName: string, aliasName: string): boolean;
  updateAliases(actions: any[]): boolean;
  resolveIndexName(indexName: string): string;
  resolveIndexNames(indexNames: string | string[]): string[];
  getAliasStats(): any;

  // 地理空间
  geoBoundingBoxQuery(docs: Document[], field: string, topLeft: any, bottomRight: any): Document[];
  geoDistanceQuery(docs: Document[], field: string, origin: any, distance: string): Document[];
  geoPolygonQuery(docs: Document[], field: string, polygon: any[]): Document[];
  geoDistanceSort(docs: Document[], field: string, origin: any, order?: string, unit?: string): Document[];
  geoDistanceAggregation(docs: Document[], field: string, origin: any, ranges?: any[], unit?: string): any[];
  parseGeoPoint(point: any): { lat: number; lon: number } | null;
  calculateGeoDistance(point1: any, point2: any, unit?: string, type?: string): number;
  pointInPolygon(point: any, polygon: any[]): boolean;
  encodeGeohash(latitude: number, longitude: number, precision?: number): string;

  // ==================== L5 运维管理层 ====================
  // 集群管理
  clusterHealth(indexName?: string): ClusterHealth;
  clusterState(): ClusterState;
  clusterStats(): any;
  nodeInfo(nodeId?: string): NodeInfo | NodeInfo[];
  nodeStats(nodeId?: string): NodeStats | NodeStats[];
  pendingTasks(): any[];
  reroute(commands: any[]): boolean;
  allocationExplain(body?: any): any;
  getIndexStats(indexName: string): IndexStats | null;

  // 设置管理
  getSettings(): any;
  updateSettings(settings: any): boolean;
  getIndexSettings(indexName: string): any;
  updateIndexSettings(indexName: string, settings: any): boolean;
  resetSettings(indexName?: string): boolean;

  // 缓存管理
  cacheQueryResult(key: string, result: SearchResult, ttl?: number): void;
  getCachedQueryResult(key: string): SearchResult | null;
  invalidateCache(key?: string): void;
  clearCache(indexName?: string): boolean;
  cacheStats(): any;

  // 工具方法
  getVersion(): string;
  info(): any;
  ping(): boolean;
  catIndices(): any[];
  catNodes(): any[];
  catHealth(): any;
  catShards(indexName?: string): any[];
  catAliases(): any[];
  catTemplates(): any[];
  catThreadPool(): any[];
  catPlugins(): any[];
  catFielddata(): any[];
  catSegments(indexName?: string): any[];
  catPendingTasks(): any[];
  catRecovery(indexName?: string): any[];
}

/**
 * Elasticsearch Mock 主类
 *
 * 使用方式：
 * const es = new MockElasticsearch();
 *
 * // 索引管理
 * es.createIndex('my-index');
 * es.index('my-index', { title: 'Hello', price: 100 });
 *
 * // 搜索
 * const result = es.search({
 *   index: 'my-index',
 *   query: { match_all: {} },
 * });
 *
 * // 聚合
 * const aggResult = es.search({
 *   index: 'my-index',
 *   aggs: {
 *     avg_price: { avg: { field: 'price' } },
 *   },
 * });
 *
 * // 集群管理
 * const health = es.clusterHealth();
 *
 * // 缓存管理
 * es.cacheQueryResult('cache-key', result);
 */
export class MockElasticsearch extends (ComposedMockElasticsearch as {
  new (config?: ConstructorParameters<typeof MockElasticsearchBase>[0]): any;
}) {
  /**
   * 构造函数
   * 
   * @param config 配置
   */
  constructor(config?: ConstructorParameters<typeof MockElasticsearchBase>[0]) {
    super(config);
  }
}
