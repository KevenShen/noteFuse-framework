/**
 * 24 - JSON 操作 Mixin
 * 包含：jsonGet、jsonSet、jsonPush、jsonPull
 */
import type { FlatItem } from '../types/base.types';
import type { JsonPath } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithJson<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 获取 JSON 字段值 */
    jsonGet(id: number | string, path: JsonPath): any {
      const item = (this as any).findById(id);
      if (!item) return null;
      return this.getNestedValue(item, path);
    }

    /** 设置 JSON 字段值 */
    jsonSet(id: number | string, path: JsonPath, value: any): boolean {
      const item = (this as any).findById(id);
      if (!item) return false;
      this.setNestedValue(item, path, value);
      return true;
    }

    /** JSON 数组追加元素 */
    jsonPush(id: number | string, path: JsonPath, value: any): boolean {
      const item = (this as any).findById(id);
      if (!item) return false;
      const arr = this.getNestedValue(item, path);
      if (Array.isArray(arr)) { arr.push(value); return true; }
      return false;
    }

    /** JSON 数组移除元素 */
    jsonPull(id: number | string, path: JsonPath, value: any): boolean {
      const item = (this as any).findById(id);
      if (!item) return false;
      const arr = this.getNestedValue(item, path);
      if (Array.isArray(arr)) {
        const index = arr.indexOf(value);
        if (index >= 0) { arr.splice(index, 1); return true; }
      }
      return false;
    }

    /** 获取嵌套值（内部方法） */
    private getNestedValue(obj: any, path: string): any {
      return path.split('.').reduce((current, key) => {
        if (current == null) return undefined;
        if (key.includes('[')) {
          const match = key.match(/(\w+)\[(\d+)\]/);
          if (match) return current[match[1]]?.[parseInt(match[2])];
        }
        return current[key];
      }, obj);
    }

    /** 设置嵌套值（内部方法） */
    private setNestedValue(obj: any, path: string, value: any): void {
      const keys = path.split('.');
      let current = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]] === undefined) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    }
  };
}
