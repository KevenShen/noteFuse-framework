/**
 * 04 - 事务管理 Mixin
 * 包含：beginTransaction、commit、rollback、transaction、savepoint、rollbackTo、releaseSavepoint
 */
import type { FlatItem } from '../types/base.types';
import type { TransactionOptions, TransactionStats } from '../types';
import type { MixinConstructor } from './mixin.types';
import { Transaction } from '../Transaction';

export function WithTransaction<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 开始事务 */
    beginTransaction(options?: TransactionOptions): Transaction<any> {
      if ((this as any).activeTransaction) throw new Error('已有活动事务');
      const transaction = new Transaction<any>(this as any, options);
      transaction.begin();
      (this as any).activeTransaction = transaction;
      return transaction;
    }

    /** 提交当前事务 */
    commit(): void {
      if (!(this as any).activeTransaction) throw new Error('没有活动事务');
      (this as any).activeTransaction.commit();
      (this as any).transactionStats.committedCount++;
      (this as any).activeTransaction = null;
    }

    /** 回滚当前事务 */
    rollback(): void {
      if (!(this as any).activeTransaction) throw new Error('没有活动事务');
      (this as any).activeTransaction.rollback();
      (this as any).transactionStats.rolledBackCount++;
      (this as any).activeTransaction = null;
    }

    /** 执行事务（自动提交/回滚） */
    async transaction<R>(fn: (transaction: Transaction<any>) => Promise<R> | R, options?: TransactionOptions): Promise<R> {
      const transaction = this.beginTransaction(options);
      try {
        const result = await fn(transaction);
        this.commit();
        return result;
      } catch (error) {
        if ((this as any).activeTransaction) this.rollback();
        throw error;
      }
    }

    /** 创建保存点 */
    savepoint(name: string): void {
      if (!(this as any).activeTransaction) throw new Error('没有活动事务');
      (this as any).activeTransaction.savepoint(name);
    }

    /** 回滚到保存点 */
    rollbackTo(name: string): void {
      if (!(this as any).activeTransaction) throw new Error('没有活动事务');
      (this as any).activeTransaction.rollbackTo(name);
    }

    /** 释放保存点 */
    releaseSavepoint(name: string): void {
      if (!(this as any).activeTransaction) throw new Error('没有活动事务');
      (this as any).activeTransaction.releaseSavepoint(name);
    }

    /** 获取事务统计信息 */
    getTransactionStats(): TransactionStats {
      return {
        activeTransactions: (this as any).activeTransaction ? 1 : 0,
        committedCount: (this as any).transactionStats.committedCount,
        rolledBackCount: (this as any).transactionStats.rolledBackCount,
        activeLocks: (this as any).activeLocks.length,
        deadlockCount: (this as any).transactionStats.deadlockCount,
      };
    }

    /** 检查是否在事务中 */
    isInTransaction(): boolean {
      return (this as any).activeTransaction !== null;
    }
  };
}
