/**
 * 浅比较函数
 * 比较两个对象的第一层属性是否相等
 *
 * @param objA 对象 A
 * @param objB 对象 B
 * @returns 是否相等（true 表示相等，不触发重渲染）
 *
 * @example
 * shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 });  // true
 * shallowEqual({ a: 1, b: 2 }, { a: 1, b: 3 });  // false
 * shallowEqual([1, 2, 3], [1, 2, 3]);              // true
 */
export function shallowEqual<T>(objA: T, objB: T): boolean {
  // 1. 引用相等，直接返回 true
  if (Object.is(objA, objB)) {
    return true;
  }
  // 2. 不是对象，或者为 null，返回 false
  if (
    typeof objA !== 'object' ||
    objA === null ||
    typeof objB !== 'object' ||
    objB === null
  ) {
    return false;
  }
  // 3. 比较键的数量
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) {
    return false;
  }
  // 4. 逐层比较每个属性（使用 Object.is，处理 NaN、+0/-0 等特殊情况）
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) {
      return false;
    }
    if (!Object.is((objA as any)[key], (objB as any)[key])) {
      return false;
    }
  }
  // 5. 所有属性都相等，返回 true
  return true;
}
export default shallowEqual;
