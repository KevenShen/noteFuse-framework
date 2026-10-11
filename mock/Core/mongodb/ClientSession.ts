/**
 * 客户端会话类
 * 模拟 MongoDB 的 ClientSession
 * 管理事务的生命周期
 */
import type { TransactionOptions } from './types';
import { ObjectId } from './ObjectId';
import { Transaction } from './Transaction';

export class ClientSession {
  private id: string;
  private transaction: Transaction | null = null;
  private options?: TransactionOptions;
  private ended: boolean = false;
  private clusterTime?: { clusterTime: Date, signature: { hash: string, keyId: number } };
  private operationTime?: Date;

  constructor(options?: TransactionOptions) {
    this.id = `session_${ObjectId.generate()}`;
    this.options = options;
  }

  /** 开始事务 */
  startTransaction(options?: TransactionOptions): void {
    if (this.ended) {
      throw new Error('Session has been ended');
    }
    if (this.transaction?.isActive()) {
      throw new Error('Transaction already in progress');
    }

    this.transaction = new Transaction(options || this.options);
    this.transaction.start(options);
  }

  /** 提交事务 */
  async commitTransaction(): Promise<void> {
    if (!this.transaction) {
      throw new Error('No transaction started');
    }
    await this.transaction.commit();
  }

  /** 回滚事务 */
  async abortTransaction(): Promise<void> {
    if (!this.transaction) {
      throw new Error('No transaction started');
    }
    await this.transaction.abort();
  }

  /**
   * 自动管理事务
   * 执行回调函数，成功则提交，失败则回滚
   */
  async withTransaction<T>(
    fn: (session: ClientSession) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.startTransaction(options);
        const result = await fn(this);
        await this.commitTransaction();
        return result;
      } catch (error) {
        lastError = error as Error;
        try {
          if (this.transaction?.isActive()) {
            await this.abortTransaction();
          }
        } catch (abortError) {
          // 忽略回滚错误
        }

        // 如果是临时错误，可以重试
        const isTransient = error instanceof Error && (
          error.message.includes('TransientTransactionError') ||
          error.message.includes('UnknownTransactionCommitResult')
        );

        if (!isTransient || attempt === maxRetries) {
          throw error;
        }

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, attempt * 100));
      }
    }

    throw lastError || new Error('Transaction failed after retries');
  }

  /** 结束会话 */
  endSession(): void {
    if (this.transaction?.isActive()) {
      this.transaction.abort().catch(() => {});
    }
    this.ended = true;
    this.transaction = null;
  }

  /** 获取会话 ID */
  getId(): string {
    return this.id;
  }

  /** 检查会话是否已结束 */
  isEnded(): boolean {
    return this.ended;
  }

  /** 检查是否在事务中 */
  inTransaction(): boolean {
    return this.transaction?.isActive() || false;
  }

  /** 获取当前事务 */
  getTransaction(): Transaction | null {
    return this.transaction;
  }

  /** 获取集群时间 */
  getClusterTime(): typeof this.clusterTime {
    return this.clusterTime;
  }

  /** 设置集群时间 */
  advanceClusterTime(clusterTime: typeof this.clusterTime): void {
    this.clusterTime = clusterTime;
  }

  /** 获取操作时间 */
  getOperationTime(): Date | undefined {
    return this.operationTime;
  }

  /** 设置操作时间 */
  advanceOperationTime(operationTime: Date): void {
    this.operationTime = operationTime;
  }
}
