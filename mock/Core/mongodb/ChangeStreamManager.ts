/**
 * 变更流管理器
 * 管理所有活跃的变更流，负责事件分发
 */
import type { ChangeEvent, Document } from './types';
import { ChangeStream } from './ChangeStream';

export class ChangeStreamManager {
  private streams: Set<ChangeStream<any>> = new Set();
  private eventCounter: number = 0;

  register(stream: ChangeStream<any>): void {
    this.streams.add(stream);
  }

  unregister(stream: ChangeStream<any>): void {
    this.streams.delete(stream);
  }

  generateEventId(): string {
    this.eventCounter++;
    return `${Date.now().toString(16)}_${this.eventCounter.toString(16).padStart(8, '0')}`;
  }

  emit<T extends Document>(event: ChangeEvent<T>): void {
    for (const stream of this.streams) {
      if (!stream.isClosed()) {
        stream.emit(event);
      }
    }
  }

  getStreamCount(): number {
    return this.streams.size;
  }

  closeAll(): void {
    for (const stream of this.streams) {
      stream.close();
    }
    this.streams.clear();
  }
}

/** 全局变更流管理器单例 */
export const changeStreamManager = new ChangeStreamManager();
