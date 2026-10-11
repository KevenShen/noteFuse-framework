/**
 * 03 - 游标分页 Mixin
 * 包含：cursorPaginate（基于游标的高效分页）
 */
import type { FlatItem } from '../types/base.types';
import type {
  QueryCondition,
  CursorPaginatedResult,
  CursorPaginationOptions,
} from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithCursorPagination<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 游标分页查询 */
    cursorPaginate(options: CursorPaginationOptions<any>): CursorPaginatedResult<any> {
      const { where, orderBy, limit, cursor, select, exclude } = options;
      
      let filtered = where 
        ? (this as any).data.filter((item: any) => (this as any).matchCondition(item, where))
        : [...(this as any).data];
      
      filtered = (this as any).applySort(filtered, orderBy);
      
      let startIndex = 0;
      if (cursor) {
        try {
          const cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString());
          const cursorIndex = filtered.findIndex((item: any) => 
            Object.entries(cursorData).every(([key, value]) => 
              JSON.stringify(item[key]) === JSON.stringify(value)
            )
          );
          if (cursorIndex >= 0) startIndex = cursorIndex + 1;
        } catch (e) { /* 无效游标，从头开始 */ }
      }
      
      const pageData = filtered.slice(startIndex, startIndex + limit + 1);
      const hasMore = pageData.length > limit;
      const data = hasMore ? pageData.slice(0, limit) : pageData;
      
      let nextCursor: string | null = null;
      if (hasMore && data.length > 0) {
        const lastItem = data[data.length - 1];
        const cursorObj: any = {};
        if (Array.isArray(orderBy)) {
          for (const sort of orderBy) cursorObj[sort.field as string] = lastItem[sort.field];
        } else if (orderBy && 'field' in orderBy) {
          cursorObj[orderBy.field as string] = lastItem[orderBy.field];
        } else if (orderBy) {
          for (const [field] of Object.entries(orderBy)) cursorObj[field] = lastItem[field];
        }
        nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64');
      }
      
      let prevCursor: string | null = null;
      if (startIndex > 0 && filtered.length > 0) {
        const prevItem = filtered[Math.max(0, startIndex - 1)];
        const cursorObj: any = {};
        if (Array.isArray(orderBy)) {
          for (const sort of orderBy) cursorObj[sort.field as string] = prevItem[sort.field];
        } else if (orderBy && 'field' in orderBy) {
          cursorObj[orderBy.field as string] = prevItem[orderBy.field];
        } else if (orderBy) {
          for (const [field] of Object.entries(orderBy)) cursorObj[field] = prevItem[field];
        }
        prevCursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64');
      }
      
      let resultData = data;
      if (select || exclude) {
        resultData = data.map((item: any) => (this as any).applyProjection(item, { select, exclude }));
      }
      
      return { data: resultData, nextCursor, prevCursor, hasMore, count: resultData.length };
    }
  };
}
