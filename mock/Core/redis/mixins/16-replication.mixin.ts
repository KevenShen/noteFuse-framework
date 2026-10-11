/**
 * L5 高可用 - 主从复制 Mixin
 * 包含：slaveof/slaveofNoOne/role/syncFromMaster/addSlave/removeSlave/getSlaves/getReplicationOffset/replicateToSlaves
 */
import type { MixinConstructor } from './mixin.types';
import type { ReplicationRole, SlaveInfo } from '../types';

export function WithReplication<T extends MixinConstructor>(Base: T) {
  return class ReplicationMixin extends Base {
    /**
     * 设置为从节点，复制主节点
     */
    slaveof(master: any, address?: string): void {
      this.master = master;
      this._role = 'slave';
      this.debugLog('SLAVEOF:', address || 'local');
      
      // 初始全量同步
      this.syncFromMaster();
    }

    /**
     * 取消主从关系，提升为主节点
     */
    slaveofNoOne(): void {
      this.master = null;
      this._role = 'master';
      this.debugLog('SLAVEOF NO ONE: promoted to master');
    }

    /**
     * 获取角色信息
     */
    role(): { role: ReplicationRole; connectedSlaves: number; masterHost?: string } {
      if (this._role === 'master') {
        return {
          role: 'master',
          connectedSlaves: Array.from(this.slaves.values()).filter(s => s.status === 'online').length,
        };
      } else {
        return {
          role: 'slave',
          connectedSlaves: 0,
          masterHost: this.master ? 'connected' : 'disconnected',
        };
      }
    }

    /**
     * 从主节点同步数据
     */
    syncFromMaster(): boolean {
      if (!this.master) return false;
      
      // 全量同步
      const masterData = this.master.export();
      (this as any).import(masterData);
      this.replicationOffset = this.master.getReplicationOffset();
      
      this.debugLog('SYNC: full sync from master, keys:', this.cache.size);
      return true;
    }

    /**
     * 添加从节点
     */
    addSlave(id: string, address: string): void {
      this.slaves.set(id, {
        id,
        address,
        offset: this.replicationOffset,
        lastSync: Date.now(),
        status: 'online',
      });
      this.debugLog('SLAVE ADDED:', id, address);
    }

    /**
     * 移除从节点
     */
    removeSlave(id: string): boolean {
      return this.slaves.delete(id);
    }

    /**
     * 获取从节点列表
     */
    getSlaves(): SlaveInfo[] {
      return Array.from(this.slaves.values());
    }

    /**
     * 获取复制偏移量
     */
    getReplicationOffset(): number {
      return this.replicationOffset;
    }

    /**
     * 复制到从节点（模拟）
     */
    replicateToSlaves(command: string, args: any[]): void {
      if (this._role !== 'master') return;
      
      this.replicationOffset++;
      
      for (const [id, slave] of this.slaves) {
        if (slave.status === 'online') {
          slave.offset = this.replicationOffset;
          slave.lastSync = Date.now();
        }
      }
    }
  };
}
