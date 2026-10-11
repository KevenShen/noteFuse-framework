/**
 * L3 聚合表达式 Mixin
 * 包含：evaluateExpression、evaluateGroupExpression、resolveValue、
 *       applyProjectionStage、aggregateGroup、aggregateUnwind、aggregateLookup
 */
import type { Document } from '../types';
import { getNestedValue, setNestedValue, unsetNestedValue, deepEqual } from '../utils';
import { mongodb } from '../MockMongoDB';
import type { MixinConstructor } from './mixin.types';

export function WithExpression<T extends MixinConstructor>(Base: T) {
  return class ExpressionMixin extends Base {
    /** 应用 $project 阶段（支持包含模式和排除模式） */
    protected applyProjectionStage(doc: any, projection: object): any {
      const entries = Object.entries(projection);
      const hasInclude = entries.some(([, v]) => v === 1);
      const hasExclude = entries.some(([, v]) => v === 0);

      // 包含模式：只保留指定字段
      if (hasInclude) {
        const result: any = {};
        // 默认包含 _id，除非明确排除
        const idExcluded = (projection as any)._id === 0;
        if (!idExcluded) {
          result._id = doc._id;
        }
        for (const [field, value] of entries) {
          if (field === '_id') continue;
          if (value === 1) {
            const fieldValue = getNestedValue(doc, field);
            if (fieldValue !== undefined) {
              setNestedValue(result, field, fieldValue);
            }
          } else if (typeof value === 'object') {
            // 聚合表达式
            setNestedValue(result, field, this.evaluateExpression(value, doc));
          }
        }
        return result;
      }

      // 排除模式：复制所有字段，然后排除指定字段
      if (hasExclude) {
        const result = { ...doc };
        for (const [field, value] of entries) {
          if (value === 0) {
            unsetNestedValue(result, field);
          } else if (typeof value === 'object') {
            // 排除模式下也可以添加计算字段
            setNestedValue(result, field, this.evaluateExpression(value, doc));
          }
        }
        return result;
      }

      // 纯表达式模式
      const result: any = {};
      for (const [field, value] of entries) {
        if (typeof value === 'object') {
          setNestedValue(result, field, this.evaluateExpression(value, doc));
        } else {
          setNestedValue(result, field, value);
        }
      }
      return result;
    }

    /** 解析字段引用或字面量 */
    protected resolveValue(expr: any, doc: any): any {
      if (typeof expr === 'string' && expr.startsWith('$')) {
        return getNestedValue(doc, expr.substring(1));
      }
      return expr;
    }

    /** 计算聚合表达式 */
    protected evaluateExpression(expr: any, doc: any): any {
      if (expr === null || expr === undefined) return expr;
      if (typeof expr === 'string') {
        if (expr.startsWith('$$')) {
          // 系统变量
          const varName = expr.substring(2);
          if (varName === 'NOW') return new Date();
          if (varName === 'ROOT') return doc;
          if (varName === 'CURRENT') return doc;
          return undefined;
        }
        if (expr.startsWith('$')) {
          return getNestedValue(doc, expr.substring(1));
        }
        return expr;
      }
      if (Array.isArray(expr)) {
        return expr.map(item => this.evaluateExpression(item, doc));
      }
      if (typeof expr === 'object') {
        const keys = Object.keys(expr);
        if (keys.length === 1 && keys[0].startsWith('$')) {
          const op = keys[0];
          const value = (expr as any)[op];
          switch (op) {
            case '$add':
              return (Array.isArray(value) ? value : [value]).reduce((sum: number, v: any) =>
                sum + Number(this.evaluateExpression(v, doc)), 0);
            case '$subtract':
              return Number(this.evaluateExpression(value[0], doc)) - Number(this.evaluateExpression(value[1], doc));
            case '$multiply':
              return (Array.isArray(value) ? value : [value]).reduce((prod: number, v: any) =>
                prod * Number(this.evaluateExpression(v, doc)), 1);
            case '$divide':
              return Number(this.evaluateExpression(value[0], doc)) / Number(this.evaluateExpression(value[1], doc));
            case '$mod':
              return Number(this.evaluateExpression(value[0], doc)) % Number(this.evaluateExpression(value[1], doc));
            case '$concat':
              return (Array.isArray(value) ? value : [value]).map((v: any) =>
                String(this.evaluateExpression(v, doc))).join('');
            case '$toUpper':
              return String(this.evaluateExpression(value, doc)).toUpperCase();
            case '$toLower':
              return String(this.evaluateExpression(value, doc)).toLowerCase();
            case '$strLenCP':
              return String(this.evaluateExpression(value, doc)).length;
            case '$trim':
              return String(this.evaluateExpression(value, doc)).trim();
            case '$size':
              const arr = this.evaluateExpression(value, doc);
              return Array.isArray(arr) ? arr.length : 0;
            case '$arrayElemAt':
              const array = this.evaluateExpression(value[0], doc);
              const index = Number(this.evaluateExpression(value[1], doc));
              return Array.isArray(array) ? array[index] : undefined;
            case '$ifNull':
              const val = this.evaluateExpression(value[0], doc);
              return val === null || val === undefined ? this.evaluateExpression(value[1], doc) : val;
            case '$cond':
              if (Array.isArray(value)) {
                const condition = this.evaluateExpression(value[0], doc);
                return condition ? this.evaluateExpression(value[1], doc) : this.evaluateExpression(value[2], doc);
              }
              const { if: cond, then: thenVal, else: elseVal } = value;
              return this.evaluateExpression(cond, doc) ? this.evaluateExpression(thenVal, doc) : this.evaluateExpression(elseVal, doc);
            case '$eq':
              return deepEqual(this.evaluateExpression(value[0], doc), this.evaluateExpression(value[1], doc));
            case '$ne':
              return !deepEqual(this.evaluateExpression(value[0], doc), this.evaluateExpression(value[1], doc));
            case '$gt':
              return this.evaluateExpression(value[0], doc) > this.evaluateExpression(value[1], doc);
            case '$gte':
              return this.evaluateExpression(value[0], doc) >= this.evaluateExpression(value[1], doc);
            case '$lt':
              return this.evaluateExpression(value[0], doc) < this.evaluateExpression(value[1], doc);
            case '$lte':
              return this.evaluateExpression(value[0], doc) <= this.evaluateExpression(value[1], doc);
            case '$and':
              return (Array.isArray(value) ? value : [value]).every((v: any) => Boolean(this.evaluateExpression(v, doc)));
            case '$or':
              return (Array.isArray(value) ? value : [value]).some((v: any) => Boolean(this.evaluateExpression(v, doc)));
            case '$not':
              return !this.evaluateExpression(value, doc);
            case '$sum':
              if (Array.isArray(value)) {
                return value.reduce((sum: number, v: any) => sum + Number(this.evaluateExpression(v, doc)), 0);
              }
              return Number(this.evaluateExpression(value, doc)) || 0;
            case '$avg':
              if (Array.isArray(value)) {
                const vals = value.map((v: any) => Number(this.evaluateExpression(v, doc))).filter(v => !isNaN(v));
                return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
              }
              return Number(this.evaluateExpression(value, doc)) || 0;
            case '$min':
              if (Array.isArray(value)) {
                const vals = value.map((v: any) => this.evaluateExpression(v, doc));
                return vals.length > 0 ? Math.min(...vals) : undefined;
              }
              return this.evaluateExpression(value, doc);
            case '$max':
              if (Array.isArray(value)) {
                const vals = value.map((v: any) => this.evaluateExpression(v, doc));
                return vals.length > 0 ? Math.max(...vals) : undefined;
              }
              return this.evaluateExpression(value, doc);
            case '$abs':
              return Math.abs(Number(this.evaluateExpression(value, doc)));
            case '$ceil':
              return Math.ceil(Number(this.evaluateExpression(value, doc)));
            case '$floor':
              return Math.floor(Number(this.evaluateExpression(value, doc)));
            case '$round':
              const num = Number(this.evaluateExpression(value[0], doc));
              const places = value[1] !== undefined ? Number(this.evaluateExpression(value[1], doc)) : 0;
              const factor = Math.pow(10, places);
              return Math.round(num * factor) / factor;
            case '$sqrt':
              return Math.sqrt(Number(this.evaluateExpression(value, doc)));
            case '$pow':
              return Math.pow(Number(this.evaluateExpression(value[0], doc)), Number(this.evaluateExpression(value[1], doc)));
            case '$year':
              return new Date(this.evaluateExpression(value, doc)).getFullYear();
            case '$month':
              return new Date(this.evaluateExpression(value, doc)).getMonth() + 1;
            case '$dayOfMonth':
              return new Date(this.evaluateExpression(value, doc)).getDate();
            case '$hour':
              return new Date(this.evaluateExpression(value, doc)).getHours();
            case '$minute':
              return new Date(this.evaluateExpression(value, doc)).getMinutes();
            case '$second':
              return new Date(this.evaluateExpression(value, doc)).getSeconds();
            case '$dateToString':
              const date = new Date(this.evaluateExpression(value.date, doc));
              const format = value.format || '%Y-%m-%d';
              return format
                .replace('%Y', String(date.getFullYear()))
                .replace('%m', String(date.getMonth() + 1).padStart(2, '0'))
                .replace('%d', String(date.getDate()).padStart(2, '0'))
                .replace('%H', String(date.getHours()).padStart(2, '0'))
                .replace('%M', String(date.getMinutes()).padStart(2, '0'))
                .replace('%S', String(date.getSeconds()).padStart(2, '0'));
            default:
              // 未知操作符，返回原值
              return expr;
          }
        }
        // 普通对象，递归计算
        const result: any = {};
        for (const [key, val] of Object.entries(expr)) {
          result[key] = this.evaluateExpression(val, doc);
        }
        return result;
      }
      return expr;
    }

    /** 计算分组聚合表达式 */
    protected evaluateGroupExpression(expr: any, docs: any[]): any {
      const [op, value] = Object.entries(expr)[0];

      switch (op) {
        case '$sum':
          if (value === 1) return docs.length;
          if (typeof value === 'string' && value.startsWith('$')) {
            const field = value.substring(1);
            return docs.reduce((sum, doc) => sum + (Number(getNestedValue(doc, field)) || 0), 0);
          }
          if (Array.isArray(value)) {
            return docs.reduce((sum, doc) => {
              const vals = value.map((v: any) => this.evaluateExpression(v, doc));
              return sum + vals.reduce((a: number, b: number) => a + Number(b), 0);
            }, 0);
          }
          return 0;
        case '$avg':
          if (typeof value === 'string' && value.startsWith('$')) {
            const field = value.substring(1);
            const vals = docs.map(doc => Number(getNestedValue(doc, field))).filter(v => !isNaN(v));
            return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          }
          return 0;
        case '$min':
          if (typeof value === 'string' && value.startsWith('$')) {
            const field = value.substring(1);
            const vals = docs.map(doc => getNestedValue(doc, field)).filter(v => v !== undefined);
            return vals.length > 0 ? Math.min(...vals) : undefined;
          }
          return undefined;
        case '$max':
          if (typeof value === 'string' && value.startsWith('$')) {
            const field = value.substring(1);
            const vals = docs.map(doc => getNestedValue(doc, field)).filter(v => v !== undefined);
            return vals.length > 0 ? Math.max(...vals) : undefined;
          }
          return undefined;
        case '$first':
          if (typeof value === 'string' && value.startsWith('$')) {
            const field = value.substring(1);
            return docs.length > 0 ? getNestedValue(docs[0], field) : undefined;
          }
          return docs.length > 0 ? docs[0] : undefined;
        case '$last':
          if (typeof value === 'string' && value.startsWith('$')) {
            const field = value.substring(1);
            return docs.length > 0 ? getNestedValue(docs[docs.length - 1], field) : undefined;
          }
          return docs.length > 0 ? docs[docs.length - 1] : undefined;
        case '$push':
          if (typeof value === 'string' && value.startsWith('$')) {
            const field = value.substring(1);
            return docs.map(doc => getNestedValue(doc, field));
          }
          return docs.map(doc => this.evaluateExpression(value, doc));
        case '$addToSet':
          if (typeof value === 'string' && value.startsWith('$')) {
            const field = value.substring(1);
            const set = new Set<string>();
            const result: any[] = [];
            for (const doc of docs) {
              const val = getNestedValue(doc, field);
              const key = JSON.stringify(val);
              if (!set.has(key)) {
                set.add(key);
                result.push(val);
              }
            }
            return result;
          }
          const set = new Set<string>();
          const result: any[] = [];
          for (const doc of docs) {
            const val = this.evaluateExpression(value, doc);
            const key = JSON.stringify(val);
            if (!set.has(key)) {
              set.add(key);
              result.push(val);
            }
          }
          return result;
        case '$count':
          return docs.length;
        default:
          return undefined;
      }
    }

    /** $group 阶段 */
    protected aggregateGroup(docs: any[], groupConfig: any): any[] {
      const groups = new Map<string, any[]>();

      for (const doc of docs) {
        let groupKey: string;
        if (groupConfig._id === null) {
          groupKey = 'null';
        } else if (typeof groupConfig._id === 'string' && groupConfig._id.startsWith('$')) {
          groupKey = JSON.stringify(getNestedValue(doc, groupConfig._id.substring(1)));
        } else if (typeof groupConfig._id === 'object') {
          groupKey = JSON.stringify(this.evaluateExpression(groupConfig._id, doc));
        } else {
          groupKey = JSON.stringify(groupConfig._id);
        }

        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(doc);
      }

      const result: any[] = [];
      for (const [key, groupDocs] of groups.entries()) {
        const item: any = {
          _id: key === 'null' ? null : JSON.parse(key),
        };

        for (const [field, expr] of Object.entries(groupConfig)) {
          if (field === '_id') continue;
          if (typeof expr === 'object') {
            item[field] = this.evaluateGroupExpression(expr, groupDocs);
          }
        }

        result.push(item);
      }

      return result;
    }

    /** 增强 $unwind 阶段（支持对象形式配置） */
    protected aggregateUnwind(docs: any[], config: any): any[] {
      // 字符串形式：{ $unwind: '$tags' }
      if (typeof config === 'string') {
        const field = config.replace('$', '');
        const unwound: any[] = [];
        for (const doc of docs) {
          const arr = getNestedValue(doc, field);
          if (Array.isArray(arr)) {
            for (const item of arr) {
              unwound.push({ ...doc, [field]: item });
            }
          }
        }
        return unwound;
      }

      // 对象形式：{ $unwind: { path: '$tags', includeArrayIndex: 'index', preserveNullAndEmptyArrays: true } }
      const path = (config.path as string).replace('$', '');
      const includeArrayIndex = config.includeArrayIndex;
      const preserveNullAndEmptyArrays = config.preserveNullAndEmptyArrays || false;

      const unwound: any[] = [];
      for (const doc of docs) {
        const arr = getNestedValue(doc, path);
        if (Array.isArray(arr) && arr.length > 0) {
          arr.forEach((item, index) => {
            const newDoc = { ...doc, [path]: item };
            if (includeArrayIndex) {
              newDoc[includeArrayIndex] = index;
            }
            unwound.push(newDoc);
          });
        } else if (preserveNullAndEmptyArrays) {
          // 保留空数组或非数组的文档
          const newDoc = { ...doc };
          if (includeArrayIndex) {
            newDoc[includeArrayIndex] = null;
          }
          unwound.push(newDoc);
        }
      }
      return unwound;
    }

    /** $lookup 关联查询阶段 */
    protected async aggregateLookup(docs: any[], config: any): Promise<any[]> {
      const {
        from,           // 关联的集合名
        localField,     // 本地字段
        foreignField,   // 外部字段
        as,             // 输出字段名
        pipeline,       // 子管道（可选）
        let: letVars,   // 变量定义（可选）
      } = config;

      // 获取关联集合
      const foreignCollection = mongodb.collection(from);

      return Promise.all(docs.map(async doc => {
        const localValue = getNestedValue(doc, localField);
        let matchedDocs: any[];

        if (pipeline) {
          // 使用子管道进行关联查询
          let subPipeline = [...pipeline];

          // 如果有 $match 阶段，添加 localField 匹配条件
          matchedDocs = await foreignCollection.aggregate(subPipeline);

          // 过滤出匹配的文档
          matchedDocs = matchedDocs.filter((foreignDoc: any) => {
            const foreignValue = getNestedValue(foreignDoc, foreignField);
            if (Array.isArray(localValue)) {
              return localValue.some((v: any) => deepEqual(v, foreignValue));
            }
            return deepEqual(localValue, foreignValue);
          });
        } else {
          // 简单等值匹配
          if (Array.isArray(localValue)) {
            // 本地字段是数组，匹配数组中任意值
            matchedDocs = (await foreignCollection.find({}).toArray()).filter((foreignDoc: any) => {
              const foreignValue = getNestedValue(foreignDoc, foreignField);
              return localValue.some((v: any) => deepEqual(v, foreignValue));
            });
          } else {
            // 简单等值匹配
            const query: any = {};
            query[foreignField] = localValue;
            matchedDocs = await foreignCollection.find(query).toArray();
          }
        }

        return {
          ...doc,
          [as]: matchedDocs,
        };
      }));
    }
  };
}
