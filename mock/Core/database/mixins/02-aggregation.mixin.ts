/**
 * 02 - 聚合查询 Mixin
 * 包含：groupBy、distinct、sum、avg、max、min
 */
import type { FlatItem } from '../types/base.types';
import type {
  QueryCondition,
  AggregationConfig,
  AggregationResult,
  GroupByOptions,
} from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithAggregation<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** GROUP BY 分组聚合查询 */
    groupBy(options: GroupByOptions<any>): AggregationResult[] {
      const { groupBy, aggregations, where, having, orderBy, limit, offset } = options;
      let filtered = where 
        ? (this as any).data.filter((item: any) => (this as any).matchCondition(item, where))
        : [...(this as any).data];
      
      const groups = new Map<string, any[]>();
      for (const item of filtered) {
        const key = groupBy.map(field => JSON.stringify(item[field])).join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      }
      
      let results: AggregationResult[] = [];
      for (const [, items] of groups) {
        const row: AggregationResult = {};
        for (const field of groupBy) row[field as string] = items[0][field];
        for (const [alias, config] of Object.entries(aggregations)) {
          row[alias] = this.calculateAggregation(items, config);
        }
        results.push(row);
      }
      
      if (having) results = results.filter(row => (this as any).matchCondition(row, having));
      if (orderBy) results = (this as any).applySort(results, orderBy);
      if (offset) results = results.slice(offset);
      if (limit) results = results.slice(0, limit);
      return results;
    }

    /** 计算单个聚合值 */
    private calculateAggregation(items: any[], config: AggregationConfig): any {
      const { fn, column, separator = ',', distinct = false } = config;
      let values = items.map(item => column === '*' ? item : item[column]);
      if (distinct) {
        values = [...new Set(values.map(v => JSON.stringify(v)))].map(v => JSON.parse(v));
      }
      switch (fn) {
        case 'COUNT': return column === '*' ? items.length : values.filter(v => v != null).length;
        case 'SUM': return values.reduce((sum: number, v: any) => sum + (Number(v) || 0), 0);
        case 'AVG': {
          const nums = values.filter(v => v != null).map(v => Number(v));
          return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
        }
        case 'MAX': {
          const valid = values.filter(v => v != null);
          return valid.length ? valid.reduce((max, v) => v > max ? v : max) : null;
        }
        case 'MIN': {
          const valid = values.filter(v => v != null);
          return valid.length ? valid.reduce((min, v) => v < min ? v : min) : null;
        }
        case 'GROUP_CONCAT': return values.filter(v => v != null).map(v => String(v)).join(separator);
        default: return null;
      }
    }

    /** DISTINCT 去重查询 */
    distinct(columns: string | string[], where?: QueryCondition<any>): any[] {
      const cols = Array.isArray(columns) ? columns : [columns];
      let filtered = where 
        ? (this as any).data.filter((item: any) => (this as any).matchCondition(item, where))
        : [...(this as any).data];
      const seen = new Set<string>();
      const results: any[] = [];
      for (const item of filtered) {
        const key = cols.map(col => JSON.stringify(item[col])).join('|');
        if (!seen.has(key)) {
          seen.add(key);
          results.push(cols.length === 1 ? item[cols[0]] : Object.fromEntries(cols.map(c => [c, item[c]])));
        }
      }
      return results;
    }

    /** 便捷方法：SUM 求和 */
    sum(column: string, where?: QueryCondition<any>): number {
      const filtered = where ? (this as any).data.filter((item: any) => (this as any).matchCondition(item, where)) : (this as any).data;
      return filtered.reduce((sum: number, item: any) => sum + (Number(item[column]) || 0), 0);
    }

    /** 便捷方法：AVG 平均值 */
    avg(column: string, where?: QueryCondition<any>): number | null {
      const filtered = where ? (this as any).data.filter((item: any) => (this as any).matchCondition(item, where)) : (this as any).data;
      const nums = filtered.map((item: any) => item[column]).filter((v: any) => v != null).map(Number);
      return nums.length ? nums.reduce((s: number, v: number) => s + v, 0) / nums.length : null;
    }

    /** 便捷方法：MAX 最大值 */
    max(column: string, where?: QueryCondition<any>): any {
      const filtered = where ? (this as any).data.filter((item: any) => (this as any).matchCondition(item, where)) : (this as any).data;
      const values = filtered.map((item: any) => item[column]).filter((v: any) => v != null);
      return values.length ? values.reduce((max: any, v: any) => v > max ? v : max) : null;
    }

    /** 便捷方法：MIN 最小值 */
    min(column: string, where?: QueryCondition<any>): any {
      const filtered = where ? (this as any).data.filter((item: any) => (this as any).matchCondition(item, where)) : (this as any).data;
      const values = filtered.map((item: any) => item[column]).filter((v: any) => v != null);
      return values.length ? values.reduce((min: any, v: any) => v < min ? v : min) : null;
    }
  };
}
