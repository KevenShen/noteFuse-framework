/**
 * L1 基础层 - 队列管理 Mixin
 *
 * 功能：
 * - declareQueue：声明队列
 * - deleteQueue：删除队列
 * - purgeQueue：清空队列
 * - getQueue：获取队列信息
 * - listQueues：列出所有队列
 * - queueExists：检查队列是否存在
 * - getQueueMessageCount：获取队列消息数
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import type {
  QueueOptions,
  QueueDeclareOptions,
  QueueDeclareResult,
  QueueDeleteOptions,
  QueueDeleteResult,
  QueueInfo,
} from '../types';

/**
 * 队列管理 Mixin
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithQueue<T extends Constructor>(Base: T) {
  return class QueueMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 队列管理 ====================

    /**
     * 声明队列
     *
     * 如果队列已存在且配置兼容，则返回已有队列
     * 如果队列不存在，则创建新队列
     * 如果队列为空名称，则自动生成队列名
     *
     * @param name 队列名称（空字符串则自动生成）
     * @param options 队列选项
     * @returns 队列声明结果（队列名、消息数、消费者数）
     */
    declareQueue(
      name: string,
      options?: QueueDeclareOptions,
    ): QueueDeclareResult {
      // 空队列名 → 自动生成
      let queueName = name;
      if (!queueName) {
        queueName = `amq.gen-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      }

      // 检查队列是否已存在
      const existing = this.queues.get(queueName);
      if (existing) {
        // 被动声明，只检查是否存在
        if (options?.passive) {
          return {
            queue: queueName,
            messageCount: existing.messageCount,
            consumerCount: existing.consumerCount,
          };
        }
        return {
          queue: queueName,
          messageCount: existing.messageCount,
          consumerCount: existing.consumerCount,
        };
      }

      // 被动声明但队列不存在 → 报错
      if (options?.passive) {
        throw new Error(`队列 '${queueName}' 不存在（被动声明失败）`);
      }

      // 创建新队列
      const queueInfo: QueueInfo = {
        name: queueName,
        options: {
          durable: options?.durable ?? false,
          exclusive: options?.exclusive ?? false,
          autoDelete: options?.autoDelete ?? false,
          arguments: options?.arguments,
          messageTtl: options?.messageTtl,
          expires: options?.expires,
          maxLength: options?.maxLength,
          maxLengthBytes: options?.maxLengthBytes,
          deadLetterExchange: options?.deadLetterExchange,
          deadLetterRoutingKey: options?.deadLetterRoutingKey,
          maxPriority: options?.maxPriority,
          queueMode: options?.queueMode,
        },
        messageCount: 0,
        consumerCount: 0,
        bindings: [],
        totalIncoming: 0,
        totalDelivered: 0,
        totalAcked: 0,
        createdAt: Date.now(),
      };

      this.queues.set(queueName, queueInfo);

      // 初始化消息存储
      if (!this.messages.has(queueName)) {
        this.messages.set(queueName, []);
      }

      // 初始化消费者存储
      if (!this.consumers.has(queueName)) {
        this.consumers.set(queueName, []);
      }

      this.updateStats({
        totalQueues: this.stats.totalQueues + 1,
      });

      console.log(`[MockRabbitMQ] 队列已声明: ${queueName}`);

      return {
        queue: queueName,
        messageCount: 0,
        consumerCount: 0,
      };
    }

    /**
     * 删除队列
     *
     * @param name 队列名称
     * @param options 删除选项
     * @returns 删除结果（删除的消息数）
     */
    deleteQueue(
      name: string,
      options?: QueueDeleteOptions,
    ): QueueDeleteResult {
      const queue = this.queues.get(name);
      if (!queue) {
        if (options?.ifUnused || options?.ifEmpty) {
          throw new Error(`队列 '${name}' 不存在`);
        }
        return { messageCount: 0 };
      }

      // 检查是否有消费者（ifUnused 选项）
      if (options?.ifUnused && queue.consumerCount > 0) {
        throw new Error(`队列 '${name}' 仍有消费者，无法删除`);
      }

      // 检查是否有消息（ifEmpty 选项）
      if (options?.ifEmpty && queue.messageCount > 0) {
        throw new Error(`队列 '${name}' 仍有消息，无法删除`);
      }

      const messageCount = queue.messageCount;

      // 移除相关绑定
      this.bindings = this.bindings.filter(
        (b) => !(b.destination === name && b.destinationType === 'queue'),
      );

      // 移除消息存储
      this.messages.delete(name);

      // 移除消费者
      this.consumers.delete(name);

      // 移除队列
      this.queues.delete(name);

      this.updateStats({
        totalQueues: Math.max(0, this.stats.totalQueues - 1),
        totalMessages: Math.max(0, this.stats.totalMessages - messageCount),
      });

      console.log(`[MockRabbitMQ] 队列已删除: ${name} (删除 ${messageCount} 条消息)`);
      return { messageCount };
    }

    /**
     * 清空队列（删除所有消息，但保留队列）
     *
     * @param name 队列名称
     * @returns 清空的消息数
     */
    purgeQueue(name: string): number {
      const queue = this.queues.get(name);
      if (!queue) {
        throw new Error(`队列 '${name}' 不存在`);
      }

      const messageCount = queue.messageCount;

      // 清空消息存储
      const queueMessages = this.messages.get(name);
      if (queueMessages) {
        queueMessages.length = 0;
      }

      // 更新队列信息
      queue.messageCount = 0;

      this.updateStats({
        totalMessages: Math.max(0, this.stats.totalMessages - messageCount),
      });

      console.log(`[MockRabbitMQ] 队列已清空: ${name} (清空 ${messageCount} 条消息)`);
      return messageCount;
    }

    /**
     * 获取队列信息
     *
     * @param name 队列名称
     * @returns 队列信息（不存在返回 null）
     */
    getQueue(name: string): QueueInfo | null {
      return this.queues.get(name) || null;
    }

    /**
     * 列出所有队列
     *
     * @returns 队列信息列表
     */
    listQueues(): QueueInfo[] {
      return Array.from(this.queues.values());
    }

    /**
     * 检查队列是否存在
     *
     * @param name 队列名称
     * @returns 是否存在
     */
    queueExists(name: string): boolean {
      return this.queues.has(name);
    }

    /**
     * 获取队列消息数
     *
     * @param name 队列名称
     * @returns 消息数（队列不存在返回 -1）
     */
    getQueueMessageCount(name: string): number {
      return this.queues.get(name)?.messageCount ?? -1;
    }

    /**
     * 获取队列消费者数
     *
     * @param name 队列名称
     * @returns 消费者数（队列不存在返回 -1）
     */
    getQueueConsumerCount(name: string): number {
      return this.queues.get(name)?.consumerCount ?? -1;
    }

    /**
     * 更新队列消息计数
     *
     * @param name 队列名称
     * @param delta 变化量（正数增加，负数减少）
     */
    protected updateQueueMessageCount(name: string, delta: number): void {
      const queue = this.queues.get(name);
      if (queue) {
        queue.messageCount = Math.max(0, queue.messageCount + delta);
        this.updateStats({
          totalMessages: Math.max(0, this.stats.totalMessages + delta),
        });
      }
    }

    /**
     * 更新队列消费者计数
     *
     * @param name 队列名称
     * @param delta 变化量（正数增加，负数减少）
     */
    protected updateQueueConsumerCount(name: string, delta: number): void {
      const queue = this.queues.get(name);
      if (queue) {
        queue.consumerCount = Math.max(0, queue.consumerCount + delta);
      }
    }
  };
}
