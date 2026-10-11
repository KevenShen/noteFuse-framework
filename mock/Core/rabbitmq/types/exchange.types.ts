/**
 * RabbitMQ 交换机类型定义
 *
 * 包含：交换机类型、交换机配置、交换机声明、交换机信息
 */

import type { BindingInfo } from './base.types';

// ==================== 交换机类型 ====================

/** 交换机类型 */
export type ExchangeType =
  | 'direct'    // 直连交换机：精确匹配路由键
  | 'topic'     // 主题交换机：通配符匹配路由键（* 和 #）
  | 'fanout'    // 扇出交换机：广播到所有绑定队列
  | 'headers';  // 头交换机：匹配消息头部

// ==================== 交换机配置 ====================

/** 交换机配置 */
export interface ExchangeOptions {
  /** 是否持久化（重启后保留） */
  durable?: boolean;
  /** 是否自动删除（所有绑定解除后自动删除） */
  autoDelete?: boolean;
  /** 是否内部交换机（只能被其他交换机路由，不能被客户端直接发布） */
  internal?: boolean;
  /** 自定义参数 */
  arguments?: Record<string, any>;
}

// ==================== 交换机声明 ====================

/** 交换机声明选项 */
export interface ExchangeDeclareOptions extends ExchangeOptions {
  /** 交换机类型 */
  type: ExchangeType;
  /** 是否被动声明（只检查是否存在，不存在则报错） */
  passive?: boolean;
}

/** 交换机删除选项 */
export interface ExchangeDeleteOptions {
  /** 如果交换机不存在是否报错 */
  ifUnused?: boolean;
  /** 是否不等待响应 */
  noWait?: boolean;
}

// ==================== 交换机信息 ====================

/** 交换机信息 */
export interface ExchangeInfo {
  /** 交换机名称 */
  name: string;
  /** 交换机类型 */
  type: ExchangeType;
  /** 交换机配置 */
  options: ExchangeOptions;
  /** 绑定列表 */
  bindings: BindingInfo[];
  /** 累计发布消息数 */
  messagePublishedCount: number;
  /** 创建时间 */
  createdAt: number;
}

// ==================== 内置交换机 ====================

/** 内置默认交换机名称 */
export const DEFAULT_EXCHANGE = '';

/** 内置交换机列表 */
export const BUILTIN_EXCHANGES: Array<{ name: string; type: ExchangeType }> = [
  { name: '', type: 'direct' },        // 默认交换机
  { name: 'amq.direct', type: 'direct' },
  { name: 'amq.topic', type: 'topic' },
  { name: 'amq.fanout', type: 'fanout' },
  { name: 'amq.headers', type: 'headers' },
  { name: 'amq.match', type: 'headers' },
];
