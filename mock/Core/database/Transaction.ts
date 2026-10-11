/**
 * 事务类
 * 管理事务的生命周期：开始、保存点、提交、回滚
 * 使用快照机制实现原子性
 */
import type {
  FlatItem,
  TransactionState,
  TransactionOptions,
  Savepoint,
  LockInfo,
  LockType,
  IsolationLevel,
} from './types';
import type { MockTable } from './MockTable';

export class Transaction<T extends FlatItem> {
  private id: string;
  private state: TransactionState = 'IDLE';
  private table: MockTable<T>;
  private snapshot: T[] = [];
  private nextIdSnapshot: number = 0;
  private savepoints: Map<string, Savepoint> = new Map();
  private options: TransactionOptions;
  private startTime: Date;
  private locks: LockInfo[] = [];

  constructor(table: MockTable<T>, options?: TransactionOptions) {
    this.id = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.table = table;
    this.options = options || { isolationLevel: 'REPEATABLE READ' };
    this.startTime = new Date();
  }

  /** 开始事务 */
  begin(): void {
    if (this.state === 'ACTIVE') {
      throw new Error('Transaction already active');
    }
    
    // 保存快照
    this.snapshot = this.table.getRawData().map(item => ({ ...item }));
    this.nextIdSnapshot = this.table.getNextId();
    this.state = 'ACTIVE';
    this.savepoints.clear();
  }

  /** 创建保存点 */
  savepoint(name: string): void {
    if (this.state !== 'ACTIVE') {
      throw new Error('No active transaction');
    }
    
    this.savepoints.set(name, {
      name,
      snapshot: this.table.getRawData().map(item => ({ ...item })),
      nextId: this.table.getNextId(),
    });
  }

  /** 回滚到保存点 */
  rollbackTo(name: string): void {
    if (this.state !== 'ACTIVE') {
      throw new Error('No active transaction');
    }
    
    const savepoint = this.savepoints.get(name);
    if (!savepoint) {
      throw new Error(`Savepoint "${name}" not found`);
    }
    
    // 恢复到保存点状态
    this.table.restoreData(savepoint.snapshot, savepoint.nextId);
    
    // 删除该保存点之后的所有保存点
    const names = Array.from(this.savepoints.keys());
    const index = names.indexOf(name);
    if (index >= 0) {
      for (let i = index; i < names.length; i++) {
        this.savepoints.delete(names[i]);
      }
    }
  }

  /** 释放保存点 */
  releaseSavepoint(name: string): void {
    if (this.state !== 'ACTIVE') {
      throw new Error('No active transaction');
    }
    
    if (!this.savepoints.has(name)) {
      throw new Error(`Savepoint "${name}" not found`);
    }
    
    this.savepoints.delete(name);
  }

  /** 提交事务 */
  commit(): void {
    if (this.state !== 'ACTIVE') {
      throw new Error('No active transaction to commit');
    }
    
    // 释放所有锁
    this.releaseLocks();
    
    this.state = 'COMMITTED';
    this.snapshot = [];
    this.savepoints.clear();
  }

  /** 回滚事务 */
  rollback(): void {
    if (this.state !== 'ACTIVE') {
      throw new Error('No active transaction to rollback');
    }
    
    // 恢复快照
    this.table.restoreData(this.snapshot, this.nextIdSnapshot);
    
    // 释放所有锁
    this.releaseLocks();
    
    this.state = 'ROLLED_BACK';
    this.snapshot = [];
    this.savepoints.clear();
  }

  /** 获取事务 ID */
  getId(): string {
    return this.id;
  }

  /** 获取事务状态 */
  getState(): TransactionState {
    return this.state;
  }

  /** 获取隔离级别 */
  getIsolationLevel(): IsolationLevel {
    return this.options.isolationLevel || 'REPEATABLE READ';
  }

  /** 获取事务持续时间（毫秒） */
  getDuration(): number {
    return Date.now() - this.startTime.getTime();
  }

  /** 添加锁 */
  addLock(lock: LockInfo): void {
    this.locks.push(lock);
  }

  /** 释放所有锁 */
  private releaseLocks(): void {
    for (const lock of this.locks) {
      this.table.releaseLock(lock);
    }
    this.locks = [];
  }

  /** 检查是否持有锁 */
  hasLock(type: LockType, recordId?: number | string): boolean {
    return this.locks.some(lock => 
      lock.type === type && 
      (recordId === undefined || lock.recordId === recordId)
    );
  }
}
