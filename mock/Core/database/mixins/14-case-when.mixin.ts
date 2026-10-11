/**
 * 14 - CASE WHEN 条件更新 Mixin
 * 包含：caseWhenUpdate、increment、decrement
 */
import type { FlatItem } from '../types/base.types';
import type { CaseWhenConfig, QueryCondition } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithCaseWhen<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** CASE WHEN 条件更新 */
    caseWhenUpdate(config: CaseWhenConfig<any>): number {
      const { field, cases, else: elseValue } = config;
      let updatedCount = 0;
      for (const item of (this as any).data) {
        let newValue: any = elseValue;
        for (const caseConfig of cases) {
          if ((this as any).matchCondition(item, caseConfig.when)) {
            newValue = caseConfig.then;
            break;
          }
        }
        if (newValue !== undefined && item[field] !== newValue) {
          item[field] = newValue;
          updatedCount++;
        }
      }
      return updatedCount;
    }

    /** 字段自增 */
    increment(field: string, amount: number = 1, condition?: QueryCondition<any>): number {
      const items = condition 
        ? (this as any).data.filter((item: any) => (this as any).matchCondition(item, condition))
        : (this as any).data;
      for (const item of items) {
        item[field] = (Number(item[field]) || 0) + amount;
      }
      return items.length;
    }

    /** 字段自减 */
    decrement(field: string, amount: number = 1, condition?: QueryCondition<any>): number {
      return this.increment(field, -amount, condition);
    }
  };
}
