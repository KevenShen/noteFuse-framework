/**
 * 15 - 软删除 Mixin
 * 包含：withTrashed、onlyTrashed、restore、forceDelete、applySoftDeleteFilter、resetTrashedFlags
 */
import type { FlatItem } from '../types/base.types';
import type { QueryCondition } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithSoftDelete<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 包含已删除记录 */
    withTrashed(): this {
      (this as any).withTrashedFlag = true;
      return this;
    }

    /** 只查询已删除记录 */
    onlyTrashed(): this {
      (this as any).onlyTrashedFlag = true;
      return this;
    }

    /** 恢复软删除的记录 */
    restore(condition: QueryCondition<any>): number {
      if (!(this as any).softDeleteConfig.enabled) throw new Error('软删除未启用');
      const field = (this as any).softDeleteConfig.field || 'deleted_at';
      const items = (this as any).data.filter((item: any) => 
        (this as any).matchCondition(item, condition) && item[field] !== null
      );
      for (const item of items) item[field] = null;
      return items.length;
    }

    /** 永久删除（绕过软删除） */
    forceDelete(condition: QueryCondition<any>): number {
      const before = (this as any).data.length;
      (this as any).data = (this as any).data.filter((item: any) => !(this as any).matchCondition(item, condition));
      return before - (this as any).data.length;
    }

    /** 应用软删除过滤（内部方法） */
    protected applySoftDeleteFilter(data: any[]): any[] {
      if (!(this as any).softDeleteConfig.enabled) return data;
      const field = (this as any).softDeleteConfig.field || 'deleted_at';
      if ((this as any).onlyTrashedFlag) return data.filter((item: any) => item[field] !== null);
      if ((this as any).withTrashedFlag) return data;
      return data.filter((item: any) => item[field] === null || item[field] === undefined);
    }

    /** 重置软删除标志（内部方法） */
    protected resetTrashedFlags(): void {
      (this as any).withTrashedFlag = false;
      (this as any).onlyTrashedFlag = false;
    }
  };
}
