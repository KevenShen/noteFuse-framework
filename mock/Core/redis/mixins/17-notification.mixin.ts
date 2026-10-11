/**
 * L5 高可用 - 键空间通知 Mixin
 * 包含：configSetNotifyKeyspaceEvents/subscribeKeyspaceNotifications/notifyKeyspace/isNotificationEnabled
 */
import type { MixinConstructor } from './mixin.types';
import type { KeyspaceNotificationCallback } from '../types';

export function WithNotification<T extends MixinConstructor>(Base: T) {
  return class NotificationMixin extends Base {
    /**
     * 启用键空间通知
     * @param flags 通知类型，如 'Kx'（键过期）、'El'（命令事件）、'AKE'（所有）
     */
    configSetNotifyKeyspaceEvents(flags: string): void {
      this.keyspaceNotifications = flags;
      this.debugLog('KEYSPACE NOTIFICATIONS:', flags);
    }

    /**
     * 订阅键空间通知
     */
    subscribeKeyspaceNotifications(callback: KeyspaceNotificationCallback): () => void {
      this.keyspaceSubscribers.add(callback);
      return () => this.keyspaceSubscribers.delete(callback);
    }

    /**
     * 触发键空间通知
     */
    notifyKeyspace(event: string, key: string): void {
      if (this.keyspaceSubscribers.size === 0) return;
      
      for (const callback of this.keyspaceSubscribers) {
        try {
          callback(event, key);
        } catch (error) {
          this.debugLog('Keyspace notification error:', error);
        }
      }
    }

    /**
     * 检查是否启用了某种通知
     */
    isNotificationEnabled(flag: string): boolean {
      if (this.keyspaceNotifications.includes('A')) return true;  // 所有
      return this.keyspaceNotifications.includes(flag);
    }
  };
}
