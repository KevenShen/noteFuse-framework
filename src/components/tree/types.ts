// src/components/tree/types.ts
// 树形结构 UI 组件的类型定义

import React from 'react';
import type { FlatItem } from '@/utils/tree';

/** 生成分类菜单的配置选项 */
export interface BuildCategoryMenuOptions {
  /** 是否显示"全部"选项（默认 true） */
  showAll?: boolean;
  /** "全部"选项的 key（默认 '0'） */
  allKey?: string;
  /** "全部"选项的标签（默认 '全部分类'） */
  allLabel?: string;
  /** "全部"选项的图标 */
  allIcon?: React.ReactNode;
  /** 是否显示"未分类"选项（默认 true） */
  showUncategorized?: boolean;
  /** "未分类"选项的 key（默认 '-1'） */
  uncategorizedKey?: string;
  /** "未分类"选项的标签（默认 '未分类'） */
  uncategorizedLabel?: string;
  /** "未分类"选项的图标 */
  uncategorizedIcon?: React.ReactNode;
  /** 是否在有子节点的分类下显示"全部XX"选项（默认 true） */
  showAllInSubmenu?: boolean;
  /** 每级缩进像素值（默认 12） */
  indentPerLevel?: number;
  /** 自定义节点标签渲染 */
  renderLabel?: (item: FlatItem, level: number, hasChildren: boolean) => React.ReactNode;
  /** 根节点的 parent_id（默认 0） */
  rootParentId?: number | string;
}
