/**
 * 20 - 全文搜索 Mixin
 * 包含：fulltextSearch（自然语言/布尔/查询扩展模式）
 */
import type { FlatItem } from '../types/base.types';
import type { FulltextSearchResult, FulltextSearchOptions } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithFulltext<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 全文搜索 */
    fulltextSearch(keyword: string, options?: FulltextSearchOptions): FulltextSearchResult<any>[] {
      const { mode = 'NATURAL_LANGUAGE', fields, minScore = 0, orderByScore = true, limit, booleanOperators } = options || {};
      
      let searchFields: string[];
      if (fields) {
        searchFields = fields;
      } else {
        searchFields = [];
        for (const [, index] of (this as any).indexes) {
          if (index.type === 'FULLTEXT') searchFields = searchFields.concat(index.columns);
        }
        if (searchFields.length === 0 && (this as any).data.length > 0) {
          searchFields = Object.keys((this as any).data[0]).filter(key => typeof (this as any).data[0][key] === 'string');
        }
      }
      
      let mustInclude: string[] = [];
      let mustExclude: string[] = [];
      let shouldInclude: string[] = [];
      if (mode === 'BOOLEAN' && booleanOperators) {
        mustInclude = booleanOperators.mustInclude || [];
        mustExclude = booleanOperators.mustExclude || [];
        shouldInclude = booleanOperators.shouldInclude || [];
      } else {
        shouldInclude = keyword.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      }
      
      let results: FulltextSearchResult<any>[] = [];
      for (const item of (this as any).data) {
        let score = 0;
        const matchedFields: string[] = [];
        for (const field of searchFields) {
          const fieldValue = String(item[field] || '').toLowerCase();
          const allMustIncluded = mustInclude.every(word => fieldValue.includes(word));
          if (mustInclude.length > 0 && !allMustIncluded) continue;
          const anyMustExcluded = mustExclude.some(word => fieldValue.includes(word));
          if (anyMustExcluded) continue;
          for (const word of shouldInclude) {
            if (fieldValue.includes(word)) {
              score++;
              if (!matchedFields.includes(field)) matchedFields.push(field);
            }
          }
        }
        if (score > 0 && score >= minScore && matchedFields.length > 0) {
          results.push({ item, score, matchedFields });
        }
      }
      
      if (orderByScore) results.sort((a, b) => b.score - a.score);
      if (limit) results = results.slice(0, limit);
      return results;
    }
  };
}
