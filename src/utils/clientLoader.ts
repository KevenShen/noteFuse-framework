// src/utils/clientLoader.ts
// clientLoader 相关工具函数
// 用于统一处理 clientLoader 数据提取、合并等通用逻辑

/**
 * 统一的 API 响应数据提取
 * 兼容多种返回结构（service 泛型与实际返回结构可能不一致）
 *
 * @param res - API 响应对象
 * @param defaultValue - 默认值（当 res 为空时返回）
 * @returns 提取后的数据
 */
export const extractResponseData = <T>(res: any, defaultValue: T): T => {
  if (!res) return defaultValue;
  // 优先从 res.data 提取，其次从 res 本身提取
  const data = res.data !== undefined ? res.data : res;
  return data ?? defaultValue;
};

/**
 * 从列表响应中提取列表数据
 * 兼容 { list: [], total: 0, page: 1 } 和直接数组两种结构
 *
 * @param res - API 响应对象
 * @returns 列表数据数组
 */
export const extractListData = <T>(res: any): T[] => {
  const data = extractResponseData<any>(res, {});
  if (Array.isArray(data)) return data;
  return data.list || [];
};

/**
 * 从列表响应中提取分页信息
 *
 * @param res - API 响应对象
 * @returns 分页信息 { total, page }
 */
export const extractPaginationData = (res: any): { total: number; page: number } => {
  const data = extractResponseData<any>(res, {});
  return {
    total: data.total || 0,
    page: data.page || 1,
  };
};

/**
 * 合并 model 数据和 clientLoader 数据
 * 优先使用 model 数据（交互更新后），兜底使用 clientLoader 预加载数据（首屏）
 *
 * 注意：对于数组类型，空数组也是有效数据（如筛选后无结果），不应回退到 loaderData
 *
 * @param modelData - model 中的数据
 * @param loaderData - clientLoader 中的数据
 * @returns 合并后的数据
 */
export const mergeWithClientLoader = <T>(modelData: T | undefined | null, loaderData: T | undefined | null): T => {
  // 优先使用 model 数据（包括空数组、0、false 等有效值），仅在 undefined/null 时回退到 loaderData
  return (modelData ?? loaderData) as T;
};
