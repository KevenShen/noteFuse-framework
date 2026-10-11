/**
 * MockRabbitMQ 主类
 *
 * 使用 Mixin 组合模式，将 21 个功能 Mixin 组合到基础类上
 *
 * 【架构说明】
 * - MockRabbitMQBase：包含所有共享属性和构造函数
 * - 21 个 Mixin：按功能模块拆分，每个 Mixin 只包含方法实现
 * - applyMixins：管道式组合函数，按顺序应用所有 Mixin
 *
 * 【使用方式】
 * ```typescript
 * const rabbitmq = new MockRabbitMQ();
 * const conn = await rabbitmq.connect();
 * const channel = conn.createChannel();
 * await channel.declareQueue('my-queue');
 * channel.publish('', 'my-queue', Buffer.from('hello'));
 * ```
 */

import { applyMixins, MockRabbitMQBase } from './mixins';

// ==================== 导入所有 Mixin ====================
// L1 基础层
import { WithConnection } from './mixins/01-connection.mixin';
import { WithChannel } from './mixins/02-channel.mixin';
import { WithExchange } from './mixins/03-exchange.mixin';
import { WithQueue } from './mixins/04-queue.mixin';
import { WithBinding } from './mixins/05-binding.mixin';

// L2 消息层
import { WithPublish } from './mixins/06-publish.mixin';
import { WithConsume } from './mixins/07-consume.mixin';
import { WithAck } from './mixins/08-ack.mixin';
import { WithPrefetch } from './mixins/09-prefetch.mixin';
import { WithRouting } from './mixins/10-routing.mixin';

// L3 高级消息层
import { WithDLX } from './mixins/11-dlx.mixin';
import { WithDelayed } from './mixins/12-delayed.mixin';
import { WithPersistence } from './mixins/13-persistence.mixin';

// L4 可靠性层
import { WithTransaction } from './mixins/14-transaction.mixin';
import { WithConfirms } from './mixins/15-confirms.mixin';
import { WithFlow } from './mixins/16-flow.mixin';

// L5 管理监控层
import { WithVhost } from './mixins/17-vhost.mixin';
import { WithPermission } from './mixins/18-permission.mixin';
import { WithMonitoring } from './mixins/19-monitoring.mixin';

// L6 集群工具层
import { WithCluster } from './mixins/20-cluster.mixin';
import { WithUtility } from './mixins/21-utility.mixin';

// ==================== 组合所有 Mixin ====================
// 使用 as any 绕过 TypeScript 对 Mixin 函数的严格类型检查
// （Mixin 函数内部使用了 Base as unknown as typeof MockRabbitMQBase）
const EnhancedMockRabbitMQ = applyMixins(
  MockRabbitMQBase,
  // L1 基础层
  WithConnection as any,
  WithChannel as any,
  WithExchange as any,
  WithQueue as any,
  WithBinding as any,
  // L2 消息层
  WithPublish as any,
  WithConsume as any,
  WithAck as any,
  WithPrefetch as any,
  WithRouting as any,
  // L3 高级消息层
  WithDLX as any,
  WithDelayed as any,
  WithPersistence as any,
  // L4 可靠性层
  WithTransaction as any,
  WithConfirms as any,
  WithFlow as any,
  // L5 管理监控层
  WithVhost as any,
  WithPermission as any,
  WithMonitoring as any,
  // L6 集群工具层
  WithCluster as any,
  WithUtility as any,
);

/**
 * MockRabbitMQ 主类
 *
 * 完整的 RabbitMQ 模拟实现，支持：
 * - 连接/通道管理
 * - 交换机/队列/绑定管理
 * - 消息发布/消费/确认
 * - 死信队列/延迟队列
 * - 事务/发布确认
 * - 监控统计
 *
 * @example
 * ```typescript
 * const rabbitmq = new MockRabbitMQ();
 *
 * // 声明队列
 * rabbitmq.declareQueue('my-queue', { durable: true });
 *
 * // 发布消息
 * rabbitmq.publish('', 'my-queue', Buffer.from('hello world'));
 *
 * // 消费消息
 * rabbitmq.consume('my-queue', (msg) => {
 *   if (msg) {
 *     console.log('收到消息:', msg.content.toString());
 *     rabbitmq.ack(msg.fields.deliveryTag);
 *   }
 * });
 * ```
 */
export class MockRabbitMQ extends EnhancedMockRabbitMQ {
  // 可以在此添加特定的便捷方法
  // 所有核心功能由 Mixin 提供

  // ==================== 类型声明（Mixin 方法）====================
  // 由于 TypeScript 无法自动推断 Mixin 组合后的类型，
  // 这里显式声明常用方法的类型签名，确保类型安全

  // L1 基础层
  declare connect: (config?: any) => any;
  declare close: () => void;
  declare createChannel: () => any;
  declare declareExchange: (name: string, type: string, options?: any) => any;
  declare deleteExchange: (name: string) => void;
  declare declareQueue: (name: string, options?: any) => any;
  declare deleteQueue: (name: string) => void;
  declare bindQueue: (queueName: string, exchangeName: string, routingKey: string) => boolean;
  declare unbindQueue: (queueName: string, exchangeName: string, routingKey: string) => boolean;

  // L2 消息层
  declare publish: (exchange: string, routingKey: string, content: any, properties?: any, channelId?: number) => void;
  declare sendToQueue: (queueName: string, content: any, properties?: any, channelId?: number) => void;
  declare consume: (queueName: string, callback: any, options?: any) => string;
  declare get: (queueName: string, noAck?: boolean) => any;
  declare ack: (message: any, multiple?: boolean) => void;
  declare nack: (message: any, multiple?: boolean, requeue?: boolean) => void;
  declare prefetch: (count: number, global?: boolean) => void;

  // L3 高级消息层
  declare declareDLX: (name: string, options?: any) => any;
  declare publishDelayed: (exchange: string, routingKey: string, content: any, delay: number, properties?: any) => void;

  // L4 可靠性层
  declare txSelect: () => void;
  declare txCommit: () => void;
  declare txRollback: () => void;
  declare confirmSelect: () => void;

  // L5 管理监控层
  declare getStats: () => any;
  declare getQueueStats: (queueName: string) => any;
  declare listQueues: () => any[];
  declare listExchanges: () => any[];

  // L6 集群工具层
  declare resetAll: () => void;
  declare getInfo: () => any;
}
