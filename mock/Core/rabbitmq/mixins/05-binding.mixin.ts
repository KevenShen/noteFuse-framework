/**
 * L1 基础层 - 绑定管理 Mixin
 *
 * 功能：
 * - bindQueue：绑定队列到交换机
 * - unbindQueue：解绑队列
 * - bindExchange：绑定交换机到交换机
 * - unbindExchange：解绑交换机
 * - listBindings：列出所有绑定
 * - getQueueBindings：获取队列的绑定列表
 * - getExchangeBindings：获取交换机的绑定列表
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import { matchTopicRoutingKey } from '../utils';
import type {
  BindingInfo,
  BindingDestinationType,
} from '../types';

/**
 * 绑定管理 Mixin
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithBinding<T extends Constructor>(Base: T) {
  return class BindingMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 队列绑定 ====================

    /**
     * 绑定队列到交换机
     *
     * @param queueName 队列名称
     * @param exchangeName 交换机名称
     * @param routingKey 路由键
     * @param args 绑定参数（用于 headers 交换机）
     * @returns 是否成功绑定
     */
    bindQueue(
      queueName: string,
      exchangeName: string,
      routingKey: string = '',
      args?: Record<string, any>,
    ): boolean {
      // 检查队列是否存在
      if (!(this as any).queueExists(queueName)) {
        throw new Error(`队列 '${queueName}' 不存在`);
      }

      // 检查交换机是否存在
      if (!(this as any).exchangeExists(exchangeName)) {
        throw new Error(`交换机 '${exchangeName}' 不存在`);
      }

      // 检查是否已绑定（避免重复绑定）
      const existing = this.bindings.find(
        (b) =>
          b.source === exchangeName &&
          b.destination === queueName &&
          b.destinationType === 'queue' &&
          b.routingKey === routingKey,
      );

      if (existing) {
        console.log(`[MockRabbitMQ] 队列已绑定: ${queueName} -> ${exchangeName} (${routingKey})`);
        return true;
      }

      // 创建绑定
      const binding: BindingInfo = {
        source: exchangeName,
        destination: queueName,
        destinationType: 'queue',
        routingKey,
        arguments: args,
        createdAt: Date.now(),
      };

      this.bindings.push(binding);

      // 更新交换机的绑定列表
      const exchange = this.exchanges.get(exchangeName);
      if (exchange) {
        exchange.bindings.push(binding);
      }

      // 更新队列的绑定列表
      const queue = this.queues.get(queueName);
      if (queue) {
        queue.bindings.push(binding);
      }

      console.log(`[MockRabbitMQ] 队列已绑定: ${queueName} -> ${exchangeName} (${routingKey})`);
      return true;
    }

    /**
     * 解绑队列
     *
     * @param queueName 队列名称
     * @param exchangeName 交换机名称
     * @param routingKey 路由键
     * @param args 绑定参数
     * @returns 是否成功解绑
     */
    unbindQueue(
      queueName: string,
      exchangeName: string,
      routingKey: string = '',
      args?: Record<string, any>,
    ): boolean {
      // 查找绑定
      const bindingIndex = this.bindings.findIndex(
        (b) =>
          b.source === exchangeName &&
          b.destination === queueName &&
          b.destinationType === 'queue' &&
          b.routingKey === routingKey,
      );

      if (bindingIndex === -1) {
        console.warn(`[MockRabbitMQ] 绑定不存在: ${queueName} -> ${exchangeName} (${routingKey})`);
        return false;
      }

      // 移除绑定
      const [removedBinding] = this.bindings.splice(bindingIndex, 1);

      // 从交换机的绑定列表中移除
      const exchange = this.exchanges.get(exchangeName);
      if (exchange) {
        exchange.bindings = exchange.bindings.filter(
          (b) => !(b.destination === queueName && b.routingKey === routingKey),
        );
      }

      // 从队列的绑定列表中移除
      const queue = this.queues.get(queueName);
      if (queue) {
        queue.bindings = queue.bindings.filter(
          (b) => !(b.source === exchangeName && b.routingKey === routingKey),
        );
      }

      console.log(`[MockRabbitMQ] 队列已解绑: ${queueName} -> ${exchangeName} (${routingKey})`);
      return true;
    }

    // ==================== 交换机绑定 ====================

    /**
     * 绑定交换机到交换机（Exchange-to-Exchange 绑定）
     *
     * @param sourceExchangeName 源交换机名称
     * @param destExchangeName 目标交换机名称
     * @param routingKey 路由键
     * @param args 绑定参数
     * @returns 是否成功绑定
     */
    bindExchange(
      sourceExchangeName: string,
      destExchangeName: string,
      routingKey: string = '',
      args?: Record<string, any>,
    ): boolean {
      // 检查交换机是否存在
      if (!(this as any).exchangeExists(sourceExchangeName)) {
        throw new Error(`源交换机 '${sourceExchangeName}' 不存在`);
      }
      if (!(this as any).exchangeExists(destExchangeName)) {
        throw new Error(`目标交换机 '${destExchangeName}' 不存在`);
      }

      // 检查是否已绑定
      const existing = this.bindings.find(
        (b) =>
          b.source === sourceExchangeName &&
          b.destination === destExchangeName &&
          b.destinationType === 'exchange' &&
          b.routingKey === routingKey,
      );

      if (existing) {
        console.log(`[MockRabbitMQ] 交换机已绑定: ${destExchangeName} -> ${sourceExchangeName} (${routingKey})`);
        return true;
      }

      // 创建绑定
      const binding: BindingInfo = {
        source: sourceExchangeName,
        destination: destExchangeName,
        destinationType: 'exchange',
        routingKey,
        arguments: args,
        createdAt: Date.now(),
      };

      this.bindings.push(binding);

      // 更新源交换机的绑定列表
      const sourceExchange = this.exchanges.get(sourceExchangeName);
      if (sourceExchange) {
        sourceExchange.bindings.push(binding);
      }

      console.log(`[MockRabbitMQ] 交换机已绑定: ${destExchangeName} -> ${sourceExchangeName} (${routingKey})`);
      return true;
    }

    /**
     * 解绑交换机
     *
     * @param sourceExchangeName 源交换机名称
     * @param destExchangeName 目标交换机名称
     * @param routingKey 路由键
     * @param args 绑定参数
     * @returns 是否成功解绑
     */
    unbindExchange(
      sourceExchangeName: string,
      destExchangeName: string,
      routingKey: string = '',
      args?: Record<string, any>,
    ): boolean {
      // 查找绑定
      const bindingIndex = this.bindings.findIndex(
        (b) =>
          b.source === sourceExchangeName &&
          b.destination === destExchangeName &&
          b.destinationType === 'exchange' &&
          b.routingKey === routingKey,
      );

      if (bindingIndex === -1) {
        console.warn(`[MockRabbitMQ] 绑定不存在: ${destExchangeName} -> ${sourceExchangeName} (${routingKey})`);
        return false;
      }

      // 移除绑定
      this.bindings.splice(bindingIndex, 1);

      // 从源交换机的绑定列表中移除
      const sourceExchange = this.exchanges.get(sourceExchangeName);
      if (sourceExchange) {
        sourceExchange.bindings = sourceExchange.bindings.filter(
          (b) => !(b.destination === destExchangeName && b.routingKey === routingKey && b.destinationType === 'exchange'),
        );
      }

      console.log(`[MockRabbitMQ] 交换机已解绑: ${destExchangeName} -> ${sourceExchangeName} (${routingKey})`);
      return true;
    }

    // ==================== 绑定查询 ====================

    /**
     * 列出所有绑定
     *
     * @returns 绑定列表
     */
    listBindings(): BindingInfo[] {
      return [...this.bindings];
    }

    /**
     * 获取队列的绑定列表
     *
     * @param queueName 队列名称
     * @returns 绑定列表
     */
    getQueueBindings(queueName: string): BindingInfo[] {
      return this.bindings.filter(
        (b) => b.destination === queueName && b.destinationType === 'queue',
      );
    }

    /**
     * 获取交换机的绑定列表（作为源交换机）
     *
     * @param exchangeName 交换机名称
     * @returns 绑定列表
     */
    getExchangeBindings(exchangeName: string): BindingInfo[] {
      return this.bindings.filter((b) => b.source === exchangeName);
    }

    /**
     * 获取交换机的反向绑定列表（作为目标交换机）
     *
     * @param exchangeName 交换机名称
     * @returns 绑定列表
     */
    getExchangeReverseBindings(exchangeName: string): BindingInfo[] {
      return this.bindings.filter(
        (b) => b.destination === exchangeName && b.destinationType === 'exchange',
      );
    }

    /**
     * 根据交换机和路由键查找匹配的队列
     *
     * @param exchangeName 交换机名称
     * @param routingKey 路由键
     * @returns 匹配的队列名称列表
     */
    protected findMatchedQueues(exchangeName: string, routingKey: string): string[] {
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) return [];

      const matchedQueues: string[] = [];

      for (const binding of exchange.bindings) {
        if (binding.destinationType !== 'queue') continue;

        // 根据交换机类型匹配路由键
        let matched = false;
        switch (exchange.type) {
          case 'direct':
            matched = binding.routingKey === routingKey;
            break;
          case 'fanout':
            matched = true; // 广播，所有绑定都匹配
            break;
          case 'topic':
            matched = matchTopicRoutingKey(routingKey, binding.routingKey);
            break;
          case 'headers':
            // headers 交换机匹配逻辑在 publish mixin 中处理
            matched = true; // 暂时匹配，具体在发布时判断
            break;
        }

        if (matched && !matchedQueues.includes(binding.destination)) {
          matchedQueues.push(binding.destination);
        }
      }

      return matchedQueues;
    }
  };
}
