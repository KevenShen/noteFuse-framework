/**
 * 30 - 写入操作 Mixin
 * 包含：create、update、delete、truncate
 */
import type { FlatItem } from '../types/base.types';
import type { QueryCondition } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithWrite<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 创建记录 */
    create(data: Partial<any>): any {
      const startTime = Date.now();
      
      if ((this as any).validationConfig) {
        const validation = (this as any).validate(data);
        if (!validation.valid) throw new Error(`验证失败: ${validation.errors.map((e: any) => e.message).join(', ')}`);
      }
      
      (this as any).checkForeignKeysOnInsert?.(data);
      
      if (!(this as any).triggerEvent?.('beforeInsert', data)) throw new Error('插入被 beforeInsert 钩子阻止');
      
      const item: any = { ...data };
      if (item.id === undefined) item.id = (this as any).getNextId();
      
      (this as any).applyCreatedTimestamp?.(item);
      (this as any).applyUpdatedTimestamp?.(item);
      
      if ((this as any).softDeleteConfig?.enabled) {
        const field = (this as any).softDeleteConfig.field || 'deleted_at';
        if (item[field] === undefined) item[field] = null;
      }
      
      (this as any).data.push(item);
      (this as any).clearCache?.();
      (this as any).logBinlog?.('INSERT', item);
      (this as any).triggerEvent?.('afterInsert', item);
      (this as any).recordPerformance?.('INSERT', Date.now() - startTime);
      
      return item;
    }

    /** 更新记录 */
    update(condition: QueryCondition<any>, data: Partial<any>): number {
      const startTime = Date.now();
      
      if ((this as any).validationConfig) {
        const validation = (this as any).validate(data);
        if (!validation.valid) throw new Error(`验证失败: ${validation.errors.map((e: any) => e.message).join(', ')}`);
      }
      
      if (!(this as any).triggerEvent?.('beforeUpdate', { condition, data })) {
        throw new Error('更新被 beforeUpdate 钩子阻止');
      }
      
      (this as any).applyUpdatedTimestamp?.(data);
      
      let updatedCount = 0;
      for (const item of (this as any).data) {
        if ((this as any).matchCondition(item, condition)) {
          const before = { ...item };
          Object.assign(item, data);
          (this as any).logBinlog?.('UPDATE', item, before);
          updatedCount++;
        }
      }
      
      if (updatedCount > 0) (this as any).clearCache?.();
      (this as any).triggerEvent?.('afterUpdate', { condition, data, updatedCount });
      (this as any).recordPerformance?.('UPDATE', Date.now() - startTime);
      
      return updatedCount;
    }

    /** 删除记录 */
    delete(condition: QueryCondition<any>): number {
      const startTime = Date.now();
      
      if (!(this as any).triggerEvent?.('beforeDelete', { condition })) {
        throw new Error('删除被 beforeDelete 钩子阻止');
      }
      
      let deletedCount = 0;
      const toDelete = (this as any).data.filter((item: any) => (this as any).matchCondition(item, condition));
      
      if ((this as any).softDeleteConfig?.enabled) {
        const field = (this as any).softDeleteConfig.field || 'deleted_at';
        for (const item of toDelete) {
          if (item[field] === null || item[field] === undefined) {
            item[field] = new Date().toISOString();
            (this as any).logBinlog?.('SOFT_DELETE', item);
            deletedCount++;
          }
        }
      } else {
        for (const item of toDelete) {
          (this as any).checkForeignKeysOnDelete?.(item);
          (this as any).logBinlog?.('DELETE', item);
        }
        (this as any).data = (this as any).data.filter((item: any) => !(this as any).matchCondition(item, condition));
        deletedCount = toDelete.length;
      }
      
      if (deletedCount > 0) (this as any).clearCache?.();
      (this as any).triggerEvent?.('afterDelete', { condition, deletedCount });
      (this as any).recordPerformance?.('DELETE', Date.now() - startTime);
      
      return deletedCount;
    }

    /** 根据 ID 更新记录 */
    updateById(id: number | string, data: Partial<any>): any | undefined {
      const item = (this as any).findById(id);
      if (!item) return undefined;

      if ((this as any).validationConfig) {
        const validation = (this as any).validate(data);
        if (!validation.valid) throw new Error(`验证失败: ${validation.errors.map((e: any) => e.message).join(', ')}`);
      }

      if (!(this as any).triggerEvent?.('beforeUpdate', { condition: { id }, data })) {
        throw new Error('更新被 beforeUpdate 钩子阻止');
      }

      (this as any).applyUpdatedTimestamp?.(data);

      const before = { ...item };
      Object.assign(item, data);

      (this as any).logBinlog?.('UPDATE', item, before);
      (this as any).clearCache?.();
      (this as any).triggerEvent?.('afterUpdate', { condition: { id }, data, updatedCount: 1 });

      return item;
    }

    /** 根据 ID 删除记录 */
    deleteById(id: number | string): boolean {
      const item = (this as any).findById(id);
      if (!item) return false;

      if (!(this as any).triggerEvent?.('beforeDelete', { condition: { id } })) {
        throw new Error('删除被 beforeDelete 钩子阻止');
      }

      if ((this as any).softDeleteConfig?.enabled) {
        const field = (this as any).softDeleteConfig.field || 'deleted_at';
        if (item[field] === null || item[field] === undefined) {
          item[field] = new Date().toISOString();
          (this as any).logBinlog?.('SOFT_DELETE', item);
        }
      } else {
        (this as any).checkForeignKeysOnDelete?.(item);
        (this as any).logBinlog?.('DELETE', item);
        (this as any).data = (this as any).data.filter((i: any) => i.id !== id);
      }

      (this as any).clearCache?.();
      (this as any).triggerEvent?.('afterDelete', { condition: { id }, deletedCount: 1 });

      return true;
    }

    /** 清空表 */
    truncate(): void {
      (this as any).data = [];
      (this as any).clearCache?.();
      (this as any).logBinlog?.('TRUNCATE', {});
    }
  };
}
