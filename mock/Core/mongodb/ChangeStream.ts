/**
 * 变更流类
 * 监听集合的变化（插入、更新、删除等）
 * 支持回调、异步迭代器、next/tryNext 等多种消费方式
 */
import type {
  Document,
  ChangeEvent,
  ChangeStreamOptions,
  ChangeStreamCallback,
  ChangeStreamState,
} from './types';

export class ChangeStream<T extends Document = Document> {
  private id: string;
  private state: ChangeStreamState = 'pending';
  private callbacks: Set<ChangeStreamCallback<T>> = new Set();
  private eventQueue: ChangeEvent<T>[] = [];
  private filter?: (event: ChangeEvent<T>) => boolean;
  private options?: ChangeStreamOptions;
  private collectionName?: string;
  private closed: boolean = false;

  constructor(
    collectionName?: string,
    options?: ChangeStreamOptions,
    filter?: (event: ChangeEvent<T>) => boolean
  ) {
    this.id = `changestream_${Date.now().toString(16)}`;
    this.collectionName = collectionName;
    this.options = options;
    this.filter = filter;
    this.state = 'open';
  }

  on(callback: ChangeStreamCallback<T>): this {
    this.callbacks.add(callback);
    return this;
  }

  once(callback: ChangeStreamCallback<T>): this {
    const wrapper = (event: ChangeEvent<T>) => {
      callback(event);
      this.callbacks.delete(wrapper);
    };
    this.callbacks.add(wrapper);
    return this;
  }

  off(callback: ChangeStreamCallback<T>): this {
    this.callbacks.delete(callback);
    return this;
  }

  removeAllListeners(): this {
    this.callbacks.clear();
    return this;
  }

  emit(event: ChangeEvent<T>): void {
    if (this.closed || this.state !== 'open') return;
    if (this.filter && !this.filter(event)) return;
    if (this.collectionName && event.ns.coll !== this.collectionName) return;

    this.eventQueue.push(event);
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('ChangeStream callback error:', error);
      }
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<ChangeEvent<T>> {
    while (!this.closed) {
      if (this.eventQueue.length > 0) {
        yield this.eventQueue.shift()!;
      } else {
        await new Promise(resolve => setTimeout(resolve, this.options?.maxAwaitTimeMS || 100));
      }
    }
    while (this.eventQueue.length > 0) {
      yield this.eventQueue.shift()!;
    }
  }

  async next(): Promise<ChangeEvent<T> | null> {
    while (!this.closed) {
      if (this.eventQueue.length > 0) {
        return this.eventQueue.shift()!;
      }
      await new Promise(resolve => setTimeout(resolve, this.options?.maxAwaitTimeMS || 100));
    }
    return null;
  }

  tryNext(): ChangeEvent<T> | null {
    return this.eventQueue.length > 0 ? this.eventQueue.shift()! : null;
  }

  hasNext(): boolean {
    return this.eventQueue.length > 0;
  }

  close(): void {
    this.closed = true;
    this.state = 'closed';
    this.callbacks.clear();
  }

  getId(): string { return this.id; }
  getState(): ChangeStreamState { return this.state; }
  isClosed(): boolean { return this.closed; }
  queueSize(): number { return this.eventQueue.length; }

  getResumeToken(): { _data: string } | null {
    return this.eventQueue.length > 0 ? this.eventQueue[this.eventQueue.length - 1]._id : null;
  }
}
