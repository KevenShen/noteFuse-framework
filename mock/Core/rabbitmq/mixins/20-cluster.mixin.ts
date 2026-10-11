/**
 * L6 集群工具层 - 集群 Mixin
 *
 * 功能：
 * - joinCluster：加入集群
 * - leaveCluster：离开集群
 * - listClusterNodes：列出集群节点
 * - getClusterStatus：获取集群状态
 * - syncFromNode：从节点同步
 * - setClusterName：设置集群名称
 * - getClusterName：获取集群名称
 * - getClusterStats：获取集群统计
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';

/**
 * 集群节点信息
 */
interface ClusterNode {
  /** 节点名称 */
  name: string;
  /** 节点地址 */
  address: string;
  /** 节点类型：disc（磁盘节点）或 ram（内存节点） */
  type: 'disc' | 'ram';
  /** 节点状态：running / stopped / starting */
  status: 'running' | 'stopped' | 'starting';
  /** 是否为主节点 */
  isMaster: boolean;
  /** 加入时间 */
  joinedAt: number;
  /** 最后心跳时间 */
  lastHeartbeat: number;
  /** 节点统计 */
  stats: {
    connections: number;
    channels: number;
    queues: number;
    messages: number;
  };
}

/**
 * 集群状态
 */
interface ClusterStatus {
  /** 集群名称 */
  clusterName: string;
  /** 节点数量 */
  nodeCount: number;
  /** 运行中的节点数量 */
  runningNodes: number;
  /** 集群状态：healthy / degraded / unhealthy */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** 当前节点名称 */
  currentNode: string;
  /** 主节点名称 */
  masterNode: string;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 集群 Mixin
 *
 * 【说明】
 * 在 Mock 环境中，集群是模拟的：
 * - 可以添加/移除虚拟节点
 * - 节点状态是模拟的
 * - 数据同步是模拟的（实际都在同一个内存中）
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithCluster<T extends Constructor>(Base: T) {
  return class ClusterMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 集群存储 ====================

    /**
     * 集群节点：nodeName → ClusterNode
     */
    protected clusterNodes: Map<string, ClusterNode> = new Map();

    /**
     * 集群名称
     */
    protected clusterName: string = 'mock-cluster@localhost';

    /**
     * 当前节点名称
     */
    protected currentNodeName: string = 'mock@localhost';

    /**
     * 集群创建时间
     */
    protected clusterCreatedAt: number = Date.now();

    // ==================== 构造函数初始化 ====================

    /**
     * 初始化默认集群节点（在构造函数后调用）
     */
    protected initDefaultClusterNode(): void {
      if (!this.clusterNodes.has(this.currentNodeName)) {
        this.clusterNodes.set(this.currentNodeName, {
          name: this.currentNodeName,
          address: 'localhost:5672',
          type: 'disc',
          status: 'running',
          isMaster: true,
          joinedAt: Date.now(),
          lastHeartbeat: Date.now(),
          stats: {
            connections: 0,
            channels: 0,
            queues: 0,
            messages: 0,
          },
        });
      }
    }

    // ==================== 集群管理 ====================

    /**
     * 加入集群
     *
     * @param nodeName 节点名称
     * @param address 节点地址
     * @param type 节点类型（disc/ram）
     * @returns 是否成功加入
     */
    joinCluster(
      nodeName: string,
      address: string,
      type: 'disc' | 'ram' = 'disc',
    ): boolean {
      if (this.clusterNodes.has(nodeName)) {
        console.warn(`[MockRabbitMQ] 节点已在集群中: ${nodeName}`);
        return false;
      }

      const node: ClusterNode = {
        name: nodeName,
        address,
        type,
        status: 'starting',
        isMaster: false,
        joinedAt: Date.now(),
        lastHeartbeat: Date.now(),
        stats: {
          connections: 0,
          channels: 0,
          queues: 0,
          messages: 0,
        },
      };

      this.clusterNodes.set(nodeName, node);

      // 模拟节点启动
      setTimeout(() => {
        node.status = 'running';
        console.log(`[MockRabbitMQ] 节点已启动: ${nodeName}`);
      }, 1000);

      console.log(
        `[MockRabbitMQ] 节点已加入集群: ${nodeName}, address=${address}, type=${type}`,
      );

      return true;
    }

    /**
     * 离开集群
     *
     * @param nodeName 节点名称
     * @returns 是否成功离开
     */
    leaveCluster(nodeName: string): boolean {
      if (nodeName === this.currentNodeName) {
        throw new Error('不能移除当前节点');
      }

      if (!this.clusterNodes.has(nodeName)) {
        console.warn(`[MockRabbitMQ] 节点不在集群中: ${nodeName}`);
        return false;
      }

      this.clusterNodes.delete(nodeName);
      console.log(`[MockRabbitMQ] 节点已离开集群: ${nodeName}`);
      return true;
    }

    /**
     * 列出集群节点
     *
     * @returns 节点列表
     */
    listClusterNodes(): ClusterNode[] {
      // 更新节点统计
      this.updateNodeStats();
      return Array.from(this.clusterNodes.values());
    }

    /**
     * 获取集群状态
     *
     * @returns 集群状态
     */
    getClusterStatus(): ClusterStatus {
      const nodes = Array.from(this.clusterNodes.values());
      const runningNodes = nodes.filter((n) => n.status === 'running').length;
      const masterNode = nodes.find((n) => n.isMaster)?.name || this.currentNodeName;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (runningNodes === nodes.length && nodes.length > 0) {
        status = 'healthy';
      } else if (runningNodes > 0) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        clusterName: this.clusterName,
        nodeCount: nodes.length,
        runningNodes,
        status,
        currentNode: this.currentNodeName,
        masterNode,
        createdAt: this.clusterCreatedAt,
      };
    }

    // ==================== 节点管理 ====================

    /**
     * 获取节点信息
     *
     * @param nodeName 节点名称
     * @returns 节点信息（不存在返回 null）
     */
    getClusterNode(nodeName: string): ClusterNode | null {
      const node = this.clusterNodes.get(nodeName);
      if (node) {
        this.updateNodeStats();
      }
      return node || null;
    }

    /**
     * 停止节点
     *
     * @param nodeName 节点名称
     */
    stopNode(nodeName: string): void {
      const node = this.clusterNodes.get(nodeName);
      if (node) {
        node.status = 'stopped';
        console.log(`[MockRabbitMQ] 节点已停止: ${nodeName}`);
      }
    }

    /**
     * 启动节点
     *
     * @param nodeName 节点名称
     */
    startNode(nodeName: string): void {
      const node = this.clusterNodes.get(nodeName);
      if (node) {
        node.status = 'starting';
        setTimeout(() => {
          node.status = 'running';
          console.log(`[MockRabbitMQ] 节点已启动: ${nodeName}`);
        }, 1000);
      }
    }

    /**
     * 发送心跳
     *
     * @param nodeName 节点名称
     */
    sendHeartbeat(nodeName: string): void {
      const node = this.clusterNodes.get(nodeName);
      if (node) {
        node.lastHeartbeat = Date.now();
      }
    }

    // ==================== 数据同步 ====================

    /**
     * 从节点同步数据
     *
     * 【说明】
     * 在 Mock 环境中，数据同步是模拟的，因为所有节点共享同一个内存。
     *
     * @param nodeName 源节点名称
     * @returns 是否同步成功
     */
    syncFromNode(nodeName: string): boolean {
      const node = this.clusterNodes.get(nodeName);
      if (!node) {
        console.warn(`[MockRabbitMQ] 节点不存在: ${nodeName}`);
        return false;
      }

      if (node.status !== 'running') {
        console.warn(`[MockRabbitMQ] 节点未运行: ${nodeName}`);
        return false;
      }

      console.log(`[MockRabbitMQ] 正在从节点同步数据: ${nodeName}`);

      // 模拟同步延迟
      setTimeout(() => {
        console.log(`[MockRabbitMQ] 数据同步完成: ${nodeName}`);
      }, 500);

      return true;
    }

    /**
     * 同步所有节点
     *
     * @returns 同步的节点数量
     */
    syncAllNodes(): number {
      let syncedCount = 0;
      for (const nodeName of this.clusterNodes.keys()) {
        if (nodeName !== this.currentNodeName) {
          if (this.syncFromNode(nodeName)) {
            syncedCount++;
          }
        }
      }
      return syncedCount;
    }

    // ==================== 集群配置 ====================

    /**
     * 设置集群名称
     *
     * @param name 集群名称
     */
    setClusterName(name: string): void {
      this.clusterName = name;
      console.log(`[MockRabbitMQ] 集群名称已设置: ${name}`);
    }

    /**
     * 获取集群名称
     *
     * @returns 集群名称
     */
    getClusterName(): string {
      return this.clusterName;
    }

    /**
     * 获取当前节点名称
     *
     * @returns 当前节点名称
     */
    getCurrentNodeName(): string {
      return this.currentNodeName;
    }

    // ==================== 集群统计 ====================

    /**
     * 更新节点统计（内部方法）
     */
    protected updateNodeStats(): void {
      const currentNode = this.clusterNodes.get(this.currentNodeName);
      if (currentNode) {
        currentNode.stats.connections = this.connections.size;
        currentNode.stats.channels = (this as any).channels?.size || 0;
        currentNode.stats.queues = this.queues.size;
        currentNode.stats.messages = Array.from(this.messages.values()).reduce(
          (sum, msgs) => sum + msgs.length,
          0,
        );
      }
    }

    /**
     * 获取集群统计
     *
     * @returns 集群统计信息
     */
    getClusterStats(): {
      totalNodes: number;
      runningNodes: number;
      stoppedNodes: number;
      totalConnections: number;
      totalChannels: number;
      totalQueues: number;
      totalMessages: number;
      discNodes: number;
      ramNodes: number;
    } {
      const nodes = Array.from(this.clusterNodes.values());
      this.updateNodeStats();

      return {
        totalNodes: nodes.length,
        runningNodes: nodes.filter((n) => n.status === 'running').length,
        stoppedNodes: nodes.filter((n) => n.status === 'stopped').length,
        totalConnections: nodes.reduce((sum, n) => sum + n.stats.connections, 0),
        totalChannels: nodes.reduce((sum, n) => sum + n.stats.channels, 0),
        totalQueues: nodes.reduce((sum, n) => sum + n.stats.queues, 0),
        totalMessages: nodes.reduce((sum, n) => sum + n.stats.messages, 0),
        discNodes: nodes.filter((n) => n.type === 'disc').length,
        ramNodes: nodes.filter((n) => n.type === 'ram').length,
      };
    }

    /**
     * 检查节点是否健康
     *
     * @param nodeName 节点名称
     * @returns 是否健康
     */
    isNodeHealthy(nodeName: string): boolean {
      const node = this.clusterNodes.get(nodeName);
      if (!node) return false;
      if (node.status !== 'running') return false;
      // 心跳超过 30 秒视为不健康
      return Date.now() - node.lastHeartbeat < 30000;
    }

    /**
     * 获取不健康的节点
     *
     * @returns 不健康节点列表
     */
    getUnhealthyNodes(): string[] {
      const unhealthy: string[] = [];
      for (const [nodeName, node] of this.clusterNodes.entries()) {
        if (!this.isNodeHealthy(nodeName)) {
          unhealthy.push(nodeName);
        }
      }
      return unhealthy;
    }
  };
}
