/**
 * 09 - JOIN 关联查询 Mixin
 * 包含：join（INNER/LEFT/RIGHT/FULL）
 */
import type { FlatItem } from '../types/base.types';
import type { JoinQueryOptions } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithJoin<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** JOIN 关联查询 */
    join(options: JoinQueryOptions<any, any>): any[] {
      const { joins, where, rightWhere, select, orderBy, limit, offset } = options;
      let leftData = where 
        ? (this as any).data.filter((item: any) => (this as any).matchCondition(item, where))
        : [...(this as any).data];
      let results: any[] = [];
      
      for (const joinConfig of joins) {
        const { type, table, on, alias } = joinConfig;
        const rightData = rightWhere ? table.find(rightWhere) : table.findAll();
        const joinResults: any[] = [];
        
        for (const leftItem of leftData) {
          let matched = false;
          for (const rightItem of rightData) {
            const isMatch = Object.entries(on).every(([leftField, rightField]) => 
              leftItem[leftField] === rightItem[rightField as string]
            );
            if (isMatch) {
              matched = true;
              const merged = { ...leftItem };
              for (const [key, value] of Object.entries(rightItem)) {
                merged[alias ? `${alias}.${key}` : key] = value;
              }
              joinResults.push(merged);
            }
          }
          if (!matched && (type === 'LEFT' || type === 'FULL')) {
            const merged = { ...leftItem };
            for (const key of Object.keys(rightData[0] || {})) {
              merged[alias ? `${alias}.${key}` : key] = null;
            }
            joinResults.push(merged);
          }
        }
        
        if (type === 'RIGHT' || type === 'FULL') {
          for (const rightItem of rightData) {
            const hasMatch = leftData.some((leftItem: any) => 
              Object.entries(on).every(([leftField, rightField]) => 
                leftItem[leftField] === rightItem[rightField as string]
              )
            );
            if (!hasMatch) {
              const merged: any = {};
              for (const key of Object.keys(leftData[0] || {})) merged[key] = null;
              for (const [key, value] of Object.entries(rightItem)) {
                merged[alias ? `${alias}.${key}` : key] = value;
              }
              joinResults.push(merged);
            }
          }
        }
        results = joinResults;
        leftData = joinResults;
      }
      
      if (select) {
        results = results.map(row => {
          const selected: any = {};
          for (const field of select) selected[field] = row[field];
          return selected;
        });
      }
      if (orderBy) results = (this as any).applySort(results, orderBy);
      if (offset) results = results.slice(offset);
      if (limit) results = results.slice(0, limit);
      return results;
    }
  };
}
