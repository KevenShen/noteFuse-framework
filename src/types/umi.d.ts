// src/types/umi.d.ts
// 补充 @umijs/max 中由插件动态生成的 API 类型声明
// 这些 API 在运行时由 .umi/exports.ts 导出，但类型定义不在 @umijs/max 包中

declare module '@umijs/max' {
  // ==================== defineConfig ====================
  /**
   * Umi 配置定义函数，提供类型提示
   */
  export function defineConfig<T = Record<string, any>>(config: T): T;

  // ==================== dva (useSelector / useDispatch) ====================
  /**
   * Dva useSelector Hook - 从 Store 中选取状态
   * @param selector - 选择器函数，接收全局 state，返回需要的状态片段
   * @param equalityFn - 可选的相等性比较函数，用于优化重渲染
   */
  export function useSelector<TState = any, TSelected = any>(
    selector: (state: TState) => TSelected,
    equalityFn?: (left: TSelected, right: TSelected) => boolean,
  ): TSelected;

  /**
   * Dva useDispatch Hook - 获取 dispatch 函数
   * @returns dispatch 函数，用于触发 action
   */
  export function useDispatch<
    TDispatch = (action: { type: string; payload?: any }) => Promise<any>,
  >(): TDispatch;

  /**
   * Dva Store 连接函数（传统方式，不推荐，建议使用 Hooks）
   */
  export function connect(
    mapStateToProps?: (state: any) => any,
    mapDispatchToProps?: any,
  ): any;

  // ==================== 路由相关 ====================
  import type { History, Location } from '@umijs/renderer-react';
  export const history: History;

  /**
   * 路由出口组件，用于渲染子路由
   */
  export const Outlet: React.FC;

  /**
   * 获取当前路由位置信息
   */
  export function useLocation<T = any>(): Location & { state: T };

  /**
   * 获取应用数据（包含 clientRoutes 等）
   */
  export function useAppData<T = any>(): {
    clientRoutes: any[];
    routeComponents: Record<string, any>;
    pluginManager: any;
    rootRoutes: any[];
    [key: string]: any;
  };

  // ==================== plugin-request ====================
  /**
   * 全局请求方法
   */
  export function request<T = any>(url: string, options?: Record<string, any>): Promise<T>;

  /**
   * 请求 Hook
   */
  export function useRequest<TData = any, TParams = any[]>(
    service: (...args: TParams) => Promise<TData>,
    options?: Record<string, any>,
  ): {
    data: TData | undefined;
    loading: boolean;
    error: Error | undefined;
    params: TParams | [];
    run: (...args: TParams) => Promise<TData>;
    runAsync: (...args: TParams) => Promise<TData>;
    refresh: () => Promise<TData>;
    refreshAsync: () => Promise<TData>;
    mutate: (data: TData | ((oldData: TData) => TData)) => void;
    cancel: () => void;
  };

  /**
   * 获取请求实例
   */
  export function getRequestInstance(): any;

  /**
   * 请求配置类型
   */
  export type RequestConfig = {
    timeout?: number;
    headers?: Record<string, string>;
    prefix?: string;
    errorConfig?: {
      errorHandler?: (error: any) => void;
      errorThrower?: (res: any) => void;
    };
    requestInterceptors?: any[];
    responseInterceptors?: any[];
  };

  // ==================== plugin-initialState ====================
  /**
   * 获取初始状态 Hook
   */
  export function useInitialState<T = any>(): {
    initialState: T | undefined;
    loading: boolean;
    refresh: () => Promise<T>;
    setInitialState: (state: T) => void;
  };

  // ==================== plugin-access ====================
  /**
   * 权限 Hook
   */
  export function useAccess<T = Record<string, boolean>>(): T;

  /**
   * 权限组件
   */
  export const Access: React.FC<{
    accessible: boolean;
    fallback?: React.ReactNode;
    children: React.ReactNode;
  }>;

  // ==================== plugin-qiankun ====================
  /**
   * 微前端子应用组件
   */
  export const MicroApp: React.FC<{
    name: string;
    [key: string]: any;
  }>;

  export const MicroAppWithMemoHistory: React.FC<{
    name: string;
    url: string;
    [key: string]: any;
  }>;
}
