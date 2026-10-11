/**
 * L4 可靠性层 - 事务 Mixin
 *
 * 功能：
 * - txSelect：开启事务模式
 * - txCommit：提交事务
 * - txRollback：回滚事务
 * - getTransactionStatus：获取事务状态
 * - listTransactions：列出所有事务
 * - getTransactionStats：获取事务统计
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import type {
  TransactionState,
  TransactionOperationType,
  TransactionOperation,
  TransactionInfo,
  TransactionStats,
} from '../types';

/**
 * 事务 Mixin
 *
 * 【实现原理】
 * - 开启事务后，所有操作（发布、确认等）都记录在事务操作列表中
 * - 提交事务时，执行所有记录的操作
 * - 回滚事务时，丢弃所有记录的操作
 *
 * 【注意】
 * 在 Mock 环境中，事务是模拟的：
 * - 发布操作在提交时才真正入队
 * - 确认操作在提交时才真正移除未确认消息
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithTransaction<T extends Constructor>(Base: T) {
  return class TransactionMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 事务存储 ====================

    /**
     * 通道事务状态：channelId → TransactionInfo
     */
    protected channelTransactions: Map<number, TransactionInfo> = new Map();

    /**
     * 事务统计
     */
    protected transactionStats: {
      totalTransactions: number;
      totalCommits: number;
      totalRollbacks: number;
      totalOperations: number;
    } = {
      totalTransactions: 0,
      totalCommits: 0,
      totalRollbacks: 0,
      totalOperations: 0,
    };

    // ==================== 事务管理 ====================

    /**
     * 开启事务模式
     *
     * @param channelId 通道 ID
     */
    txSelect(channelId: number): void {
      // 检查是否已有事务
      if (this.channelTransactions.has(channelId)) {
        const existing = this.channelTransactions.get(channelId)!;
        if (existing.state === 'active') {
          throw new Error(`通道 ${channelId} 已有进行中的事务`);
        }
      }

      // 创建新事务
      const transaction: TransactionInfo = {
        channelId,
        state: 'active',
        startedAt: Date.now(),
        operations: [],
        transactionId: `tx-${channelId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      };

      this.channelTransactions.set(channelId, transaction);
      this.transactionStats.totalTransactions++;

      console.log(`[MockRabbitMQ] 事务已开启: channel=${channelId}, txId=${transaction.transactionId}`);
    }

    /**
     * 提交事务
     *
     * 执行事务中记录的所有操作
     *
     * @param channelId 通道 ID
     */
    txCommit(channelId: number): void {
      const transaction = this.channelTransactions.get(channelId);
      if (!transaction || transaction.state !== 'active') {
        throw new Error(`通道 ${channelId} 没有进行中的事务`);
      }

      console.log(
        `[MockRabbitMQ] 事务提交开始: channel=${channelId}, ` +
        `operations=${transaction.operations.length}`,
      );

      // 更新状态
      transaction.state = 'committing';

      try {
        // 执行所有事务操作
        for (const operation of transaction.operations) {
          this.executeTransactionOperation(operation);
        }

        // 提交成功
        transaction.state = 'committed';
        transaction.endedAt = Date.now();
        this.transactionStats.totalCommits++;

        console.log(
          `[MockRabbitMQ] 事务提交成功: channel=${channelId}, ` +
          `operations=${transaction.operations.length}, ` +
          `duration=${transaction.endedAt - transaction.startedAt}ms`,
        );
      } catch (error) {
        // 提交失败，回滚
        console.error(`[MockRabbitMQ] 事务提交失败，正在回滚: ${error}`);
        this.txRollback(channelId);
        throw error;
      } finally {
        // 移除事务状态（保留一段时间用于查询）
        setTimeout(() => {
          this.channelTransactions.delete(channelId);
        }, 60000);
      }
    }

    /**
     * 回滚事务
     *
     * 丢弃事务中记录的所有操作
     *
     * @param channelId 通道 ID
     */
    txRollback(channelId: number): void {
      const transaction = this.channelTransactions.get(channelId);
      if (!transaction || transaction.state !== 'active') {
        throw new Error(`通道 ${channelId} 没有进行中的事务`);
      }

      console.log(
        `[MockRabbitMQ] 事务回滚: channel=${channelId}, ` +
        `discardedOperations=${transaction.operations.length}`,
      );

      transaction.state = 'rolling-back';

      // 丢弃所有操作（不需要执行任何清理，因为操作还未执行）
      transaction.state = 'rolled-back';
      transaction.endedAt = Date.now();
      this.transactionStats.totalRollbacks++;

      // 移除事务状态
      setTimeout(() => {
        this.channelTransactions.delete(channelId);
      }, 60000);

      console.log(`[MockRabbitMQ] 事务已回滚: channel=${channelId}`);
    }

    // ==================== 事务操作 ====================

    /**
     * 记录事务操作（内部方法，由 publish/ack 等 mixin 调用）
     *
     * @param channelId 通道 ID
     * @param type 操作类型
     * @param data 操作数据
     * @returns 是否在事务中（true=已记录，false=不在事务中，直接执行）
     */
    protected recordTransactionOperation(
      channelId: number,
      type: TransactionOperationType,
      data: any,
    ): boolean {
      const transaction = this.channelTransactions.get(channelId);
      if (!transaction || transaction.state !== 'active') {
        return false; // 不在事务中，直接执行
      }

      // 记录操作
      const operation: TransactionOperation = {
        type,
        data,
        timestamp: Date.now(),
        sequence: transaction.operations.length + 1,
      };

      transaction.operations.push(operation);
      this.transactionStats.totalOperations++;

      console.log(
        `[MockRabbitMQ] 事务操作已记录: channel=${channelId}, ` +
        `type=${type}, seq=${operation.sequence}`,
      );

      return true; // 在事务中，延迟执行
    }

    /**
     * 执行事务操作
     *
     * @param operation 事务操作
     */
    protected executeTransactionOperation(operation: TransactionOperation): void {
      switch (operation.type) {
        case 'publish':
          // 发布消息
          (this as any).publish(
            operation.data.exchange,
            operation.data.routingKey,
            operation.data.content,
            operation.data.properties,
            operation.data.channelId,
          );
          break;

        case 'ack':
          // 确认消息
          (this as any).ack(
            operation.data.deliveryTag,
            operation.data.options,
            operation.data.channelId,
          );
          break;

        case 'nack':
          // 拒绝消息
          (this as any).nack(
            operation.data.deliveryTag,
            operation.data.options,
            operation.data.channelId,
          );
          break;

        case 'queue.declare':
          // 声明队列
          (this as any).declareQueue(
            operation.data.name,
            operation.data.options,
          );
          break;

        case 'exchange.declare':
          // 声明交换机
          (this as any).declareExchange(
            operation.data.name,
            operation.data.type,
            operation.data.options,
          );
          break;

        case 'queue.bind':
          // 绑定队列
          (this as any).bindQueue(
            operation.data.queueName,
            operation.data.exchangeName,
            operation.data.routingKey,
            operation.data.args,
          );
          break;

        case 'queue.purge':
          // 清空队列
          (this as any).purgeQueue(operation.data.queueName);
          break;

        default:
          console.warn(`[MockRabbitMQ] 未知事务操作类型: ${operation.type}`);
      }
    }

    /**
     * 检查通道是否在事务中
     *
     * @param channelId 通道 ID
     * @returns 是否在事务中
     */
    isInTransaction(channelId: number): boolean {
      const transaction = this.channelTransactions.get(channelId);
      return transaction?.state === 'active';
    }

    // ==================== 事务查询 ====================

    /**
     * 获取事务状态
     *
     * @param channelId 通道 ID
     * @returns 事务信息（不存在返回 null）
     */
    getTransactionStatus(channelId: number): TransactionInfo | null {
      return this.channelTransactions.get(channelId) || null;
    }

    /**
     * 列出所有事务
     *
     * @param state 事务状态（可选，按状态过滤）
     * @returns 事务列表
     */
    listTransactions(state?: TransactionState): TransactionInfo[] {
      let transactions = Array.from(this.channelTransactions.values());

      if (state) {
        transactions = transactions.filter((t) => t.state === state);
      }

      // 按开始时间降序排序
      return transactions.sort((a, b) => b.startedAt - a.startedAt);
    }

    /**
     * 获取事务统计
     *
     * @returns 事务统计信息
     */
    getTransactionStats(): TransactionStats {
      const activeTransactions = Array.from(this.channelTransactions.values()).filter(
        (t) => t.state === 'active',
      ).length;

      // 计算平均事务持续时间
      const completedTransactions = Array.from(this.channelTransactions.values()).filter(
        (t) => t.endedAt,
      );
      const avgDuration = completedTransactions.length > 0
        ? completedTransactions.reduce(
            (sum, t) => sum + ((t.endedAt || Date.now()) - t.startedAt),
            0,
          ) / completedTransactions.length
        : 0;

      return {
        totalTransactions: this.transactionStats.totalTransactions,
        totalCommits: this.transactionStats.totalCommits,
        totalRollbacks: this.transactionStats.totalRollbacks,
        activeTransactions,
        avgDuration,
      };
    }

    /**
     * 获取事务中的操作列表
     *
     * @param channelId 通道 ID
     * @returns 操作列表（不在事务中返回空数组）
     */
    getTransactionOperations(channelId: number): TransactionOperation[] {
      const transaction = this.channelTransactions.get(channelId);
      if (!transaction || transaction.state !== 'active') {
        return [];
      }
      return [...transaction.operations];
    }

    /**
     * 清理已完成的事务记录
     *
     * @param maxAge 最大保留时间（毫秒，默认 1 小时）
     * @returns 清理的事务数量
     */
    cleanupCompletedTransactions(maxAge: number = 3600000): number {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [channelId, transaction] of this.channelTransactions.entries()) {
        if (
          (transaction.state === 'committed' || transaction.state === 'rolled-back') &&
          transaction.endedAt &&
          now - transaction.endedAt > maxAge
        ) {
          this.channelTransactions.delete(channelId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`[MockRabbitMQ] 已清理已完成事务记录: count=${cleanedCount}`);
      }

      return cleanedCount;
    }
  };
}
