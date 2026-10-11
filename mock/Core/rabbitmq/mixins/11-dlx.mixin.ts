/**
 * L3 高级消息层 - 死信队列（DLX）Mixin
 *
 * 功能：
 * - getDeadLetterStats：获取死信统计
 * - getDeadLetterMessages：获取死信消息列表
 * - replayDeadLetter：重放死信消息（重新发布到原队列）
 * - clearDeadLetters：清空死信消息
 * - configureDLX：配置队列的死信交换机
 * - getDeadLetterConfig：获取队列的死信配置
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import type {
  DeadLetterReason,
  DeadLetterMessage,
  DeadLetterStats,
  DeadLetterConfig,
  RabbitMQMessage,
} from '../types';

/**
 * 死信队列 Mixin
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithDLX<T extends Constructor>(Base: T) {
  return class DLXMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 死信消息存储 ====================

    /**
     * 死信消息存储：queueName → 死信消息列表
     */
    protected deadLetterMessages: Map<string, DeadLetterMessage[]> = new Map();

    // ==================== 死信统计 ====================

    /**
     * 获取死信统计
     *
     * @returns 死信统计信息
     */
    getDeadLetterStats(): DeadLetterStats {
      let totalDeadLettered = 0;
      const byReason: Record<DeadLetterReason, number> = {
        rejected: 0,
        expired: 0,
        maxlen: 0,
      };
      const byQueue: Record<string, number> = {};

      for (const [queueName, messages] of this.deadLetterMessages.entries()) {
        totalDeadLettered += messages.length;
        byQueue[queueName] = messages.length;

        for (const msg of messages) {
          byReason[msg.reason]++;
        }
      }

      // 加上全局统计中的死信数（历史累计）
      const totalFromStats = this.stats.totalMessagesDeadLettered;

      return {
        totalDeadLettered: Math.max(totalDeadLettered, totalFromStats),
        byReason,
        byQueue,
        currentDeadLetterCount: totalDeadLettered,
      };
    }

    // ==================== 死信消息查询 ====================

    /**
     * 获取死信消息列表
     *
     * @param queueName 队列名称（可选，不指定则返回全部）
     * @param reason 死信原因（可选，按原因过滤）
     * @param limit 返回数量限制（可选，默认 100）
     * @returns 死信消息列表
     */
    getDeadLetterMessages(
      queueName?: string,
      reason?: DeadLetterReason,
      limit: number = 100,
    ): DeadLetterMessage[] {
      let result: DeadLetterMessage[] = [];

      if (queueName) {
        result = this.deadLetterMessages.get(queueName) || [];
      } else {
        for (const messages of this.deadLetterMessages.values()) {
          result.push(...messages);
        }
      }

      // 按原因过滤
      if (reason) {
        result = result.filter((msg) => msg.reason === reason);
      }

      // 按死信时间降序排序（最新的在前）
      result.sort((a, b) => b.deadLetteredAt - a.deadLetteredAt);

      // 限制返回数量
      return result.slice(0, limit);
    }

    /**
     * 获取指定队列的死信消息数量
     *
     * @param queueName 队列名称
     * @returns 死信消息数量
     */
    getDeadLetterCount(queueName: string): number {
      return (this.deadLetterMessages.get(queueName) || []).length;
    }

    // ==================== 死信消息处理 ====================

    /**
     * 记录死信消息（内部方法，由 publish mixin 调用）
     *
     * @param queueName 原始队列名
     * @param message 死信消息
     * @param reason 死信原因
     */
    protected recordDeadLetter(
      queueName: string,
      message: RabbitMQMessage,
      reason: DeadLetterReason,
    ): void {
      if (!this.deadLetterMessages.has(queueName)) {
        this.deadLetterMessages.set(queueName, []);
      }

      const now = Date.now();

      // 检查是否已有死亡记录（消息可能多次进入死信队列）
      const existingDeaths = message.properties.headers?.['x-death'] || [];
      const deathCount = Array.isArray(existingDeaths) ? existingDeaths.length + 1 : 1;
      const firstDeathAt = Array.isArray(existingDeaths) && existingDeaths.length > 0
        ? existingDeaths[existingDeaths.length - 1]?.time || now
        : now;

      const deadLetterMessage: DeadLetterMessage = {
        originalMessage: message,
        reason,
        originalQueue: queueName,
        deadLetteredAt: now,
        deathCount,
        firstDeathAt,
      };

      this.deadLetterMessages.get(queueName)!.push(deadLetterMessage);

      console.log(
        `[MockRabbitMQ] 死信记录: queue=${queueName}, reason=${reason}, ` +
        `deathCount=${deathCount}, total=${this.deadLetterMessages.get(queueName)!.length}`,
      );
    }

    /**
     * 重放死信消息（重新发布到原队列）
     *
     * @param queueName 队列名称
     * @param deliveryTag 投递标签（可选，不指定则重放该队列所有死信）
     * @param maxRetries 最大重试次数（可选，超过则不再重放）
     * @returns 重放的消息数量
     */
    replayDeadLetter(
      queueName: string,
      deliveryTag?: number,
      maxRetries?: number,
    ): number {
      const messages = this.deadLetterMessages.get(queueName);
      if (!messages || messages.length === 0) {
        console.log(`[MockRabbitMQ] 没有死信消息可重放: ${queueName}`);
        return 0;
      }

      let replayedCount = 0;
      const toRemove: number[] = [];

      for (let i = 0; i < messages.length; i++) {
        const dlMsg = messages[i];

        // 如果指定了 deliveryTag，只重放匹配的消息
        if (deliveryTag !== undefined && dlMsg.originalMessage.fields.deliveryTag !== deliveryTag) {
          continue;
        }

        // 检查最大重试次数
        if (maxRetries !== undefined && dlMsg.deathCount >= maxRetries) {
          console.log(
            `[MockRabbitMQ] 消息达到最大重试次数，跳过重放: ` +
            `deliveryTag=${dlMsg.originalMessage.fields.deliveryTag}, ` +
            `deathCount=${dlMsg.deathCount}, maxRetries=${maxRetries}`,
          );
          continue;
        }

        // 重新发布到原队列（使用默认交换机，路由键为队列名）
        const message = dlMsg.originalMessage;
        (this as any).publish(
          '',
          queueName,
          message.content,
          {
            ...message.properties,
            headers: {
              ...message.properties.headers,
              'x-replayed': true,
              'x-replay-count': dlMsg.deathCount,
            },
          },
        );

        toRemove.push(i);
        replayedCount++;

        console.log(
          `[MockRabbitMQ] 死信消息已重放: queue=${queueName}, ` +
          `deliveryTag=${message.fields.deliveryTag}, deathCount=${dlMsg.deathCount}`,
        );
      }

      // 从重放列表中移除已重放的消息（从后往前删除，避免索引错乱）
      for (let i = toRemove.length - 1; i >= 0; i--) {
        messages.splice(toRemove[i], 1);
      }

      return replayedCount;
    }

    /**
     * 重放所有死信消息
     *
     * @param maxRetries 最大重试次数（可选）
     * @returns 重放的消息总数
     */
    replayAllDeadLetters(maxRetries?: number): number {
      let totalReplayed = 0;
      for (const queueName of this.deadLetterMessages.keys()) {
        totalReplayed += this.replayDeadLetter(queueName, undefined, maxRetries);
      }
      return totalReplayed;
    }

    // ==================== 死信消息清理 ====================

    /**
     * 清空死信消息
     *
     * @param queueName 队列名称（可选，不指定则清空全部）
     * @returns 清空的消息数量
     */
    clearDeadLetters(queueName?: string): number {
      if (queueName) {
        const count = (this.deadLetterMessages.get(queueName) || []).length;
        this.deadLetterMessages.delete(queueName);
        console.log(`[MockRabbitMQ] 已清空队列死信消息: ${queueName}, count=${count}`);
        return count;
      } else {
        let total = 0;
        for (const messages of this.deadLetterMessages.values()) {
          total += messages.length;
        }
        this.deadLetterMessages.clear();
        console.log(`[MockRabbitMQ] 已清空所有死信消息: count=${total}`);
        return total;
      }
    }

    // ==================== 死信配置 ====================

    /**
     * 配置队列的死信交换机
     *
     * @param queueName 队列名称
     * @param config 死信配置
     */
    configureDLX(queueName: string, config: DeadLetterConfig): void {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`队列 '${queueName}' 不存在`);
      }

      queue.options.deadLetterExchange = config.exchange;
      queue.options.deadLetterRoutingKey = config.routingKey;

      // 如果配置了消息 TTL，也设置到队列选项
      if (config.messageTtl) {
        queue.options.messageTtl = config.messageTtl;
      }

      console.log(
        `[MockRabbitMQ] 队列死信配置已更新: ${queueName}, ` +
        `exchange=${config.exchange}, routingKey=${config.routingKey}`,
      );
    }

    /**
     * 获取队列的死信配置
     *
     * @param queueName 队列名称
     * @returns 死信配置（未配置返回 null）
     */
    getDeadLetterConfig(queueName: string): DeadLetterConfig | null {
      const queue = this.queues.get(queueName);
      if (!queue || !queue.options.deadLetterExchange) {
        return null;
      }

      return {
        exchange: queue.options.deadLetterExchange,
        routingKey: queue.options.deadLetterRoutingKey,
        messageTtl: queue.options.messageTtl,
      };
    }

    /**
     * 移除队列的死信配置
     *
     * @param queueName 队列名称
     */
    removeDLXConfig(queueName: string): void {
      const queue = this.queues.get(queueName);
      if (!queue) return;

      queue.options.deadLetterExchange = undefined;
      queue.options.deadLetterRoutingKey = undefined;

      console.log(`[MockRabbitMQ] 队列死信配置已移除: ${queueName}`);
    }
  };
}
