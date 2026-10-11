/**
 * L5 事务支持 Mixin
 * 包含：snapshot、restore、getDocuments、setDocuments
 */
import type { Document } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithTransaction<T extends MixinConstructor>(Base: T) {
  return class TransactionMixin extends Base {
    /** 创建集合快照（用于事务回滚） */
    snapshot(): Map<string, T> {
      return new Map((this as any).documents);
    }

    /** 恢复集合快照（用于事务回滚） */
    restore(snapshot: Map<string, T>): void {
      (this as any).documents = new Map(snapshot);
    }

    /** 获取内部文档 Map（用于事务管理） */
    getDocuments(): Map<string, T> {
      return (this as any).documents;
    }

    /** 设置内部文档 Map（用于事务管理） */
    setDocuments(docs: Map<string, T>): void {
      (this as any).documents = docs;
    }
  };
}
