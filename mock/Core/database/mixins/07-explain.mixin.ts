/**
 * 07 - EXPLAIN 执行计划 Mixin
 * 包含：explain（分析查询的执行方式和性能）
 */
import type { FlatItem } from '../types/base.types';
import type { QueryPlan, QueryCondition } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithExplain<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** EXPLAIN 执行计划 */
    explain(condition?: QueryCondition<any>): QueryPlan {
      const startTime = Date.now();
      let indexUsed = false;
      let usedIndex: string | null = null;
      let rowsExamined = 0;
      
      if (condition) {
        const indexResult = (this as any).queryByIndex?.(condition);
        if (indexResult !== null) {
          indexUsed = true;
          usedIndex = this.findMatchingIndex(condition);
          rowsExamined = indexResult.length;
        } else {
          rowsExamined = (this as any).data.length;
        }
      } else {
        rowsExamined = (this as any).data.length;
      }
      
      const results = condition ? (this as any).find(condition) : (this as any).findAll();
      const executionTime = Date.now() - startTime;
      
      return {
        type: indexUsed ? 'ref' : 'ALL',
        possibleKeys: this.findPossibleIndexes(condition),
        key: usedIndex,
        keyLen: usedIndex ? (this as any).indexes.get(usedIndex)?.columns.length * 4 || 0 : 0,
        ref: [],
        rows: rowsExamined,
        filtered: rowsExamined > 0 ? (results.length / rowsExamined) * 100 : 0,
        Extra: indexUsed ? 'Using index' : 'Using where',
        rowsExamined,
        rowsMatched: results.length,
        rowsReturned: results.length,
        executionTimeMS: executionTime,
        indexUsed,
        isCovered: false,
      };
    }

    /** 查找可能使用的索引 */
    private findPossibleIndexes(condition?: QueryCondition<any>): string[] {
      if (!condition) return [];
      const conditionKeys = Object.keys(condition).filter(k => !k.startsWith('$'));
      const possible: string[] = [];
      for (const [name, index] of (this as any).indexes) {
        if (index.columns.some((col: string) => conditionKeys.includes(col))) possible.push(name);
      }
      return possible;
    }

    /** 查找匹配的索引 */
    private findMatchingIndex(condition?: QueryCondition<any>): string | null {
      if (!condition) return null;
      const conditionKeys = Object.keys(condition).filter(k => !k.startsWith('$'));
      for (const [name, index] of (this as any).indexes) {
        if (index.columns.length <= conditionKeys.length) {
          const matches = index.columns.every((col: string, i: number) => conditionKeys[i] === col);
          if (matches) return name;
        }
      }
      return null;
    }
  };
}
