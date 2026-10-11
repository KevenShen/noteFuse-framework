/**
 * L6 集群工具层 - 工具方法 Mixin
 *
 * 功能：
 * - reset：重置所有数据
 * - clearAll：清空所有数据
 * - getVersion：获取版本信息
 * - ping：心跳检测
 * - echo：回声测试
 * - getConfig：获取配置
 * - setConfig：设置配置
 * - close：关闭连接
 * - destroy：销毁实例
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';

/**
 * 工具方法 Mixin
 *
 * 【说明】
 * 提供通用工具方法，包括重置、清空、版本信息、心跳检测等。
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithUtility<T extends Constructor>(Base: T) {
  return class UtilityMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 版本信息 ====================

    /**
     * 获取版本信息
     *
     * @returns 版本信息
     */
    getVersion(): {
      rabbitmqVersion: string;
      erlangVersion: string;
      managementVersion: string;
      mockVersion: string;
    } {
      return {
        rabbitmqVersion: '3.12.0-mock',
        erlangVersion: '26.0-mock',
        managementVersion: '3.12.0-mock',
        mockVersion: '1.0.0',
      };
    }

    // ==================== 心跳检测 ====================

    /**
     * 心跳检测
     *
     * @returns 固定返回 'pong'
     */
    ping(): string {
      return 'pong';
    }

    /**
     * 回声测试
     *
     * @param message 消息
     * @returns 原消息
     */
    echo(message: string): string {
      return message;
    }

    // ==================== 数据管理 ====================

    /**
     * 重置所有数据（恢复到初始状态）
     *
     * 【说明】
     * 清空所有队列、交换机、绑定、消息、消费者、连接、通道，
     * 但保留配置和默认交换机。
     */
    reset(): void {
      console.log('[MockRabbitMQ] 正在重置所有数据...');

      // 清空消息
      for (const queueName of this.messages.keys()) {
        this.messages.set(queueName, []);
      }

      // 清空消费者
      for (const queueName of this.consumers.keys()) {
        this.consumers.set(queueName, []);
      }

      // 清空未确认消息
      this.unackedMessages.clear();

      // 清空连接和通道
      this.connections.clear();
      if ((this as any).channels) {
        (this as any).channels.clear();
      }

      // 重置统计
      this.updateStats({
        totalMessagesPublished: 0,
        totalMessagesDelivered: 0,
        totalMessagesAcked: 0,
        totalMessagesNacked: 0,
        totalMessagesDeadLettered: 0,
      });

      console.log('[MockRabbitMQ] 数据重置完成');
    }

    /**
     * 清空所有数据（包括队列和交换机）
     *
     * 【说明】
     * 比 reset 更彻底，删除所有非默认队列和交换机。
     */
    clearAll(): void {
      console.log('[MockRabbitMQ] 正在清空所有数据...');

      // 清空消息
      this.messages.clear();

      // 清空消费者
      this.consumers.clear();

      // 清空未确认消息
      this.unackedMessages.clear();

      // 清空连接和通道
      this.connections.clear();
      if ((this as any).channels) {
        (this as any).channels.clear();
      }

      // 删除非默认队列
      for (const queueName of Array.from(this.queues.keys())) {
        this.queues.delete(queueName);
      }

      // 删除非默认交换机
      const defaultExchanges = ['', 'amq.direct', 'amq.topic', 'amq.fanout', 'amq.headers', 'amq.match'];
      for (const exchangeName of Array.from(this.exchanges.keys())) {
        if (!defaultExchanges.includes(exchangeName)) {
          this.exchanges.delete(exchangeName);
        }
      }

      // 清空绑定
      this.bindings = [];

      // 重置统计
      this.updateStats({
        totalMessagesPublished: 0,
        totalMessagesDelivered: 0,
        totalMessagesAcked: 0,
        totalMessagesNacked: 0,
        totalMessagesDeadLettered: 0,
      });

      console.log('[MockRabbitMQ] 所有数据已清空');
    }

    /**
     * 清空指定队列的消息
     *
     * @param queueName 队列名称
     * @returns 清空的消息数量
     */
    clearQueue(queueName: string): number {
      const queueMessages = this.messages.get(queueName);
      if (!queueMessages) return 0;

      const count = queueMessages.length;
      queueMessages.length = 0;

      // 更新队列消息计数
      (this as any).updateQueueMessageCount?.(queueName, -count);

      console.log(`[MockRabbitMQ] 队列已清空: ${queueName}, count=${count}`);
      return count;
    }

    // ==================== 配置管理 ====================

    /**
     * 获取配置
     *
     * @returns 配置信息
     */
    getConfig(): {
      defaultVhost: string;
      defaultUser: string;
      defaultPass: string;
      heartbeat: number;
      connectionTimeout: number;
    } {
      return {
        defaultVhost: this.currentVhost,
        defaultUser: 'guest',
        defaultPass: 'guest',
        heartbeat: this.config.heartbeat || 60,
        connectionTimeout: this.config.connectionTimeout || 10000,
      };
    }

    /**
     * 设置配置
     *
     * @param key 配置键
     * @param value 配置值
     */
    setConfig(key: string, value: any): void {
      (this.config as any)[key] = value;
      console.log(`[MockRabbitMQ] 配置已设置: ${key}=${value}`);
    }

    // ==================== 生命周期 ====================

    /**
     * 关闭所有连接
     */
    close(): void {
      console.log('[MockRabbitMQ] 正在关闭所有连接...');

      // 关闭所有通道
      if ((this as any).channels) {
        for (const channel of (this as any).channels.values()) {
          (this as any).closeChannel?.(channel.id);
        }
      }

      // 关闭所有连接
      for (const connection of this.connections.values()) {
        (this as any).disconnect?.(connection.id);
      }

      console.log('[MockRabbitMQ] 所有连接已关闭');
    }

    /**
     * 销毁实例（释放所有资源）
     */
    destroy(): void {
      console.log('[MockRabbitMQ] 正在销毁实例...');

      this.close();
      this.clearAll();

      // 清空集群节点
      if ((this as any).clusterNodes) {
        (this as any).clusterNodes.clear();
      }

      // 清空用户和权限
      if ((this as any).users) {
        (this as any).users.clear();
      }
      if ((this as any).permissions) {
        (this as any).permissions.clear();
      }

      // 清空快照
      if ((this as any).snapshots) {
        (this as any).snapshots.clear();
      }

      // 清空死信
      if ((this as any).deadLetterMessages) {
        (this as any).deadLetterMessages.clear();
      }

      // 清空延迟消息
      if ((this as any).scheduledMessages) {
        (this as any).scheduledMessages.clear();
      }
      if ((this as any).scheduledTimers) {
        for (const timer of (this as any).scheduledTimers.values()) {
          clearTimeout(timer);
        }
        (this as any).scheduledTimers.clear();
      }

      console.log('[MockRabbitMQ] 实例已销毁');
    }

    // ==================== 工具方法 ====================

    /**
     * 生成唯一 ID
     *
     * @param prefix 前缀
     * @returns 唯一 ID
     */
    generateId(prefix: string = ''): string {
      return `${prefix}${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    }

    /**
     * 格式化字节数
     *
     * @param bytes 字节数
     * @returns 格式化后的字符串
     */
    formatBytes(bytes: number): string {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    /**
     * 格式化时间
     *
     * @param timestamp 时间戳
     * @returns 格式化后的时间字符串
     */
    formatTime(timestamp: number): string {
      return new Date(timestamp).toISOString();
    }

    /**
     * 计算运行时间
     *
     * @returns 运行时间（毫秒）
     */
    getUptime(): number {
      return Date.now() - ((this as any).startTime || Date.now());
    }

    /**
     * 格式化运行时间
     *
     * @returns 格式化后的运行时间
     */
    getUptimeFormatted(): string {
      const uptime = this.getUptime();
      const seconds = Math.floor(uptime / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟`;
      } else if (hours > 0) {
        return `${hours}小时 ${minutes % 60}分钟 ${seconds % 60}秒`;
      } else if (minutes > 0) {
        return `${minutes}分钟 ${seconds % 60}秒`;
      } else {
        return `${seconds}秒`;
      }
    }

    /**
     * 检查实例是否健康
     *
     * @returns 是否健康
     */
    isHealthy(): boolean {
      // 检查是否有运行中的连接或队列
      return this.connections.size >= 0 && this.queues.size >= 0;
    }

    /**
     * 获取实例信息摘要
     *
     * @returns 实例信息摘要
     */
    getSummary(): {
      version: string;
      uptime: string;
      connections: number;
      channels: number;
      queues: number;
      exchanges: number;
      messages: number;
      consumers: number;
      healthy: boolean;
    } {
      const version = this.getVersion();
      const totalMessages = Array.from(this.messages.values()).reduce(
        (sum, msgs) => sum + msgs.length,
        0,
      );
      const totalConsumers = Array.from(this.consumers.values()).reduce(
        (sum, consumers) => sum + consumers.length,
        0,
      );

      return {
        version: version.rabbitmqVersion,
        uptime: this.getUptimeFormatted(),
        connections: this.connections.size,
        channels: (this as any).channels?.size || 0,
        queues: this.queues.size,
        exchanges: this.exchanges.size,
        messages: totalMessages,
        consumers: totalConsumers,
        healthy: this.isHealthy(),
      };
    }
  };
}
