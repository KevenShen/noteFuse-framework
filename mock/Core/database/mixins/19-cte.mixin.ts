/**
 * 19 - CTE 公共表表达式 Mixin
 * 包含：with（普通 CTE + 递归 CTE）
 */
import type { FlatItem } from '../types/base.types';
import type { CteDefinition } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithCte<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** CTE（公共表表达式）查询 */
    with(ctes: CteDefinition[], finalQuery: (cteData: Record<string, any[]>) => any[]): any[] {
      const cteData: Record<string, any[]> = {};
      for (const cte of ctes) {
        cteData[cte.name] = cte.recursive ? this.executeRecursiveCte(cte) : cte.query();
      }
      return finalQuery(cteData);
    }

    /** 执行递归 CTE */
    private executeRecursiveCte(cte: CteDefinition): any[] {
      if (!cte.anchorQuery || !cte.recursiveQuery) return cte.query();
      const maxDepth = cte.maxDepth || 100;
      let results = cte.anchorQuery();
      let prevResults = results;
      for (let depth = 0; depth < maxDepth; depth++) {
        const newResults = cte.recursiveQuery(prevResults);
        if (newResults.length === 0) break;
        const seen = new Set(results.map(r => JSON.stringify(r)));
        const uniqueNew = newResults.filter(r => !seen.has(JSON.stringify(r)));
        if (uniqueNew.length === 0) break;
        results = results.concat(uniqueNew);
        prevResults = uniqueNew;
      }
      return results;
    }
  };
}
