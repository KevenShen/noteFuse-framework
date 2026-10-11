/**
 * L4 集合管理 Mixin
 * 包含：getName、clear、count、findAll、export、import
 */
import type { Document } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithCollection<T extends MixinConstructor>(Base: T) {
  return class CollectionMixin extends Base {
    /** 获取集合名称 */
    getName(): string {
      return (this as any).name;
    }

    /** 清空集合 */
    clear(): void {
      (this as any).documents.clear();
    }

    /** 获取文档数量（同步） */
    count(): number {
      return (this as any).documents.size;
    }

    /** 获取所有文档（同步，用于调试） */
    findAll(): T[] {
      return Array.from((this as any).documents.values());
    }

    /** 导出集合数据 */
    export(): T[] {
      return JSON.parse(JSON.stringify(Array.from((this as any).documents.values())));
    }

    /** 导入集合数据 */
    import(data: T[]): void {
      this.clear();
      for (const doc of data) {
        (this as any).insertDocument(doc);
      }
    }
  };
}
