/**
 * L2 搜索层 - 高级搜索 Mixin
 * 
 * 包含：多索引搜索、模板搜索、滚动搜索、搜索模板、字段折叠、重新评分、KNN搜索、向量搜索等
 */

import type { MixinConstructor } from './mixin.types';
import type {
  Document,
  SearchRequest,
  SearchResult,
  SearchHit,
  QueryDSL,
} from '../types';

import { matchesQuery, calculateScore } from '../utils';

/**
 * 高级搜索 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithSearchAdvanced<T extends MixinConstructor>(Base: T) {
  return class SearchAdvancedMixin extends Base {
    // ==================== 多索引搜索 ====================

    /**
     * 多索引搜索
     * 
     * @param indexNames 索引名列表
     * @param query 查询条件
     * @param options 选项
     * @returns 搜索结果
     */
    multiIndexSearch(
      indexNames: string[],
      query: QueryDSL,
      options: {
        from?: number;
        size?: number;
        sort?: any[];
        indices_boost?: Record<string, number>;
        _source?: boolean | string[];
      } = {},
    ): SearchResult {
      const { indices_boost, ...searchOptions } = options;

      // 构建搜索请求
      const request: SearchRequest = {
        index: indexNames,
        query,
        ...searchOptions,
      };

      // 执行搜索
      const result = (this as any).search(request);

      // 应用索引权重提升
      if (indices_boost && result.hits.hits.length > 0) {
        result.hits.hits = result.hits.hits.map((hit: any) => {
          const boost = indices_boost[hit._index] || 1;
          return {
            ...hit,
            _score: (hit._score || 0) * boost,
          };
        });

        // 重新排序
        result.hits.hits.sort((a: any, b: any) => (b._score || 0) - (a._score || 0));

        // 重新计算 max_score
        result.hits.max_score = result.hits.hits.length > 0
          ? Math.max(...result.hits.hits.map((h: any) => h._score || 0))
          : null;
      }

      return result;
    }

    // ==================== 滚动搜索（Scroll） ====================

    /**
     * 初始化滚动搜索
     * 
     * @param indexName 索引名
     * @param query 查询条件
     * @param options 选项
     * @returns 滚动搜索结果（包含 scroll_id）
     */
    scrollSearch(
      indexName: string,
      query: QueryDSL,
      options: {
        size?: number;
        scroll?: string;
        sort?: any[];
        _source?: boolean | string[];
      } = {},
    ): SearchResult & { _scroll_id?: string } {
      const { size = 100, scroll = '1m', ...searchOptions } = options;

      // 执行搜索
      const result = (this as any).search({
        index: indexName,
        query,
        size,
        ...searchOptions,
      });

      // 生成 scroll_id
      const scrollId = this.generateScrollId(indexName, query, size);

      // 保存滚动上下文
      (this.scrollContexts as any).set(scrollId, {
        indexName,
        query,
        size,
        from: size,
        createdAt: Date.now(),
        ttl: this.parseScrollDuration(scroll),
      });

      return {
        ...result,
        _scroll_id: scrollId,
      };
    }

    /**
     * 继续滚动搜索
     * 
     * @param scrollId 滚动ID
     * @param scroll 滚动保持时间
     * @returns 搜索结果
     */
    scrollContinue(
      scrollId: string,
      scroll: string = '1m',
    ): SearchResult & { _scroll_id?: string } {
      const context = (this.scrollContexts as any).get(scrollId);
      if (!context) {
        throw new Error(`滚动上下文不存在或已过期: ${scrollId}`);
      }

      // 检查是否过期
      if (Date.now() - context.createdAt > context.ttl) {
        (this.scrollContexts as any).delete(scrollId);
        throw new Error(`滚动上下文已过期: ${scrollId}`);
      }

      // 执行搜索
      const result = (this as any).search({
        index: context.indexName,
        query: context.query,
        from: context.from,
        size: context.size,
      });

      // 更新滚动上下文
      context.from += context.size;
      context.createdAt = Date.now();
      context.ttl = this.parseScrollDuration(scroll);

      return {
        ...result,
        _scroll_id: scrollId,
      };
    }

    /**
     * 清除滚动上下文
     * 
     * @param scrollId 滚动ID（可选，不传则清除所有）
     * @returns 清除的滚动上下文数量
     */
    clearScroll(scrollId?: string): number {
      if (scrollId) {
        return (this.scrollContexts as any).delete(scrollId) ? 1 : 0;
      }
      const count = (this.scrollContexts as any).size;
      (this.scrollContexts as any).clear();
      return count;
    }

    // ==================== 搜索模板 ====================

    /**
     * 创建搜索模板
     * 
     * @param templateId 模板ID
     * @param template 模板配置
     * @returns 是否创建成功
     */
    putSearchTemplate(templateId: string, template: any): boolean {
      (this as any).searchTemplates?.set(templateId, template);
      this.debugLog(`创建搜索模板: ${templateId}`);
      return true;
    }

    /**
     * 获取搜索模板
     * 
     * @param templateId 模板ID
     * @returns 模板配置或 null
     */
    getSearchTemplate(templateId: string): any | null {
      return (this as any).searchTemplates?.get(templateId) || null;
    }

    /**
     * 删除搜索模板
     * 
     * @param templateId 模板ID
     * @returns 是否删除成功
     */
    deleteSearchTemplate(templateId: string): boolean {
      return (this as any).searchTemplates?.delete(templateId);
    }

    /**
     * 使用模板搜索
     * 
     * @param indexName 索引名
     * @param templateId 模板ID
     * @param params 模板参数
     * @param options 选项
     * @returns 搜索结果
     */
    searchWithTemplate(
      indexName: string,
      templateId: string,
      params: Record<string, any> = {},
      options: {
        from?: number;
        size?: number;
        _source?: boolean | string[];
      } = {},
    ): SearchResult {
      const template = (this as any).searchTemplates?.get(templateId);
      if (!template) {
        throw new Error(`搜索模板不存在: ${templateId}`);
      }

      // 渲染模板（简化实现：替换参数）
      const query = this.renderTemplate(template, params);

      // 执行搜索
      return (this as any).search({
        index: indexName,
        query,
        ...options,
      });
    }

    // ==================== 字段折叠（Collapse） ====================

    /**
     * 字段折叠搜索
     * 
     * @param indexName 索引名
     * @param query 查询条件
     * @param collapseField 折叠字段
     * @param options 选项
     * @returns 搜索结果
     */
    collapseSearch(
      indexName: string,
      query: QueryDSL,
      collapseField: string,
      options: {
        size?: number;
        inner_hits?: any;
        max_concurrent_group_searches?: number;
        _source?: boolean | string[];
      } = {},
    ): SearchResult {
      const { size = 10, inner_hits, ...searchOptions } = options;

      // 执行搜索
      const result = (this as any).search({
        index: indexName,
        query,
        size: size * 10, // 获取更多结果用于折叠
        ...searchOptions,
      });

      // 按字段折叠
      const seenValues = new Set<string>();
      const collapsedHits: SearchHit[] = [];

      for (const hit of result.hits.hits) {
        const value = this.getNestedValue(hit._source, collapseField);
        if (value === undefined) continue;

        const key = String(value);
        if (!seenValues.has(key)) {
          seenValues.add(key);

          // 添加 inner_hits（简化实现）
          if (inner_hits) {
            (hit as any).inner_hits = {
              [collapseField]: {
                hits: {
                  total: { value: 1, relation: 'eq' },
                  hits: [hit],
                },
              },
            };
          }

          collapsedHits.push(hit);
          if (collapsedHits.length >= size) break;
        }
      }

      return {
        ...result,
        hits: {
          ...result.hits,
          total: {
            value: seenValues.size,
            relation: 'eq',
          },
          hits: collapsedHits,
        },
      };
    }

    // ==================== 重新评分（Rescore） ====================

    /**
     * 重新评分搜索
     * 
     * @param indexName 索引名
     * @param query 原始查询
     * @param rescoreConfig 重新评分配置
     * @param options 选项
     * @returns 搜索结果
     */
    rescoreSearch(
      indexName: string,
      query: QueryDSL,
      rescoreConfig: {
        window_size?: number;
        query_weight?: number;
        rescore_query_weight?: number;
        score_mode?: 'total' | 'multiply' | 'avg' | 'max' | 'min';
        rescore_query: QueryDSL;
      },
      options: {
        size?: number;
        _source?: boolean | string[];
      } = {},
    ): SearchResult {
      const {
        window_size = 100,
        query_weight = 1,
        rescore_query_weight = 1,
        score_mode = 'total',
        rescore_query,
      } = rescoreConfig;

      const { size = 10, ...searchOptions } = options;

      // 执行原始搜索
      const result = (this as any).search({
        index: indexName,
        query,
        size: window_size,
        ...searchOptions,
      });

      // 对前 window_size 个结果重新评分
      const rescoredHits = result.hits.hits.map((hit: any) => {
        const originalScore = hit._score || 0;

        // 计算重新评分查询的分数
        const doc = { _source: hit._source } as Document;
        const rescoreScore = calculateScore(doc, rescore_query);

        // 应用评分模式
        let finalScore = 0;
        switch (score_mode) {
          case 'total':
            finalScore = originalScore * query_weight + rescoreScore * rescore_query_weight;
            break;
          case 'multiply':
            finalScore = originalScore * rescoreScore;
            break;
          case 'avg':
            finalScore = (originalScore + rescoreScore) / 2;
            break;
          case 'max':
            finalScore = Math.max(originalScore, rescoreScore);
            break;
          case 'min':
            finalScore = Math.min(originalScore, rescoreScore);
            break;
        }

        return {
          ...hit,
          _score: finalScore,
        };
      });

      // 重新排序
      rescoredHits.sort((a: any, b: any) => (b._score || 0) - (a._score || 0));

      return {
        ...result,
        hits: {
          ...result.hits,
          max_score: rescoredHits.length > 0 ? rescoredHits[0]._score : null,
          hits: rescoredHits.slice(0, size),
        },
      };
    }

    // ==================== KNN 搜索（简化实现） ====================

    /**
     * KNN 向量搜索
     * 
     * @param indexName 索引名
     * @param knnConfig KNN配置
     * @param options 选项
     * @returns 搜索结果
     */
    knnSearch(
      indexName: string,
      knnConfig: {
        field: string;
        query_vector: number[];
        k?: number;
        num_candidates?: number;
        filter?: QueryDSL;
        boost?: number;
      },
      options: {
        size?: number;
        _source?: boolean | string[];
      } = {},
    ): SearchResult {
      const {
        field,
        query_vector,
        k = 10,
        num_candidates = 100,
        filter,
        boost = 1,
      } = knnConfig;

      const { size = 10, ...searchOptions } = options;

      // 获取索引数据
      const indexData = this.getIndexData(indexName);
      if (!indexData) {
        return {
          took: 0,
          timed_out: false,
          _shards: { total: 0, successful: 0, skipped: 0, failed: 0 },
          hits: {
            total: { value: 0, relation: 'eq' },
            max_score: null,
            hits: [],
          },
        };
      }

      // 计算向量相似度
      const scoredDocuments: Array<{ doc: Document; score: number }> = [];

      for (const doc of indexData.documents.values()) {
        // 应用过滤器
        if (filter && !matchesQuery(doc, filter)) {
          continue;
        }

        const vector = this.getNestedValue(doc._source, field);
        if (!Array.isArray(vector)) continue;

        // 计算余弦相似度
        const similarity = this.cosineSimilarity(query_vector, vector);
        const score = similarity * boost;

        scoredDocuments.push({ doc, score });
      }

      // 按相似度排序
      scoredDocuments.sort((a, b) => b.score - a.score);

      // 取前 k 个
      const topK = scoredDocuments.slice(0, k);

      // 构建搜索结果
      const hits: SearchHit[] = topK.slice(0, size).map(({ doc, score }) => ({
        _index: doc._index,
        _id: doc._id,
        _score: score,
        _source: (this as any).filterSource?.(doc._source, searchOptions._source) || doc._source,
      }));

      return {
        took: 0,
        timed_out: false,
        _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
        hits: {
          total: { value: topK.length, relation: 'eq' },
          max_score: hits.length > 0 ? hits[0]._score : null,
          hits,
        },
      };
    }

    // ==================== 工具方法 ====================

    /**
     * 生成滚动ID
     * 
     * @param indexName 索引名
     * @param query 查询条件
     * @param size 每页大小
     * @returns 滚动ID
     */
    protected generateScrollId(indexName: string, query: QueryDSL, size: number): string {
      return Buffer.from(`${indexName}:${size}:${Date.now()}:${Math.random()}`).toString('base64');
    }

    /**
     * 解析滚动持续时间
     * 
     * @param scroll 滚动时间字符串（如 "1m"、"30s"）
     * @returns 毫秒数
     */
    protected parseScrollDuration(scroll: string): number {
      const match = scroll.match(/^(\d+)(ms|s|m|h|d)$/);
      if (!match) return 60000; // 默认1分钟

      const value = parseInt(match[1], 10);
      const unit = match[2];

      switch (unit) {
        case 'ms': return value;
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return 60000;
      }
    }

    /**
     * 渲染搜索模板
     * 
     * @param template 模板配置
     * @param params 模板参数
     * @returns 渲染后的查询
     */
    protected renderTemplate(template: any, params: Record<string, any>): QueryDSL {
      // 简化实现：递归替换模板中的参数占位符
      const templateStr = JSON.stringify(template);
      let renderedStr = templateStr;

      for (const [key, value] of Object.entries(params)) {
        const placeholder = `{{${key}}}`;
        renderedStr = renderedStr.replace(new RegExp(placeholder, 'g'), JSON.stringify(value));
      }

      return JSON.parse(renderedStr);
    }

    /**
     * 计算余弦相似度
     * 
     * @param vec1 向量1
     * @param vec2 向量2
     * @returns 余弦相似度
     */
    protected cosineSimilarity(vec1: number[], vec2: number[]): number {
      if (vec1.length !== vec2.length) return 0;

      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vec2[i] * vec2[i];
      }

      if (norm1 === 0 || norm2 === 0) return 0;

      return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
  };
}
