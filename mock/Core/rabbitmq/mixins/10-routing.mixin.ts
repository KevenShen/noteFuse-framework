/**
 * L2 消息层 - 路由匹配 Mixin
 *
 * 功能：
 * - matchRouting：通用路由匹配（根据交换机类型）
 * - matchDirect：direct 交换机匹配
 * - matchTopic：topic 交换机匹配
 * - matchFanout：fanout 交换机匹配（总是匹配）
 * - matchHeaders：headers 交换机匹配
 * - findQueuesForRouting：查找匹配指定路由键的所有队列
 * - getRoutingInfo：获取路由信息（调试用）
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import {
  matchTopicRoutingKey,
  matchDirectRoutingKey,
  matchHeaders,
  matchRouting as utilsMatchRouting,
} from '../utils';
import type {
  ExchangeType,
  BindingInfo,
  RabbitMQMessage,
} from '../types';

/**
 * 路由匹配结果
 */
interface RoutingMatchResult {
  /** 交换机名称 */
  exchange: string;
  /** 交换机类型 */
  exchangeType: ExchangeType;
  /** 路由键 */
  routingKey: string;
  /** 匹配的绑定列表 */
  matchedBindings: BindingInfo[];
  /** 匹配的队列名称列表 */
  matchedQueues: string[];
  /** 匹配的交换机名称列表（Exchange-to-Exchange 绑定） */
  matchedExchanges: string[];
}

/**
 * 路由匹配 Mixin
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithRouting<T extends Constructor>(Base: T) {
  return class RoutingMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 通用路由匹配 ====================

    /**
     * 通用路由匹配（根据交换机类型选择匹配算法）
     *
     * @param exchangeType 交换机类型
     * @param routingKey 路由键
     * @param bindingKey 绑定键
     * @param messageHeaders 消息头部（headers 交换机使用）
     * @param bindingArguments 绑定参数（headers 交换机使用）
     * @returns 是否匹配
     */
    matchRouting(
      exchangeType: ExchangeType,
      routingKey: string,
      bindingKey: string,
      messageHeaders?: Record<string, any>,
      bindingArguments?: Record<string, any>,
    ): boolean {
      return utilsMatchRouting(
        exchangeType,
        routingKey,
        bindingKey,
        messageHeaders,
        bindingArguments,
      );
    }

    // ==================== 各类型交换机匹配 ====================

    /**
     * Direct 交换机匹配（精确匹配）
     *
     * @param routingKey 路由键
     * @param bindingKey 绑定键
     * @returns 是否匹配
     */
    matchDirect(routingKey: string, bindingKey: string): boolean {
      return matchDirectRoutingKey(routingKey, bindingKey);
    }

    /**
     * Topic 交换机匹配（通配符匹配）
     *
     * 通配符规则：
     * - * 匹配一个单词
     * - # 匹配零个或多个单词
     *
     * @param routingKey 路由键
     * @param pattern 绑定模式（含通配符）
     * @returns 是否匹配
     */
    matchTopic(routingKey: string, pattern: string): boolean {
      return matchTopicRoutingKey(routingKey, pattern);
    }

    /**
     * Fanout 交换机匹配（广播，总是匹配）
     *
     * @returns 总是返回 true
     */
    matchFanout(): boolean {
      return true;
    }

    /**
     * Headers 交换机匹配
     *
     * @param messageHeaders 消息头部
     * @param bindingArguments 绑定参数
     * @param matchType 匹配模式（all=所有键都匹配，any=任意键匹配）
     * @returns 是否匹配
     */
    matchHeaders(
      messageHeaders: Record<string, any>,
      bindingArguments: Record<string, any>,
      matchType: 'all' | 'any' = 'all',
    ): boolean {
      return matchHeaders(messageHeaders, bindingArguments, matchType);
    }

    // ==================== 路由查询 ====================

    /**
     * 查找匹配指定路由键的所有队列
     *
     * 【流程】
     * 1. 获取交换机的所有绑定
     * 2. 根据交换机类型逐个匹配
     * 3. 收集匹配的队列名称
     * 4. 处理 Exchange-to-Exchange 绑定（递归匹配）
     *
     * @param exchangeName 交换机名称
     * @param routingKey 路由键
     * @param message 消息（headers 交换机需要消息头部）
     * @returns 匹配的队列名称列表
     */
    findQueuesForRouting(
      exchangeName: string,
      routingKey: string,
      message?: RabbitMQMessage,
    ): string[] {
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) return [];

      const matchedQueues: Set<string> = new Set();
      const visitedExchanges: Set<string> = new Set();

      // 递归匹配（处理 Exchange-to-Exchange 绑定）
      const matchRecursive = (exName: string, rKey: string) => {
        // 防止循环引用
        if (visitedExchanges.has(exName)) return;
        visitedExchanges.add(exName);

        const ex = this.exchanges.get(exName);
        if (!ex) return;

        // 获取该交换机的所有绑定
        const bindings = this.bindings.filter((b) => b.source === exName);

        for (const binding of bindings) {
          // 根据交换机类型匹配
          let matched = false;
          switch (ex.type) {
            case 'direct':
              matched = this.matchDirect(rKey, binding.routingKey);
              break;
            case 'topic':
              matched = this.matchTopic(rKey, binding.routingKey);
              break;
            case 'fanout':
              matched = true;
              break;
            case 'headers':
              matched = this.matchHeaders(
                message?.properties.headers || {},
                binding.arguments || {},
                (binding.arguments?.['x-match'] as 'all' | 'any') || 'all',
              );
              break;
          }

          if (matched) {
            if (binding.destinationType === 'queue') {
              // 目标是队列，添加到结果
              matchedQueues.add(binding.destination);
            } else if (binding.destinationType === 'exchange') {
              // 目标是交换机，递归匹配
              matchRecursive(binding.destination, rKey);
            }
          }
        }
      };

      matchRecursive(exchangeName, routingKey);
      return Array.from(matchedQueues);
    }

    /**
     * 获取路由信息（调试用）
     *
     * @param exchangeName 交换机名称
     * @param routingKey 路由键
     * @param message 消息
     * @returns 路由匹配结果详情
     */
    getRoutingInfo(
      exchangeName: string,
      routingKey: string,
      message?: RabbitMQMessage,
    ): RoutingMatchResult {
      const exchange = this.exchanges.get(exchangeName);

      const result: RoutingMatchResult = {
        exchange: exchangeName,
        exchangeType: exchange?.type || 'direct',
        routingKey,
        matchedBindings: [],
        matchedQueues: [],
        matchedExchanges: [],
      };

      if (!exchange) return result;

      // 获取该交换机的所有绑定
      const bindings = this.bindings.filter((b) => b.source === exchangeName);

      for (const binding of bindings) {
        // 根据交换机类型匹配
        let matched = false;
        switch (exchange.type) {
          case 'direct':
            matched = this.matchDirect(routingKey, binding.routingKey);
            break;
          case 'topic':
            matched = this.matchTopic(routingKey, binding.routingKey);
            break;
          case 'fanout':
            matched = true;
            break;
          case 'headers':
            matched = this.matchHeaders(
              message?.properties.headers || {},
              binding.arguments || {},
              (binding.arguments?.['x-match'] as 'all' | 'any') || 'all',
            );
            break;
        }

        if (matched) {
          result.matchedBindings.push(binding);
          if (binding.destinationType === 'queue') {
            result.matchedQueues.push(binding.destination);
          } else {
            result.matchedExchanges.push(binding.destination);
          }
        }
      }

      return result;
    }

    // ==================== 路由验证 ====================

    /**
     * 验证路由键格式
     *
     * @param routingKey 路由键
     * @returns 是否有效
     */
    isValidRoutingKey(routingKey: string): boolean {
      // 路由键不能为空
      if (!routingKey) return false;

      // 路由键长度限制（255 字节，简化为字符数检查）
      if (routingKey.length > 255) return false;

      // 路由键不能包含某些特殊字符（除了 . * #）
      // 实际上 RabbitMQ 允许大部分字符，这里只做基本检查
      return true;
    }

    /**
     * 验证绑定模式格式（topic 交换机）
     *
     * @param pattern 绑定模式
     * @returns 是否有效
     */
    isValidTopicPattern(pattern: string): boolean {
      if (!pattern) return false;

      // 检查通配符使用是否正确
      const parts = pattern.split('.');
      for (const part of parts) {
        // * 必须单独作为一个单词
        if (part.includes('*') && part !== '*') return false;
        // # 必须单独作为一个单词
        if (part.includes('#') && part !== '#') return false;
      }

      return true;
    }
  };
}
