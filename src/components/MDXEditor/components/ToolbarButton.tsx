/**
 * 工具栏基础按钮组件
 * - ToolbarBaseButton: 普通按钮
 * - ToolbarDropdown: 图标下拉菜单
 */
import React from 'react';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { TOOL_BTN_STYLE } from '../constants';

export interface ToolbarBaseBtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  style?: React.CSSProperties;
}

export const ToolbarBaseButton: React.FC<ToolbarBaseBtnProps> = ({ children, onClick, title, style }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    title={title}
    style={{ ...TOOL_BTN_STYLE, ...style }}
  >
    {children}
  </button>
);

// ==================== 图标下拉菜单 ====================

interface ToolbarDropdownItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

export interface ToolbarDropdownProps {
  icon?: React.ReactNode;
  title?: string;
  items: ToolbarDropdownItem[];
  onSelect: (key: string) => void;
}

export const ToolbarDropdown: React.FC<ToolbarDropdownProps> = ({
  icon = '➕',
  title = '插入组件',
  items,
  onSelect,
}) => {
  const menuItems: MenuProps['items'] = items.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
  }));

  return (
    <Dropdown
      menu={{ items: menuItems, onClick: ({ key }) => onSelect(key) }}
      trigger={['hover']}
      placement="bottomCenter"
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        title={title}
        style={{ ...TOOL_BTN_STYLE, fontSize: 20, fontWeight: 600 }}
      >
        {icon}
      </button>
    </Dropdown>
  );
};
