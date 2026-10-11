/**
 * L2 搜索层 - 基础搜索 Mixin
 * 
 * 包含：基础搜索、查询DSL解析、文档匹配、评分计算、搜索结果构建等
 */

import type { MixinConstructor } from './mixin.types';
import type {
  Document,
  SearchRequest,
  SearchResult,
  SearchHit,
  QueryDSL,
  CountResult,
} from '../types';

import {
  matchesQuery,
  calculateScore,
  filterDocuments,
  sortDocuments,
  paginateDocuments,
  highlightDocument,
} from '../utils';

/**
 * 基础搜索 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithSearchBasic<T extends MixinConstructor>(Base: T) {
  return class SearchBasicMixin extends Base {
    // ==================== 基础搜索 ====================

    /**
     * 搜索文档
     * 
     * @param request 搜索请求
     * @returns 搜索结果
     */
    search(request: any): SearchResult {
      const startTime = Date.now();

      const {
        index,
        query,
        from = 0,
        size = 10,
        sort,
        _source,
        _source_includes,
        _source_excludes,
        stored_fields,
        script_fields,
        docvalue_fields,
        highlight,
        aggs,
        suggest,
        search_after,
        track_total_hits = true,
        track_scores = false,
        min_score,
        terminate_after,
        timeout,
        allow_partial_search_results = true,
        batched_reduce_size = 512,
        ccs_minimize_roundtrips = true,
        preference,
        routing,
        request_cache,
        scroll,
        stats,
        version = false,
        seq_no_primary_term = false,
        explain = false,
        fields,
        indices_boost,
        rescore,
        collapse,
        knn,
        rank,
      } = request as any;

      // 获取索引数据
      const indexNames = this.resolveIndexNames(index);
      const allDocuments: Document[] = [];

      for (const indexName of indexNames) {
        const indexData = this.getIndexData(indexName);
        if (indexData && indexData.metadata.state === 'open') {
          for (const doc of indexData.documents.values()) {
            allDocuments.push(doc);
          }
        }
      }

      // 应用查询过滤
      let matchedDocuments = allDocuments;
      if (query) {
        matchedDocuments = allDocuments.filter(doc => matchesQuery(doc, query));
      }

      // 应用 min_score 过滤
      if (min_score !== undefined) {
        matchedDocuments = matchedDocuments.filter(doc => {
          const score = query ? calculateScore(doc, query) : 1;
          return score >= min_score;
        });
      }

      // 计算评分
      const scoredDocuments: any[] = matchedDocuments.map(doc => {
        const score = query ? calculateScore(doc, query) : 1;
        return { ...doc, _score: score };
      });

      // 应用排序
      let sortedDocuments: any[] = scoredDocuments;
      if (sort && sort.length > 0) {
        sortedDocuments = sortDocuments(scoredDocuments, sort);
      } else {
        // 默认按评分降序排序
        sortedDocuments = scoredDocuments.sort((a: any, b: any) => (b._score || 0) - (a._score || 0));
      }

      // 应用 terminate_after
      if (terminate_after !== undefined && sortedDocuments.length > terminate_after) {
        sortedDocuments = sortedDocuments.slice(0, terminate_after);
      }

      // 计算总数
      const totalCount = track_total_hits ? matchedDocuments.length : Math.min(matchedDocuments.length, 10000);

      // 应用分页
      let paginatedDocuments: any[] = sortedDocuments;
      if (search_after && search_after.length > 0) {
        // search_after 分页
        paginatedDocuments = this.applySearchAfter(sortedDocuments, search_after, size);
      } else {
        // 普通分页
        paginatedDocuments = paginateDocuments(sortedDocuments, from, size);
      }

      // 构建搜索命中
      const hits: SearchHit[] = paginatedDocuments.map(doc => {
        const hit: SearchHit = {
          _index: doc._index,
          _id: doc._id,
          _score: doc._score || null,
          _source: this.filterSource(doc._source, _source, _source_includes, _source_excludes),
        };

        if (version) {
          hit._version = doc._version;
        }

        if (seq_no_primary_term) {
          hit._seq_no = doc._seq_no;
          hit._primary_term = doc._primary_term;
        }

        // 应用高亮
        if (highlight && query) {
          const queryText = this.extractQueryText(query);
          if (queryText) {
            (hit as any).highlight = highlightDocument(doc, highlight as any, queryText);
          }
        }

        // 应用 explain
        if (explain && query) {
          hit._explanation = this.buildExplanation(doc, query);
        }

        // 应用 fields
        if (fields && fields.length > 0) {
          (hit as any).fields = this.extractFields(doc, fields);
        }

        return hit;
      });

      // 构建聚合结果（简化处理）
      let aggregations: Record<string, any> | undefined;
      if (aggs) {
        aggregations = this.calculateAggregations(matchedDocuments, aggs);
      }

      // 构建搜索结果
      const duration = Date.now() - startTime;
      this.recordSearchOperation(duration);

      const result: SearchResult = {
        took: duration,
        timed_out: false,
        _shards: {
          total: indexNames.length,
          successful: indexNames.length,
          skipped: 0,
          failed: 0,
        },
        hits: {
          total: {
            value: totalCount,
            relation: track_total_hits ? 'eq' : 'gte',
          },
          max_score: hits.length > 0 ? Math.max(...hits.map(h => h._score || 0)) : null,
          hits,
        },
      };

      if (aggregations) {
        result.aggregations = aggregations;
      }

      this.debugLog(`搜索完成`, {
        index: indexNames,
        query,
        total: totalCount,
        hits: hits.length,
        duration,
      });

      return result;
    }

    /**
     * 简化搜索（只传索引和查询）
     * 
     * @param indexName 索引名
     * @param query 查询条件
     * @param options 选项
     * @returns 搜索结果
     */
    simpleSearch(
      indexName: string,
      query: QueryDSL,
      options: {
        from?: number;
        size?: number;
        sort?: any[];
        _source?: boolean | string[];
      } = {},
    ): SearchResult {
      return this.search({
        index: indexName,
        query,
        ...options,
      });
    }

    // ==================== 搜索工具方法 ====================

    /**
     * 解析索引名（支持通配符和别名）
     * 
     * @param index 索引名（可以是字符串、字符串数组、通配符）
     * @returns 实际索引名列表
     */
    protected resolveIndexNames(index: string | string[] | undefined): string[] {
      if (!index) {
        return Array.from(this.indices.keys());
      }

      const indexList = Array.isArray(index) ? index : [index];
      const result: string[] = [];

      for (const indexName of indexList) {
        // 检查别名
        if (this.aliases.has(indexName)) {
          const aliasData = this.aliases.get(indexName) as any;
          if (aliasData && aliasData.index) {
            result.push(aliasData.index);
            continue;
          }
        }

        // 检查通配符
        if (indexName.includes('*')) {
          const pattern = new RegExp('^' + indexName.replace(/\*/g, '.*') + '$');
          for (const name of this.indices.keys()) {
            if (pattern.test(name)) {
              result.push(name);
            }
          }
          continue;
        }

        // 直接匹配
        if (this.indices.has(indexName)) {
          result.push(indexName);
        }
      }

      return [...new Set(result)];
    }

    /**
     * 过滤源数据字段
     * 
     * @param source 源数据
     * @param _source 字段过滤配置
     * @param includes 包含字段
     * @param excludes 排除字段
     * @returns 过滤后的源数据
     */
    protected filterSource(
      source: Record<string, any>,
      _source?: boolean | string[] | { includes?: string[]; excludes?: string[] },
      includes?: string[],
      excludes?: string[],
    ): Record<string, any> {
      if (_source === false) {
        return {};
      }

      let result = { ...source };

      // 处理 _source 配置
      if (Array.isArray(_source)) {
        const filtered: Record<string, any> = {};
        for (const field of _source) {
          const value = this.getNestedValue(result, field);
          if (value !== undefined) {
            this.setNestedValueSafe(filtered, field, value);
          }
        }
        result = filtered;
      } else if (typeof _source === 'object' && _source !== null) {
        if (_source.includes) {
          const filtered: Record<string, any> = {};
          for (const field of _source.includes) {
            const value = this.getNestedValue(result, field);
            if (value !== undefined) {
              this.setNestedValueSafe(filtered, field, value);
            }
          }
          result = filtered;
        }
        if (_source.excludes) {
          for (const field of _source.excludes) {
            delete result[field];
          }
        }
      }

      // 处理 includes
      if (includes && includes.length > 0) {
        const filtered: Record<string, any> = {};
        for (const field of includes) {
          const value = this.getNestedValue(result, field);
          if (value !== undefined) {
            this.setNestedValueSafe(filtered, field, value);
          }
        }
        result = filtered;
      }

      // 处理 excludes
      if (excludes && excludes.length > 0) {
        for (const field of excludes) {
          delete result[field];
        }
      }

      return result;
    }

    /**
     * 安全设置嵌套字段值
     * 
     * @param obj 目标对象
     * @param path 字段路径
     * @param value 值
     */
    protected setNestedValueSafe(obj: Record<string, any>, path: string, value: any): void {
      const parts = path.split('.');
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    }

    /**
     * 提取查询文本（用于高亮）
     * 
     * @param query 查询条件
     * @returns 查询文本
     */
    protected extractQueryText(query: any): string {
      if (!query) return '';

      // match 查询
      if (query.match) {
        for (const field of Object.keys(query.match)) {
          const matchConfig = query.match[field];
          if (typeof matchConfig === 'string') return matchConfig;
          if (typeof matchConfig === 'object' && matchConfig.query) return matchConfig.query;
        }
      }

      // multi_match 查询
      if (query.multi_match && query.multi_match.query) {
        return query.multi_match.query;
      }

      // query_string 查询
      if (query.query_string && query.query_string.query) {
        return query.query_string.query;
      }

      // simple_query_string 查询
      if (query.simple_query_string && query.simple_query_string.query) {
        return query.simple_query_string.query;
      }

      // bool 查询（递归提取）
      if (query.bool) {
        const bool = query.bool;
        if (bool.must && bool.must.length > 0) {
          for (const subQuery of bool.must) {
            const text = this.extractQueryText(subQuery);
            if (text) return text;
          }
        }
        if (bool.should && bool.should.length > 0) {
          for (const subQuery of bool.should) {
            const text = this.extractQueryText(subQuery);
            if (text) return text;
          }
        }
      }

      return '';
    }

    /**
     * 应用 search_after 分页
     * 
     * @param documents 文档列表
     * @param searchAfter search_after 值
     * @param size 每页大小
     * @returns 分页后的文档列表
     */
    protected applySearchAfter(
      documents: Document[],
      searchAfter: any[],
      size: number,
    ): Document[] {
      // 简化实现：找到 search_after 对应的文档位置
      let startIndex = 0;
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        // 简化比较：比较 _id
        if (doc._id === searchAfter[searchAfter.length - 1]) {
          startIndex = i + 1;
          break;
        }
      }
      return documents.slice(startIndex, startIndex + size);
    }

    /**
     * 构建 explain 解释
     * 
     * @param doc 文档
     * @param query 查询条件
     * @returns 解释对象
     */
    protected buildExplanation(doc: Document, query: QueryDSL): any {
      const score = calculateScore(doc, query);
      return {
        value: score,
        description: 'sum of:',
        details: [
          {
            value: score,
            description: 'score in document',
            details: [],
          },
        ],
      };
    }

    /**
     * 提取字段值
     * 
     * @param doc 文档
     * @param fields 字段列表
     * @returns 字段值映射
     */
    protected extractFields(doc: Document, fields: string[]): Record<string, any[]> {
      const result: Record<string, any[]> = {};
      for (const field of fields) {
        const value = this.getNestedValue(doc._source, field);
        if (value !== undefined) {
          result[field] = Array.isArray(value) ? value : [value];
        }
      }
      return result;
    }

    /**
     * 计算聚合（简化实现）
     * 
     * @param documents 文档列表
     * @param aggs 聚合配置
     * @returns 聚合结果
     */
    protected calculateAggregations(
      documents: Document[],
      aggs: Record<string, any>,
    ): Record<string, any> {
      const result: Record<string, any> = {};

      for (const [aggName, aggConfig] of Object.entries(aggs)) {
        result[aggName] = this.calculateSingleAggregation(documents, aggConfig);
      }

      return result;
    }

    /**
     * 计算单个聚合（简化实现）
     * 
     * @param documents 文档列表
     * @param aggConfig 聚合配置
     * @returns 聚合结果
     */
    protected calculateSingleAggregation(
      documents: Document[],
      aggConfig: any,
    ): any {
      // value_count 聚合
      if (aggConfig.value_count) {
        const field = aggConfig.value_count.field;
        let count = 0;
        for (const doc of documents) {
          if (this.getNestedValue(doc._source, field) !== undefined) {
            count++;
          }
        }
        return { value: count };
      }

      // avg 聚合
      if (aggConfig.avg) {
        const field = aggConfig.avg.field;
        let sum = 0;
        let count = 0;
        for (const doc of documents) {
          const value = this.getNestedValue(doc._source, field);
          if (typeof value === 'number') {
            sum += value;
            count++;
          }
        }
        return { value: count > 0 ? sum / count : null };
      }

      // sum 聚合
      if (aggConfig.sum) {
        const field = aggConfig.sum.field;
        let sum = 0;
        for (const doc of documents) {
          const value = this.getNestedValue(doc._source, field);
          if (typeof value === 'number') {
            sum += value;
          }
        }
        return { value: sum };
      }

      // min 聚合
      if (aggConfig.min) {
        const field = aggConfig.min.field;
        let min: number | null = null;
        for (const doc of documents) {
          const value = this.getNestedValue(doc._source, field);
          if (typeof value === 'number') {
            if (min === null || value < min) min = value;
          }
        }
        return { value: min };
      }

      // max 聚合
      if (aggConfig.max) {
        const field = aggConfig.max.field;
        let max: number | null = null;
        for (const doc of documents) {
          const value = this.getNestedValue(doc._source, field);
          if (typeof value === 'number') {
            if (max === null || value > max) max = value;
          }
        }
        return { value: max };
      }

      // terms 聚合
      if (aggConfig.terms) {
        const field = aggConfig.terms.field;
        const size = aggConfig.terms.size || 10;
        const valueCounts = new Map<string, number>();

        for (const doc of documents) {
          const value = this.getNestedValue(doc._source, field);
          if (value !== undefined) {
            const key = String(value);
            valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
          }
        }

        const buckets = Array.from(valueCounts.entries())
          .map(([key, count]) => ({ key, doc_count: count }))
          .sort((a, b) => b.doc_count - a.doc_count)
          .slice(0, size);

        return {
          doc_count_error_upper_bound: 0,
          sum_other_doc_count: documents.length - buckets.reduce((sum, b) => sum + b.doc_count, 0),
          buckets,
        };
      }

      // 默认返回空值
      return { value: null };
    }
  };
}
