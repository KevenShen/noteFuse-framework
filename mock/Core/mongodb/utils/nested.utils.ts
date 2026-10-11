/**
 * 嵌套字段工具函数
 * 包含：getNestedValue、setNestedValue、unsetNestedValue
 */

/** 获取嵌套字段值（支持点号路径，如 "user.name"） */
export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[key];
  }, obj);
}

/** 设置嵌套字段值 */
export function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined || current[keys[i]] === null) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

/** 删除嵌套字段 */
export function unsetNestedValue(obj: any, path: string): void {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined || current[keys[i]] === null) return;
    current = current[keys[i]];
  }
  delete current[keys[keys.length - 1]];
}
