/**
 * RabbitMQ 路由匹配工具
 *
 * 支持四种交换机的路由匹配：
 * - direct: 精确匹配
 * - topic: 通配符匹配（* 匹配一个单词，# 匹配零个或多个单词）
 * - fanout: 广播（所有绑定都匹配）
 * - headers: 匹配消息头部
 */

import type { ExchangeType } from '../types';

// ==================== Topic 路由匹配 ====================

/**
 * Topic 交换机路由匹配（支持 * 和 # 通配符）
 *
 * 通配符规则：
 * - * 匹配一个单词（必须存在）
 * - # 匹配零个或多个单词
 *
 * 示例：
 *   routingKey: "user.created.v1"
 *   pattern: "user.*.v1"     → 匹配（* 匹配 "created"）
 *   pattern: "user.#"         → 匹配（# 匹配 "created.v1"）
 *   pattern: "*.created.*"    → 匹配（* 匹配 "user" 和 "v1"）
 *   pattern: "order.*"        → 不匹配（第一个单词不同）
 *   pattern: "user.created"   → 不匹配（缺少第三个单词）
 *
 * @param routingKey 路由键（如 "user.created.v1"）
 * @param pattern 绑定模式（如 "user.*.v1" 或 "user.#"）
 * @returns 是否匹配
 */
export function matchTopicRoutingKey(routingKey: string, pattern: string): boolean {
  const keyParts = routingKey.split('.');
  const patternParts = pattern.split('.');

  return matchParts(keyParts, patternParts, 0, 0);
}

/**
 * 递归匹配单词数组
 *
 * @param keyParts 路由键单词数组
 * @param patternParts 模式单词数组
 * @param keyIndex 当前路由键索引
 * @param patternIndex 当前模式索引
 * @returns 是否匹配
 */
function matchParts(
  keyParts: string[],
  patternParts: string[],
  keyIndex: number,
  patternIndex: number,
): boolean {
  // 模式已匹配完
  if (patternIndex === patternParts.length) {
    // 路由键也匹配完 → 成功
    // 路由键还有剩余 → 失败（除非最后一个模式是 #，但已处理）
    return keyIndex === keyParts.length;
  }

  const currentPattern = patternParts[patternIndex];

  // 处理 # 通配符（匹配零个或多个单词）
  if (currentPattern === '#') {
    // # 是最后一个模式 → 匹配剩余所有单词（包括零个）
    if (patternIndex === patternParts.length - 1) {
      return true;
    }

    // # 不是最后一个模式，尝试匹配后续模式
    // 从当前 keyIndex 开始，尝试跳过 0 到剩余所有单词
    for (let i = keyIndex; i <= keyParts.length; i++) {
      if (matchParts(keyParts, patternParts, i, patternIndex + 1)) {
        return true;
      }
    }
    return false;
  }

  // 路由键已匹配完，但模式还有剩余 → 失败
  // （除非剩余模式都是 #，但上面已处理 #）
  if (keyIndex === keyParts.length) {
    return false;
  }

  // 处理 * 通配符（匹配一个单词）
  if (currentPattern === '*') {
    return matchParts(keyParts, patternParts, keyIndex + 1, patternIndex + 1);
  }

  // 精确匹配
  if (currentPattern === keyParts[keyIndex]) {
    return matchParts(keyParts, patternParts, keyIndex + 1, patternIndex + 1);
  }

  return false;
}

// ==================== Direct 路由匹配 ====================

/**
 * Direct 交换机路由匹配（精确匹配）
 *
 * @param routingKey 路由键
 * @param bindingKey 绑定键
 * @returns 是否匹配
 */
export function matchDirectRoutingKey(routingKey: string, bindingKey: string): boolean {
  return routingKey === bindingKey;
}

// ==================== Headers 路由匹配 ====================

/**
 * Headers 交换机匹配模式
 */
export type HeadersMatchType = 'all' | 'any';

/**
 * Headers 交换机路由匹配
 *
 * @param messageHeaders 消息头部
 * @param bindingArguments 绑定参数（需要匹配的头部键值对）
 * @param matchType 匹配模式：all=所有键都匹配，any=任意键匹配
 * @returns 是否匹配
 */
export function matchHeaders(
  messageHeaders: Record<string, any>,
  bindingArguments: Record<string, any>,
  matchType: HeadersMatchType = 'all',
): boolean {
  // 过滤掉 x-match 参数（它指定匹配模式，不是匹配条件）
  const matchConditions = Object.entries(bindingArguments).filter(
    ([key]) => key !== 'x-match',
  );

  if (matchConditions.length === 0) {
    return true; // 无条件，匹配所有
  }

  if (matchType === 'all') {
    // 所有条件都必须匹配
    return matchConditions.every(([key, value]) => {
      return messageHeaders[key] === value;
    });
  } else {
    // 任意条件匹配即可
    return matchConditions.some(([key, value]) => {
      return messageHeaders[key] === value;
    });
  }
}

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
export function matchRouting(
  exchangeType: ExchangeType,
  routingKey: string,
  bindingKey: string,
  messageHeaders?: Record<string, any>,
  bindingArguments?: Record<string, any>,
): boolean {
  switch (exchangeType) {
    case 'direct':
      return matchDirectRoutingKey(routingKey, bindingKey);

    case 'topic':
      return matchTopicRoutingKey(routingKey, bindingKey);

    case 'fanout':
      return true; // 广播，所有绑定都匹配

    case 'headers':
      return matchHeaders(
        messageHeaders || {},
        bindingArguments || {},
        (bindingArguments?.['x-match'] as HeadersMatchType) || 'all',
      );

    default:
      return false;
  }
}
