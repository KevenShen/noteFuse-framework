import { shallowEqual } from '@/utils/shallowEqual';
import { useSelector } from '@umijs/max';
/**
 * 浅比较 useSelector
 * - 当 selector 返回对象/数组时，只比较第一层属性
 * - 避免因其他未使用字段变化导致的无效重渲染
 *
 * @param selector 选择器函数
 * @returns 选择器返回的值
 *
 * @example
 * // 返回对象（推荐使用）
 * const { list, loading } = useShallowSelector((state) => ({
 *   list: state.project.list,
 *   loading: state.project.loading,
 * }));
 *
 * @example
 * // 返回数组
 * const [list, total] = useShallowSelector((state) => [
 *   state.project.list,
 *   state.project.total,
 * ]);
 *
 * @example
 * // 返回原始类型（不需要 shallowEqual，但也可以用，不影响性能）
 * const loading = useShallowSelector((state) => state.user.loading);
 */
export function useShallowSelector<T>(selector: (state: any) => T): T {
  return useSelector(selector, shallowEqual);
}

export default useShallowSelector;
