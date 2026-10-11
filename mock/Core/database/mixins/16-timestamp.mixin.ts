/**
 * 16 - 时间戳自动维护 Mixin
 * 包含：applyCreatedTimestamp、applyUpdatedTimestamp
 */
import type { FlatItem } from '../types/base.types';
import type { MixinConstructor } from './mixin.types';

export function WithTimestamp<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 应用创建时间戳（内部方法） */
    protected applyCreatedTimestamp(data: any): void {
      if (!(this as any).timestampConfig.enabled || !(this as any).timestampConfig.auto) return;
      const field = (this as any).timestampConfig.createdAtField || 'created_at';
      if (data[field] === undefined) data[field] = new Date().toISOString();
    }

    /** 应用更新时间戳（内部方法） */
    protected applyUpdatedTimestamp(data: any): void {
      if (!(this as any).timestampConfig.enabled || !(this as any).timestampConfig.auto) return;
      const field = (this as any).timestampConfig.updatedAtField || 'updated_at';
      data[field] = new Date().toISOString();
    }
  };
}
