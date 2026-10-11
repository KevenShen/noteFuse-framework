/**
 * 11 - 子查询 Mixin
 * 包含：whereIn、whereNotIn、whereExists、whereNotExists
 */
import type { FlatItem } from '../types/base.types';
import type { SubqueryConfig } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithSubquery<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 子查询：IN */
    whereIn(field: string, subquery: SubqueryConfig<any>): any[] {
      const subqueryResults = subquery.table.findAll().map((item: any) => item[subquery.select]);
      return (this as any).data.filter((item: any) => subqueryResults.includes(item[field]));
    }

    /** 子查询：NOT IN */
    whereNotIn(field: string, subquery: SubqueryConfig<any>): any[] {
      const subqueryResults = subquery.table.findAll().map((item: any) => item[subquery.select]);
      return (this as any).data.filter((item: any) => !subqueryResults.includes(item[field]));
    }

    /** 子查询：EXISTS */
    whereExists(subquery: SubqueryConfig<any>): any[] {
      return (this as any).data.filter((item: any) => {
        if (!subquery.correlation) return false;
        return subquery.table.findAll().some((subItem: any) => 
          Object.entries(subquery.correlation!).every(([parentField, childField]) => 
            item[parentField] === subItem[childField as string]
          )
        );
      });
    }

    /** 子查询：NOT EXISTS */
    whereNotExists(subquery: SubqueryConfig<any>): any[] {
      return (this as any).data.filter((item: any) => {
        if (!subquery.correlation) return true;
        return !subquery.table.findAll().some((subItem: any) => 
          Object.entries(subquery.correlation!).every(([parentField, childField]) => 
            item[parentField] === subItem[childField as string]
          )
        );
      });
    }
  };
}
