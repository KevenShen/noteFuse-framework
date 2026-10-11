/**
 * Elasticsearch Mock 基类
 * 
 * 包含核心属性、构造函数和私有工具方法
 * 所有 Mixin 都继承自此类
 */

import type {
  ElasticsearchConfig,
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
} from './types';

import {
  DEFAULT_ELASTICSEARCH_CONFIG,
} from './types';

import {
  generateUUID,
  debugLog,
  deepClone,
  getNestedValue,
  standardTokenizer,
} from './utils';

/**
 * Elasticsearch Mock 基类
 */
export class MockElasticsearchBase {
  // ==================== 索引存储 ====================

  /** 索引存储（索引名 -> 索引数据） */
  protected indices: Map<string, IndexData>;

  /** 索引模板（模板名 -> 索引模板） */
  protected indexTemplates: Map<string, any>;

  // ==================== 别名映射 ====================

  /** 别名映射（别名 -> 索引名集合） */
  protected aliases: Map<string, Set<string>>;

  // ==================== 集群状态 ====================

  /** 集群名 */
  protected clusterName: string;

  /** 集群UUID */
  protected clusterUUID: string;

  /** 集群状态 */
  protected clusterStateVersion: number;

  /** 节点信息（节点ID -> 节点信息） */
  protected nodes: Map<string, NodeInfo>;

  // ==================== 分析器 ====================

  /** 分析器（分析器名 -> 分析器配置） */
  protected analyzers: Map<string, AnalyzerConfig>;

  /** 分词器（分词器名 -> 分词器配置） */
  protected tokenizers: Map<string, TokenizerConfig>;

  /** 分词过滤器（过滤器名 -> 过滤器配置） */
  protected tokenFilters: Map<string, TokenFilterConfig>;

  /** 字符过滤器（过滤器名 -> 过滤器配置） */
  protected charFilters: Map<string, CharFilterConfig>;

  // ==================== 缓存 ====================

  /** 查询缓存（缓存键 -> 搜索结果） */
  protected queryCache: Map<string, { result: SearchResult; expireAt: number }>;

  /** 字段缓存（索引名:字段名 -> Map<文档ID, 字段值>） */
  protected fieldCache: Map<string, Map<string, any>>;

  /** 请求缓存（缓存键 -> 结果） */
  protected requestCache: Map<string, { result: any; expireAt: number }>;

  // ==================== 统计 ====================

  /** 总文档数 */
  protected totalDocs: number;

  /** 总查询数 */
  protected totalQueries: number;

  /** 总索引操作数 */
  protected totalIndexingOps: number;

  /** 总索引时间（毫秒） */
  protected totalIndexingTime: number;

  /** 总搜索时间（毫秒） */
  protected totalSearchTime: number;

  /** 缓存命中数 */
  protected cacheHits: number;

  /** 缓存未命中数 */
  protected cacheMisses: number;

  // ==================== 配置 ====================

  /** 配置 */
  protected config: Required<ElasticsearchConfig>;

  /** 待处理任务 */
  protected pendingTasks: Array<{
    id: string;
    insertOrder: number;
    priority: string;
    source: string;
    timeInQueue: number;
  }>;

  /** scroll 上下文（scroll_id -> 搜索结果） */
  protected scrollContexts: Map<string, {
    results: Document[];
    currentIndex: number;
    expireAt: number;
  }>;

  // ==================== 构造函数 ====================

  /**
   * 构造函数
   * 
   * @param config 配置
   */
  constructor(config: ElasticsearchConfig = {}) {
    // 合并配置
    this.config = { ...DEFAULT_ELASTICSEARCH_CONFIG, ...config } as Required<ElasticsearchConfig>;

    // 初始化索引存储
    this.indices = new Map();
    this.indexTemplates = new Map();

    // 初始化别名映射
    this.aliases = new Map();

    // 初始化集群状态
    this.clusterName = this.config.clusterName;
    this.clusterUUID = generateUUID();
    this.clusterStateVersion = 1;
    this.nodes = new Map();

    // 初始化默认节点
    this.initDefaultNode();

    // 初始化分析器
    this.analyzers = new Map();
    this.tokenizers = new Map();
    this.tokenFilters = new Map();
    this.charFilters = new Map();
    this.initDefaultAnalyzers();

    // 初始化缓存
    this.queryCache = new Map();
    this.fieldCache = new Map();
    this.requestCache = new Map();

    // 初始化统计
    this.totalDocs = 0;
    this.totalQueries = 0;
    this.totalIndexingOps = 0;
    this.totalIndexingTime = 0;
    this.totalSearchTime = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;

    // 初始化其他
    this.pendingTasks = [];
    this.scrollContexts = new Map();

    this.debugLog('Elasticsearch Mock 初始化完成', {
      clusterName: this.clusterName,
      clusterUUID: this.clusterUUID,
    });
  }

  // ==================== 初始化方法 ====================

  /**
   * 初始化默认节点
   */
  protected initDefaultNode(): void {
    const nodeId = generateUUID();
    const node: NodeInfo = {
      name: 'node-1',
      id: nodeId,
      transport_address: '127.0.0.1:9300',
      host: '127.0.0.1',
      ip: '127.0.0.1',
      version: '8.0.0',
      build_type: 'mock',
      build_hash: generateUUID(),
      build_date: new Date().toISOString(),
      build_snapshot: false,
      lucene_version: '9.0.0',
      minimum_wire_compatibility_version: '7.0.0',
      minimum_index_compatibility_version: '7.0.0',
      roles: ['master', 'data', 'ingest'],
      attributes: {},
    };
    this.nodes.set(nodeId, node);
  }

  /**
   * 初始化默认分析器
   */
  protected initDefaultAnalyzers(): void {
    // 标准分析器
    this.analyzers.set('standard', {
      type: 'standard',
      tokenizer: 'standard',
      filter: ['lowercase'],
    });

    // 简单分析器
    this.analyzers.set('simple', {
      type: 'simple',
      tokenizer: 'lowercase',
    });

    // 空白分析器
    this.analyzers.set('whitespace', {
      type: 'whitespace',
      tokenizer: 'whitespace',
    });

    // 关键词分析器
    this.analyzers.set('keyword', {
      type: 'keyword',
      tokenizer: 'keyword',
    });

    // 停用词分析器
    this.analyzers.set('stop', {
      type: 'stop',
      tokenizer: 'lowercase',
      stopwords: '_english_',
    });

    // 默认分词器
    this.tokenizers.set('standard', { type: 'standard' });
    this.tokenizers.set('lowercase', { type: 'lowercase' });
    this.tokenizers.set('whitespace', { type: 'whitespace' });
    this.tokenizers.set('keyword', { type: 'keyword' });

    // 默认分词过滤器
    this.tokenFilters.set('lowercase', { type: 'lowercase' });
    this.tokenFilters.set('uppercase', { type: 'uppercase' });
    this.tokenFilters.set('asciifolding', { type: 'asciifolding' });
    this.tokenFilters.set('trim', { type: 'trim' });
    this.tokenFilters.set('unique', { type: 'unique' });

    // 默认字符过滤器
    this.charFilters.set('html_strip', { type: 'html_strip' });
  }

  // ==================== 索引操作方法 ====================

  /**
   * 获取索引数据
   * 
   * @param indexName 索引名（支持别名）
   * @returns 索引数据或 null
   */
  protected getIndexData(indexName: string): IndexData | null {
    // 检查是否是别名
    if (this.aliases.has(indexName)) {
      const indexNames = Array.from(this.aliases.get(indexName)!);
      if (indexNames.length > 0) {
        return this.indices.get(indexNames[0]) || null;
      }
    }
    return this.indices.get(indexName) || null;
  }

  /**
   * 获取多个索引数据（支持通配符和多索引）
   * 
   * @param indexNames 索引名列表
   * @returns 索引数据列表
   */
  protected getMultipleIndexData(indexNames: string | string[]): IndexData[] {
    const names = Array.isArray(indexNames) ? indexNames : [indexNames];
    const result: IndexData[] = [];

    for (const name of names) {
      if (name === '_all' || name === '*') {
        // 所有索引
        result.push(...Array.from(this.indices.values()));
      } else if (name.includes('*')) {
        // 通配符匹配
        const pattern = new RegExp('^' + name.replace(/\*/g, '.*') + '$');
        for (const [indexName, indexData] of this.indices) {
          if (pattern.test(indexName)) {
            result.push(indexData);
          }
        }
      } else {
        // 精确匹配或别名
        const indexData = this.getIndexData(name);
        if (indexData) {
          result.push(indexData);
        }
      }
    }

    return result;
  }

  /**
   * 确保索引存在
   * 
   * @param indexName 索引名
   */
  protected ensureIndexExists(indexName: string): void {
    if (!this.indices.has(indexName)) {
      throw new Error(`索引不存在: ${indexName}`);
    }
  }

  /**
   * 创建索引数据
   * 
   * @param indexName 索引名
   * @param settings 索引设置
   * @param mappings 字段映射
   * @returns 索引数据
   */
  protected createIndexData(
    indexName: string,
    settings: IndexSettings = {},
    mappings: IndexMappings = {},
  ): IndexData {
    const metadata: IndexMetadata = {
      name: indexName,
      settings: {
        number_of_shards: settings.number_of_shards || this.config.defaultNumberOfShards,
        number_of_replicas: settings.number_of_replicas || this.config.defaultNumberOfReplicas,
        refresh_interval: settings.refresh_interval || this.config.defaultRefreshInterval,
        max_result_window: settings.max_result_window || this.config.maxResultWindow,
        ...settings,
      },
      mappings,
      aliases: [],
      creationDate: Date.now(),
      uuid: generateUUID(),
      version: 1,
      state: 'open',
    };

    const indexData: IndexData = {
      metadata,
      documents: new Map(),
      versionMap: new Map(),
      seqNo: 0,
      primaryTerm: 1,
      invertedIndex: new Map(),
      fieldCache: new Map(),
    };

    this.indices.set(indexName, indexData);
    this.clusterStateVersion++;

    return indexData;
  }

  /**
   * 删除索引数据
   * 
   * @param indexName 索引名
   * @returns 是否删除成功
   */
  protected deleteIndexData(indexName: string): boolean {
    const indexData = this.indices.get(indexName);
    if (!indexData) return false;

    // 更新文档总数
    this.totalDocs -= indexData.documents.size;

    // 删除索引
    this.indices.delete(indexName);

    // 删除相关别名
    for (const [alias, indexNames] of this.aliases) {
      indexNames.delete(indexName);
      if (indexNames.size === 0) {
        this.aliases.delete(alias);
      }
    }

    // 清除字段缓存
    for (const key of this.fieldCache.keys()) {
      if (key.startsWith(`${indexName}:`)) {
        this.fieldCache.delete(key);
      }
    }

    this.clusterStateVersion++;
    return true;
  }

  // ==================== 文档操作方法 ====================

  /**
   * 获取文档
   * 
   * @param indexName 索引名
   * @param docId 文档ID
   * @returns 文档或 null
   */
  protected getDocument(indexName: string, docId: string): Document | null {
    const indexData = this.getIndexData(indexName);
    if (!indexData) return null;
    return indexData.documents.get(docId) || null;
  }

  /**
   * 保存文档
   * 
   * @param indexName 索引名
   * @param doc 文档
   */
  protected saveDocument(indexName: string, doc: Document): void {
    const indexData = this.getIndexData(indexName);
    if (!indexData) return;

    const isNew = !indexData.documents.has(doc._id);
    indexData.documents.set(doc._id, doc);
    indexData.versionMap.set(doc._id, doc._version);

    if (isNew) {
      this.totalDocs++;
    }

    // 更新倒排索引
    if (this.config.enableInvertedIndex) {
      this.updateInvertedIndex(indexData, doc);
    }

    // 清除字段缓存
    this.clearFieldCache(indexName);
  }

  /**
   * 删除文档
   * 
   * @param indexName 索引名
   * @param docId 文档ID
   * @returns 是否删除成功
   */
  protected deleteDocument(indexName: string, docId: string): boolean {
    const indexData = this.getIndexData(indexName);
    if (!indexData) return false;

    const doc = indexData.documents.get(docId);
    if (!doc) return false;

    indexData.documents.delete(docId);
    indexData.versionMap.delete(docId);
    this.totalDocs--;

    // 清除字段缓存
    this.clearFieldCache(indexName);

    return true;
  }

  /**
   * 生成文档ID
   * 
   * @returns 文档ID
   */
  protected generateDocId(): string {
    return generateUUID();
  }

  // ==================== 倒排索引方法 ====================

  /**
   * 更新倒排索引
   * 
   * @param indexData 索引数据
   * @param doc 文档
   */
  protected updateInvertedIndex(indexData: IndexData, doc: Document): void {
    const mappings = indexData.metadata.mappings.properties || {};

    for (const [field, mapping] of Object.entries(mappings)) {
      const mappingConfig = mapping as { type?: string; analyzer?: string };
      if (mappingConfig.type === 'text' || mappingConfig.type === 'keyword') {
        const fieldValue = getNestedValue(doc._source, field);
        if (fieldValue === undefined || fieldValue === null) continue;

        const tokens = this.analyzeText(String(fieldValue), mappingConfig.analyzer || 'standard');

        if (!indexData.invertedIndex.has(field)) {
          indexData.invertedIndex.set(field, new Map());
        }

        const fieldIndex = indexData.invertedIndex.get(field)!;
        for (const token of tokens) {
          if (!fieldIndex.has(token)) {
            fieldIndex.set(token, new Set());
          }
          fieldIndex.get(token)!.add(doc._id);
        }
      }
    }
  }

  // ==================== 分词方法 ====================

  /**
   * 分析文本（分词）
   * 
   * @param text 文本
   * @param analyzerName 分析器名
   * @returns 词条列表
   */
  protected analyzeText(text: string, analyzerName: string = 'standard'): string[] {
    const analyzer = this.analyzers.get(analyzerName);
    if (!analyzer) {
      // 默认使用标准分词器
      return standardTokenizer(text);
    }

    // 应用字符过滤器
    let processedText = text;
    if (analyzer.char_filter) {
      for (const charFilterName of analyzer.char_filter) {
        processedText = this.applyCharFilter(processedText, charFilterName);
      }
    }

    // 分词
    const tokenizerName = analyzer.tokenizer || 'standard';
    let tokens = this.applyTokenizer(processedText, tokenizerName);

    // 应用分词过滤器
    if (analyzer.filter) {
      for (const filterName of analyzer.filter) {
        tokens = this.applyTokenFilter(tokens, filterName);
      }
    }

    return tokens;
  }

  /**
   * 应用分词器
   */
  protected applyTokenizer(text: string, tokenizerName: string): string[] {
    switch (tokenizerName) {
      case 'standard':
      case 'letter':
        return standardTokenizer(text);
      case 'lowercase':
        return text.toLowerCase().split(/[^a-z0-9]+/).filter(t => t);
      case 'whitespace':
        return text.split(/\s+/).filter(t => t);
      case 'keyword':
        return [text];
      default:
        return standardTokenizer(text);
    }
  }

  /**
   * 应用分词过滤器
   */
  protected applyTokenFilter(tokens: string[], filterName: string): string[] {
    switch (filterName) {
      case 'lowercase':
        return tokens.map(t => t.toLowerCase());
      case 'uppercase':
        return tokens.map(t => t.toUpperCase());
      case 'asciifolding':
        return tokens.map(t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      case 'trim':
        return tokens.map(t => t.trim());
      case 'unique':
        return Array.from(new Set(tokens));
      case 'stop':
        const stopwords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those', 'am', 'not', 'no', 'yes', 'so', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'whose']);
        return tokens.filter(t => !stopwords.has(t.toLowerCase()));
      default:
        return tokens;
    }
  }

  /**
   * 应用字符过滤器
   */
  protected applyCharFilter(text: string, filterName: string): string {
    switch (filterName) {
      case 'html_strip':
        return text.replace(/<[^>]*>/g, '');
      default:
        return text;
    }
  }

  // ==================== 缓存方法 ====================

  /**
   * 清除字段缓存
   * 
   * @param indexName 索引名
   */
  protected clearFieldCache(indexName: string): void {
    for (const key of this.fieldCache.keys()) {
      if (key.startsWith(`${indexName}:`)) {
        this.fieldCache.delete(key);
      }
    }
  }

  /**
   * 清除查询缓存
   */
  protected clearQueryCache(): void {
    this.queryCache.clear();
  }

  /**
   * 清除所有缓存
   */
  protected clearAllCaches(): void {
    this.queryCache.clear();
    this.fieldCache.clear();
    this.requestCache.clear();
  }

  /**
   * 清理过期缓存
   */
  protected cleanupExpiredCache(): void {
    const now = Date.now();

    for (const [key, value] of this.queryCache) {
      if (value.expireAt < now) {
        this.queryCache.delete(key);
      }
    }

    for (const [key, value] of this.requestCache) {
      if (value.expireAt < now) {
        this.requestCache.delete(key);
      }
    }

    for (const [key, value] of this.scrollContexts) {
      if (value.expireAt < now) {
        this.scrollContexts.delete(key);
      }
    }
  }

  // ==================== 统计方法 ====================

  /**
   * 记录索引操作
   */
  protected recordIndexingOperation(duration: number): void {
    this.totalIndexingOps++;
    this.totalIndexingTime += duration;
  }

  /**
   * 记录搜索操作
   */
  protected recordSearchOperation(duration: number): void {
    this.totalQueries++;
    this.totalSearchTime += duration;
  }

  /**
   * 获取索引统计
   * 
   * @param indexName 索引名
   * @returns 索引统计
   */
  protected getIndexStats(indexName: string): IndexStats | null {
    const indexData = this.getIndexData(indexName);
    if (!indexData) return null;

    return {
      docs: {
        count: indexData.documents.size,
        deleted: 0,
      },
      store: {
        size_in_bytes: this.estimateIndexSize(indexData),
        reserved_in_bytes: 0,
        total_data_set_size_in_bytes: 0,
      },
      indexing: {
        index_total: this.totalIndexingOps,
        index_time_in_millis: this.totalIndexingTime,
        index_current: 0,
        index_failed: 0,
        delete_total: 0,
        delete_time_in_millis: 0,
        delete_current: 0,
        noop_update_total: 0,
        is_throttled: false,
        throttle_time_in_millis: 0,
      },
      get: {
        total: 0,
        time_in_millis: 0,
        exists_total: 0,
        exists_time_in_millis: 0,
        missing_total: 0,
        missing_time_in_millis: 0,
        current: 0,
      },
      search: {
        open_contexts: 0,
        query_total: this.totalQueries,
        query_time_in_millis: this.totalSearchTime,
        query_current: 0,
        fetch_total: 0,
        fetch_time_in_millis: 0,
        fetch_current: 0,
        scroll_total: 0,
        scroll_time_in_millis: 0,
        scroll_current: 0,
        suggest_total: 0,
        suggest_time_in_millis: 0,
        suggest_current: 0,
      },
      merges: {
        current: 0,
        current_docs: 0,
        current_size_in_bytes: 0,
        total: 0,
        total_time_in_millis: 0,
        total_docs: 0,
        total_size_in_bytes: 0,
      },
      refresh: {
        total: 0,
        total_time_in_millis: 0,
        external_total: 0,
        external_total_time_in_millis: 0,
        listeners: 0,
      },
      flush: {
        total: 0,
        periodic: 0,
        total_time_in_millis: 0,
      },
      segments: {
        count: 1,
        memory_in_bytes: 0,
      },
      translog: {
        operations: 0,
        size_in_bytes: 0,
        uncommitted_operations: 0,
        uncommitted_size_in_bytes: 0,
      },
      recovery: {
        current_as_source: 0,
        current_as_target: 0,
      },
      query_cache: {
        memory_size_in_bytes: 0,
        total_count: this.cacheHits + this.cacheMisses,
        hit_count: this.cacheHits,
        miss_count: this.cacheMisses,
        cache_size: this.queryCache.size,
        cache_count: this.queryCache.size,
        evictions: 0,
      },
      fielddata: {
        memory_size_in_bytes: 0,
        evictions: 0,
      },
      completion: {
        size_in_bytes: 0,
      },
      warmer: {
        current: 0,
        total: 0,
        total_time_in_millis: 0,
      },
    };
  }

  /**
   * 估算索引大小（字节）
   */
  protected estimateIndexSize(indexData: IndexData): number {
    let size = 0;
    for (const doc of indexData.documents.values()) {
      size += JSON.stringify(doc).length;
    }
    return size;
  }

  // ==================== 集群健康方法 ====================

  /**
   * 获取集群健康状态
   * 
   * @param indexName 索引名（可选）
   * @returns 集群健康状态
   */
  protected getClusterHealth(indexName?: string): ClusterHealth {
    const activePrimaryShards = this.indices.size;
    const activeShards = this.indices.size; // 简化：每个索引一个分片

    let status: ClusterHealthStatus = 'green';
    if (activeShards === 0) {
      status = 'yellow';
    }

    return {
      cluster_name: this.clusterName,
      status,
      timed_out: false,
      number_of_nodes: this.nodes.size,
      number_of_data_nodes: this.nodes.size,
      active_primary_shards: activePrimaryShards,
      active_shards: activeShards,
      relocating_shards: 0,
      initializing_shards: 0,
      unassigned_shards: 0,
      delayed_unassigned_shards: 0,
      number_of_pending_tasks: this.pendingTasks.length,
      number_of_in_flight_fetch: 0,
      task_max_waiting_in_queue_millis: 0,
      active_shards_percent_as_number: activeShards > 0 ? 100 : 0,
    };
  }

  // ==================== 工具方法 ====================

  /**
   * 调试日志
   */
  protected debugLog(message: string, ...args: any[]): void {
    debugLog(this.config.debug, message, ...args);
  }

  /**
   * 深拷贝
   */
  protected deepClone<T>(obj: T): T {
    return deepClone(obj);
  }

  /**
   * 获取嵌套字段值
   */
  protected getNestedValue(obj: any, path: string): any {
    return getNestedValue(obj, path);
  }

  /**
   * 生成缓存键
   */
  protected generateCacheKey(index: string, query: any): string {
    return `${index}:${JSON.stringify(query)}`;
  }

  /**
   * 检查索引是否打开
   */
  protected isIndexOpen(indexName: string): boolean {
    const indexData = this.getIndexData(indexName);
    return indexData?.metadata.state === 'open';
  }

  /**
   * 验证文档ID
   */
  protected validateDocId(docId: string): boolean {
    return typeof docId === 'string' && docId.length > 0 && docId.length <= 512;
  }

  /**
   * 应用分析设置
   * 
   * @param analysis 分析设置
   */
  protected applyAnalysisSettings(analysis: AnalysisSettings): void {
    if (analysis.analyzer) {
      for (const [name, config] of Object.entries(analysis.analyzer)) {
        this.analyzers.set(name, config);
      }
    }

    if (analysis.tokenizer) {
      for (const [name, config] of Object.entries(analysis.tokenizer)) {
        this.tokenizers.set(name, config);
      }
    }

    if (analysis.filter) {
      for (const [name, config] of Object.entries(analysis.filter)) {
        this.tokenFilters.set(name, config);
      }
    }

    if (analysis.char_filter) {
      for (const [name, config] of Object.entries(analysis.char_filter)) {
        this.charFilters.set(name, config);
      }
    }
  }
}
