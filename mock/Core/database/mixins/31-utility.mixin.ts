/**
 * 31 - 工具方法 Mixin
 * 包含：getTableName、getNextId、toArray、clone、getSchema、getFieldNames
 */
import type { FlatItem } from '../types/base.types';
import type { MixinConstructor } from './mixin.types';

export function WithUtility<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 获取表名 */
    getTableName(): string {
      return (this as any).config?.name || 'unknown';
    }

    /** 获取下一个 ID */
    getNextId(): number {
      const maxId = (this as any).data.reduce((max: number, item: any) => 
        Math.max(max, typeof item.id === 'number' ? item.id : 0), 0
      );
      (this as any).nextId = maxId + 1;
      return (this as any).nextId;
    }

    /** 转换为数组 */
    toArray(): any[] {
      return [...(this as any).data];
    }

    /** 克隆表 */
    clone(): any {
      const cloned = new (this.constructor as any)({
        name: `${(this as any).getTableName()}_clone`,
        initialData: JSON.parse(JSON.stringify((this as any).data)),
      });
      return cloned;
    }

    /** 获取表结构（字段名和类型） */
    getSchema(): Record<string, string> {
      if ((this as any).data.length === 0) return {};
      const sample = (this as any).data[0];
      const schema: Record<string, string> = {};
      for (const [key, value] of Object.entries(sample)) {
        schema[key] = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
      }
      return schema;
    }

    /** 获取字段名列表 */
    getFieldNames(): string[] {
      if ((this as any).data.length === 0) return [];
      return Object.keys((this as any).data[0]);
    }

    /** 检查字段是否存在 */
    hasField(field: string): boolean {
      return this.getFieldNames().includes(field);
    }
  };
}
