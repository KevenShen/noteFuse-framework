// src/layouts/HomeLayout/utils/findLayoutRoute.ts
// 路由查找工具函数：递归遍历 clientRoutes，找到当前路径所属的 Layout 父路由（层级最深匹配）

import { getPurePath, joinPath } from '@/constants/auth';

/** 路由配置类型（简化版，仅用于布局查找） */
export interface LayoutRouteConfig {
  path: string;
  title?: string;
  icon?: string;
  hideInTab?: boolean;
  routes?: LayoutRouteConfig[];
}

/**
 * 递归遍历路由树，找到当前路径所属的 Layout 父路由（层级最深匹配）
 *
 * 算法思路：
 * 1. 遍历所有路由，计算每个路由的完整路径
 * 2. 判断当前路径是否是该路由的子路径（前缀匹配）
 * 3. 如果是且该路由有子路由，则加入候选列表
 * 4. 递归遍历子路由
 * 5. 最后按路径长度排序，返回层级最深的匹配
 *
 * @param routes - 路由配置数组
 * @param currentUrlPath - 当前 URL 路径（已去除查询参数）
 * @param basePath - 父路由基础路径（递归时传递）
 * @param candidates - 候选路由列表（递归时累积）
 * @returns 层级最深匹配的 Layout 父路由，没有则返回 null
 */
export const findLayoutRoute = (
  routes: LayoutRouteConfig[],
  currentUrlPath: string,
  basePath: string = '',
  candidates: { route: LayoutRouteConfig; fullPath: string }[] = [],
): LayoutRouteConfig | null => {
  for (const route of routes) {
    // 计算路由的完整路径（处理相对路径和绝对路径）
    const routeFullPath = route.path.startsWith('/')
      ? route.path
      : joinPath(basePath, route.path);

    // 判断当前路径是否是该路由的子路径（前缀匹配）
    const isPrefixMatch =
      currentUrlPath === routeFullPath ||
      routeFullPath === '/' ||
      currentUrlPath.startsWith(routeFullPath + '/');

    // 如果是且该路由有子路由，则加入候选列表
    if (route.routes && isPrefixMatch) {
      candidates.push({ route, fullPath: routeFullPath });
    }

    // 递归遍历子路由
    if (route.routes) {
      findLayoutRoute(route.routes, currentUrlPath, routeFullPath, candidates);
    }
  }

  // 没有候选路由，返回 null
  if (candidates.length === 0) return null;

  // 按路径长度排序（降序），返回层级最深的匹配
  candidates.sort((a, b) => b.fullPath.length - a.fullPath.length);
  return candidates[0].route;
};
