/**
 * 18 - 窗口函数 Mixin
 * 包含：windowQuery（ROW_NUMBER/RANK/DENSE_RANK/LAG/LEAD/SUM/AVG等）
 */
import type { FlatItem } from '../types/base.types';
import type { WindowQueryOptions, WindowFunctionConfig, WindowSpec } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithWindowFunction<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 窗口函数查询 */
    windowQuery(options: WindowQueryOptions<any>): any[] {
      const { functions, window, where, having, limit, offset } = options;
      let filtered = where 
        ? (this as any).data.filter((item: any) => (this as any).matchCondition(item, where))
        : [...(this as any).data];
      
      const partitions = new Map<string, any[]>();
      if (window.partitionBy && window.partitionBy.length > 0) {
        for (const item of filtered) {
          const key = window.partitionBy.map(field => JSON.stringify(item[field])).join('|');
          if (!partitions.has(key)) partitions.set(key, []);
          partitions.get(key)!.push(item);
        }
      } else {
        partitions.set('__all__', filtered);
      }
      
      let results: any[] = [];
      for (const [, partitionData] of partitions) {
        let sorted = [...partitionData];
        if (window.orderBy) sorted = (this as any).applySort(sorted, window.orderBy);
        
        for (let i = 0; i < sorted.length; i++) {
          const row: any = { ...sorted[i] };
          for (const funcConfig of functions) {
            row[funcConfig.alias] = this.calculateWindowFunction(funcConfig, sorted, i, window);
          }
          results.push(row);
        }
      }
      
      if (having) {
        results = results.filter(row => 
          Object.entries(having).every(([alias, condition]) => {
            if (typeof condition === 'object' && condition !== null) {
              return (this as any).matchCondition(row, { [alias]: condition });
            }
            return row[alias] === condition;
          })
        );
      }
      if (offset) results = results.slice(offset);
      if (limit) results = results.slice(0, limit);
      return results;
    }

    /** 计算单个窗口函数值 */
    private calculateWindowFunction(config: WindowFunctionConfig<any>, partition: any[], index: number, window: WindowSpec<any>): any {
      const { type, field, offset = 1, defaultValue = null } = config;
      switch (type) {
        case 'ROW_NUMBER': return index + 1;
        case 'RANK': {
          let rank = 1;
          for (let i = 0; i < index; i++) {
            if (this.compareRows(partition[i], partition[index], window.orderBy)) rank++;
          }
          return rank;
        }
        case 'DENSE_RANK': {
          const seen = new Set<string>();
          let rank = 1;
          for (let i = 0; i < index; i++) {
            const key = this.getSortKey(partition[i], window.orderBy);
            if (!seen.has(key)) {
              seen.add(key);
              if (this.compareRows(partition[i], partition[index], window.orderBy)) rank++;
            }
          }
          return rank;
        }
        case 'LAG': return index - offset >= 0 ? partition[index - offset][field!] : defaultValue;
        case 'LEAD': return index + offset < partition.length ? partition[index + offset][field!] : defaultValue;
        case 'FIRST_VALUE': return partition[0][field!];
        case 'LAST_VALUE': return partition[partition.length - 1][field!];
        case 'SUM': return this.getFrameRows(partition, index, window).reduce((sum, item) => sum + (Number(item[field!]) || 0), 0);
        case 'AVG': {
          const frame = this.getFrameRows(partition, index, window);
          const values = frame.map(item => Number(item[field!])).filter(v => !isNaN(v));
          return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
        }
        case 'COUNT': return this.getFrameRows(partition, index, window).length;
        case 'MIN': {
          const frame = this.getFrameRows(partition, index, window);
          const values = frame.map(item => item[field!]).filter(v => v != null);
          return values.length ? Math.min(...values.map(Number)) : null;
        }
        case 'MAX': {
          const frame = this.getFrameRows(partition, index, window);
          const values = frame.map(item => item[field!]).filter(v => v != null);
          return values.length ? Math.max(...values.map(Number)) : null;
        }
        default: return null;
      }
    }

    /** 获取窗口框架内的行 */
    private getFrameRows(partition: any[], index: number, window: WindowSpec<any>): any[] {
      if (!window.frame) return partition.slice(0, index + 1);
      const { type, start, end } = window.frame;
      let startIdx = start === 'UNBOUNDED PRECEDING' ? 0 : start === 'CURRENT ROW' ? index : Math.max(0, index + (start as number));
      let endIdx = end === 'UNBOUNDED FOLLOWING' ? partition.length - 1 : end === 'CURRENT ROW' ? index : Math.min(partition.length - 1, index + (end as number));
      return partition.slice(startIdx, endIdx + 1);
    }

    /** 比较两行的排序字段 */
    private compareRows(a: any, b: any, orderBy?: Record<string, 'asc' | 'desc'>): boolean {
      if (!orderBy) return false;
      for (const [field, order] of Object.entries(orderBy)) {
        if (a[field] !== b[field]) return order === 'asc' ? a[field] < b[field] : a[field] > b[field];
      }
      return false;
    }

    /** 获取排序键 */
    private getSortKey(item: any, orderBy?: Record<string, 'asc' | 'desc'>): string {
      if (!orderBy) return '';
      return Object.keys(orderBy).map(field => JSON.stringify(item[field])).join('|');
    }
  };
}
