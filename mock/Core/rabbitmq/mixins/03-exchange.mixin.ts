/**
 * L1 基础层 - 交换机管理 Mixin
 *
 * 功能：
 * - declareExchange：声明交换机
 * - deleteExchange：删除交换机
 * - getExchange：获取交换机信息
 * - listExchanges：列出所有交换机
 * - exchangeExists：检查交换机是否存在
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import type {
  ExchangeType,
  ExchangeOptions,
  ExchangeDeclareOptions,
  ExchangeDeleteOptions,
  ExchangeInfo,
} from '../types';

/**
 * 交换机管理 Mixin
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithExchange<T extends Constructor>(Base: T) {
  return class ExchangeMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 交换机管理 ====================

    /**
     * 声明交换机
     *
     * 如果交换机已存在且类型相同，则返回已有交换机
     * 如果交换机已存在但类型不同，则抛出错误
     * 如果交换机不存在，则创建新交换机
     *
     * @param name 交换机名称
     * @param type 交换机类型（direct/topic/fanout/headers）
     * @param options 交换机选项
     * @returns 交换机信息
     */
    declareExchange(
      name: string,
      type: ExchangeType,
      options?: ExchangeDeclareOptions,
    ): ExchangeInfo {
      // 检查交换机是否已存在
      const existing = this.exchanges.get(name);
      if (existing) {
        // 如果是被动声明，只检查是否存在
        if (options?.passive) {
          return existing;
        }

        // 检查类型是否一致
        if (existing.type !== type) {
          throw new Error(
            `交换机 '${name}' 已存在，但类型不同: 现有=${existing.type}, 请求=${type}`,
          );
        }

        return existing;
      }

      // 被动声明但交换机不存在 → 报错
      if (options?.passive) {
        throw new Error(`交换机 '${name}' 不存在（被动声明失败）`);
      }

      // 创建新交换机
      const exchangeInfo: ExchangeInfo = {
        name,
        type,
        options: {
          durable: options?.durable ?? false,
          autoDelete: options?.autoDelete ?? false,
          internal: options?.internal ?? false,
          arguments: options?.arguments,
        },
        bindings: [],
        messagePublishedCount: 0,
        createdAt: Date.now(),
      };

      this.exchanges.set(name, exchangeInfo);

      this.updateStats({
        totalExchanges: this.stats.totalExchanges + 1,
      });

      console.log(`[MockRabbitMQ] 交换机已声明: ${name} (${type})`);
      return exchangeInfo;
    }

    /**
     * 删除交换机
     *
     * @param name 交换机名称
     * @param options 删除选项
     * @returns 是否成功删除
     */
    deleteExchange(
      name: string,
      options?: ExchangeDeleteOptions,
    ): boolean {
      const exchange = this.exchanges.get(name);
      if (!exchange) {
        if (options?.ifUnused) {
          throw new Error(`交换机 '${name}' 不存在`);
        }
        return false;
      }

      // 检查是否有绑定（ifUnused 选项）
      if (options?.ifUnused && exchange.bindings.length > 0) {
        throw new Error(`交换机 '${name}' 仍有绑定，无法删除`);
      }

      // 移除相关绑定
      this.bindings = this.bindings.filter((b) => b.source !== name);

      // 移除交换机
      this.exchanges.delete(name);

      this.updateStats({
        totalExchanges: Math.max(0, this.stats.totalExchanges - 1),
      });

      console.log(`[MockRabbitMQ] 交换机已删除: ${name}`);
      return true;
    }

    /**
     * 获取交换机信息
     *
     * @param name 交换机名称
     * @returns 交换机信息（不存在返回 null）
     */
    getExchange(name: string): ExchangeInfo | null {
      return this.exchanges.get(name) || null;
    }

    /**
     * 列出所有交换机
     *
     * @returns 交换机信息列表
     */
    listExchanges(): ExchangeInfo[] {
      return Array.from(this.exchanges.values());
    }

    /**
     * 检查交换机是否存在
     *
     * @param name 交换机名称
     * @returns 是否存在
     */
    exchangeExists(name: string): boolean {
      return this.exchanges.has(name);
    }

    /**
     * 获取交换机类型
     *
     * @param name 交换机名称
     * @returns 交换机类型（不存在返回 null）
     */
    getExchangeType(name: string): ExchangeType | null {
      return this.exchanges.get(name)?.type || null;
    }

    /**
     * 增加交换机发布消息计数
     *
     * @param name 交换机名称
     * @param count 增加的数量（默认 1）
     */
    protected incrementExchangePublishCount(name: string, count: number = 1): void {
      const exchange = this.exchanges.get(name);
      if (exchange) {
        exchange.messagePublishedCount += count;
      }
    }
  };
}
