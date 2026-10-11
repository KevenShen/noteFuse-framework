/**
 * 10 - UNION 合并查询 Mixin
 * 包含：union（UNION/UNION ALL）
 */
import type { FlatItem } from '../types/base.types';
import type { UnionQueryOptions } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithUnion<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** UNION 合并查询 */
    union(queries: Array<() => any[]>, options?: UnionQueryOptions): any[] {
      const { distinct = true, orderBy, limit, offset } = options || {};
      let results: any[] = [];
      for (const query of queries) results = results.concat(query());
      
      if (distinct) {
        const seen = new Set<string>();
        results = results.filter(item => {
          const key = JSON.stringify(item);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      if (orderBy) results = (this as any).applySort(results, orderBy);
      if (offset) results = results.slice(offset);
      if (limit) results = results.slice(0, limit);
      return results;
    }
  };
}
