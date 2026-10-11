/**
 * L5 高可用 - 持久化 Mixin
 * 包含：save/bgsave/lastsave/restoreFromRDB/getRDBSnapshots/setAOFEnabled/bgrewriteaof/getAOFLog/restoreFromAOF/recordAOF/createSnapshot
 */
import type { MixinConstructor } from './mixin.types';
import type { RDBSnapshot, AOFEntry, CacheItem } from '../types';

export function WithPersistence<T extends MixinConstructor>(Base: T) {
  return class PersistenceMixin extends Base {
    /**
     * 同步保存 RDB 快照
     * 返回快照大小（字节）
     */
    save(): number {
      const snapshot = this.createSnapshot();
      this.rdbSnapshots.push(snapshot);
      this.lastSaveTime = Date.now();
      this.debugLog('SAVE: RDB snapshot created, size:', snapshot.size);
      return snapshot.size;
    }

    /**
     * 后台保存 RDB 快照（异步模拟）
     * 返回快照 ID
     */
    bgsave(): number {
      const snapshotId = this.rdbSnapshots.length;
      // 模拟异步保存
      setTimeout(() => {
        const snapshot = this.createSnapshot();
        this.rdbSnapshots.push(snapshot);
        this.lastSaveTime = Date.now();
        this.debugLog('BGSAVE: RDB snapshot created in background, id:', snapshotId);
      }, 0);
      return snapshotId;
    }

    /**
     * 获取最后一次保存时间
     */
    lastsave(): number {
      return this.lastSaveTime;
    }

    /**
     * 创建快照
     */
    createSnapshot(): RDBSnapshot {
      const data: Record<string, CacheItem> = {};
      let size = 0;
      
      for (const [key, item] of this.cache.entries()) {
        data[key] = { ...item };
        size += JSON.stringify(item).length;
      }
      
      return {
        timestamp: Date.now(),
        data,
        size,
      };
    }

    /**
     * 从 RDB 快照恢复
     */
    restoreFromRDB(snapshotIndex?: number): boolean {
      const snapshot = snapshotIndex !== undefined 
        ? this.rdbSnapshots[snapshotIndex] 
        : this.rdbSnapshots[this.rdbSnapshots.length - 1];
      
      if (!snapshot) return false;
      
      this.cache.clear();
      for (const [key, item] of Object.entries(snapshot.data)) {
        this.cache.set(key, { ...item });
      }
      
      this.debugLog('RESTORE: from RDB snapshot, keys:', this.cache.size);
      return true;
    }

    /**
     * 获取 RDB 快照列表
     */
    getRDBSnapshots(): Array<{ timestamp: number; size: number; keyCount: number }> {
      return this.rdbSnapshots.map(s => ({
        timestamp: s.timestamp,
        size: s.size,
        keyCount: Object.keys(s.data).length,
      }));
    }

    /**
     * 启用/禁用 AOF
     */
    setAOFEnabled(enabled: boolean): void {
      this.aofEnabled = enabled;
      this.debugLog('AOF:', enabled ? 'enabled' : 'disabled');
    }

    /**
     * 后台重写 AOF
     */
    bgrewriteaof(): boolean {
      if (!this.aofEnabled) return false;
      
      // 模拟 AOF 重写：压缩日志
      const compacted: AOFEntry[] = [];
      const keyState = new Map<string, any>();
      
      for (const entry of this.aofLog) {
        // 简化：只保留最后的 set 操作
        if (entry.command === 'set' && entry.args.length >= 2) {
          keyState.set(entry.args[0], entry);
        } else {
          compacted.push(entry);
        }
      }
      
      // 添加最终状态
      for (const entry of keyState.values()) {
        compacted.push(entry);
      }
      
      this.aofLog = compacted;
      this.debugLog('BGREWRITEAOF: AOF rewritten, entries:', this.aofLog.length);
      return true;
    }

    /**
     * 获取 AOF 日志
     */
    getAOFLog(): AOFEntry[] {
      return [...this.aofLog];
    }

    /**
     * 从 AOF 恢复
     */
    restoreFromAOF(): boolean {
      if (this.aofLog.length === 0) return false;
      
      this.cache.clear();
      
      for (const entry of this.aofLog) {
        try {
          this.executeCommand(entry.command, entry.args);
        } catch (error) {
          this.debugLog('AOF restore error:', error);
        }
      }
      
      this.debugLog('RESTORE: from AOF, commands:', this.aofLog.length);
      return true;
    }

    /**
     * 记录 AOF 命令
     */
    recordAOF(command: string, args: any[]): void {
      if (!this.aofEnabled) return;
      
      this.aofLog.push({
        timestamp: Date.now(),
        command,
        args,
      });
    }
  };
}
