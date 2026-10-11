/**
 * MockRabbitMQ 基础类
 *
 * 包含所有 Mixin 共享的属性和构造函数
 * 所有 Mixin 都继承自此类，通过原型链访问共享属性
 *
 * 【设计说明】
 * - 所有共享数据结构在此定义
 * - 构造函数初始化所有数据结构
 * - Mixin 只包含方法实现，不定义属性
 * - 通过 this 访问共享属性
 */

import type {
  RabbitMQConfig,
  PartialRabbitMQConfig,
  ExchangeInfo,
  QueueInfo,
  BindingInfo,
  RabbitMQMessage,
  ConsumerInfo,
  RabbitMQStats,
  ConnectionState,
} from '../types';

/**
 * 默认 RabbitMQ 配置
 */
const DEFAULT_CONFIG: RabbitMQConfig = {
  host: 'localhost',
  port: 5672,
  username: 'guest',
  password: 'guest',
  vhost: '/',
  heartbeat: 60,
  connectionTimeout: 10000,
};

/**
 * MockRabbitMQ 基础类
 *
 * 包含所有共享属性和构造函数
 */
export class MockRabbitMQBase {
  // ==================== 配置 ====================

  /** RabbitMQ 配置 */
  protected config: RabbitMQConfig;

  // ==================== 连接管理 ====================

  /** 连接映射：connectionId → 连接信息 */
  protected connections: Map<string, {
    id: string;
    state: ConnectionState;
    channels: number[];
    createdAt: number;
    lastActivityAt: number;
  }>;

  // ==================== 交换机管理 ====================

  /** 交换机映射：exchangeName → 交换机信息 */
  protected exchanges: Map<string, ExchangeInfo>;

  // ==================== 队列管理 ====================

  /** 队列映射：queueName → 队列信息 */
  protected queues: Map<string, QueueInfo>;

  // ==================== 绑定管理 ====================

  /** 绑定列表 */
  protected bindings: BindingInfo[];

  // ==================== 消息存储 ====================

  /** 消息存储：queueName → 消息列表 */
  protected messages: Map<string, Array<{
    message: RabbitMQMessage;
    expireAt: number | null;
    priority: number;
    receivedAt: number;
  }>>;

  // ==================== 消费者管理 ====================

  /** 消费者映射：queueName → 消费者列表 */
  protected consumers: Map<string, ConsumerInfo[]>;

  // ==================== 未确认消息 ====================

  /** 未确认消息：deliveryTag → 未确认消息信息 */
  protected unackedMessages: Map<number, {
    message: RabbitMQMessage;
    queueName: string;
    consumerTag: string;
    channelId: number;
    deliveredAt: number;
  }>;

  // ==================== 全局统计 ====================

  /** 全局统计 */
  protected stats: RabbitMQStats;

  // ==================== 虚拟主机 ====================

  /** 虚拟主机集合 */
  protected vhosts: Set<string>;

  /** 当前虚拟主机 */
  protected currentVhost: string;

  // ==================== 投递标签计数器 ====================

  /** 全局投递标签计数器 */
  protected nextDeliveryTag: number;

  // ==================== 构造函数 ====================

  /**
   * 构造函数
   *
   * @param config 可选的 RabbitMQ 配置（覆盖默认配置）
   */
  constructor(config?: PartialRabbitMQConfig) {
    // 合并配置
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 初始化连接管理
    this.connections = new Map();

    // 初始化交换机管理（内置默认交换机）
    this.exchanges = new Map();
    this.initBuiltinExchanges();

    // 初始化队列管理
    this.queues = new Map();

    // 初始化绑定管理
    this.bindings = [];

    // 初始化消息存储
    this.messages = new Map();

    // 初始化消费者管理
    this.consumers = new Map();

    // 初始化未确认消息
    this.unackedMessages = new Map();

    // 初始化全局统计
    this.stats = {
      totalMessagesPublished: 0,
      totalMessagesDelivered: 0,
      totalMessagesAcked: 0,
      totalMessagesNacked: 0,
      totalMessagesDeadLettered: 0,
      totalConnections: 0,
      totalChannels: 0,
      totalQueues: 0,
      totalExchanges: this.exchanges.size,
      totalConsumers: 0,
      totalMessages: 0,
      statsSince: Date.now(),
    };

    // 初始化虚拟主机
    this.vhosts = new Set(['/']);
    this.currentVhost = this.config.vhost || '/';

    // 初始化投递标签计数器
    this.nextDeliveryTag = 1;
  }

  // ==================== 内置交换机初始化 ====================

  /**
   * 初始化内置交换机
   *
   * RabbitMQ 默认创建以下交换机：
   * - (空字符串)：默认 direct 交换机
   * - amq.direct：direct 交换机
   * - amq.topic：topic 交换机
   * - amq.fanout：fanout 交换机
   * - amq.headers：headers 交换机
   * - amq.match：headers 交换机
   */
  private initBuiltinExchanges(): void {
    const builtinExchanges: Array<{ name: string; type: ExchangeInfo['type'] }> = [
      { name: '', type: 'direct' },
      { name: 'amq.direct', type: 'direct' },
      { name: 'amq.topic', type: 'topic' },
      { name: 'amq.fanout', type: 'fanout' },
      { name: 'amq.headers', type: 'headers' },
      { name: 'amq.match', type: 'headers' },
    ];

    const now = Date.now();
    for (const exchange of builtinExchanges) {
      this.exchanges.set(exchange.name, {
        name: exchange.name,
        type: exchange.type,
        options: {
          durable: true,
          autoDelete: false,
          internal: false,
        },
        bindings: [],
        messagePublishedCount: 0,
        createdAt: now,
      });
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 生成下一个投递标签
   *
   * @returns 投递标签
   */
  protected getNextDeliveryTag(): number {
    return this.nextDeliveryTag++;
  }

  /**
   * 生成连接 ID
   *
   * @returns 连接 ID
   */
  protected generateConnectionId(): string {
    return `conn-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 生成消费者标签
   *
   * @returns 消费者标签
   */
  protected generateConsumerTag(): string {
    return `ctag-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 更新统计信息
   *
   * @param updates 要更新的统计字段
   */
  protected updateStats(updates: Partial<RabbitMQStats>): void {
    this.stats = { ...this.stats, ...updates };
  }
}
