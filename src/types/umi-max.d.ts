// src/types/umi-max.d.ts
// 补充 @umijs/max 缺失的运行时导出类型声明
// useModel / Provider 由 plugin-model 在运行时生成并通过 webpack alias 注入 @umijs/max，
// 但 @umijs/max 的 .d.ts（export * from 'umi'）未包含这些导出，导致 TS 报错。
import type {
  Provider as ModelProvider,
  useModel as useModelHook,
} from '@@/plugin-model';

declare module '@umijs/max' {
  export const Provider: typeof ModelProvider;
  export const useModel: typeof useModelHook;
  // clientLoader 数据获取 hook（运行时由 @umijs/renderer-react 导出，类型定义缺失）
  export function useClientLoaderData<T = any>(): T;
  export function useLoaderData<T = any>(): T;
}
