/**
 * 29 - 增量备份和时间点恢复 Mixin
 * 包含：createBackup、restoreBackup、listBackups、deleteBackup、pointInTimeRecovery
 */
import type { FlatItem } from '../types/base.types';
import type { BackupInfo, BackupOptions } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithBackup<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 创建备份 */
    createBackup(options?: BackupOptions): BackupInfo {
      const backup: BackupInfo = {
        id: `backup_${Date.now()}`,
        tableName: (this as any).getTableName(),
        type: options?.type || 'full',
        timestamp: new Date(),
        data: JSON.parse(JSON.stringify((this as any).data)),
        recordCount: (this as any).data.length,
        size: JSON.stringify((this as any).data).length,
      };
      (this as any).backups.push(backup);
      if ((this as any).backups.length > (options?.maxBackups || 10)) {
        (this as any).backups.shift();
      }
      return backup;
    }

    /** 恢复备份 */
    restoreBackup(backupId: string): boolean {
      const backup = (this as any).backups.find((b: BackupInfo) => b.id === backupId);
      if (!backup) return false;
      (this as any).data = JSON.parse(JSON.stringify(backup.data));
      return true;
    }

    /** 列出所有备份 */
    listBackups(): BackupInfo[] {
      return [...(this as any).backups].sort((a: BackupInfo, b: BackupInfo) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }

    /** 删除备份 */
    deleteBackup(backupId: string): boolean {
      const index = (this as any).backups.findIndex((b: BackupInfo) => b.id === backupId);
      if (index >= 0) { (this as any).backups.splice(index, 1); return true; }
      return false;
    }

    /** 时间点恢复（基于 Binlog） */
    pointInTimeRecovery(targetTime: Date): boolean {
      const backups = this.listBackups();
      const baseBackup = backups.find((b: BackupInfo) => new Date(b.timestamp) <= targetTime);
      if (!baseBackup) return false;
      
      (this as any).data = JSON.parse(JSON.stringify(baseBackup.data));
      
      const eventsAfterBackup = (this as any).getBinlog({ since: new Date(baseBackup.timestamp) })
        .filter((e: any) => new Date(e.timestamp) <= targetTime);
      
      for (const event of eventsAfterBackup) {
        if (event.operation === 'INSERT') (this as any).data.push(event.data);
        else if (event.operation === 'UPDATE') {
          const index = (this as any).data.findIndex((item: any) => item.id === event.data.id);
          if (index >= 0) (this as any).data[index] = { ...(this as any).data[index], ...event.data };
        } else if (event.operation === 'DELETE') {
          (this as any).data = (this as any).data.filter((item: any) => item.id !== event.data.id);
        }
      }
      return true;
    }
  };
}
