/**
 * 28 - 主从复制 Mixin
 * 包含：setAsPrimary、setAsReplica、syncFromPrimary、getReplicationStatus
 */
import type { FlatItem } from '../types/base.types';
import type { ReplicationConfig, ReplicationStatus } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithReplication<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 设置为主节点 */
    setAsPrimary(config?: Partial<ReplicationConfig>): void {
      (this as any).replicationConfig = {
        role: 'primary',
        binlogEnabled: true,
        ...config,
      };
    }

    /** 设置为从节点 */
    setAsReplica(primaryTable: any, config?: Partial<ReplicationConfig>): void {
      (this as any).replicationConfig = {
        role: 'replica',
        primaryTable,
        binlogEnabled: false,
        ...config,
      };
    }

    /** 从主节点同步 */
    syncFromPrimary(): number {
      if ((this as any).replicationConfig?.role !== 'replica') throw new Error('当前不是从节点');
      const primary = (this as any).replicationConfig.primaryTable;
      if (!primary) throw new Error('未配置主节点');
      
      const primaryData = primary.findAll();
      let synced = 0;
      for (const item of primaryData) {
        const existing = (this as any).findById(item.id);
        if (!existing) { (this as any).create(item); synced++; }
        else if (JSON.stringify(existing) !== JSON.stringify(item)) {
          (this as any).update({ id: item.id }, item); synced++;
        }
      }
      (this as any).replicationConfig.lastSyncAt = new Date();
      return synced;
    }

    /** 获取复制状态 */
    getReplicationStatus(): ReplicationStatus {
      const config = (this as any).replicationConfig;
      if (!config) return { role: 'standalone', isPrimary: true, isReplica: false, connected: false };
      return {
        role: config.role,
        isPrimary: config.role === 'primary',
        isReplica: config.role === 'replica',
        connected: config.role === 'replica' && !!config.primaryTable,
        lastSyncAt: config.lastSyncAt,
        binlogPosition: config.role === 'primary' ? (this as any).getBinlogEventCount() : 0,
      };
    }
  };
}
