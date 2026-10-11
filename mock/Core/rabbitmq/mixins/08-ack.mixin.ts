/**
 * L2 消息层 - 消息确认 Mixin
 *
 * 功能：
 * - ack：确认消息
 * - nack：拒绝消息（支持批量和重新入队）
 * - reject：拒绝单条消息
 * - recover：重新投递未确认消息
 * - getUnackedMessages：获取未确认消息列表
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import type {
  AckOptions,
  NackOptions,
  RejectOptions,
  RecoverOptions,
  RabbitMQMessage,
} from '../types';

/**
 * 消息确认 Mixin
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithAck<T extends Constructor>(Base: T) {
  return class AckMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 消息确认 ====================

    /**
     * 确认消息
     *
     * @param deliveryTag 投递标签
     * @param options 确认选项
     * @param channelId 通道 ID（可选）
     */
    ack(
      deliveryTag: number,
      options?: AckOptions,
      channelId?: number,
    ): void {
      if (options?.multiple) {
        // 批量确认：确认所有 deliveryTag <= 指定值的消息
        const tagsToAck: number[] = [];
        for (const tag of this.unackedMessages.keys()) {
          if (tag <= deliveryTag) {
            tagsToAck.push(tag);
          }
        }
        for (const tag of tagsToAck) {
          this.ackSingleMessage(tag, channelId);
        }
        console.log(`[MockRabbitMQ] 批量确认: deliveryTag<=${deliveryTag}, count=${tagsToAck.length}`);
      } else {
        // 单条确认
        this.ackSingleMessage(deliveryTag, channelId);
      }
    }

    /**
     * 确认单条消息
     *
     * @param deliveryTag 投递标签
     * @param channelId 通道 ID
     */
    protected ackSingleMessage(deliveryTag: number, channelId?: number): void {
      const unacked = this.unackedMessages.get(deliveryTag);
      if (!unacked) {
        console.warn(`[MockRabbitMQ] 未确认消息不存在: deliveryTag=${deliveryTag}`);
        return;
      }

      // 从未确认列表中移除
      this.unackedMessages.delete(deliveryTag);

      // 更新消费者统计
      const consumer = (this as any).getConsumer(unacked.consumerTag);
      if (consumer) {
        consumer.ackedCount++;
        consumer.unackedCount = Math.max(0, consumer.unackedCount - 1);
      }

      // 更新队列统计
      const queue = this.queues.get(unacked.queueName);
      if (queue) {
        queue.totalAcked++;
      }

      // 更新全局统计
      this.updateStats({
        totalMessagesAcked: this.stats.totalMessagesAcked + 1,
      });

      // 更新通道统计
      if (channelId) {
        const channel = (this as any).getChannel(channelId);
        if (channel) {
          (this as any).updateChannelStats(channelId, {
            messagesAcked: channel.messagesAcked + 1,
            unackedCount: Math.max(0, channel.unackedCount - 1),
          });
        }
      }

      // 尝试投递更多消息给消费者（消费者有了更多配额）
      (this as any).deliverMessagesToConsumers(unacked.queueName);

      console.log(`[MockRabbitMQ] 消息已确认: deliveryTag=${deliveryTag}, queue=${unacked.queueName}`);
    }

    // ==================== 消息拒绝 ====================

    /**
     * 拒绝消息（nack）
     *
     * @param deliveryTag 投递标签
     * @param options 拒绝选项
     * @param channelId 通道 ID（可选）
     */
    nack(
      deliveryTag: number,
      options?: NackOptions,
      channelId?: number,
    ): void {
      if (options?.multiple) {
        // 批量拒绝：拒绝所有 deliveryTag <= 指定值的消息
        const tagsToNack: number[] = [];
        for (const tag of this.unackedMessages.keys()) {
          if (tag <= deliveryTag) {
            tagsToNack.push(tag);
          }
        }
        for (const tag of tagsToNack) {
          this.nackSingleMessage(tag, options?.requeue ?? false, channelId);
        }
        console.log(`[MockRabbitMQ] 批量拒绝: deliveryTag<=${deliveryTag}, count=${tagsToNack.length}, requeue=${options?.requeue}`);
      } else {
        // 单条拒绝
        this.nackSingleMessage(deliveryTag, options?.requeue ?? false, channelId);
      }
    }

    /**
     * 拒绝单条消息
     *
     * @param deliveryTag 投递标签
     * @param requeue 是否重新入队
     * @param channelId 通道 ID
     */
    protected nackSingleMessage(
      deliveryTag: number,
      requeue: boolean,
      channelId?: number,
    ): void {
      const unacked = this.unackedMessages.get(deliveryTag);
      if (!unacked) {
        console.warn(`[MockRabbitMQ] 未确认消息不存在: deliveryTag=${deliveryTag}`);
        return;
      }

      // 从未确认列表中移除
      this.unackedMessages.delete(deliveryTag);

      // 更新消费者统计
      const consumer = (this as any).getConsumer(unacked.consumerTag);
      if (consumer) {
        consumer.nackedCount++;
        consumer.unackedCount = Math.max(0, consumer.unackedCount - 1);
      }

      // 更新全局统计
      this.updateStats({
        totalMessagesNacked: this.stats.totalMessagesNacked + 1,
      });

      // 更新通道统计
      if (channelId) {
        const channel = (this as any).getChannel(channelId);
        if (channel) {
          (this as any).updateChannelStats(channelId, {
            unackedCount: Math.max(0, channel.unackedCount - 1),
          });
        }
      }

      if (requeue) {
        // 重新入队（标记为 redelivered）
        const message: RabbitMQMessage = {
          ...unacked.message,
          fields: {
            ...unacked.message.fields,
            redelivered: true,
          },
        };

        // 重新入队到队列头部
        const queueMessages = this.messages.get(unacked.queueName);
        if (queueMessages) {
          queueMessages.unshift({
            message,
            expireAt: null,
            priority: message.properties.priority || 0,
            receivedAt: Date.now(),
          });
          (this as any).updateQueueMessageCount(unacked.queueName, 1);
        }

        console.log(`[MockRabbitMQ] 消息已重新入队: deliveryTag=${deliveryTag}, queue=${unacked.queueName}`);
      } else {
        // 不重新入队 → 死信或丢弃
        (this as any).handleDeadLetter(unacked.queueName, unacked.message, 'rejected');
        console.log(`[MockRabbitMQ] 消息已拒绝（死信或丢弃）: deliveryTag=${deliveryTag}, queue=${unacked.queueName}`);
      }

      // 尝试投递更多消息给消费者
      (this as any).deliverMessagesToConsumers(unacked.queueName);
    }

    /**
     * 拒绝单条消息（reject，不支持批量）
     *
     * @param deliveryTag 投递标签
     * @param options 拒绝选项
     * @param channelId 通道 ID（可选）
     */
    reject(
      deliveryTag: number,
      options?: RejectOptions,
      channelId?: number,
    ): void {
      this.nackSingleMessage(deliveryTag, options?.requeue ?? false, channelId);
    }

    // ==================== 消息恢复 ====================

    /**
     * 重新投递所有未确认消息
     *
     * @param options 恢复选项
     */
    recover(options?: RecoverOptions): void {
      const requeue = options?.requeue ?? true;

      // 获取所有未确认消息的投递标签
      const deliveryTags = Array.from(this.unackedMessages.keys());

      for (const deliveryTag of deliveryTags) {
        const unacked = this.unackedMessages.get(deliveryTag);
        if (!unacked) continue;

        if (requeue) {
          // 重新入队
          const message: RabbitMQMessage = {
            ...unacked.message,
            fields: {
              ...unacked.message.fields,
              redelivered: true,
            },
          };

          const queueMessages = this.messages.get(unacked.queueName);
          if (queueMessages) {
            queueMessages.unshift({
              message,
              expireAt: null,
              priority: message.properties.priority || 0,
              receivedAt: Date.now(),
            });
            (this as any).updateQueueMessageCount(unacked.queueName, 1);
          }
        }

        // 从未确认列表中移除
        this.unackedMessages.delete(deliveryTag);

        // 更新消费者统计
        const consumer = (this as any).getConsumer(unacked.consumerTag);
        if (consumer) {
          consumer.unackedCount = Math.max(0, consumer.unackedCount - 1);
        }
      }

      // 尝试投递消息给消费者
      for (const queueName of this.queues.keys()) {
        (this as any).deliverMessagesToConsumers(queueName);
      }

      console.log(`[MockRabbitMQ] 消息恢复完成: count=${deliveryTags.length}, requeue=${requeue}`);
    }

    // ==================== 未确认消息查询 ====================

    /**
     * 获取未确认消息列表
     *
     * @param queueName 队列名称（可选，不指定则返回全部）
     * @returns 未确认消息列表
     */
    getUnackedMessages(queueName?: string): Array<{
      deliveryTag: number;
      message: RabbitMQMessage;
      queueName: string;
      consumerTag: string;
      deliveredAt: number;
    }> {
      const result: Array<{
        deliveryTag: number;
        message: RabbitMQMessage;
        queueName: string;
        consumerTag: string;
        deliveredAt: number;
      }> = [];

      for (const [deliveryTag, unacked] of this.unackedMessages.entries()) {
        if (!queueName || unacked.queueName === queueName) {
          result.push({
            deliveryTag,
            ...unacked,
          });
        }
      }

      return result;
    }

    /**
     * 获取未确认消息数量
     *
     * @param queueName 队列名称（可选）
     * @returns 未确认消息数量
     */
    getUnackedMessageCount(queueName?: string): number {
      if (!queueName) {
        return this.unackedMessages.size;
      }

      let count = 0;
      for (const unacked of this.unackedMessages.values()) {
        if (unacked.queueName === queueName) count++;
      }
      return count;
    }
  };
}
