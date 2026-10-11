/**
 * MockMongoCollection 基类
 * 包含核心属性、构造函数和基础工具方法
 * 所有功能通过 Mixin 组合扩展
 */
import type { Document, OptionalId, IndexInfo } from './types';
import type { MongoAsyncConfig, ResolvedAsyncDelayConfig, AsyncMongoStats } from './types';
import { ObjectId } from './ObjectId';
import { changeStreamManager } from './ChangeStreamManager';
import type { ChangeOperationType, ChangeEvent } from './types';
import { resolveAsyncDelayConfig, createAsyncStats } from './utils';

export class MockMongoCollectionBase<T extends Document> {
  // ==================== 核心属性 ====================
  protected name: string;
  protected documents: Map<string, T>;
  protected indexes: Map<string, IndexInfo>;

  // ==================== 异步模式属性 ====================
  /** 异步延迟配置（启用异步模式时存在） */
  protected asyncConfig?: ResolvedAsyncDelayConfig;
  /** 异步操作统计（启用异步模式时存在） */
  protected asyncStats?: AsyncMongoStats;

  constructor(name: string, initialData?: T[], asyncConfig?: MongoAsyncConfig) {
    this.name = name;
    this.documents = new Map();
    this.indexes = new Map();

    // 解析异步配置
    if (asyncConfig?.async) {
      this.asyncConfig = resolveAsyncDelayConfig(asyncConfig.asyncConfig);
      this.asyncStats = createAsyncStats();
    }

    // 导入初始数据
    if (initialData && initialData.length > 0) {
      for (const doc of initialData) {
        this.insertDocument(doc);
      }
    }
  }

  // ==================== 异步模式方法 ====================

  /**
   * 判断是否为异步模式
   * @returns 是否启用异步模式
   */
  isAsyncMode(): boolean {
    return !!this.asyncConfig;
  }

  /**
   * 获取异步操作统计
   * @returns 异步操作统计（未启用异步模式时返回 null）
   */
  getAsyncStats(): AsyncMongoStats | null {
    return this.asyncStats ?? null;
  }

  /** 插入文档（内部方法） */
  protected insertDocument(doc: OptionalId<T>): T {
    const newDoc = { ...doc } as T;
    if (!newDoc._id) {
      newDoc._id = new ObjectId();
    } else if (typeof newDoc._id === 'string') {
      newDoc._id = new ObjectId(newDoc._id);
    }
    const id = newDoc._id.toString();
    this.documents.set(id, newDoc);
    return newDoc;
  }

  /** 触发变更事件（内部方法） */
  protected emitChangeEvent(
    operationType: ChangeOperationType,
    documentKey?: { _id: ObjectId | string },
    fullDocument?: T,
    updateDescription?: ChangeEvent<T>['updateDescription']
  ): void {
    const event: ChangeEvent<T> = {
      _id: { _data: changeStreamManager.generateEventId() },
      operationType,
      ns: { db: 'mock', coll: this.name },
      documentKey,
      fullDocument,
      updateDescription,
      timestamp: new Date(),
      clusterTime: new Date(),
    };
    changeStreamManager.emit(event);
  }
}
