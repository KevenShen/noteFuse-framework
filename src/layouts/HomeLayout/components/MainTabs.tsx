// src/layouts/HomeLayout/components/MainTabs.tsx
// 主 Tab 导航组件：根据当前 Layout 父路由的子路由生成 Tab 导航

import {
  CodeOutlined,
  HeartOutlined,
  SyncOutlined,
  TagOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { history, useAppData, useLocation } from '@umijs/max';
import { Tabs } from 'antd';
import React, { useMemo } from 'react';
import { getPurePath, joinPath } from '@/constants/auth';
import { findLayoutRoute } from '../utils/findLayoutRoute';
import type { LayoutRouteConfig } from '../utils/findLayoutRoute';

/** 图标名称 -> 图标组件映射表，和路由配置 icon 字符串一一对应 */
const iconMap: Record<string, React.FC> = {
  CodeOutlined,
  SyncOutlined,
  HeartOutlined,
  TagOutlined,
  ThunderboltOutlined,
};

/**
 * 从 Layout 父路由生成 Tab 导航项
 *
 * @param layoutRoute - Layout 父路由
 * @returns Tab 导航项数组
 */
const generateTabItems = (
  layoutRoute: LayoutRouteConfig | null,
): { key: string; label: string; icon?: React.ReactNode }[] => {
  if (!layoutRoute?.routes) return [];

  const basePath = getPurePath(layoutRoute.path);

  return layoutRoute.routes
    .filter((route) => !!route.path && !!route.title && !route.hideInTab)
    .map((route) => {
      // 计算 Tab 的完整路径（作为 key）
      const tabKey = route.path.startsWith('/')
        ? route.path
        : joinPath(basePath, route.path);

      // 获取图标组件
      const IconComp = route.icon ? iconMap[route.icon] : null;

      return {
        key: tabKey,
        label: route.title as string,
        ...(IconComp && { icon: <IconComp /> }),
      };
    });
};

/**
 * 主 Tab 导航组件
 * 根据当前路径自动查找所属的 Layout 父路由，并生成对应的 Tab 导航
 * 点击 Tab 跳转到对应路由
 */
const MainTabs: React.FC = () => {
  const location = useLocation();
  const { clientRoutes } = useAppData();
  // 去除查询参数的纯路径
  const pureLocationPath = getPurePath(location.pathname);

  // 找到当前 Layout 对应的父路由节点（使用 useMemo 缓存）
  const layoutParentRoute = useMemo(() => {
    if (!Array.isArray(clientRoutes)) return null;
    return findLayoutRoute(clientRoutes, pureLocationPath);
  }, [clientRoutes, pureLocationPath]);

  // 生成 Tab Items（使用 useMemo 缓存）
  const tabItems = useMemo(
    () => generateTabItems(layoutParentRoute),
    [layoutParentRoute],
  );

  // 没有 Tab 项时不渲染
  if (tabItems.length === 0) return null;

  return (
    <Tabs
      activeKey={pureLocationPath}
      onChange={(path) => history.push(path)}
      items={tabItems}
      className="main-tabs"
    />
  );
};

export default MainTabs;
