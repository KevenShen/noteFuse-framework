/**
 * L3 分析层 - 桶聚合 Mixin
 * 
 * 包含：terms、range、date_range、histogram、date_histogram、filter、filters、nested、missing、global、sampler、diversified_sampler 等桶聚合
 */

import type { MixinConstructor } from './mixin.types';
import type { Document } from '../types';

/**
 * 桶聚合 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithAggregationBucket<T extends MixinConstructor>(Base: T) {
  return class AggregationBucketMixin extends Base {
    // ==================== terms 桶聚合 ====================

    /**
     * terms 桶聚合
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param options 选项
     * @returns 桶列表
     */
    termsAggregation(
      docs: Document[],
      field: string,
      options: {
        size?: number;
        order?: Record<string, 'asc' | 'desc'>;
        min_doc_count?: number;
        shard_size?: number;
        show_term_doc_count_error?: boolean;
        include?: string | string[];
        exclude?: string | string[];
        missing?: any;
      } = {},
    ): Array<{
      key: string;
      doc_count: number;
      doc_count_error_upper_bound?: number;
    }> {
      const {
        size = 10,
        order = { _count: 'desc' },
        min_doc_count = 1,
        missing,
      } = options;

      const valueCounts = new Map<string, number>();

      for (const doc of docs) {
        let value = this.getNestedValue(doc._source, field);

        // 处理缺失值
        if (value === undefined || value === null) {
          if (missing !== undefined) {
            value = missing;
          } else {
            continue;
          }
        }

        // 处理数组值
        const values = Array.isArray(value) ? value : [value];

        for (const v of values) {
          const key = String(v);
          valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
        }
      }

      // 过滤最小文档数
      let buckets = Array.from(valueCounts.entries())
        .filter(([, count]) => count >= min_doc_count)
        .map(([key, count]) => ({ key, doc_count: count }));

      // 排序
      for (const [sortField, sortOrder] of Object.entries(order)) {
        if (sortField === '_count') {
          buckets.sort((a, b) => sortOrder === 'asc'
            ? a.doc_count - b.doc_count
            : b.doc_count - a.doc_count);
        } else if (sortField === '_key') {
          buckets.sort((a, b) => sortOrder === 'asc'
            ? a.key.localeCompare(b.key)
            : b.key.localeCompare(a.key));
        }
      }

      // 限制返回数量
      return buckets.slice(0, size);
    }

    // ==================== range 桶聚合 ====================

    /**
     * range 桶聚合
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param ranges 范围列表
     * @param keyed 是否使用键值对格式
     * @returns 桶列表
     */
    rangeAggregation(
      docs: Document[],
      field: string,
      ranges: Array<{
        key?: string;
        from?: number;
        to?: number;
      }>,
      keyed: boolean = false,
    ): Array<{
      key: string;
      from?: number;
      to?: number;
      doc_count: number;
    }> {
      return ranges.map((range, index) => {
        const key = range.key || (
          range.from !== undefined && range.to !== undefined
            ? `${range.from}-${range.to}`
            : range.from !== undefined
              ? `${range.from}-*`
              : `*-${range.to}`
        );

        let doc_count = 0;
        for (const doc of docs) {
          const value = this.getNestedValue(doc._source, field);
          if (typeof value === 'number') {
            const inRange =
              (range.from === undefined || value >= range.from) &&
              (range.to === undefined || value < range.to);
            if (inRange) doc_count++;
          }
        }

        return {
          key,
          from: range.from,
          to: range.to,
          doc_count,
        };
      });
    }

    // ==================== date_range 桶聚合 ====================

    /**
     * date_range 桶聚合
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param ranges 日期范围列表
     * @param format 日期格式
     * @returns 桶列表
     */
    dateRangeAggregation(
      docs: Document[],
      field: string,
      ranges: Array<{
        key?: string;
        from?: string | number;
        to?: string | number;
      }>,
      format?: string,
    ): Array<{
      key: string;
      from?: number;
      from_as_string?: string;
      to?: number;
      to_as_string?: string;
      doc_count: number;
    }> {
      return ranges.map((range) => {
        const key = range.key || `${range.from || '*'}-${range.to || '*'}`;
        const fromTsParsed = range.from !== undefined ? this.parseDateToTimestamp(range.from) : null;
        const toTsParsed = range.to !== undefined ? this.parseDateToTimestamp(range.to) : null;
        const fromTs = fromTsParsed !== null ? fromTsParsed : undefined;
        const toTs = toTsParsed !== null ? toTsParsed : undefined;

        let doc_count = 0;
        for (const doc of docs) {
          const value = this.getNestedValue(doc._source, field);
          const valueTs = this.parseDateToTimestamp(value);
          if (valueTs !== null) {
            const inRange =
              (fromTs === undefined || valueTs >= fromTs) &&
              (toTs === undefined || valueTs < toTs);
            if (inRange) doc_count++;
          }
        }

        return {
          key,
          from: fromTs,
          from_as_string: fromTs !== undefined ? this.formatTimestamp(fromTs, format) : undefined,
          to: toTs,
          to_as_string: toTs !== undefined ? this.formatTimestamp(toTs, format) : undefined,
          doc_count,
        };
      });
    }

    // ==================== histogram 桶聚合 ====================

    /**
     * histogram 桶聚合
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param interval 间隔
     * @param options 选项
     * @returns 桶列表
     */
    histogramAggregation(
      docs: Document[],
      field: string,
      interval: number,
      options: {
        min_doc_count?: number;
        extended_bounds?: { min: number; max: number };
        hard_bounds?: { min: number; max: number };
        order?: Record<string, 'asc' | 'desc'>;
        offset?: number;
        keyed?: boolean;
        missing?: number;
      } = {},
    ): Array<{
      key: number;
      doc_count: number;
    }> {
      const {
        min_doc_count = 1,
        offset = 0,
        missing,
      } = options;

      const bucketCounts = new Map<number, number>();

      for (const doc of docs) {
        let value = this.getNestedValue(doc._source, field);
        if (value === undefined || value === null) {
          if (missing !== undefined) {
            value = missing;
          } else {
            continue;
          }
        }

        if (typeof value === 'number') {
          const bucketKey = Math.floor((value - offset) / interval) * interval + offset;
          bucketCounts.set(bucketKey, (bucketCounts.get(bucketKey) || 0) + 1);
        }
      }

      let buckets = Array.from(bucketCounts.entries())
        .filter(([, count]) => count >= min_doc_count)
        .map(([key, count]) => ({ key, doc_count: count }))
        .sort((a, b) => a.key - b.key);

      return buckets;
    }

    // ==================== date_histogram 桶聚合 ====================

    /**
     * date_histogram 桶聚合
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param interval 日期间隔（如 '1d'、'1w'、'1M'）
     * @param options 选项
     * @returns 桶列表
     */
    dateHistogramAggregation(
      docs: Document[],
      field: string,
      interval: string,
      options: {
        min_doc_count?: number;
        format?: string;
        time_zone?: string;
        offset?: string;
        order?: Record<string, 'asc' | 'desc'>;
        missing?: string;
      } = {},
    ): Array<{
      key: number;
      key_as_string: string;
      doc_count: number;
    }> {
      const {
        min_doc_count = 1,
        format = 'yyyy-MM-dd',
        missing,
      } = options;

      const intervalMs = this.parseIntervalToMs(interval);
      const bucketCounts = new Map<number, number>();

      for (const doc of docs) {
        let value = this.getNestedValue(doc._source, field);
        if (value === undefined || value === null) {
          if (missing !== undefined) {
            value = missing;
          } else {
            continue;
          }
        }

        const timestamp = this.parseDateToTimestamp(value);
        if (timestamp !== null) {
          const bucketKey = Math.floor(timestamp / intervalMs) * intervalMs;
          bucketCounts.set(bucketKey, (bucketCounts.get(bucketKey) || 0) + 1);
        }
      }

      return Array.from(bucketCounts.entries())
        .filter(([, count]) => count >= min_doc_count)
        .map(([key, count]) => ({
          key,
          key_as_string: this.formatTimestamp(key, format),
          doc_count: count,
        }))
        .sort((a, b) => a.key - b.key);
    }

    // ==================== filter 桶聚合 ====================

    /**
     * filter 桶聚合
     * 
     * @param docs 文档列表
     * @param filterQuery 过滤查询
     * @returns 桶
     */
    filterAggregation(
      docs: Document[],
      filterQuery: any,
    ): {
      doc_count: number;
    } {
      let doc_count = 0;
      for (const doc of docs) {
        if (this.matchesFilter(doc, filterQuery)) {
          doc_count++;
        }
      }
      return { doc_count };
    }

    // ==================== filters 桶聚合 ====================

    /**
     * filters 桶聚合
     * 
     * @param docs 文档列表
     * @param filters 过滤器列表（键值对或数组）
     * @param otherBucket 是否包含其他桶
     * @param otherBucketKey 其他桶的键名
     * @returns 桶列表
     */
    filtersAggregation(
      docs: Document[],
      filters: Record<string, any> | Array<{ key?: string; [key: string]: any }>,
      otherBucket: boolean = false,
      otherBucketKey: string = '_other_',
    ): Array<{
      key: string;
      doc_count: number;
    }> {
      const filterList = Array.isArray(filters)
        ? filters.map((f, i) => ({ key: f.key || String(i), filter: f }))
        : Object.entries(filters).map(([key, filter]) => ({ key, filter }));

      const matchedDocIds = new Set<string>();
      const buckets: Array<{ key: string; doc_count: number }> = [];

      for (const { key, filter } of filterList) {
        let doc_count = 0;
        for (const doc of docs) {
          if (this.matchesFilter(doc, filter)) {
            doc_count++;
            matchedDocIds.add(doc._id);
          }
        }
        buckets.push({ key, doc_count });
      }

      // 其他桶
      if (otherBucket) {
        const otherCount = docs.filter(doc => !matchedDocIds.has(doc._id)).length;
        buckets.push({ key: otherBucketKey, doc_count: otherCount });
      }

      return buckets;
    }

    // ==================== missing 桶聚合 ====================

    /**
     * missing 桶聚合
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @returns 桶
     */
    missingAggregation(
      docs: Document[],
      field: string,
    ): {
      doc_count: number;
    } {
      let doc_count = 0;
      for (const doc of docs) {
        const value = this.getNestedValue(doc._source, field);
        if (value === undefined || value === null) {
          doc_count++;
        }
      }
      return { doc_count };
    }

    // ==================== global 桶聚合 ====================

    /**
     * global 桶聚合（忽略查询过滤，包含所有文档）
     * 
     * @param allDocs 所有文档（不受查询过滤）
     * @returns 桶
     */
    globalAggregation(allDocs: Document[]): {
      doc_count: number;
    } {
      return { doc_count: allDocs.length };
    }

    // ==================== sampler 桶聚合 ====================

    /**
     * sampler 桶聚合（采样）
     * 
     * @param docs 文档列表
     * @param shardSize 每个分片的采样大小
     * @returns 采样后的文档
     */
    samplerAggregation(
      docs: Document[],
      shardSize: number = 100,
    ): Document[] {
      return docs.slice(0, shardSize);
    }

    // ==================== diversified_sampler 桶聚合 ====================

    /**
     * diversified_sampler 桶聚合（多样化采样）
     * 
     * @param docs 文档列表
     * @param field 用于去重的字段
     * @param shardSize 每个分片的采样大小
     * @param maxDocsPerValue 每个值的最大文档数
     * @returns 采样后的文档
     */
    diversifiedSamplerAggregation(
      docs: Document[],
      field: string,
      shardSize: number = 100,
      maxDocsPerValue: number = 1,
    ): Document[] {
      const valueCounts = new Map<string, number>();
      const result: Document[] = [];

      for (const doc of docs) {
        if (result.length >= shardSize) break;

        const value = String(this.getNestedValue(doc._source, field) || '');
        const count = valueCounts.get(value) || 0;

        if (count < maxDocsPerValue) {
          valueCounts.set(value, count + 1);
          result.push(doc);
        }
      }

      return result;
    }

    // ==================== 工具方法 ====================

    /**
     * 解析日期为时间戳
     * 
     * @param value 日期值
     * @returns 时间戳或 null
     */
    protected parseDateToTimestamp(value: any): number | null {
      if (value === null || value === undefined) return null;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const ts = Date.parse(value);
        return isNaN(ts) ? null : ts;
      }
      if (value instanceof Date) return value.getTime();
      return null;
    }

    /**
     * 格式化时间戳
     * 
     * @param timestamp 时间戳
     * @param format 格式（简化实现）
     * @returns 格式化后的日期字符串
     */
    protected formatTimestamp(timestamp: number, format?: string): string {
      const date = new Date(timestamp);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const h = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const s = String(date.getSeconds()).padStart(2, '0');

      if (format?.includes('HH')) {
        return `${y}-${m}-${d}T${h}:${min}:${s}`;
      }
      return `${y}-${m}-${d}`;
    }

    /**
     * 解析间隔为毫秒
     * 
     * @param interval 间隔字符串（如 '1d'、'1w'、'1M'）
     * @returns 毫秒数
     */
    protected parseIntervalToMs(interval: string): number {
      const match = interval.match(/^(\d+)(ms|s|m|h|d|w|M|q|y)$/);
      if (!match) return 86400000; // 默认1天

      const value = parseInt(match[1], 10);
      const unit = match[2];

      switch (unit) {
        case 'ms': return value;
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'w': return value * 7 * 24 * 60 * 60 * 1000;
        case 'M': return value * 30 * 24 * 60 * 60 * 1000; // 简化
        case 'q': return value * 90 * 24 * 60 * 60 * 1000; // 简化
        case 'y': return value * 365 * 24 * 60 * 60 * 1000; // 简化
        default: return 86400000;
      }
    }

    /**
     * 匹配过滤器
     * 
     * @param doc 文档
     * @param filter 过滤器
     * @returns 是否匹配
     */
    protected matchesFilter(doc: Document, filter: any): boolean {
      // 简化实现：支持 term、terms、range、exists、bool 等基本过滤
      try {
        if (filter.term) {
          for (const [field, value] of Object.entries(filter.term)) {
            const docValue = this.getNestedValue(doc._source, field);
            if (docValue !== value) return false;
          }
          return true;
        }
        if (filter.terms) {
          for (const [field, values] of Object.entries(filter.terms)) {
            const docValue = this.getNestedValue(doc._source, field);
            if (!Array.isArray(values) || !values.includes(docValue)) return false;
          }
          return true;
        }
        if (filter.range) {
          for (const [field, config] of Object.entries(filter.range)) {
            const docValue = this.getNestedValue(doc._source, field);
            if (typeof docValue !== 'number') return false;
            const c = config as any;
            if (c.gte !== undefined && docValue < c.gte) return false;
            if (c.gt !== undefined && docValue <= c.gt) return false;
            if (c.lte !== undefined && docValue > c.lte) return false;
            if (c.lt !== undefined && docValue >= c.lt) return false;
          }
          return true;
        }
        if (filter.exists) {
          const value = this.getNestedValue(doc._source, filter.exists.field);
          return value !== undefined && value !== null;
        }
        if (filter.bool) {
          const bool = filter.bool;
          if (bool.must && !bool.must.every((f: any) => this.matchesFilter(doc, f))) return false;
          if (bool.must_not && bool.must_not.some((f: any) => this.matchesFilter(doc, f))) return false;
          if (bool.should && !bool.should.some((f: any) => this.matchesFilter(doc, f))) return false;
          return true;
        }
        if (filter.match_all) return true;
        return true;
      } catch {
        return true;
      }
    }

    /**
     * 执行桶聚合
     * 
     * @param docs 文档列表
     * @param aggConfig 聚合配置
     * @returns 聚合结果
     */
    executeBucketAggregation(
      docs: Document[],
      aggConfig: any,
    ): any {
      if (aggConfig.terms) {
        return {
          doc_count_error_upper_bound: 0,
          sum_other_doc_count: 0,
          buckets: this.termsAggregation(docs, aggConfig.terms.field, aggConfig.terms),
        };
      }
      if (aggConfig.range) {
        return {
          buckets: this.rangeAggregation(
            docs,
            aggConfig.range.field,
            aggConfig.range.ranges || [],
            aggConfig.range.keyed,
          ),
        };
      }
      if (aggConfig.date_range) {
        return {
          buckets: this.dateRangeAggregation(
            docs,
            aggConfig.date_range.field,
            aggConfig.date_range.ranges || [],
            aggConfig.date_range.format,
          ),
        };
      }
      if (aggConfig.histogram) {
        return {
          buckets: this.histogramAggregation(
            docs,
            aggConfig.histogram.field,
            aggConfig.histogram.interval,
            aggConfig.histogram,
          ),
        };
      }
      if (aggConfig.date_histogram) {
        return {
          buckets: this.dateHistogramAggregation(
            docs,
            aggConfig.date_histogram.field,
            aggConfig.date_histogram.interval || aggConfig.date_histogram.calendar_interval || '1d',
            aggConfig.date_histogram,
          ),
        };
      }
      if (aggConfig.filter) {
        return this.filterAggregation(docs, aggConfig.filter);
      }
      if (aggConfig.filters) {
        return {
          buckets: this.filtersAggregation(
            docs,
            aggConfig.filters.filters || aggConfig.filters,
            aggConfig.filters.other_bucket,
            aggConfig.filters.other_bucket_key,
          ),
        };
      }
      if (aggConfig.missing) {
        return this.missingAggregation(docs, aggConfig.missing.field);
      }

      return { buckets: [] };
    }
  };
}
