import type { MenuProps } from 'antd';
import type React from 'react';

/** 首页布局组件 Props */
export interface HomeLayoutProps {
  /** Tab 配置项 */
  tabItems?: { key: string; label: string }[];
  /** 当前激活的 Tab */
  activeTab?: string;
  /** Tab 切换回调 */
  onTabChange?: (key: string) => void;
  /** 是否显示新建按钮 */
  showCreateButton?: boolean;
  /** 新建按钮文字 */
  createButtonText?: string;
  /** 新建按钮点击回调 */
  onCreate?: () => void;
  /** 内容区域 */
  children?: React.ReactNode;
}

// 内部菜单类型统一导出
export type UserMenuItems = MenuProps['items'];
