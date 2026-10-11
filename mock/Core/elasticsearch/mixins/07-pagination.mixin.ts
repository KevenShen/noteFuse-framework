/**
 * L2 搜索层 - 分页 Mixin
 * 
 * 包含：基础分页、深分页（search_after）、游标分页（PIT）、分页结果构建、分页信息计算等
 */

import type { MixinConstructor } from './mixin.types';
import type {
  Document,
  SearchHit,
  SearchResult,
} from '../types';

/**
 * 分页 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithPagination<T extends MixinConstructor>(Base: T) {
  return class PaginationMixin extends Base {
    // ==================== 基础分页 ====================

    /**
     * 基础分页
     * 
     * @param docs 文档列表
     * @param from 起始位置
     * @param size 每页大小
     * @returns 分页结果
     */
    paginate(
      docs: Document[],
      from: number = 0,
      size: number = 10,
    ): any {
      const total = docs.length;
      const page = Math.floor(from / size) + 1;
      const totalPages = Math.ceil(total / size);

      const items = docs.slice(from, from + size);

      return {
        items,
        total,
        page,
        totalPages,
        hasNext: from + size < total,
        hasPrev: from > 0,
        from,
        size,
      };
    }

    /**
     * 分页搜索
     * 
     * @param indexName 索引名
     * @param query 查询条件
     * @param page 页码（从1开始）
     * @param pageSize 每页大小
     * @param options 选项
     * @returns 搜索结果
     */
    paginatedSearch(
      indexName: string,
      query: any,
      page: number = 1,
      pageSize: number = 10,
      options: {
        sort?: any[];
        _source?: boolean | string[];
        highlight?: any;
      } = {},
    ): SearchResult & {
      pagination: {
        page: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    } {
      const from = (page - 1) * pageSize;

      const result = (this as any).search({
        index: indexName,
        query,
        from,
        size: pageSize,
        ...options,
      });

      const total = result.hits.total.value;
      const totalPages = Math.ceil(total / pageSize);

      return {
        ...result,
        pagination: {
          page,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    }

    // ==================== 深分页（search_after） ====================

    /**
     * 使用 search_after 进行深分页搜索
     * 
     * @param indexName 索引名
     * @param query 查询条件
     * @param searchAfter 上一页最后一条文档的排序值
     * @param size 每页大小
     * @param options 选项
     * @returns 搜索结果（包含下一页的 search_after 值）
     */
    searchAfterSearch(
      indexName: string,
      query: any,
      searchAfter: any[] | null,
      size: number = 10,
      options: {
        sort?: any[];
        _source?: boolean | string[];
        highlight?: any;
      } = {},
    ): SearchResult & {
      next_search_after?: any[];
      has_next: boolean;
    } {
      // 确保有排序（search_after 需要唯一排序字段）
      const sort = options.sort || [{ _id: 'asc' }];

      const result = (this as any).search({
        index: indexName,
        query,
        size: size + 1, // 多取一条用于判断是否有下一页
        search_after: searchAfter || undefined,
        sort,
        ...options,
      });

      const hits = result.hits.hits;
      const hasNext = hits.length > size;
      const pageHits = hasNext ? hits.slice(0, size) : hits;

      // 计算下一页的 search_after 值
      let nextSearchAfter: any[] | undefined;
      if (hasNext && pageHits.length > 0) {
        const lastHit = pageHits[pageHits.length - 1];
        nextSearchAfter = this.extractSortValues(lastHit, sort);
      }

      return {
        ...result,
        hits: {
          ...result.hits,
          hits: pageHits,
        },
        next_search_after: nextSearchAfter,
        has_next: hasNext,
      };
    }

    /**
     * 从搜索命中提取排序值
     * 
     * @param hit 搜索命中
     * @param sort 排序配置
     * @returns 排序值数组
     */
    protected extractSortValues(hit: SearchHit, sort: any[]): any[] {
      const values: any[] = [];

      for (const sortItem of sort) {
        if (typeof sortItem === 'string') {
          values.push(this.getNestedValue(hit._source, sortItem));
        } else if (typeof sortItem === 'object') {
          for (const field of Object.keys(sortItem)) {
            if (field === '_score') {
              values.push(hit._score);
            } else if (field === '_id') {
              values.push(hit._id);
            } else {
              values.push(this.getNestedValue(hit._source, field));
            }
          }
        }
      }

      return values;
    }

    // ==================== PIT（Point in Time）游标分页 ====================

    /**
     * 创建 PIT（Point in Time）
     * 
     * @param indexName 索引名
     * @param keepAlive PIT 保持时间
     * @returns PIT ID
     */
    createPIT(
      indexName: string,
      keepAlive: string = '1m',
    ): {
      id: string;
      creation_time: number;
    } {
      const pitId = this.generatePITId(indexName);

      ((this as any).pitContexts as any)?.set(pitId, {
        indexName,
        createdAt: Date.now(),
        ttl: this.parseKeepAlive(keepAlive),
        snapshot: this.captureIndexSnapshot(indexName),
      });

      this.debugLog(`创建 PIT: ${pitId}`, { indexName, keepAlive });

      return {
        id: pitId,
        creation_time: Date.now(),
      };
    }

    /**
     * 使用 PIT 进行搜索
     * 
     * @param pitId PIT ID
     * @param query 查询条件
     * @param searchAfter search_after 值
     * @param size 每页大小
     * @param options 选项
     * @returns 搜索结果
     */
    searchWithPIT(
      pitId: string,
      query: any,
      searchAfter: any[] | null,
      size: number = 10,
      options: {
        sort?: any[];
        _source?: boolean | string[];
        highlight?: any;
      } = {},
    ): SearchResult & {
      pit_id: string;
      next_search_after?: any[];
      has_next: boolean;
    } {
      const pit = ((this as any).pitContexts as any)?.get(pitId);
      if (!pit) {
        throw new Error(`PIT 不存在或已过期: ${pitId}`);
      }

      // 检查是否过期
      if (Date.now() - pit.createdAt > pit.ttl) {
        ((this as any).pitContexts as any)?.delete(pitId);
        throw new Error(`PIT 已过期: ${pitId}`);
      }

      // 使用快照数据进行搜索
      const sort = options.sort || [{ _id: 'asc' }];

      // 从快照中获取文档
      const docs = pit.snapshot;

      // 应用查询过滤
      let matchedDocs = docs;
      if (query) {
        matchedDocs = docs.filter((doc: any) => this.matchesQuerySafe(doc, query));
      }

      // 应用排序
      matchedDocs = this.applySortSafe(matchedDocs, sort);

      // 应用 search_after
      let startIndex = 0;
      if (searchAfter && searchAfter.length > 0) {
        for (let i = 0; i < matchedDocs.length; i++) {
          const doc = matchedDocs[i];
          const sortValues = this.extractDocSortValues(doc, sort);
          if (this.compareSortValues(sortValues, searchAfter) > 0) {
            startIndex = i;
            break;
          }
        }
      }

      // 分页
      const pageDocs = matchedDocs.slice(startIndex, startIndex + size + 1);
      const hasNext = pageDocs.length > size;
      const resultDocs = hasNext ? pageDocs.slice(0, size) : pageDocs;

      // 构建搜索命中
      const hits: SearchHit[] = resultDocs.map((doc: any) => ({
        _index: doc._index,
        _id: doc._id,
        _score: 1,
        _source: doc._source,
      }));

      // 计算下一页的 search_after
      let nextSearchAfter: any[] | undefined;
      if (hasNext && hits.length > 0) {
        const lastHit = hits[hits.length - 1];
        nextSearchAfter = this.extractSortValues(lastHit, sort);
      }

      // 刷新 PIT 过期时间
      pit.createdAt = Date.now();

      return {
        took: 0,
        timed_out: false,
        _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
        hits: {
          total: { value: matchedDocs.length, relation: 'eq' },
          max_score: 1,
          hits,
        },
        pit_id: pitId,
        next_search_after: nextSearchAfter,
        has_next: hasNext,
      };
    }

    /**
     * 关闭 PIT
     * 
     * @param pitId PIT ID（可选，不传则关闭所有）
     * @returns 关闭的 PIT 数量
     */
    closePIT(pitId?: string): number {
      if (pitId) {
        return ((this as any).pitContexts as any)?.delete(pitId) ? 1 : 0;
      }
      const count = ((this as any).pitContexts as any)?.size || 0;
      ((this as any).pitContexts as any)?.clear();
      return count;
    }

    /**
     * 列出所有 PIT
     * 
     * @returns PIT 列表
     */
    listPITs(): Array<{
      id: string;
      indexName: string;
      createdAt: number;
      ttl: number;
    }> {
      return Array.from(((this as any).pitContexts as any)?.entries() || []).map(([id, pit]: any) => ({
        id,
        indexName: pit.indexName,
        createdAt: pit.createdAt,
        ttl: pit.ttl,
      }));
    }

    // ==================== 分页信息计算 ====================

    /**
     * 计算分页信息
     * 
     * @param total 总数
     * @param page 当前页
     * @param pageSize 每页大小
     * @returns 分页信息
     */
    calculatePaginationInfo(
      total: number,
      page: number,
      pageSize: number,
    ): {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
      from: number;
      to: number;
      firstPage: number;
      lastPage: number;
      pages: number[];
    } {
      const totalPages = Math.ceil(total / pageSize);
      const from = (page - 1) * pageSize + 1;
      const to = Math.min(page * pageSize, total);

      // 生成页码列表（当前页前后各2页）
      const pages: number[] = [];
      const startPage = Math.max(1, page - 2);
      const endPage = Math.min(totalPages, page + 2);
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      return {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        from,
        to,
        firstPage: 1,
        lastPage: totalPages,
        pages,
      };
    }

    /**
     * 验证分页参数
     * 
     * @param page 页码
     * @param pageSize 每页大小
     * @param maxPageSize 最大每页大小
     * @returns 验证后的分页参数
     */
    validatePaginationParams(
      page: number,
      pageSize: number,
      maxPageSize: number = 10000,
    ): {
      page: number;
      pageSize: number;
      from: number;
      valid: boolean;
      warnings: string[];
    } {
      const warnings: string[] = [];

      // 验证页码
      let validPage = Math.max(1, Math.floor(page) || 1);
      if (page < 1) {
        warnings.push(`页码不能小于1，已调整为1`);
      }

      // 验证每页大小
      let validPageSize = Math.max(1, Math.min(maxPageSize, Math.floor(pageSize) || 10));
      if (pageSize < 1) {
        warnings.push(`每页大小不能小于1，已调整为1`);
      }
      if (pageSize > maxPageSize) {
        warnings.push(`每页大小不能超过${maxPageSize}，已调整为${maxPageSize}`);
      }

      const from = (validPage - 1) * validPageSize;

      return {
        page: validPage,
        pageSize: validPageSize,
        from,
        valid: warnings.length === 0,
        warnings,
      };
    }

    // ==================== 工具方法 ====================

    /**
     * 生成 PIT ID
     * 
     * @param indexName 索引名
     * @returns PIT ID
     */
    protected generatePITId(indexName: string): string {
      return Buffer.from(`pit:${indexName}:${Date.now()}:${Math.random()}`).toString('base64');
    }

    /**
     * 解析 keepAlive 时间
     * 
     * @param keepAlive 保持时间字符串（如 "1m"、"30s"）
     * @returns 毫秒数
     */
    protected parseKeepAlive(keepAlive: string): number {
      const match = keepAlive.match(/^(\d+)(ms|s|m|h|d)$/);
      if (!match) return 60000;

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
     * 捕获索引快照
     * 
     * @param indexName 索引名
     * @returns 文档快照
     */
    protected captureIndexSnapshot(indexName: string): Document[] {
      const indexData = this.getIndexData(indexName);
      if (!indexData) return [];

      return Array.from(indexData.documents.values()).map(doc => ({
        ...doc,
        _source: { ...doc._source },
      }));
    }

    /**
     * 安全匹配查询
     * 
     * @param doc 文档
     * @param query 查询条件
     * @returns 是否匹配
     */
    protected matchesQuerySafe(doc: Document, query: any): boolean {
      try {
        // 简化实现：只支持简单的 term 查询
        if (query.term) {
          for (const [field, value] of Object.entries(query.term)) {
            const docValue = this.getNestedValue(doc._source, field);
            if (docValue !== value) return false;
          }
          return true;
        }
        return true;
      } catch {
        return false;
      }
    }

    /**
     * 安全应用排序
     * 
     * @param docs 文档列表
     * @param sort 排序配置
     * @returns 排序后的文档列表
     */
    protected applySortSafe(docs: Document[], sort: any[]): Document[] {
      return [...docs].sort((a, b) => {
        for (const sortItem of sort) {
          if (typeof sortItem === 'string') {
            const aValue = this.getNestedValue(a._source, sortItem);
            const bValue = this.getNestedValue(b._source, sortItem);
            if (aValue !== bValue) {
              return String(aValue).localeCompare(String(bValue));
            }
          } else if (typeof sortItem === 'object') {
            for (const [field, config] of Object.entries(sortItem)) {
              const order = (config as any).order || 'asc';
              const aValue = field === '_id' ? a._id : this.getNestedValue(a._source, field);
              const bValue = field === '_id' ? b._id : this.getNestedValue(b._source, field);
              if (aValue !== bValue) {
                const comparison = String(aValue).localeCompare(String(bValue));
                return order === 'desc' ? -comparison : comparison;
              }
            }
          }
        }
        return 0;
      });
    }

    /**
     * 提取文档排序值
     * 
     * @param doc 文档
     * @param sort 排序配置
     * @returns 排序值数组
     */
    protected extractDocSortValues(doc: Document, sort: any[]): any[] {
      const values: any[] = [];
      for (const sortItem of sort) {
        if (typeof sortItem === 'string') {
          values.push(this.getNestedValue(doc._source, sortItem));
        } else if (typeof sortItem === 'object') {
          for (const field of Object.keys(sortItem)) {
            if (field === '_id') {
              values.push(doc._id);
            } else {
              values.push(this.getNestedValue(doc._source, field));
            }
          }
        }
      }
      return values;
    }

    /**
     * 比较排序值数组
     * 
     * @param a 排序值数组A
     * @param b 排序值数组B
     * @returns 比较结果（-1/0/1）
     */
    protected compareSortValues(a: any[], b: any[]): number {
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
          return String(a[i]).localeCompare(String(b[i]));
        }
      }
      return 0;
    }
  };
}
