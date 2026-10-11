// src/components/tree/index.tsx
// 树形结构 UI 工具组件
// 功能：生成 Ant Design Menu 组件结构、树形选择器等 UI 相关工具

import React from 'react';
import type { MenuProps } from 'antd';
import {
  buildCategoryMenuData,
  type FlatItem,
  type MenuDataItem,
} from '@/utils/tree';
import type { BuildCategoryMenuOptions } from './types';

// 导出类型
export type { BuildCategoryMenuOptions } from './types';

// ==================== 内部工具函数 ====================

/**
 * 递归渲染菜单项（纯函数，无副作用）
 * @param items 菜单数据数组
 * @param options 渲染选项
 * @returns Ant Design Menu 组件的 items
 */
function renderMenuItems(
  items: MenuDataItem[],
  options: {
    allKey: string;
    uncategorizedKey: string;
    allIcon?: React.ReactNode;
    uncategorizedIcon?: React.ReactNode;
    indentPerLevel: number;
    renderLabel?: (item: FlatItem, level: number, hasChildren: boolean) => React.ReactNode;
  },
): MenuProps['items'] {
  const {
    allKey,
    uncategorizedKey,
    allIcon,
    uncategorizedIcon,
    indentPerLevel,
    renderLabel,
  } = options;

  return items.map((item) => {
    // 分隔线
    if (item.type === 'divider') {
      return { type: 'divider' as const };
    }

    const level = item.level || 0;
    const hasChildren = item.hasChildren || false;
    const isAllItem = item.key === allKey;
    const isUncategorizedItem = item.key === uncategorizedKey;
    const isAllInSubmenu = item.isAllInSubmenu || false;

    // 自定义标签渲染或默认渲染
    const label = renderLabel && item.data
      ? renderLabel(item.data, level, hasChildren)
      : (
        <span style={{ paddingLeft: level * indentPerLevel }}>
          {hasChildren && (
            <span style={{ marginRight: 4, fontSize: 10 }}>▸</span>
          )}
          {isAllItem && allIcon && <span style={{ marginRight: 6 }}>{allIcon}</span>}
          {isUncategorizedItem && uncategorizedIcon && (
            <span style={{ marginRight: 6 }}>{uncategorizedIcon}</span>
          )}
          <span style={{ color: isAllInSubmenu ? '#1677ff' : undefined }}>
            {item.label}
          </span>
        </span>
      );

    // 有子菜单
    if (item.children && item.children.length > 0) {
      return {
        key: item.key,
        label,
        children: renderMenuItems(item.children, options),
      };
    }

    // 叶子节点
    return { key: item.key, label };
  });
}

// ==================== 生成 Ant Design Menu 组件结构 ====================

/**
 * 将扁平化分类数据转换为 Ant Design Menu 组件所需的结构
 * 支持任意层级，每级都可选，有子节点的分类下会显示"全部XX"选项
 *
 * @param list 扁平化分类数据数组
 * @param options 配置选项
 * @returns Ant Design Menu 组件的 items
 */
export function buildCategoryMenu(
  list: FlatItem[],
  options?: BuildCategoryMenuOptions,
): MenuProps['items'] {
  const {
    showAll = true,
    allKey = '0',
    allLabel = '全部分类',
    allIcon,
    showUncategorized = true,
    uncategorizedKey = '-1',
    uncategorizedLabel = '未分类',
    uncategorizedIcon,
    showAllInSubmenu = true,
    indentPerLevel = 12,
    renderLabel,
    rootParentId = 0,
  } = options || {};

  // 使用纯逻辑函数获取菜单数据
  const menuData = buildCategoryMenuData(list, {
    showAll,
    allKey,
    allLabel,
    showUncategorized,
    uncategorizedKey,
    uncategorizedLabel,
    showAllInSubmenu,
    rootParentId,
  });

  // 渲染 UI
  return renderMenuItems(menuData, {
    allKey,
    uncategorizedKey,
    allIcon,
    uncategorizedIcon,
    indentPerLevel,
    renderLabel,
  });
}

// ==================== 树形选择器组件（可选，后续扩展） ====================

// 后续可以在这里添加 TreeSelect、Tree 等组件的封装
