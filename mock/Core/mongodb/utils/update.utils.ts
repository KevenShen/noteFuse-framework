/**
 * 更新操作符工具函数
 * 包含：applyUpdate
 */
import type { Document, UpdateQuery } from '../types';
import { deepEqual, getNestedValue, setNestedValue, unsetNestedValue } from './index';

/**
 * 应用更新操作符到文档
 * 支持：$set、$unset、$inc、$mul、$rename、$min、$max、$push、$pull、$addToSet、$pop
 */
export function applyUpdate(doc: Document, update: UpdateQuery<any>): boolean {
  let modified = false;

  for (const [operator, value] of Object.entries(update)) {
    switch (operator) {
      case '$set':
        for (const [field, val] of Object.entries(value as object)) {
          const current = getNestedValue(doc, field);
          if (!deepEqual(current, val)) {
            setNestedValue(doc, field, val);
            modified = true;
          }
        }
        break;
      case '$unset':
        for (const field of Object.keys(value as object)) {
          if (getNestedValue(doc, field) !== undefined) {
            unsetNestedValue(doc, field);
            modified = true;
          }
        }
        break;
      case '$inc':
        for (const [field, val] of Object.entries(value as object)) {
          const current = getNestedValue(doc, field) || 0;
          setNestedValue(doc, field, current + (val as number));
          modified = true;
        }
        break;
      case '$mul':
        for (const [field, val] of Object.entries(value as object)) {
          const current = getNestedValue(doc, field) || 0;
          setNestedValue(doc, field, current * (val as number));
          modified = true;
        }
        break;
      case '$rename':
        for (const [oldField, newField] of Object.entries(value as object)) {
          const oldValue = getNestedValue(doc, oldField);
          if (oldValue !== undefined) {
            unsetNestedValue(doc, oldField);
            setNestedValue(doc, newField as string, oldValue);
            modified = true;
          }
        }
        break;
      case '$min':
        for (const [field, val] of Object.entries(value as object)) {
          const current = getNestedValue(doc, field);
          if (current === undefined || val < current) {
            setNestedValue(doc, field, val);
            modified = true;
          }
        }
        break;
      case '$max':
        for (const [field, val] of Object.entries(value as object)) {
          const current = getNestedValue(doc, field);
          if (current === undefined || val > current) {
            setNestedValue(doc, field, val);
            modified = true;
          }
        }
        break;
      case '$push':
        for (const [field, val] of Object.entries(value as object)) {
          const arr = getNestedValue(doc, field);
          if (Array.isArray(arr)) {
            if (val !== null && typeof val === 'object' && '$each' in val) {
              arr.push(...(val as any).$each);
            } else {
              arr.push(val);
            }
            modified = true;
          }
        }
        break;
      case '$pull':
        for (const [field, val] of Object.entries(value as object)) {
          const arr = getNestedValue(doc, field);
          if (Array.isArray(arr)) {
            const initialLength = arr.length;
            for (let i = arr.length - 1; i >= 0; i--) {
              if (deepEqual(arr[i], val)) {
                arr.splice(i, 1);
              }
            }
            if (arr.length !== initialLength) modified = true;
          }
        }
        break;
      case '$addToSet':
        for (const [field, val] of Object.entries(value as object)) {
          const arr = getNestedValue(doc, field);
          if (Array.isArray(arr)) {
            const items = val !== null && typeof val === 'object' && '$each' in val ? (val as any).$each : [val];
            for (const item of items) {
              if (!arr.some(existing => deepEqual(existing, item))) {
                arr.push(item);
                modified = true;
              }
            }
          }
        }
        break;
      case '$pop':
        for (const [field, val] of Object.entries(value as object)) {
          const arr = getNestedValue(doc, field);
          if (Array.isArray(arr) && arr.length > 0) {
            if (val === 1) {
              arr.pop();
            } else {
              arr.shift();
            }
            modified = true;
          }
        }
        break;
      default:
        // 未知操作符，忽略
        break;
    }
  }

  return modified;
}
