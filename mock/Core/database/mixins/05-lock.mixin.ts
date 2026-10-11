/**
 * 05 - 锁机制 Mixin
 * 包含：lockTable、lockRow、releaseLock、releaseAllLocks、optimisticUpdate
 */
import type { FlatItem } from '../types/base.types';
import type { LockType, LockInfo, OptimisticLockOptions } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithLock<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 获取表锁 */
    lockTable(type: LockType, timeout: number = 5000): void {
      const lock: LockInfo = {
        type,
        table: (this as any).getTableName(),
        transactionId: (this as any).activeTransaction?.getId() || 'manual',
        acquiredAt: new Date(),
      };
      const conflictingLock = (this as any).activeLocks.find((l: LockInfo) => 
        l.table === lock.table && (l.type === 'WRITE' || type === 'WRITE')
      );
      if (conflictingLock) throw new Error(`表 ${lock.table} 已被锁定`);
      (this as any).activeLocks.push(lock);
    }

    /** 获取行锁 */
    lockRow(recordId: number | string, type: LockType): void {
      const lock: LockInfo = {
        type,
        table: (this as any).getTableName(),
        recordId,
        transactionId: (this as any).activeTransaction?.getId() || 'manual',
        acquiredAt: new Date(),
      };
      const conflictingLock = (this as any).activeLocks.find((l: LockInfo) => 
        l.table === lock.table && l.recordId === recordId && (l.type === 'WRITE' || type === 'WRITE')
      );
      if (conflictingLock) throw new Error(`记录 ${recordId} 已被锁定`);
      (this as any).activeLocks.push(lock);
    }

    /** 释放锁 */
    releaseLock(lock: LockInfo): void {
      const index = (this as any).activeLocks.findIndex((l: LockInfo) => 
        l.table === lock.table && l.recordId === lock.recordId && 
        l.type === lock.type && l.transactionId === lock.transactionId
      );
      if (index >= 0) (this as any).activeLocks.splice(index, 1);
    }

    /** 释放所有锁 */
    releaseAllLocks(): void {
      (this as any).activeLocks = [];
    }

    /** 乐观锁更新 */
    optimisticUpdate(condition: any, data: any, options?: OptimisticLockOptions): number {
      const versionField = options?.versionField || 'version';
      const currentVersion = options?.version;
      const fullCondition = { ...condition, [versionField]: currentVersion };
      const updateData = { ...data, [versionField]: currentVersion + 1 };
      return (this as any).update(fullCondition, updateData);
    }
  };
}
