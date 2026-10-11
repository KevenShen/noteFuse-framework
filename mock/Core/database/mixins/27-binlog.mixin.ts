/**
 * 27 - Binlog Mixin
 * 包含：getBinlog、getBinlogEvents、clearBinlog
 */
import type { FlatItem } from '../types/base.types';
import type { BinlogEvent, BinlogOptions } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithBinlog<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 获取 Binlog 事件 */
    getBinlog(options?: BinlogOptions): BinlogEvent[] {
      let events = [...(this as any).binlog];
      if (options?.operation) events = events.filter(e => e.operation === options.operation);
      if (options?.since) events = events.filter(e => e.timestamp >= options.since!.getTime());
      if (options?.limit) events = events.slice(-options.limit);
      return events;
    }

    /** 获取 Binlog 事件数量 */
    getBinlogEventCount(): number {
      return (this as any).binlog.length;
    }

    /** 清空 Binlog */
    clearBinlog(): void {
      (this as any).binlog = [];
    }

    /** 记录 Binlog 事件（内部方法） */
    protected logBinlog(operation: string, data: any, before?: any): void {
      if (!(this as any).binlogConfig?.enabled) return;
      const event: BinlogEvent = {
        id: (this as any).binlog.length + 1,
        operation,
        tableName: (this as any).getTableName(),
        data,
        before,
        timestamp: new Date(),
        transactionId: (this as any).activeTransaction?.getId() || null,
      };
      (this as any).binlog.push(event);
      if ((this as any).binlog.length > (this as any).binlogConfig?.maxSize || 10000) {
        (this as any).binlog = (this as any).binlog.slice(-((this as any).binlogConfig?.maxSize || 10000));
      }
    }
  };
}
