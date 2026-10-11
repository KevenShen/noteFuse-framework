/**
 * RabbitMQ Mixin 类型定义
 *
 * 定义 Mixin 组合模式所需的类型：
 * - Constructor：构造函数类型
 * - MixinFunction：Mixin 函数类型
 */

/**
 * 构造函数类型
 *
 * 用于 Mixin 模式中的基类约束
 *
 * @example
 * ```typescript
 * export function WithConnection<T extends Constructor>(Base: T) {
 *   return class ConnectionMixin extends Base {
 *     // ...
 *   };
 * }
 * ```
 */
export type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * Mixin 函数类型
 *
 * 接收一个基类，返回一个扩展后的类
 *
 * @example
 * ```typescript
 * const WithConnection: MixinFunction = (Base) => class extends Base { ... };
 * ```
 */
export type MixinFunction = <T extends Constructor>(Base: T) => T;

/**
 * MockRabbitMQ 基础属性接口
 *
 * 定义所有 Mixin 都需要访问的共享属性
 * 实际属性在 MockRabbitMQBase 中定义
 */
export interface MockRabbitMQBaseProperties {
  // 连接管理
  // connections: Map<string, RabbitMQConnection>

  // 交换机管理
  // exchanges: Map<string, ExchangeInfo>

  // 队列管理
  // queues: Map<string, QueueInfo>

  // 绑定管理
  // bindings: BindingInfo[]

  // 消息存储
  // messages: Map<string, RabbitMQMessage[]>

  // 消费者管理
  // consumers: Map<string, ConsumerInfo[]>

  // 全局统计
  // stats: RabbitMQStats

  // 虚拟主机
  // vhosts: Set<string>
  // currentVhost: string
}
