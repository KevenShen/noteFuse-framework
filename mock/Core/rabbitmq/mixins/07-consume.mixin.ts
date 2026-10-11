/**
 * L2 消息层 - 消息消费 Mixin
 *
 * 功能：
 * - consume：注册消费者
 * - cancel：取消消费者
 * - get：主动获取单条消息
 * - deliverMessagesToConsumers：将消息推送给消费者
 * - listConsumers：列出所有消费者
 * - getConsumer：获取消费者信息
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import type {
  ConsumerOptions,
  ConsumerCallback,
  ConsumerInfo,
  RabbitMQMessage,
} from '../types';

/**
 * 消息消费 Mixin
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithConsume<T extends Constructor>(Base: T) {
  return class ConsumeMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 消费者管理 ====================

    /**
     * 注册消费者
     *
     * @param queueName 队列名称
     * @param callback 消息回调函数
     * @param options 消费者选项
     * @param channelId 通道 ID（可选）
     * @returns 消费者标签
     */
    consume(
      queueName: string,
      callback: ConsumerCallback,
      options?: ConsumerOptions,
      channelId?: number,
    ): string {
      // 检查队列是否存在
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`队列 '${queueName}' 不存在`);
      }

      // 生成消费者标签
      const consumerTag = options?.consumerTag || this.generateConsumerTag();

      // 创建消费者信息
      const consumer: ConsumerInfo = {
        consumerTag,
        queueName,
        options: {
          noLocal: options?.noLocal ?? false,
          noAck: options?.noAck ?? false,
          exclusive: options?.exclusive ?? false,
          priority: options?.priority ?? 0,
          arguments: options?.arguments,
        },
        callback,
        active: true,
        createdAt: Date.now(),
        deliveredCount: 0,
        ackedCount: 0,
        nackedCount: 0,
        unackedCount: 0,
      };

      // 保存消费者
      if (!this.consumers.has(queueName)) {
        this.consumers.set(queueName, []);
      }
      this.consumers.get(queueName)!.push(consumer);

      // 更新队列消费者计数
      (this as any).updateQueueConsumerCount(queueName, 1);

      // 更新全局统计
      this.updateStats({
        totalConsumers: this.stats.totalConsumers + 1,
      });

      // 更新通道统计
      if (channelId) {
        const channel = (this as any).getChannel(channelId);
        if (channel) {
          (this as any).updateChannelStats(channelId, {
            consumerCount: channel.consumerCount + 1,
          });
        }
      }

      console.log(`[MockRabbitMQ] 消费者已注册: ${consumerTag} -> ${queueName}`);

      // 立即尝试投递消息（队列中可能已有消息）
      this.deliverMessagesToConsumers(queueName);

      return consumerTag;
    }

    /**
     * 取消消费者
     *
     * @param consumerTag 消费者标签
     * @returns 是否成功取消
     */
    cancel(consumerTag: string): boolean {
      // 遍历所有队列，查找消费者
      for (const [queueName, consumers] of this.consumers.entries()) {
        const index = consumers.findIndex((c) => c.consumerTag === consumerTag);
        if (index !== -1) {
          const [removed] = consumers.splice(index, 1);
          removed.active = false;

          // 更新队列消费者计数
          (this as any).updateQueueConsumerCount(queueName, -1);

          // 更新全局统计
          this.updateStats({
            totalConsumers: Math.max(0, this.stats.totalConsumers - 1),
          });

          console.log(`[MockRabbitMQ] 消费者已取消: ${consumerTag} -> ${queueName}`);
          return true;
        }
      }

      console.warn(`[MockRabbitMQ] 消费者不存在: ${consumerTag}`);
      return false;
    }

    /**
     * 主动获取单条消息（非消费模式）
     *
     * @param queueName 队列名称
     * @param noAck 是否自动确认（true=自动确认，false=需要手动确认）
     * @returns 消息（队列为空返回 null）
     */
    get(queueName: string, noAck: boolean = false): RabbitMQMessage | null {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`队列 '${queueName}' 不存在`);
      }

      const queueMessages = this.messages.get(queueName);
      if (!queueMessages || queueMessages.length === 0) {
        return null;
      }

      // 取出第一条消息
      const queueMessage = queueMessages.shift()!;
      const message = queueMessage.message;

      // 更新队列消息计数
      (this as any).updateQueueMessageCount(queueName, -1);

      // 更新队列累计投递计数
      queue.totalDelivered++;

      // 如果不是自动确认，添加到未确认消息列表
      if (!noAck) {
        this.unackedMessages.set(message.fields.deliveryTag, {
          message,
          queueName,
          consumerTag: 'get-' + message.fields.deliveryTag,
          channelId: 0,
          deliveredAt: Date.now(),
        });
      }

      // 更新全局统计
      this.updateStats({
        totalMessagesDelivered: this.stats.totalMessagesDelivered + 1,
      });

      console.log(`[MockRabbitMQ] 消息已获取: ${queueName}, deliveryTag=${message.fields.deliveryTag}`);
      return message;
    }

    // ==================== 消息投递 ====================

    /**
     * 将队列中的消息推送给活跃消费者
     *
     * 【投递策略】
     * 1. 按消费者优先级排序（高优先级先投递）
     * 2. 轮询投递（Round-Robin）
     * 3. 受预取数量限制（prefetchCount）
     * 4. 自动确认模式（noAck=true）：投递后立即从队列移除
     * 5. 手动确认模式（noAck=false）：投递后添加到未确认列表
     *
     * @param queueName 队列名称
     */
    deliverMessagesToConsumers(queueName: string): void {
      const queue = this.queues.get(queueName);
      if (!queue) return;

      const queueMessages = this.messages.get(queueName);
      const consumers = this.consumers.get(queueName);

      if (!queueMessages || !consumers || consumers.length === 0) return;

      // 筛选活跃消费者
      const activeConsumers = consumers.filter((c) => c.active);
      if (activeConsumers.length === 0) return;

      // 按消费者优先级排序（高优先级在前）
      const sortedConsumers = [...activeConsumers].sort(
        (a, b) => (b.options.priority || 0) - (a.options.priority || 0),
      );

      // 轮询投递消息
      let consumerIndex = 0;
      let deliveredThisRound = 0;
      const maxDeliverPerRound = 100; // 每轮最多投递 100 条，避免无限循环

      while (queueMessages.length > 0 && deliveredThisRound < maxDeliverPerRound) {
        const consumer = sortedConsumers[consumerIndex % sortedConsumers.length];

        // 检查预取限制（手动确认模式下）
        if (!consumer.options.noAck) {
          const prefetchCount = this.getConsumerPrefetch(consumer.consumerTag);
          if (prefetchCount > 0 && consumer.unackedCount >= prefetchCount) {
            // 该消费者已达预取上限，跳过
            consumerIndex++;
            // 如果所有消费者都达到上限，停止投递
            if (consumerIndex >= sortedConsumers.length * 2) {
              break;
            }
            continue;
          }
        }

        // 取出第一条消息
        const queueMessage = queueMessages.shift()!;
        const message = queueMessage.message;

        // 设置消费者标签
        message.fields.consumerTag = consumer.consumerTag;

        // 更新队列消息计数
        (this as any).updateQueueMessageCount(queueName, -1);

        // 更新队列累计投递计数
        queue.totalDelivered++;

        // 更新消费者统计
        consumer.deliveredCount++;

        // 自动确认模式：投递后立即移除
        if (consumer.options.noAck) {
          consumer.ackedCount++;
          queue.totalAcked++;
          this.updateStats({
            totalMessagesAcked: this.stats.totalMessagesAcked + 1,
          });
        } else {
          // 手动确认模式：添加到未确认列表
          consumer.unackedCount++;
          this.unackedMessages.set(message.fields.deliveryTag, {
            message,
            queueName,
            consumerTag: consumer.consumerTag,
            channelId: 0,
            deliveredAt: Date.now(),
          });
        }

        // 更新全局统计
        this.updateStats({
          totalMessagesDelivered: this.stats.totalMessagesDelivered + 1,
        });

        // 异步调用消费者回调（模拟异步投递）
        const callback = consumer.callback;
        const msgToDeliver = { ...message };
        setImmediate(() => {
          try {
            callback(msgToDeliver);
          } catch (error) {
            console.error(`[MockRabbitMQ] 消费者回调异常: ${consumer.consumerTag}`, error);
          }
        });

        consumerIndex++;
        deliveredThisRound++;
      }
    }

    /**
     * 获取消费者的预取数量
     *
     * @param consumerTag 消费者标签
     * @returns 预取数量（0 表示不限制）
     */
    protected getConsumerPrefetch(consumerTag: string): number {
      // 预取数量在 prefetch mixin 中管理
      // 这里默认返回 0（不限制）
      if (typeof (this as any).getPrefetchCount === 'function') {
        return (this as any).getPrefetchCount() || 0;
      }
      return 0;
    }

    // ==================== 消费者查询 ====================

    /**
     * 获取消费者信息
     *
     * @param consumerTag 消费者标签
     * @returns 消费者信息（不存在返回 null）
     */
    getConsumer(consumerTag: string): ConsumerInfo | null {
      for (const consumers of this.consumers.values()) {
        const consumer = consumers.find((c) => c.consumerTag === consumerTag);
        if (consumer) return consumer;
      }
      return null;
    }

    /**
     * 列出所有消费者
     *
     * @returns 消费者信息列表
     */
    listConsumers(): ConsumerInfo[] {
      const allConsumers: ConsumerInfo[] = [];
      for (const consumers of this.consumers.values()) {
        allConsumers.push(...consumers);
      }
      return allConsumers;
    }

    /**
     * 获取队列的消费者列表
     *
     * @param queueName 队列名称
     * @returns 消费者信息列表
     */
    getQueueConsumers(queueName: string): ConsumerInfo[] {
      return this.consumers.get(queueName) || [];
    }

    /**
     * 获取未确认消息数量
     *
     * @param consumerTag 消费者标签（可选，不指定则返回全部）
     * @returns 未确认消息数量
     */
    getUnackedCount(consumerTag?: string): number {
      if (consumerTag) {
        let count = 0;
        for (const unacked of this.unackedMessages.values()) {
          if (unacked.consumerTag === consumerTag) count++;
        }
        return count;
      }
      return this.unackedMessages.size;
    }
  };
}
