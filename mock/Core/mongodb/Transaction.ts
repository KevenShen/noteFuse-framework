/**
 * 事务类
 * 管理事务的生命周期：开始、提交、回滚
 * 使用快照机制实现原子性
 */
import type { TransactionState, TransactionOptions } from './types';
import { mongodb } from './MockMongoDB';

export class Transaction {
  private state: TransactionState = 'NO_TRANSACTION';
  private snapshots: Map<string, Map<string, any>> = new Map();
  private options?: TransactionOptions;
  private startTime?: number;
  private operationCount: number = 0;

  constructor(options?: TransactionOptions) {
    this.options = options;
  }

  /** 开始事务 */
  start(options?: TransactionOptions): void {
    if (this.state === 'TRANSACTION_IN_PROGRESS') {
      throw new Error('Transaction already in progress');
    }

    this.options = options || this.options;
    this.state = 'STARTING_TRANSACTION';
    this.startTime = Date.now();
    this.operationCount = 0;
    this.snapshots.clear();

    // 保存所有集合的快照
    const allCollections = mongodb.listCollections();
    for (const name of allCollections) {
      const collection = mongodb.collection(name);
      this.snapshots.set(name, collection.snapshot());
    }

    this.state = 'TRANSACTION_IN_PROGRESS';
  }

  /** 提交事务 */
  async commit(): Promise<void> {
    if (this.state !== 'TRANSACTION_IN_PROGRESS') {
      throw new Error('No transaction in progress to commit');
    }

    // 检查最大提交时间
    if (this.options?.maxCommitTimeMS && this.startTime) {
      const elapsed = Date.now() - this.startTime;
      if (elapsed > this.options.maxCommitTimeMS) {
        await this.abort();
        throw new Error(`Transaction exceeded maxCommitTimeMS: ${this.options.maxCommitTimeMS}ms`);
      }
    }

    // 提交成功，清除快照（修改已经应用到集合上）
    this.snapshots.clear();
    this.state = 'TRANSACTION_COMMITTED';
  }

  /** 回滚事务 */
  async abort(): Promise<void> {
    if (this.state !== 'TRANSACTION_IN_PROGRESS') {
      throw new Error('No transaction in progress to abort');
    }

    // 恢复所有集合的快照
    for (const [name, snapshot] of this.snapshots.entries()) {
      const collection = mongodb.collection(name);
      collection.restore(snapshot);
    }

    this.snapshots.clear();
    this.state = 'TRANSACTION_ABORTED';
  }

  /** 获取事务状态 */
  getState(): TransactionState {
    return this.state;
  }

  /** 检查是否在事务中 */
  isActive(): boolean {
    return this.state === 'TRANSACTION_IN_PROGRESS';
  }

  /** 增加操作计数 */
  incrementOperationCount(): void {
    this.operationCount++;
  }

  /** 获取操作计数 */
  getOperationCount(): number {
    return this.operationCount;
  }

  /** 获取事务选项 */
  getOptions(): TransactionOptions | undefined {
    return this.options;
  }

  /** 获取事务持续时间 */
  getDuration(): number {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }
}
