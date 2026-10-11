/**
 * RabbitMQ Mock 使用示例（文档）
 *
 * 展示如何使用 MockRabbitMQ 的各项功能
 *
 * 【注意】
 * 本文件仅作为文档示例，不会被实际导入使用
 * 阶段 1 只实现了基础设施，具体功能将在后续阶段实现
 * 所有方法调用使用类型断言避免编译错误
 */

import { MockRabbitMQ, rabbitmq } from './index';
import type {
  ExchangeType,
  QueueOptions,
  MessageProperties,
  RabbitMQMessage,
} from './types';

// 使用 any 类型避免编译错误（仅用于示例文档）
type AnyMQ = any;

// ==================== 示例 1：基础使用 ====================

/**
 * 示例 1：基础发布和消费
 *
 * 展示最基本的队列声明、消息发布和消费
 */
export function exampleBasicUsage(): void {
  // 1. 创建实例（或使用全局实例）
  const mq = new MockRabbitMQ() as AnyMQ;

  // 2. 声明队列
  mq.declareQueue('my-queue', { durable: true });

  // 3. 发布消息
  mq.publish(
    '',           // 默认交换机
    'my-queue',   // 路由键（队列名）
    Buffer.from('hello world'),
    {
      contentType: 'text/plain',
      deliveryMode: 2, // 持久化
    },
  );

  // 4. 消费消息
  mq.consume('my-queue', (msg: RabbitMQMessage | null) => {
    if (msg) {
      console.log('收到消息:', msg.content.toString());
      // 确认消息
      mq.ack(msg.fields.deliveryTag);
    }
  });
}

// ==================== 示例 2：交换机和绑定 ====================

/**
 * 示例 2：使用 Topic 交换机
 *
 * 展示交换机声明、队列绑定和路由匹配
 */
export function exampleTopicExchange(): void {
  const mq = new MockRabbitMQ() as AnyMQ;

  // 1. 声明 Topic 交换机
  mq.declareExchange('events', 'topic', { durable: true });

  // 2. 声明队列
  mq.declareQueue('user-events', { durable: true });
  mq.declareQueue('order-events', { durable: true });

  // 3. 绑定队列到交换机（使用通配符）
  mq.bindQueue('user-events', 'events', 'user.*');      // 匹配 user.created, user.updated 等
  mq.bindQueue('order-events', 'events', 'order.#');    // 匹配 order.created, order.created.v1 等

  // 4. 发布消息
  mq.publish('events', 'user.created', Buffer.from('用户创建'));
  mq.publish('events', 'order.created.v1', Buffer.from('订单创建'));
}

// ==================== 示例 3：死信队列 ====================

/**
 * 示例 3：死信队列（DLX）
 *
 * 展示如何配置死信队列，处理被拒绝或过期的消息
 */
export function exampleDeadLetterQueue(): void {
  const mq = new MockRabbitMQ() as AnyMQ;

  // 1. 声明死信交换机和死信队列
  mq.declareExchange('dlx', 'direct', { durable: true });
  mq.declareQueue('dead-letters', { durable: true });
  mq.bindQueue('dead-letters', 'dlx', '#');

  // 2. 声明业务队列（配置死信交换机）
  mq.declareQueue('work-queue', {
    durable: true,
    deadLetterExchange: 'dlx',
    deadLetterRoutingKey: 'dead',
    messageTtl: 60000, // 60秒过期
  });

  // 3. 消费消息并拒绝（消息会进入死信队列）
  mq.consume('work-queue', (msg: RabbitMQMessage | null) => {
    if (msg) {
      console.log('处理失败，拒绝消息');
      mq.nack(msg.fields.deliveryTag, false, false); // requeue=false → 进入死信队列
    }
  });
}

// ==================== 示例 4：发布确认 ====================

/**
 * 示例 4：发布确认（Publisher Confirms）
 *
 * 展示如何使用发布确认模式，确保消息被 broker 接收
 */
export async function examplePublisherConfirms(): Promise<void> {
  const mq = new MockRabbitMQ() as AnyMQ;

  // 1. 开启发布确认模式
  mq.confirmSelect();

  // 2. 发布消息
  mq.publish('events', 'user.created', Buffer.from('用户创建'));

  // 3. 等待确认
  const result = await mq.waitForConfirms({ timeout: 5000 });
  if (result?.success) {
    console.log('消息已确认');
  } else {
    console.log('消息被拒绝:', result?.nackedMessages);
  }
}

// ==================== 示例 5：事务 ====================

/**
 * 示例 5：事务
 *
 * 展示如何使用事务，确保多条消息的原子性
 */
export function exampleTransaction(): void {
  const mq = new MockRabbitMQ() as AnyMQ;

  // 1. 开启事务
  mq.txSelect();

  try {
    // 2. 发布多条消息
    mq.publish('', 'queue1', Buffer.from('消息1'));
    mq.publish('', 'queue2', Buffer.from('消息2'));

    // 3. 提交事务
    mq.txCommit();
    console.log('事务提交成功');
  } catch (error) {
    // 4. 回滚事务
    mq.txRollback();
    console.log('事务回滚');
  }
}

// ==================== 示例 6：监控统计 ====================

/**
 * 示例 6：监控统计
 *
 * 展示如何获取全局统计和队列统计
 */
export function exampleMonitoring(): void {
  const mq = new MockRabbitMQ() as AnyMQ;

  // 获取全局统计
  const stats = mq.getStats();
  console.log('全局统计:', stats);

  // 获取队列统计
  const queueStats = mq.getQueueStats('my-queue');
  console.log('队列统计:', queueStats);

  // 获取系统概览
  const overview = mq.getOverview();
  console.log('系统概览:', overview);
}

// ==================== 示例 7：使用全局实例 ====================

/**
 * 示例 7：使用全局实例
 *
 * 在 mock 接口中直接使用全局 rabbitmq 实例
 */
export function exampleGlobalInstance(): void {
  const mq = rabbitmq as AnyMQ;

  // 直接使用全局实例（无需创建）
  mq.declareQueue('api-queue', { durable: true });

  mq.publish(
    '',
    'api-queue',
    Buffer.from(JSON.stringify({ action: 'create', data: {} })),
    { contentType: 'application/json' },
  );

  mq.consume('api-queue', (msg: RabbitMQMessage | null) => {
    if (msg) {
      const data = JSON.parse(msg.content.toString());
      console.log('处理 API 消息:', data);
      mq.ack(msg.fields.deliveryTag);
    }
  });
}

// ==================== 运行所有示例 ====================

/**
 * 运行所有示例
 */
export function runAllExamples(): void {
  console.log('=== RabbitMQ Mock 使用示例 ===\n');

  console.log('1. 基础使用');
  exampleBasicUsage();

  console.log('\n2. Topic 交换机');
  exampleTopicExchange();

  console.log('\n3. 死信队列');
  exampleDeadLetterQueue();

  console.log('\n4. 发布确认');
  examplePublisherConfirms().catch(console.error);

  console.log('\n5. 事务');
  exampleTransaction();

  console.log('\n6. 监控统计');
  exampleMonitoring();

  console.log('\n7. 全局实例');
  exampleGlobalInstance();
}
