/**
 * RabbitMQ 监控统计类型定义
 *
 * 包含：全局统计、队列统计、连接统计、通道统计、消息统计
 */

import type { ConnectionState, ChannelState } from './base.types';

// ==================== 全局统计 ====================

/** 全局统计 */
export interface RabbitMQStats {
  /** 累计发布消息数 */
  totalMessagesPublished: number;
  /** 累计投递消息数 */
  totalMessagesDelivered: number;
  /** 累计确认消息数 */
  totalMessagesAcked: number;
  /** 累计拒绝消息数 */
  totalMessagesNacked: number;
  /** 累计死信消息数 */
  totalMessagesDeadLettered: number;
  /** 当前连接数 */
  totalConnections: number;
  /** 当前通道数 */
  totalChannels: number;
  /** 当前队列数 */
  totalQueues: number;
  /** 当前交换机数 */
  totalExchanges: number;
  /** 当前消费者数 */
  totalConsumers: number;
  /** 当前总消息数 */
  totalMessages: number;
  /** 统计开始时间 */
  statsSince: number;
}

// ==================== 队列统计 ====================

/** 队列运行时统计 */
export interface QueueRuntimeStats {
  /** 队列名称 */
  name: string;
  /** 当前消息数 */
  messageCount: number;
  /** 消费者数量 */
  consumerCount: number;
  /** 每秒进入消息数 */
  incomingRate: number;
  /** 每秒投递消息数 */
  deliveryRate: number;
  /** 每秒确认消息数 */
  ackRate: number;
  /** 平均消息大小（字节） */
  avgMessageSize: number;
  /** 累计进入消息数 */
  totalIncoming: number;
  /** 累计投递消息数 */
  totalDelivered: number;
  /** 累计确认消息数 */
  totalAcked: number;
}

// ==================== 连接统计 ====================

/** 连接统计 */
export interface ConnectionStats {
  /** 连接 ID */
  id: string;
  /** 连接状态 */
  state: ConnectionState;
  /** 通道数量 */
  channels: number;
  /** 累计发布消息数 */
  messagesPublished: number;
  /** 累计投递消息数 */
  messagesDelivered: number;
  /** 累计确认消息数 */
  messagesAcked: number;
  /** 连接时间 */
  connectedAt: number;
  /** 最后活动时间 */
  lastActivityAt: number;
  /** 客户端信息 */
  clientInfo?: {
    product?: string;
    version?: string;
    platform?: string;
    copyright?: string;
  };
}

// ==================== 通道统计 ====================

/** 通道统计 */
export interface ChannelStats {
  /** 通道 ID */
  id: number;
  /** 连接 ID */
  connectionId: string;
  /** 通道状态 */
  state: ChannelState;
  /** 预取数量 */
  prefetchCount: number;
  /** 确认模式 */
  confirmMode: string;
  /** 消费者数量 */
  consumerCount: number;
  /** 未确认消息数 */
  unackedCount: number;
  /** 累计发布消息数 */
  messagesPublished: number;
  /** 累计投递消息数 */
  messagesDelivered: number;
  /** 累计确认消息数 */
  messagesAcked: number;
  /** 创建时间 */
  createdAt: number;
}

// ==================== 消息统计 ====================

/** 消息统计 */
export interface MessageStats {
  /** 累计发布消息数 */
  totalPublished: number;
  /** 累计投递消息数 */
  totalDelivered: number;
  /** 累计确认消息数 */
  totalAcked: number;
  /** 累计拒绝消息数 */
  totalNacked: number;
  /** 累计死信消息数 */
  totalDeadLettered: number;
  /** 当前队列中消息数 */
  currentQueued: number;
  /** 当前未确认消息数 */
  currentUnacked: number;
  /** 平均消息大小（字节） */
  avgMessageSize: number;
  /** 最大消息大小（字节） */
  maxMessageSize: number;
  /** 平均投递延迟（毫秒） */
  avgDeliveryLatency: number;
  /** 平均确认延迟（毫秒） */
  avgAckLatency: number;
}

// ==================== 概览信息 ====================

/** 系统概览 */
export interface SystemOverview {
  /** 全局统计 */
  stats: RabbitMQStats;
  /** 队列列表（简要信息） */
  queues: Array<{
    name: string;
    messageCount: number;
    consumerCount: number;
  }>;
  /** 连接列表（简要信息） */
  connections: Array<{
    id: string;
    state: ConnectionState;
    channels: number;
  }>;
  /** 交换机列表（简要信息） */
  exchanges: Array<{
    name: string;
    type: string;
  }>;
}
