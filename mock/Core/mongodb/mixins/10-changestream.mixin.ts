/**
 * L5 变更流支持 Mixin
 * 包含：watch
 */
import type { Document, ChangeStreamOptions, ChangeEvent } from '../types';
import { ChangeStream } from '../ChangeStream';
import { changeStreamManager } from '../ChangeStreamManager';
import { matchDocument } from '../utils';
import type { MixinConstructor } from './mixin.types';

export function WithChangeStream<T extends MixinConstructor>(Base: T) {
  return class ChangeStreamMixin extends Base {
    /**
     * 创建变更流
     * 监听集合的变化（插入、更新、删除等）
     */
    watch(
      pipeline?: object[],
      options?: ChangeStreamOptions
    ): ChangeStream<T> {
      // 构建过滤函数（基于 pipeline 中的 $match 阶段）
      let filter: ((event: ChangeEvent<T>) => boolean) | undefined;
      if (pipeline && pipeline.length > 0) {
        const matchStage = pipeline.find(s => '$match' in s) as { $match?: any };
        if (matchStage?.$match) {
          const matchQuery = matchStage.$match;
          filter = (event: ChangeEvent<T>) => {
            if (matchQuery.operationType && event.operationType !== matchQuery.operationType) {
              return false;
            }
            if (matchQuery.fullDocument && event.fullDocument) {
              return matchDocument(event.fullDocument, matchQuery.fullDocument);
            }
            return true;
          };
        }
      }

      const stream = new ChangeStream<T>((this as any).name, options, filter);
      changeStreamManager.register(stream);
      return stream;
    }
  };
}
