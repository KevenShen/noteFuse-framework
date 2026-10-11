/**
 * 01 - 基础查询 Mixin
 * 包含：findAll、findById、findOne、find、paginate、count、exists
 */
import type { FlatItem } from '../types/base.types';
import type {
  QueryCondition,
  FindOptions,
  OrderByOption,
  PaginationOption,
  PaginatedResult,
} from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithQuery<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 获取所有数据 */
    findAll(options?: FindOptions<any>): any[] {
      let result = [...(this as any).data];
      result = (this as any).applySoftDeleteFilter(result);
      result = (this as any).applySort(result, options?.orderBy);
      if (options?.offset) result = result.slice(options.offset);
      if (options?.limit) result = result.slice(0, options.limit);
      if (options?.select || options?.exclude || options?.alias) {
        return result.map(item => (this as any).applyProjection(item, options));
      }
      (this as any).resetTrashedFlags();
      return result;
    }

    /** 根据 ID 查找 */
    findById(id: number | string, options?: FindOptions<any>): any | undefined {
      const item = (this as any).data.find((item: any) => item.id === id);
      if (!item) return undefined;
      return (this as any).applyProjection(item, options);
    }

    /** 根据条件查找单条 */
    findOne(condition: QueryCondition<any>, options?: FindOptions<any>): any | undefined {
      let matched = (this as any).data.filter((item: any) => (this as any).matchCondition(item, condition));
      matched = (this as any).applySoftDeleteFilter(matched);
      let result = matched[0];
      if (options?.orderBy && matched.length > 1) {
        result = (this as any).applySort(matched, options.orderBy)[0];
      }
      if (!result) return undefined;
      (this as any).resetTrashedFlags();
      return (this as any).applyProjection(result, options);
    }

    /** 根据条件查找多条 */
    find(condition?: QueryCondition<any>, options?: FindOptions<any>): any[] {
      let result = condition 
        ? (this as any).data.filter((item: any) => (this as any).matchCondition(item, condition))
        : [...(this as any).data];
      result = (this as any).applySoftDeleteFilter(result);
      result = (this as any).applySort(result, options?.orderBy);
      if (options?.offset) result = result.slice(options.offset);
      if (options?.limit) result = result.slice(0, options.limit);
      if (options?.select || options?.exclude || options?.alias) {
        return result.map((item: any) => (this as any).applyProjection(item, options));
      }
      (this as any).resetTrashedFlags();
      return result;
    }

    /** 分页查询 */
    paginate(
      condition?: QueryCondition<any>,
      sort?: OrderByOption<any>,
      pagination?: PaginationOption,
      options?: Omit<FindOptions<any>, 'orderBy' | 'limit' | 'offset'>,
    ): PaginatedResult<any> {
      let result = condition ? this.find(condition) : this.findAll();
      if (sort) result = (this as any).applySort(result, sort);
      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 10;
      const total = result.length;
      const start = (page - 1) * pageSize;
      let list = result.slice(start, start + pageSize);
      if (options?.select || options?.exclude || options?.alias) {
        list = list.map((item: any) => (this as any).applyProjection(item, options));
      }
      return { list, total, page, pageSize };
    }

    /** 统计数量 */
    count(condition?: QueryCondition<any>): number {
      let result = condition 
        ? (this as any).data.filter((item: any) => (this as any).matchCondition(item, condition))
        : (this as any).data;
      result = (this as any).applySoftDeleteFilter(result);
      (this as any).resetTrashedFlags();
      return result.length;
    }

    /** 检查是否存在 */
    exists(condition: QueryCondition<any>): boolean {
      return (this as any).data.some((item: any) => (this as any).matchCondition(item, condition));
    }
  };
}
