/**
 * L4 消息/扩展 - 发布订阅 Mixin
 * 包含：publish/subscribe/unsubscribe/psubscribe/punsubscribe/pubsubChannels/pubsubNumSub/pubsubNumPat
 */
import type { MixinConstructor } from './mixin.types';
import type { SubscribeCallback, PatternSubscribeCallback } from '../types';
import { patternToRegex } from '../utils';

export function WithPubsub<T extends MixinConstructor>(Base: T) {
  return class PubsubMixin extends Base {
    /**
     * 发布消息到频道
     * 返回接收消息的订阅者数量
     */
    publish(channel: string, message: any): number {
      let receiverCount = 0;

      // 通知精确匹配的订阅者
      const channelSubscribers = this.subscribers.get(channel);
      if (channelSubscribers) {
        for (const callback of channelSubscribers) {
          try {
            callback(channel, message);
            receiverCount++;
          } catch (error) {
            this.debugLog('Pub/Sub callback error:', error);
          }
        }
      }

      // 通知模式匹配的订阅者
      for (const [pattern, callbacks] of this.patternSubscribers) {
        const regex = patternToRegex(pattern);
        if (regex.test(channel)) {
          for (const callback of callbacks) {
            try {
              callback(pattern, channel, message);
              receiverCount++;
            } catch (error) {
              this.debugLog('Pub/Sub pattern callback error:', error);
            }
          }
        }
      }

      this.debugLog('PUBLISH:', channel, 'receivers:', receiverCount);
      return receiverCount;
    }

    /**
     * 订阅频道
     * 返回取消订阅函数
     */
    subscribe(channel: string, callback: SubscribeCallback): () => void {
      if (!this.subscribers.has(channel)) {
        this.subscribers.set(channel, new Set());
      }
      this.subscribers.get(channel)!.add(callback);
      this.debugLog('SUBSCRIBE:', channel);

      // 返回取消订阅函数
      return () => this.unsubscribe(channel, callback);
    }

    /**
     * 取消订阅频道
     */
    unsubscribe(channel: string, callback?: SubscribeCallback): void {
      if (callback) {
        const callbacks = this.subscribers.get(channel);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            this.subscribers.delete(channel);
          }
        }
      } else {
        this.subscribers.delete(channel);
      }
      this.debugLog('UNSUBSCRIBE:', channel);
    }

    /**
     * 模式订阅（支持通配符 * 和 ?）
     * 返回取消订阅函数
     */
    psubscribe(pattern: string, callback: PatternSubscribeCallback): () => void {
      if (!this.patternSubscribers.has(pattern)) {
        this.patternSubscribers.set(pattern, new Set());
      }
      this.patternSubscribers.get(pattern)!.add(callback);
      this.debugLog('PSUBSCRIBE:', pattern);

      return () => this.punsubscribe(pattern, callback);
    }

    /**
     * 取消模式订阅
     */
    punsubscribe(pattern: string, callback?: PatternSubscribeCallback): void {
      if (callback) {
        const callbacks = this.patternSubscribers.get(pattern);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            this.patternSubscribers.delete(pattern);
          }
        }
      } else {
        this.patternSubscribers.delete(pattern);
      }
      this.debugLog('PUNSUBSCRIBE:', pattern);
    }

    /**
     * 查看活跃的频道
     */
    pubsubChannels(pattern?: string): string[] {
      let channels = Array.from(this.subscribers.keys());
      if (pattern) {
        const regex = patternToRegex(pattern);
        channels = channels.filter(ch => regex.test(ch));
      }
      return channels;
    }

    /**
     * 查看频道的订阅者数量
     */
    pubsubNumSub(channel: string): number {
      return this.subscribers.get(channel)?.size || 0;
    }

    /**
     * 查看模式订阅者数量
     */
    pubsubNumPat(): number {
      let count = 0;
      for (const callbacks of this.patternSubscribers.values()) {
        count += callbacks.size;
      }
      return count;
    }
  };
}
