/**
 * Elasticsearch Mixin 类型定义
 * 
 * 包含：MixinConstructor 类型、IMockElasticsearchBase 接口（所有 Mixin 需要访问的属性和方法）
 */

import type {
  IndexData,
  IndexMetadata,
  IndexMappings,
  IndexSettings,
  Document,
  SearchRequest,
  SearchResult,
  SearchHit,
  QueryDSL,
  Aggregation,
  AnalyzerConfig,
  TokenizerConfig,
  TokenFilterConfig,
  CharFilterConfig,
  ClusterHealth,
  ClusterHealthStatus,
  NodeInfo,
  NodeStats,
  IndexStats,
  AnalysisSettings,
  ElasticsearchConfig,
  BulkOperation,
  BulkResult,
  CountResult,
  AnalyzeRequest,
  AnalyzeResponse,
  FieldCapsResponse,
  PendingTasksResponse,
} from '../types';

/**
 * Mixin 构造函数类型
 * 
 * 所有 Mixin 函数都接受一个实现了 IMockElasticsearchBase 接口的基类
 */
export type MixinConstructor<T = IMockElasticsearchBase> = new (...args: any[]) => T;

/**
 * IMockElasticsearchBase 接口
 * 
 * 定义所有 Mixin 需要访问的属性和方法
 * 这是 Mixin 之间共享状态和行为的契约
 */
export interface IMockElasticsearchBase {
  // ==================== 索引存储 ====================
  indices: Map<string, IndexData>;
  indexTemplates: Map<string, any>;

  // ==================== 别名映射 ====================
  aliases: Map<string, Set<string>>;

  // ==================== 集群状态 ====================
  clusterName: string;
  clusterUUID: string;
  clusterStateVersion: number;
  nodes: Map<string, NodeInfo>;

  // ==================== 分析器 ====================
  analyzers: Map<string, AnalyzerConfig>;
  tokenizers: Map<string, TokenizerConfig>;
  tokenFilters: Map<string, TokenFilterConfig>;
  charFilters: Map<string, CharFilterConfig>;

  // ==================== 缓存 ====================
  queryCache: Map<string, { result: SearchResult; expireAt: number }>;
  fieldCache: Map<string, Map<string, any>>;
  requestCache: Map<string, { result: any; expireAt: number }>;

  // ==================== 统计 ====================
  totalDocs: number;
  totalQueries: number;
  totalIndexingOps: number;
  totalIndexingTime: number;
  totalSearchTime: number;
  cacheHits: number;
  cacheMisses: number;

  // ==================== 配置 ====================
  config: Required<ElasticsearchConfig>;
  pendingTasks: Array<{
    id: string;
    insertOrder: number;
    priority: string;
    source: string;
    timeInQueue: number;
  }>;
  scrollContexts: Map<string, {
    results: Document[];
    currentIndex: number;
    expireAt: number;
  }>;

  // ==================== 索引操作方法 ====================
  getIndexData(indexName: string): IndexData | null;
  getMultipleIndexData(indexNames: string | string[]): IndexData[];
  ensureIndexExists(indexName: string): void;
  createIndexData(indexName: string, settings?: IndexSettings, mappings?: IndexMappings): IndexData;
  deleteIndexData(indexName: string): boolean;

  // ==================== 文档操作方法 ====================
  getDocument(indexName: string, docId: string): Document | null;
  saveDocument(indexName: string, doc: Document): void;
  deleteDocument(indexName: string, docId: string): boolean;
  generateDocId(): string;

  // ==================== 倒排索引方法 ====================
  updateInvertedIndex(indexData: IndexData, doc: Document): void;

  // ==================== 分词方法 ====================
  analyzeText(text: string, analyzerName?: string): string[];
  applyTokenizer(text: string, tokenizerName: string): string[];
  applyTokenFilter(tokens: string[], filterName: string): string[];
  applyCharFilter(text: string, filterName: string): string;

  // ==================== 缓存方法 ====================
  clearFieldCache(indexName: string): void;
  clearQueryCache(): void;
  clearAllCaches(): void;
  cleanupExpiredCache(): void;

  // ==================== 统计方法 ====================
  recordIndexingOperation(duration: number): void;
  recordSearchOperation(duration: number): void;
  getIndexStats(indexName: string): IndexStats | null;
  estimateIndexSize(indexData: IndexData): number;

  // ==================== 集群健康方法 ====================
  getClusterHealth(indexName?: string): ClusterHealth;

  // ==================== 工具方法 ====================
  debugLog(message: string, ...args: any[]): void;
  deepClone<T>(obj: T): T;
  getNestedValue(obj: any, path: string): any;
  generateCacheKey(index: string, query: any): string;
  isIndexOpen(indexName: string): boolean;
  validateDocId(docId: string): boolean;
  applyAnalysisSettings(analysis: AnalysisSettings): void;

  // ==================== 跨 Mixin 调用方法（由其他 Mixin 实现） ====================
  
  // 搜索方法（由 04-search-basic.mixin.ts 实现）
  search?(request: SearchRequest): SearchResult;
  count?(index: string, query?: QueryDSL): CountResult;

  // 文档操作方法（由 02-document-crud.mixin.ts 实现）
  index?(indexName: string, document: any, options?: any): Document;
  get?(indexName: string, docId: string, options?: any): Document | null;
  update?(indexName: string, docId: string, document: any, options?: any): Document | null;
  delete?(indexName: string, docId: string, options?: any): boolean;

  // 索引管理方法（由 01-index-management.mixin.ts 实现）
  createIndex?(indexName: string, settings?: IndexSettings, mappings?: IndexMappings): boolean;
  deleteIndex?(indexName: string): boolean;
  indexExists?(indexName: string): boolean;

  // 聚合方法（由 08/09/10-aggregation-*.mixin.ts 实现）
  executeAggregation?(docs: Document[], agg: Aggregation): any;

  // 高亮方法（由 06-highlight-sort.mixin.ts 实现）
  applyHighlight?(doc: Document, highlightConfig: any, queryText: string): Document;

  // 评分方法（由 06-highlight-sort.mixin.ts 实现）
  calculateScore?(doc: Document, query: QueryDSL, params?: any): number;

  // 匹配方法（由 query.utils 提供，但在 Mixin 中封装）
  matchesQuery?(doc: Document, query: QueryDSL): boolean;

  // 批量操作方法（由 03-bulk.mixin.ts 实现）
  bulk?(operations: BulkOperation[]): BulkResult;
  mget?(index: string, ids: string[]): Document[];

  // 分析方法（由 12-analyzer.mixin.ts 实现）
  analyze?(request: AnalyzeRequest): AnalyzeResponse;

  // 映射方法（由 11-mapping.mixin.ts 实现）
  putMapping?(indexName: string, mappings: IndexMappings): boolean;
  getMapping?(indexName: string): IndexMappings | null;

  // 别名方法（由 13-alias.mixin.ts 实现）
  putAlias?(indexName: string, alias: string): boolean;
  deleteAlias?(indexName: string, alias: string): boolean;

  // 地理方法（由 14-geo.mixin.ts 实现）
  calculateGeoDistance?(point1: any, point2: any, unit?: string): number;

  // 集群方法（由 15-cluster.mixin.ts 实现）
  clusterHealth?(indexName?: string): ClusterHealth;
  nodeStats?(nodeId?: string): NodeStats | null;
  getPendingTasks?(): PendingTasksResponse;

  // 设置方法（由 16-settings.mixin.ts 实现）
  putSettings?(indexName: string, settings: IndexSettings): boolean;
  getSettings?(indexName: string): IndexSettings | null;

  // 缓存方法（由 17-cache.mixin.ts 实现）
  clearCache?(indexName?: string): boolean;
  cacheStats?(): any;

  // 工具方法（由 18-utility.mixin.ts 实现）
  refresh?(indexName?: string): boolean;
  flush?(indexName?: string): boolean;
  forceMerge?(indexName: string, maxNumSegments?: number): boolean;
  reindex?(sourceIndex: string, targetIndex: string, options?: any): number;
  indicesStats?(indexName?: string): Record<string, IndexStats>;
}
