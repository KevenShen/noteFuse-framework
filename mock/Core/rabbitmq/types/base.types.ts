/**
 * RabbitMQ 基础类型定义
 *
 * 包含：连接配置、连接状态、通道状态、消息属性、消息结构
 */

// ==================== 连接配置 ====================

/** RabbitMQ 连接配置 */
export interface RabbitMQConfig {
  /** 主机地址 */
  host: string;
  /** 端口号 */
  port: number;
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
  /** 虚拟主机 */
  vhost: string;
  /** 心跳间隔（秒） */
  heartbeat: number;
  /** 连接超时（毫秒） */
  connectionTimeout: number;
}

/** 连接配置（可选字段） */
export type PartialRabbitMQConfig = Partial<RabbitMQConfig>;

// ==================== 连接/通道状态 ====================

/** 连接状态 */
export type ConnectionState =
  | 'connecting'    // 连接中
  | 'connected'     // 已连接
  | 'closing'       // 关闭中
  | 'closed'        // 已关闭
  | 'error';        // 错误

/** 通道状态 */
export type ChannelState =
  | 'opening'       // 开启中
  | 'open'          // 已开启
  | 'closing'       // 关闭中
  | 'closed'        // 已关闭
  | 'error';        // 错误

// ==================== 消息属性 ====================

/** 消息属性 */
export interface MessageProperties {
  /** 内容类型（如 application/json） */
  contentType?: string;
  /** 内容编码（如 utf-8） */
  contentEncoding?: string;
  /** 自定义头部 */
  headers?: Record<string, any>;
  /** 投递模式：1=非持久化，2=持久化 */
  deliveryMode?: 1 | 2;
  /** 优先级（0-255） */
  priority?: number;
  /** 关联 ID（用于请求/响应模式） */
  correlationId?: string;
  /** 回复队列名 */
  replyTo?: string;
  /** 过期时间（毫秒，字符串形式） */
  expiration?: string;
  /** 消息 ID */
  messageId?: string;
  /** 时间戳 */
  timestamp?: number;
  /** 消息类型 */
  type?: string;
  /** 用户 ID */
  userId?: string;
  /** 应用 ID */
  appId?: string;
}

// ==================== 消息结构 ====================

/** 消息字段（投递元数据） */
export interface MessageFields {
  /** 投递标签（用于 ack/nack） */
  deliveryTag: number;
  /** 是否重新投递 */
  redelivered: boolean;
  /** 源交换机 */
  exchange: string;
  /** 路由键 */
  routingKey: string;
  /** 消费者标签（消费消息时填充） */
  consumerTag?: string;
}

/** RabbitMQ 消息 */
export interface RabbitMQMessage {
  /** 消息字段（投递元数据） */
  fields: MessageFields;
  /** 消息属性 */
  properties: MessageProperties;
  /** 消息内容（Buffer） */
  content: Buffer;
}

// ==================== 绑定信息 ====================

/** 绑定目标类型 */
export type BindingDestinationType = 'queue' | 'exchange';

/** 绑定信息 */
export interface BindingInfo {
  /** 源交换机名 */
  source: string;
  /** 目标名（队列名或交换机名） */
  destination: string;
  /** 目标类型 */
  destinationType: BindingDestinationType;
  /** 路由键 */
  routingKey: string;
  /** 绑定参数（用于 headers 交换机） */
  arguments?: Record<string, any>;
  /** 创建时间 */
  createdAt: number;
}
