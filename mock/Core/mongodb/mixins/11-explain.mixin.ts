/**
 * L6 EXPLAIN 执行计划 Mixin
 * 包含：explain、findUsableIndex、getIndexEntries、isCoveredIndex
 */
import type { Document, FilterQuery, FindOptions, QueryPlan, IndexInfo } from '../types';
import type { ObjectId } from '../ObjectId';
import { matchDocument } from '../utils';
import type { MixinConstructor } from './mixin.types';

export function WithExplain<T extends MixinConstructor>(Base: T) {
  return class ExplainMixin extends Base {
    /**
     * 分析查询计划
     * 返回查询执行计划，包括是否使用索引、扫描文档数等
     */
    explain(query: FilterQuery<T>, options?: FindOptions): QueryPlan {
      const startTime = Date.now();

      // 查找可用索引
      const usableIndex = this.findUsableIndex(query);
      const indexUsed = !!usableIndex;

      let docsExamined = 0;
      let docsMatched = 0;

      if (indexUsed && usableIndex) {
        // 使用索引扫描
        const indexEntries = this.getIndexEntries(usableIndex.name, query);
        docsExamined = indexEntries.length;
        docsMatched = indexEntries.filter(id => {
          const doc = (this as any).documents.get(String(id));
          return doc ? matchDocument(doc, query) : false;
        }).length;
      } else {
        // 全集合扫描
        docsExamined = (this as any).documents.size;
        docsMatched = Array.from((this as any).documents.values()).filter((d: any) => matchDocument(d, query)).length;
      }

      const executionTime = Date.now() - startTime;

      // 构建查询计划
      let plan: QueryPlan = {
        stage: indexUsed ? 'IXSCAN' : 'COLLSCAN',
        filter: query,
        indexName: usableIndex?.name,
        indexKeys: usableIndex?.keys,
        docsExamined,
        docsMatched,
        docsReturned: options?.limit ? Math.min(docsMatched, options.limit) : docsMatched,
        indexUsed,
        isCovered: indexUsed && !!options?.projection && this.isCoveredIndex(usableIndex!, options.projection),
        executionTimeMS: executionTime,
      };

      // 添加排序阶段
      if (options?.sort) {
        plan = {
          stage: 'SORT',
          sortKey: options.sort,
          docsExamined,
          docsMatched,
          docsReturned: plan.docsReturned,
          indexUsed,
          isCovered: false,
          executionTimeMS: executionTime,
          inputStage: plan,
        };
      }

      // 添加跳过阶段
      if (options?.skip) {
        plan = {
          stage: 'SKIP',
          skip: options.skip,
          docsExamined,
          docsMatched,
          docsReturned: Math.max(0, plan.docsReturned - options.skip),
          indexUsed,
          isCovered: plan.isCovered,
          executionTimeMS: executionTime,
          inputStage: plan,
        };
      }

      // 添加限制阶段
      if (options?.limit) {
        plan = {
          stage: 'LIMIT',
          limit: options.limit,
          docsExamined,
          docsMatched,
          docsReturned: Math.min(plan.docsReturned, options.limit),
          indexUsed,
          isCovered: plan.isCovered,
          executionTimeMS: executionTime,
          inputStage: plan,
        };
      }

      // 添加投影阶段
      if (options?.projection) {
        plan = {
          stage: 'PROJECTION',
          projection: options.projection,
          docsExamined,
          docsMatched,
          docsReturned: plan.docsReturned,
          indexUsed,
          isCovered: plan.isCovered,
          executionTimeMS: executionTime,
          inputStage: plan,
        };
      }

      return plan;
    }

    /** 查找可用索引 */
    protected findUsableIndex(query: FilterQuery<T>): IndexInfo | null {
      for (const index of (this as any).indexes.values()) {
        if (index.name === '_id_') continue; // _id 索引特殊处理

        const indexKeys = Object.keys(index.keys);
        const queryKeys = Object.keys(query).filter(k => !k.startsWith('$'));

        // 检查索引前缀是否匹配查询条件
        const hasPrefixMatch = indexKeys.some((key: string) => queryKeys.includes(key));
        if (hasPrefixMatch) {
          return index;
        }
      }
      return null;
    }

    /** 获取索引条目 */
    protected getIndexEntries(indexName: string, query: FilterQuery<T>): (ObjectId | string)[] {
      const results: (ObjectId | string)[] = [];
      for (const doc of (this as any).documents.values()) {
        results.push(doc._id as ObjectId);
      }
      return results;
    }

    /** 检查是否为覆盖索引 */
    protected isCoveredIndex(index: IndexInfo, projection: object): boolean {
      const indexKeys = new Set(Object.keys(index.keys));
      const projectionKeys = Object.keys(projection);
      return projectionKeys.every(key => indexKeys.has(key) || key === '_id');
    }
  };
}
