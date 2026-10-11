/**
 * L3 聚合管道 Mixin
 * 包含：aggregate（支持15+常用阶段）
 */
import type { Document, FilterQuery } from '../types';
import { matchDocument, getNestedValue, setNestedValue, unsetNestedValue, deepEqual } from '../utils';
import { mongodb } from '../MockMongoDB';
import type { MixinConstructor } from './mixin.types';

export function WithAggregation<T extends MixinConstructor>(Base: T) {
  return class AggregationMixin extends Base {
    /** 聚合查询（完整实现，支持常用阶段和表达式） */
    async aggregate(pipeline: object[]): Promise<any[]> {
      let result: any[] = Array.from((this as any).documents.values());

      for (const stage of pipeline) {
        const [stageKey, stageValue] = Object.entries(stage)[0];

        switch (stageKey) {
          case '$match':
            result = result.filter(doc => matchDocument(doc, stageValue as FilterQuery<any>));
            break;
          case '$sort':
            result.sort((a, b) => {
              for (const [field, order] of Object.entries(stageValue as object)) {
                const aVal = getNestedValue(a, field);
                const bVal = getNestedValue(b, field);
                if (aVal == null && bVal == null) continue;
                if (aVal == null) return 1;
                if (bVal == null) return -1;
                if (aVal < bVal) return order === 1 ? -1 : 1;
                if (aVal > bVal) return order === 1 ? 1 : -1;
              }
              return 0;
            });
            break;
          case '$skip':
            result = result.slice(stageValue as number);
            break;
          case '$limit':
            result = result.slice(0, stageValue as number);
            break;
          case '$project':
            result = result.map(doc => (this as any).applyProjectionStage(doc, stageValue as object));
            break;
          case '$group':
            result = (this as any).aggregateGroup(result, stageValue as any);
            break;
          case '$count':
            result = [{ [stageValue as string]: result.length }];
            break;
          case '$addFields':
          case '$set':
            result = result.map(doc => ({
              ...doc,
              ...Object.fromEntries(
                Object.entries(stageValue as object).map(([field, expr]) => [
                  field,
                  (this as any).evaluateExpression(expr, doc)
                ])
              ),
            }));
            break;
          case '$unset':
            {
              const fields = Array.isArray(stageValue) ? stageValue : [stageValue];
              result = result.map(doc => {
                const newDoc = { ...doc };
                for (const field of fields) {
                  unsetNestedValue(newDoc, field);
                }
                return newDoc;
              });
            }
            break;
          case '$unwind':
            result = (this as any).aggregateUnwind(result, stageValue);
            break;
          case '$lookup':
            result = await (this as any).aggregateLookup(result, stageValue as any);
            break;
          case '$replaceRoot':
          case '$replaceWith':
            result = result.map(doc => {
              const newRoot = stageValue as any;
              if (typeof newRoot === 'object' && 'newRoot' in newRoot) {
                return (this as any).evaluateExpression(newRoot.newRoot, doc);
              }
              return (this as any).evaluateExpression(newRoot, doc);
            });
            break;
          case '$sortByCount':
            {
              const fieldExpr = stageValue as string;
              const groups = new Map<string, number>();
              for (const doc of result) {
                const key = JSON.stringify((this as any).resolveValue(fieldExpr, doc));
                groups.set(key, (groups.get(key) || 0) + 1);
              }
              result = Array.from(groups.entries())
                .map(([key, count]) => ({ _id: JSON.parse(key), count }))
                .sort((a, b) => b.count - a.count);
            }
            break;
          case '$facet':
            {
              const facetConfig = stageValue as Record<string, object[]>;
              const facetResult: Record<string, any[]> = {};
              for (const [outputField, subPipeline] of Object.entries(facetConfig)) {
                // 每个子管道从原始数据开始
                const subCollection = mongodb.collection('_temp', result);
                facetResult[outputField] = await subCollection.aggregate(subPipeline);
              }
              result = [facetResult];
            }
            break;
          case '$sample':
            {
              const size = (stageValue as any).size;
              const shuffled = [...result].sort(() => Math.random() - 0.5);
              result = shuffled.slice(0, size);
            }
            break;
          default:
            // 未知阶段，跳过
            break;
        }
      }

      return result;
    }
  };
}
