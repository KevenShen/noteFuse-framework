/**
 * L4 可靠性层 - 发布确认 Mixin
 *
 * 功能：
 * - confirmSelect：开启发布确认模式
 * - waitForConfirms：等待所有未确认消息被确认
 * - waitForConfirmsOrDie：等待确认，失败则关闭通道
 * - getPendingConfirms：获取待确认消息列表
 * - getConfirmStats：获取发布确认统计
 * - nackAll：拒绝所有待确认消息（模拟 broker 故障）
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import type {
  ConfirmMode,
  ConfirmStatus,
  PublishConfirm,
  WaitForConfirmsOptions,
  WaitForConfirmsResult,
  ConfirmStats,
  RabbitMQMessage,
} from '../types';

/**
 * 发布确认 Mixin
 *
 * 【实现原理】
 * - 开启确认模式后，每条发布的消息都会分配一个投递标签
 * - broker 接收消息后发送 ack，无法处理时发送 nack
 * - 客户端可以等待所有消息被确认
 *
 * 【在 Mock 环境中】
 * - 消息发布后立即发送 ack（模拟成功）
 * - 可以通过 nackAll 模拟 broker 故障
 * - 支持超时和批量确认
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithConfirms<T extends Constructor>(Base: T) {
  return class ConfirmsMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 发布确认存储 ====================

    /**
     * 通道确认模式：channelId → ConfirmMode
     */
    protected channelConfirmModes: Map<number, ConfirmMode> = new Map();

    /**
     * 待确认消息：deliveryTag → PublishConfirm
     */
    protected pendingConfirms: Map<number, PublishConfirm> = new Map();

    /**
     * 确认统计
     */
    protected confirmStats: {
      totalPublished: number;
      totalAcked: number;
      totalNacked: number;
      totalTimeouts: number;
    } = {
      totalPublished: 0,
      totalAcked: 0,
      totalNacked: 0,
      totalTimeouts: 0,
    };

    // ==================== 确认模式管理 ====================

    /**
     * 开启发布确认模式
     *
     * @param channelId 通道 ID
     */
    confirmSelect(channelId: number): void {
      if (this.channelConfirmModes.has(channelId)) {
        const mode = this.channelConfirmModes.get(channelId);
        if (mode === 'confirm.select') {
          console.log(`[MockRabbitMQ] 通道 ${channelId} 已在确认模式`);
          return;
        }
        if (mode === 'transaction') {
          throw new Error(`通道 ${channelId} 已在事务模式，无法开启确认模式`);
        }
      }

      this.channelConfirmModes.set(channelId, 'confirm.select');

      // 更新通道的 confirmMode
      const channel = (this as any).getChannel(channelId);
      if (channel) {
        channel.confirmMode = 'confirm.select';
      }

      console.log(`[MockRabbitMQ] 发布确认模式已开启: channel=${channelId}`);
    }

    /**
     * 检查通道是否在确认模式
     *
     * @param channelId 通道 ID
     * @returns 是否在确认模式
     */
    isConfirmMode(channelId: number): boolean {
      return this.channelConfirmModes.get(channelId) === 'confirm.select';
    }

    /**
     * 获取通道的确认模式
     *
     * @param channelId 通道 ID
     * @returns 确认模式
     */
    getConfirmMode(channelId: number): ConfirmMode {
      return this.channelConfirmModes.get(channelId) || 'none';
    }

    // ==================== 消息确认 ====================

    /**
     * 记录待确认消息（内部方法，由 publish mixin 调用）
     *
     * @param channelId 通道 ID
     * @param deliveryTag 投递标签
     * @param message 消息
     */
    protected recordPendingConfirm(
      channelId: number,
      deliveryTag: number,
      message: RabbitMQMessage,
    ): void {
      if (!this.isConfirmMode(channelId)) return;

      const confirm: PublishConfirm = {
        deliveryTag,
        status: 'pending',
        message,
        publishedAt: Date.now(),
        channelId,
      };

      this.pendingConfirms.set(deliveryTag, confirm);
      this.confirmStats.totalPublished++;

      // 在 Mock 环境中，立即发送 ack（模拟成功）
      // 实际 RabbitMQ 中，broker 会异步发送 ack
      setTimeout(() => {
        this.ackMessage(deliveryTag, false);
      }, 0);
    }

    /**
     * 确认消息（内部方法）
     *
     * @param deliveryTag 投递标签
     * @param multiple 是否批量确认（确认所有 <= deliveryTag 的消息）
     */
    protected ackMessage(deliveryTag: number, multiple: boolean): void {
      if (multiple) {
        // 批量确认
        const tagsToAck: number[] = [];
        for (const tag of this.pendingConfirms.keys()) {
          if (tag <= deliveryTag) {
            tagsToAck.push(tag);
          }
        }
        for (const tag of tagsToAck) {
          this.ackSingleMessage(tag);
        }
      } else {
        this.ackSingleMessage(deliveryTag);
      }
    }

    /**
     * 确认单条消息（内部方法）
     */
    protected ackSingleMessage(deliveryTag: number): void {
      const confirm = this.pendingConfirms.get(deliveryTag);
      if (!confirm || confirm.status !== 'pending') return;

      confirm.status = 'acked';
      confirm.confirmedAt = Date.now();
      this.confirmStats.totalAcked++;

      // 保留一段时间后移除（用于查询）
      setTimeout(() => {
        this.pendingConfirms.delete(deliveryTag);
      }, 60000);
    }

    /**
     * 拒绝消息（内部方法）
     *
     * @param deliveryTag 投递标签
     * @param multiple 是否批量拒绝
     * @param reason 拒绝原因
     */
    protected nackMessage(
      deliveryTag: number,
      multiple: boolean,
      reason?: string,
    ): void {
      if (multiple) {
        const tagsToNack: number[] = [];
        for (const tag of this.pendingConfirms.keys()) {
          if (tag <= deliveryTag) {
            tagsToNack.push(tag);
          }
        }
        for (const tag of tagsToNack) {
          this.nackSingleMessage(tag, reason);
        }
      } else {
        this.nackSingleMessage(deliveryTag, reason);
      }
    }

    /**
     * 拒绝单条消息（内部方法）
     */
    protected nackSingleMessage(deliveryTag: number, reason?: string): void {
      const confirm = this.pendingConfirms.get(deliveryTag);
      if (!confirm || confirm.status !== 'pending') return;

      confirm.status = 'nacked';
      confirm.confirmedAt = Date.now();
      confirm.nackReason = reason || 'unknown';
      this.confirmStats.totalNacked++;

      setTimeout(() => {
        this.pendingConfirms.delete(deliveryTag);
      }, 60000);
    }

    // ==================== 等待确认 ====================

    /**
     * 等待所有未确认消息被确认
     *
     * @param options 等待选项
     * @returns 等待结果
     */
    async waitForConfirms(
      options?: WaitForConfirmsOptions,
    ): Promise<WaitForConfirmsResult> {
      const timeout = options?.timeout || 30000;
      const startTime = Date.now();

      return new Promise<WaitForConfirmsResult>((resolve) => {
        const checkConfirms = () => {
          const pending = Array.from(this.pendingConfirms.values()).filter(
            (c) => c.status === 'pending',
          );

          if (pending.length === 0) {
            // 所有消息都已确认
            const acked = Array.from(this.pendingConfirms.values()).filter(
              (c) => c.status === 'acked',
            );
            const nacked = Array.from(this.pendingConfirms.values()).filter(
              (c) => c.status === 'nacked',
            );

            resolve({
              success: nacked.length === 0,
              ackedCount: acked.length,
              nackedCount: nacked.length,
              timeoutCount: 0,
              nackedMessages: nacked.map((c) => ({
                deliveryTag: c.deliveryTag,
                message: c.message,
                reason: c.nackReason,
              })),
            });
            return;
          }

          // 检查超时
          if (Date.now() - startTime > timeout) {
            const acked = Array.from(this.pendingConfirms.values()).filter(
              (c) => c.status === 'acked',
            );
            const nacked = Array.from(this.pendingConfirms.values()).filter(
              (c) => c.status === 'nacked',
            );
            const timeoutCount = pending.length;

            this.confirmStats.totalTimeouts += timeoutCount;

            resolve({
              success: false,
              ackedCount: acked.length,
              nackedCount: nacked.length,
              timeoutCount,
              nackedMessages: [
                ...nacked.map((c) => ({
                  deliveryTag: c.deliveryTag,
                  message: c.message,
                  reason: c.nackReason,
                })),
                ...pending.map((c) => ({
                  deliveryTag: c.deliveryTag,
                  message: c.message,
                  reason: 'timeout',
                })),
              ],
            });
            return;
          }

          // 继续等待
          setTimeout(checkConfirms, 10);
        };

        checkConfirms();
      });
    }

    /**
     * 等待确认，失败则抛出错误
     *
     * @param options 等待选项
     */
    async waitForConfirmsOrDie(
      options?: WaitForConfirmsOptions,
    ): Promise<void> {
      const result = await this.waitForConfirms(options);
      if (!result.success) {
        throw new Error(
          `发布确认失败: acked=${result.ackedCount}, ` +
          `nacked=${result.nackedCount}, timeout=${result.timeoutCount}`,
        );
      }
    }

    // ==================== 确认查询 ====================

    /**
     * 获取待确认消息列表
     *
     * @param channelId 通道 ID（可选）
     * @param status 确认状态（可选）
     * @returns 待确认消息列表
     */
    getPendingConfirms(
      channelId?: number,
      status?: ConfirmStatus,
    ): PublishConfirm[] {
      let confirms = Array.from(this.pendingConfirms.values());

      if (channelId !== undefined) {
        confirms = confirms.filter((c) => c.channelId === channelId);
      }

      if (status) {
        confirms = confirms.filter((c) => c.status === status);
      }

      return confirms.sort((a, b) => a.deliveryTag - b.deliveryTag);
    }

    /**
     * 获取待确认消息数量
     *
     * @param channelId 通道 ID（可选）
     * @returns 待确认消息数量
     */
    getPendingConfirmCount(channelId?: number): number {
      return this.getPendingConfirms(channelId, 'pending').length;
    }

    /**
     * 获取发布确认统计
     *
     * @returns 确认统计信息
     */
    getConfirmStats(): ConfirmStats {
      const pendingCount = this.getPendingConfirmCount();
      const ackedConfirms = Array.from(this.pendingConfirms.values()).filter(
        (c) => c.status === 'acked',
      );

      const avgConfirmLatency = ackedConfirms.length > 0
        ? ackedConfirms.reduce(
            (sum, c) => sum + ((c.confirmedAt || Date.now()) - c.publishedAt),
            0,
          ) / ackedConfirms.length
        : 0;

      const total = this.confirmStats.totalPublished;
      const ackRate = total > 0 ? (this.confirmStats.totalAcked / total) * 100 : 0;

      return {
        totalPublished: this.confirmStats.totalPublished,
        totalAcked: this.confirmStats.totalAcked,
        totalNacked: this.confirmStats.totalNacked,
        pendingCount,
        avgConfirmLatency,
        ackRate,
      };
    }

    // ==================== 模拟故障 ====================

    /**
     * 拒绝所有待确认消息（模拟 broker 故障）
     *
     * @param reason 拒绝原因
     * @returns 拒绝的消息数量
     */
    nackAll(reason: string = 'simulated_broker_failure'): number {
      const pending = Array.from(this.pendingConfirms.values()).filter(
        (c) => c.status === 'pending',
      );

      for (const confirm of pending) {
        this.nackSingleMessage(confirm.deliveryTag, reason);
      }

      console.log(
        `[MockRabbitMQ] 已拒绝所有待确认消息: count=${pending.length}, reason=${reason}`,
      );

      return pending.length;
    }

    /**
     * 重置确认统计
     */
    resetConfirmStats(): void {
      this.confirmStats = {
        totalPublished: 0,
        totalAcked: 0,
        totalNacked: 0,
        totalTimeouts: 0,
      };
      console.log('[MockRabbitMQ] 确认统计已重置');
    }

    /**
     * 清理已确认的消息记录
     *
     * @param maxAge 最大保留时间（毫秒，默认 1 分钟）
     * @returns 清理的记录数量
     */
    cleanupConfirmedRecords(maxAge: number = 60000): number {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [deliveryTag, confirm] of this.pendingConfirms.entries()) {
        if (
          (confirm.status === 'acked' || confirm.status === 'nacked') &&
          confirm.confirmedAt &&
          now - confirm.confirmedAt > maxAge
        ) {
          this.pendingConfirms.delete(deliveryTag);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`[MockRabbitMQ] 已清理已确认记录: count=${cleanedCount}`);
      }

      return cleanedCount;
    }
  };
}
