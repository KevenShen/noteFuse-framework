/**
 * L1 基础层 - 连接管理 Mixin
 *
 * 功能：
 * - connect：创建连接
 * - disconnect：关闭连接
 * - getConnection：获取连接信息
 * - listConnections：列出所有连接
 * - getConnectionStats：获取连接统计
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import type {
  ConnectionState,
  ConnectionStats,
} from '../types';

/**
 * 连接管理 Mixin
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithConnection<T extends Constructor>(Base: T) {
  return class ConnectionMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 连接管理 ====================

    /**
     * 创建连接
     *
     * @returns 连接 ID
     */
    connect(): string {
      const connectionId = this.generateConnectionId();
      const now = Date.now();

      this.connections.set(connectionId, {
        id: connectionId,
        state: 'connected',
        channels: [],
        createdAt: now,
        lastActivityAt: now,
      });

      this.updateStats({
        totalConnections: this.stats.totalConnections + 1,
      });

      console.log(`[MockRabbitMQ] 连接已建立: ${connectionId}`);
      return connectionId;
    }

    /**
     * 关闭连接
     *
     * @param connectionId 连接 ID
     * @returns 是否成功关闭
     */
    disconnect(connectionId: string): boolean {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        console.warn(`[MockRabbitMQ] 连接不存在: ${connectionId}`);
        return false;
      }

      // 关闭连接上的所有通道（由 channel mixin 处理）
      // 这里只更新连接状态
      connection.state = 'closed';
      connection.lastActivityAt = Date.now();

      // 移除连接
      this.connections.delete(connectionId);

      this.updateStats({
        totalConnections: Math.max(0, this.stats.totalConnections - 1),
        totalChannels: Math.max(0, this.stats.totalChannels - connection.channels.length),
      });

      console.log(`[MockRabbitMQ] 连接已关闭: ${connectionId}`);
      return true;
    }

    /**
     * 获取连接信息
     *
     * @param connectionId 连接 ID
     * @returns 连接信息（不存在返回 null）
     */
    getConnection(connectionId: string): {
      id: string;
      state: ConnectionState;
      channels: number[];
      createdAt: number;
      lastActivityAt: number;
    } | null {
      return this.connections.get(connectionId) || null;
    }

    /**
     * 列出所有连接
     *
     * @returns 连接信息列表
     */
    listConnections(): Array<{
      id: string;
      state: ConnectionState;
      channels: number[];
      createdAt: number;
      lastActivityAt: number;
    }> {
      return Array.from(this.connections.values());
    }

    /**
     * 获取连接统计
     *
     * @param connectionId 连接 ID
     * @returns 连接统计（不存在返回 null）
     */
    getConnectionStats(connectionId: string): ConnectionStats | null {
      const connection = this.connections.get(connectionId);
      if (!connection) return null;

      return {
        id: connection.id,
        state: connection.state,
        channels: connection.channels.length,
        messagesPublished: 0, // 后续阶段统计
        messagesDelivered: 0,
        messagesAcked: 0,
        connectedAt: connection.createdAt,
        lastActivityAt: connection.lastActivityAt,
      };
    }

    /**
     * 检查连接是否存在且已连接
     *
     * @param connectionId 连接 ID
     * @returns 是否连接
     */
    isConnected(connectionId: string): boolean {
      const connection = this.connections.get(connectionId);
      return connection?.state === 'connected';
    }

    /**
     * 更新连接最后活动时间
     *
     * @param connectionId 连接 ID
     */
    protected touchConnection(connectionId: string): void {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.lastActivityAt = Date.now();
      }
    }
  };
}
