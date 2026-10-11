/**
 * L3 高级消息层 - 消息持久化 Mixin
 *
 * 功能：
 * - saveToDisk：保存数据到磁盘（模拟）
 * - loadFromDisk：从磁盘加载数据（模拟）
 * - exportMessages：导出消息数据
 * - importMessages：导入消息数据
 * - exportAll：导出所有数据（队列、交换机、绑定、消息）
 * - importAll：导入所有数据
 * - getSnapshot：获取当前数据快照
 * - restoreFromSnapshot：从快照恢复
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import type {
  ExchangeInfo,
  QueueInfo,
  BindingInfo,
  RabbitMQMessage,
} from '../types';

/**
 * 持久化快照
 */
interface PersistenceSnapshot {
  /** 快照时间 */
  timestamp: number;
  /** 版本号 */
  version: string;
  /** 交换机数据 */
  exchanges: Array<{ name: string; info: ExchangeInfo }>;
  /** 队列数据 */
  queues: Array<{ name: string; info: QueueInfo }>;
  /** 绑定数据 */
  bindings: BindingInfo[];
  /** 消息数据 */
  messages: Array<{
    queueName: string;
    messages: Array<{
      message: RabbitMQMessage;
      expireAt: number | null;
      priority: number;
      receivedAt: number;
    }>;
  }>;
  /** 统计数据 */
  stats: {
    totalMessagesPublished: number;
    totalMessagesDelivered: number;
    totalMessagesAcked: number;
    totalMessagesNacked: number;
    totalMessagesDeadLettered: number;
  };
}

/**
 * 消息持久化 Mixin
 *
 * 【说明】
 * 在 Mock 环境中，持久化是模拟的：
 * - saveToDisk：将数据保存到内存中的快照
 * - loadFromDisk：从内存快照恢复
 * - exportMessages/importMessages：导出/导入 JSON 格式数据
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithPersistence<T extends Constructor>(Base: T) {
  return class PersistenceMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 快照存储 ====================

    /**
     * 快照存储：snapshotId → PersistenceSnapshot
     */
    protected snapshots: Map<string, PersistenceSnapshot> = new Map();

    /**
     * 最新快照 ID
     */
    protected latestSnapshotId: string | null = null;

    // ==================== 保存/加载 ====================

    /**
     * 保存数据到磁盘（模拟）
     *
     * 【说明】
     * 在 Mock 环境中，将数据保存到内存快照中。
     * 实际 RabbitMQ 中，持久化消息会写入磁盘。
     *
     * @param snapshotId 快照 ID（可选，不指定则自动生成）
     * @returns 快照 ID
     */
    saveToDisk(snapshotId?: string): string {
      const id = snapshotId || `snapshot-${Date.now()}`;
      const snapshot = this.createSnapshot();

      this.snapshots.set(id, snapshot);
      this.latestSnapshotId = id;

      console.log(
        `[MockRabbitMQ] 数据已保存: snapshotId=${id}, ` +
        `exchanges=${snapshot.exchanges.length}, ` +
        `queues=${snapshot.queues.length}, ` +
        `messages=${snapshot.messages.reduce((sum, m) => sum + m.messages.length, 0)}`,
      );

      return id;
    }

    /**
     * 从磁盘加载数据（模拟）
     *
     * @param snapshotId 快照 ID（可选，不指定则加载最新快照）
     * @returns 是否成功加载
     */
    loadFromDisk(snapshotId?: string): boolean {
      const id = snapshotId || this.latestSnapshotId;
      if (!id) {
        console.warn('[MockRabbitMQ] 没有可用的快照');
        return false;
      }

      const snapshot = this.snapshots.get(id);
      if (!snapshot) {
        console.warn(`[MockRabbitMQ] 快照不存在: ${id}`);
        return false;
      }

      this.restoreFromSnapshot(snapshot);

      console.log(
        `[MockRabbitMQ] 数据已加载: snapshotId=${id}, ` +
        `exchanges=${snapshot.exchanges.length}, ` +
        `queues=${snapshot.queues.length}`,
      );

      return true;
    }

    // ==================== 快照管理 ====================

    /**
     * 创建当前数据快照
     *
     * @returns 快照对象
     */
    protected createSnapshot(): PersistenceSnapshot {
      // 导出交换机
      const exchanges = Array.from(this.exchanges.entries()).map(([name, info]) => ({
        name,
        info: JSON.parse(JSON.stringify(info)),
      }));

      // 导出队列
      const queues = Array.from(this.queues.entries()).map(([name, info]) => ({
        name,
        info: JSON.parse(JSON.stringify(info)),
      }));

      // 导出绑定
      const bindings = JSON.parse(JSON.stringify(this.bindings));

      // 导出消息
      const messages = Array.from(this.messages.entries()).map(([queueName, msgs]) => ({
        queueName,
        messages: JSON.parse(JSON.stringify(msgs)),
      }));

      return {
        timestamp: Date.now(),
        version: '1.0.0',
        exchanges,
        queues,
        bindings,
        messages,
        stats: {
          totalMessagesPublished: this.stats.totalMessagesPublished,
          totalMessagesDelivered: this.stats.totalMessagesDelivered,
          totalMessagesAcked: this.stats.totalMessagesAcked,
          totalMessagesNacked: this.stats.totalMessagesNacked,
          totalMessagesDeadLettered: this.stats.totalMessagesDeadLettered,
        },
      };
    }

    /**
     * 从快照恢复数据
     *
     * @param snapshot 快照对象
     */
    protected restoreFromSnapshot(snapshot: PersistenceSnapshot): void {
      // 清空现有数据
      this.exchanges.clear();
      this.queues.clear();
      this.bindings = [];
      this.messages.clear();
      this.consumers.clear();
      this.unackedMessages.clear();

      // 恢复交换机
      for (const { name, info } of snapshot.exchanges) {
        this.exchanges.set(name, info);
      }

      // 恢复队列
      for (const { name, info } of snapshot.queues) {
        this.queues.set(name, info);
        this.messages.set(name, []);
        this.consumers.set(name, []);
      }

      // 恢复绑定
      this.bindings = snapshot.bindings;

      // 恢复消息
      for (const { queueName, messages } of snapshot.messages) {
        if (this.messages.has(queueName)) {
          this.messages.set(queueName, messages);
        }
      }

      // 恢复统计
      this.updateStats({
        totalMessagesPublished: snapshot.stats.totalMessagesPublished,
        totalMessagesDelivered: snapshot.stats.totalMessagesDelivered,
        totalMessagesAcked: snapshot.stats.totalMessagesAcked,
        totalMessagesNacked: snapshot.stats.totalMessagesNacked,
        totalMessagesDeadLettered: snapshot.stats.totalMessagesDeadLettered,
        totalExchanges: this.exchanges.size,
        totalQueues: this.queues.size,
        totalMessages: Array.from(this.messages.values()).reduce(
          (sum, msgs) => sum + msgs.length,
          0,
        ),
      });
    }

    /**
     * 获取快照列表
     *
     * @returns 快照列表
     */
    listSnapshots(): Array<{
      id: string;
      timestamp: number;
      version: string;
      exchanges: number;
      queues: number;
      messages: number;
    }> {
      return Array.from(this.snapshots.entries()).map(([id, snapshot]) => ({
        id,
        timestamp: snapshot.timestamp,
        version: snapshot.version,
        exchanges: snapshot.exchanges.length,
        queues: snapshot.queues.length,
        messages: snapshot.messages.reduce((sum, m) => sum + m.messages.length, 0),
      }));
    }

    /**
     * 删除快照
     *
     * @param snapshotId 快照 ID
     * @returns 是否成功删除
     */
    deleteSnapshot(snapshotId: string): boolean {
      if (!this.snapshots.has(snapshotId)) return false;
      this.snapshots.delete(snapshotId);
      if (this.latestSnapshotId === snapshotId) {
        this.latestSnapshotId = null;
      }
      console.log(`[MockRabbitMQ] 快照已删除: ${snapshotId}`);
      return true;
    }

    /**
     * 清空所有快照
     */
    clearSnapshots(): void {
      this.snapshots.clear();
      this.latestSnapshotId = null;
      console.log('[MockRabbitMQ] 所有快照已清空');
    }

    // ==================== 消息导出/导入 ====================

    /**
     * 导出队列消息
     *
     * @param queueName 队列名称
     * @returns 消息列表（JSON 格式）
     */
    exportMessages(queueName: string): Array<{
      message: RabbitMQMessage;
      expireAt: number | null;
      priority: number;
      receivedAt: number;
    }> {
      const queueMessages = this.messages.get(queueName);
      if (!queueMessages) return [];
      return JSON.parse(JSON.stringify(queueMessages));
    }

    /**
     * 导入消息到队列
     *
     * @param queueName 队列名称
     * @param messages 消息列表
     * @param append 是否追加（true=追加，false=替换）
     * @returns 导入的消息数量
     */
    importMessages(
      queueName: string,
      messages: Array<{
        message: RabbitMQMessage;
        expireAt: number | null;
        priority: number;
        receivedAt: number;
      }>,
      append: boolean = true,
    ): number {
      if (!this.queues.has(queueName)) {
        throw new Error(`队列 '${queueName}' 不存在`);
      }

      if (!this.messages.has(queueName)) {
        this.messages.set(queueName, []);
      }

      const queueMessages = this.messages.get(queueName)!;

      if (!append) {
        // 替换模式：先清空
        (this as any).updateQueueMessageCount(queueName, -queueMessages.length);
        queueMessages.length = 0;
      }

      // 导入消息
      for (const msg of messages) {
        queueMessages.push({
          message: msg.message,
          expireAt: msg.expireAt,
          priority: msg.priority || 0,
          receivedAt: msg.receivedAt || Date.now(),
        });
      }

      // 更新计数
      (this as any).updateQueueMessageCount(queueName, messages.length);

      console.log(
        `[MockRabbitMQ] 消息已导入: queue=${queueName}, count=${messages.length}, append=${append}`,
      );

      return messages.length;
    }

    // ==================== 全量导出/导入 ====================

    /**
     * 导出所有数据（JSON 格式）
     *
     * @returns 完整数据快照
     */
    exportAll(): PersistenceSnapshot {
      return this.createSnapshot();
    }

    /**
     * 导入所有数据
     *
     * @param snapshot 数据快照
     */
    importAll(snapshot: PersistenceSnapshot): void {
      this.restoreFromSnapshot(snapshot);
      console.log('[MockRabbitMQ] 所有数据已导入');
    }

    // ==================== 持久化配置 ====================

    /**
     * 检查消息是否持久化
     *
     * @param message 消息
     * @returns 是否持久化
     */
    isMessagePersistent(message: RabbitMQMessage): boolean {
      return message.properties.deliveryMode === 2;
    }

    /**
     * 获取持久化消息数量
     *
     * @param queueName 队列名称（可选，不指定则统计全部）
     * @returns 持久化消息数量
     */
    getPersistentMessageCount(queueName?: string): number {
      let count = 0;

      if (queueName) {
        const queueMessages = this.messages.get(queueName) || [];
        for (const msg of queueMessages) {
          if (msg.message.properties.deliveryMode === 2) count++;
        }
      } else {
        for (const queueMessages of this.messages.values()) {
          for (const msg of queueMessages) {
            if (msg.message.properties.deliveryMode === 2) count++;
          }
        }
      }

      return count;
    }

    /**
     * 获取持久化统计
     *
     * @returns 持久化统计信息
     */
    getPersistenceStats(): {
      totalMessages: number;
      persistentMessages: number;
      transientMessages: number;
      persistentRate: number;
      snapshots: number;
      latestSnapshotTime: number | null;
    } {
      let totalMessages = 0;
      let persistentMessages = 0;

      for (const queueMessages of this.messages.values()) {
        for (const msg of queueMessages) {
          totalMessages++;
          if (msg.message.properties.deliveryMode === 2) {
            persistentMessages++;
          }
        }
      }

      return {
        totalMessages,
        persistentMessages,
        transientMessages: totalMessages - persistentMessages,
        persistentRate: totalMessages > 0 ? (persistentMessages / totalMessages) * 100 : 0,
        snapshots: this.snapshots.size,
        latestSnapshotTime: this.latestSnapshotId
          ? this.snapshots.get(this.latestSnapshotId)?.timestamp || null
          : null,
      };
    }
  };
}
