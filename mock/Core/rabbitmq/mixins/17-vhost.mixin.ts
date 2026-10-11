/**
 * L5 管理监控层 - 虚拟主机 Mixin
 *
 * 功能：
 * - createVhost：创建虚拟主机
 * - deleteVhost：删除虚拟主机
 * - listVhosts：列出所有虚拟主机
 * - setCurrentVhost：设置当前虚拟主机
 * - getCurrentVhost：获取当前虚拟主机
 * - vhostExists：检查虚拟主机是否存在
 * - getVhostStats：获取虚拟主机统计
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';

/**
 * 虚拟主机信息
 */
interface VhostInfo {
  /** 虚拟主机名称 */
  name: string;
  /** 创建时间 */
  createdAt: number;
  /** 描述 */
  description?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 消息总数 */
  messageCount: number;
  /** 队列总数 */
  queueCount: number;
  /** 交换机总数 */
  exchangeCount: number;
  /** 连接总数 */
  connectionCount: number;
}

/**
 * 虚拟主机 Mixin
 *
 * 【说明】
 * 虚拟主机（vhost）提供逻辑隔离，每个 vhost 有独立的交换机、队列和绑定。
 * 在 Mock 环境中，vhost 主要用于命名空间隔离和权限管理。
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithVhost<T extends Constructor>(Base: T) {
  return class VhostMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 虚拟主机存储 ====================

    /**
     * 虚拟主机信息：vhostName → VhostInfo
     */
    protected vhostInfos: Map<string, VhostInfo> = new Map();

    // ==================== 构造函数初始化 ====================

    /**
     * 初始化默认虚拟主机（在构造函数后调用）
     */
    protected initDefaultVhost(): void {
      if (!this.vhostInfos.has('/')) {
        this.vhostInfos.set('/', {
          name: '/',
          createdAt: Date.now(),
          description: 'Default virtual host',
          enabled: true,
          messageCount: 0,
          queueCount: 0,
          exchangeCount: 0,
          connectionCount: 0,
        });
      }
    }

    // ==================== 虚拟主机管理 ====================

    /**
     * 创建虚拟主机
     *
     * @param name 虚拟主机名称
     * @param description 描述（可选）
     * @returns 是否成功创建
     */
    createVhost(name: string, description?: string): boolean {
      if (this.vhostInfos.has(name)) {
        console.warn(`[MockRabbitMQ] 虚拟主机已存在: ${name}`);
        return false;
      }

      this.vhostInfos.set(name, {
        name,
        createdAt: Date.now(),
        description,
        enabled: true,
        messageCount: 0,
        queueCount: 0,
        exchangeCount: 0,
        connectionCount: 0,
      });

      // 添加到 vhosts 集合
      this.vhosts.add(name);

      console.log(`[MockRabbitMQ] 虚拟主机已创建: ${name}`);
      return true;
    }

    /**
     * 删除虚拟主机
     *
     * @param name 虚拟主机名称
     * @returns 是否成功删除
     */
    deleteVhost(name: string): boolean {
      if (name === '/') {
        throw new Error('不能删除默认虚拟主机 /');
      }

      if (!this.vhostInfos.has(name)) {
        console.warn(`[MockRabbitMQ] 虚拟主机不存在: ${name}`);
        return false;
      }

      // 如果删除的是当前虚拟主机，切换回默认
      if (this.currentVhost === name) {
        this.currentVhost = '/';
      }

      this.vhostInfos.delete(name);
      this.vhosts.delete(name);

      console.log(`[MockRabbitMQ] 虚拟主机已删除: ${name}`);
      return true;
    }

    /**
     * 列出所有虚拟主机
     *
     * @returns 虚拟主机信息列表
     */
    listVhosts(): VhostInfo[] {
      // 更新统计信息
      this.updateVhostStats();
      return Array.from(this.vhostInfos.values());
    }

    /**
     * 获取虚拟主机信息
     *
     * @param name 虚拟主机名称
     * @returns 虚拟主机信息（不存在返回 null）
     */
    getVhost(name: string): VhostInfo | null {
      const info = this.vhostInfos.get(name);
      if (info) {
        this.updateVhostStats();
      }
      return info || null;
    }

    /**
     * 检查虚拟主机是否存在
     *
     * @param name 虚拟主机名称
     * @returns 是否存在
     */
    vhostExists(name: string): boolean {
      return this.vhostInfos.has(name);
    }

    // ==================== 当前虚拟主机 ====================

    /**
     * 设置当前虚拟主机
     *
     * @param name 虚拟主机名称
     */
    setCurrentVhost(name: string): void {
      if (!this.vhostInfos.has(name)) {
        throw new Error(`虚拟主机 '${name}' 不存在`);
      }
      this.currentVhost = name;
      console.log(`[MockRabbitMQ] 当前虚拟主机已切换: ${name}`);
    }

    /**
     * 获取当前虚拟主机
     *
     * @returns 当前虚拟主机名称
     */
    getCurrentVhost(): string {
      return this.currentVhost;
    }

    // ==================== 虚拟主机状态 ====================

    /**
     * 启用虚拟主机
     *
     * @param name 虚拟主机名称
     */
    enableVhost(name: string): void {
      const vhost = this.vhostInfos.get(name);
      if (vhost) {
        vhost.enabled = true;
        console.log(`[MockRabbitMQ] 虚拟主机已启用: ${name}`);
      }
    }

    /**
     * 禁用虚拟主机
     *
     * @param name 虚拟主机名称
     */
    disableVhost(name: string): void {
      if (name === '/') {
        throw new Error('不能禁用默认虚拟主机 /');
      }
      const vhost = this.vhostInfos.get(name);
      if (vhost) {
        vhost.enabled = false;
        console.log(`[MockRabbitMQ] 虚拟主机已禁用: ${name}`);
      }
    }

    /**
     * 检查虚拟主机是否启用
     *
     * @param name 虚拟主机名称
     * @returns 是否启用
     */
    isVhostEnabled(name: string): boolean {
      return this.vhostInfos.get(name)?.enabled ?? false;
    }

    // ==================== 虚拟主机统计 ====================

    /**
     * 更新虚拟主机统计信息（内部方法）
     */
    protected updateVhostStats(): void {
      // 在 Mock 环境中，所有数据都在默认 vhost 下
      // 实际 RabbitMQ 中，每个 vhost 有独立的数据
      const defaultVhost = this.vhostInfos.get('/');
      if (defaultVhost) {
        defaultVhost.messageCount = this.stats.totalMessages;
        defaultVhost.queueCount = this.queues.size;
        defaultVhost.exchangeCount = this.exchanges.size;
        defaultVhost.connectionCount = this.connections.size;
      }
    }

    /**
     * 获取虚拟主机统计
     *
     * @param name 虚拟主机名称
     * @returns 统计信息（不存在返回 null）
     */
    getVhostStats(name: string): {
      messageCount: number;
      queueCount: number;
      exchangeCount: number;
      connectionCount: number;
      consumerCount: number;
    } | null {
      if (!this.vhostInfos.has(name)) return null;

      this.updateVhostStats();

      // 统计消费者数量
      let consumerCount = 0;
      for (const consumers of this.consumers.values()) {
        consumerCount += consumers.length;
      }

      return {
        messageCount: this.stats.totalMessages,
        queueCount: this.queues.size,
        exchangeCount: this.exchanges.size,
        connectionCount: this.connections.size,
        consumerCount,
      };
    }

    /**
     * 获取虚拟主机名称列表
     *
     * @returns 虚拟主机名称列表
     */
    getVhostNames(): string[] {
      return Array.from(this.vhostInfos.keys());
    }
  };
}
