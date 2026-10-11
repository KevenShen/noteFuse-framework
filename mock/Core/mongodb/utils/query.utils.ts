/**
 * 查询操作符工具函数
 * 包含：matchFieldValue、deepEqual、matchDocument
 */
import type { Document, FilterQuery } from '../types';
import { ObjectId } from '../ObjectId';
import { getNestedValue } from './nested.utils';

/**
 * 匹配单个字段值
 * 支持：精确匹配、$eq、$ne、$gt、$gte、$lt、$lte、$in、$nin、$exists
 */
export function matchFieldValue(docValue: any, queryValue: any): boolean {
  // 如果查询值是对象，可能包含操作符
  if (
    queryValue !== null &&
    typeof queryValue === 'object' &&
    !Array.isArray(queryValue) &&
    !(queryValue instanceof ObjectId) &&
    !(queryValue instanceof Date)
  ) {
    const keys = Object.keys(queryValue);
    const hasOperator = keys.some(k => k.startsWith('$'));

    if (hasOperator) {
      for (const key of keys) {
        const opValue = queryValue[key];
        switch (key) {
          case '$eq':
            if (!deepEqual(docValue, opValue)) return false;
            break;
          case '$ne':
            if (deepEqual(docValue, opValue)) return false;
            break;
          case '$gt':
            if (!(docValue > opValue)) return false;
            break;
          case '$gte':
            if (!(docValue >= opValue)) return false;
            break;
          case '$lt':
            if (!(docValue < opValue)) return false;
            break;
          case '$lte':
            if (!(docValue <= opValue)) return false;
            break;
          case '$in':
            if (!Array.isArray(opValue) || !opValue.some(v => deepEqual(docValue, v))) return false;
            break;
          case '$nin':
            if (!Array.isArray(opValue) || opValue.some(v => deepEqual(docValue, v))) return false;
            break;
          case '$exists':
            const exists = docValue !== undefined;
            if (exists !== opValue) return false;
            break;
          default:
            // 未知操作符，忽略
            break;
        }
      }
      return true;
    }
  }

  // 精确匹配
  return deepEqual(docValue, queryValue);
}

/** 深度比较两个值是否相等 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a instanceof ObjectId && b instanceof ObjectId) return a.equals(b);
  if (a instanceof ObjectId) return a.toString() === String(b);
  if (b instanceof ObjectId) return String(a) === b.toString();
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => deepEqual(a[key], b[key]));
}

/**
 * 匹配文档是否符合查询条件
 * 支持：字段匹配、$and、$or、$not、$nor
 */
export function matchDocument(doc: Document, query: FilterQuery<any>): boolean {
  if (!query || Object.keys(query).length === 0) return true;

  for (const [key, value] of Object.entries(query)) {
    if (key === '$and') {
      if (!Array.isArray(value) || !value.every((q: FilterQuery<any>) => matchDocument(doc, q))) return false;
    } else if (key === '$or') {
      if (!Array.isArray(value) || !value.some((q: FilterQuery<any>) => matchDocument(doc, q))) return false;
    } else if (key === '$not') {
      if (matchDocument(doc, value as FilterQuery<any>)) return false;
    } else if (key === '$nor') {
      if (!Array.isArray(value) || value.some((q: FilterQuery<any>) => matchDocument(doc, q))) return false;
    } else {
      // 普通字段匹配
      const docValue = getNestedValue(doc, key);
      if (!matchFieldValue(docValue, value)) return false;
    }
  }
  return true;
}
