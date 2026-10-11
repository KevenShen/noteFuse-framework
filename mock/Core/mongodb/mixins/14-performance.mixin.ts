/**
 * L6 性能统计 Mixin
 * 包含：getPerformanceStats
 */
import type { Document } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithPerformance<T extends MixinConstructor>(Base: T) {
  return class PerformanceMixin extends Base {
    /** 获取集合性能统计 */
    getPerformanceStats(): {
      documentCount: number;
      indexCount: number;
      indexNames: string[];
      avgObjectSize: number;
      storageSize: number;
    } {
      const docs = Array.from((this as any).documents.values());
      const avgObjectSize = docs.length > 0
        ? Math.round(docs.reduce((sum: number, d: any) => sum + JSON.stringify(d).length, 0) / docs.length)
        : 0;

      return {
        documentCount: (this as any).documents.size,
        indexCount: (this as any).indexes.size,
        indexNames: Array.from((this as any).indexes.keys()),
        avgObjectSize,
        storageSize: avgObjectSize * (this as any).documents.size,
      };
    }
  };
}
