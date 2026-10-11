/**
 * 工具栏基础按钮组件
 * - ToolbarBaseButton: 普通按钮
 * - ToolbarDropdown: 图标下拉菜单
 *
 * 纯 UI 组件，不含业务逻辑和配置
 */
import type { MenuProps } from 'antd';
import { Dropdown } from 'antd';
import type { CSSProperties } from 'react';
import React from 'react';

/** 工具栏通用按钮样式 */
const TOOL_BTN_STYLE: CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: 4,
  fontSize: '14px',
  color: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 32,
  height: 28,
};

export interface ToolbarBaseBtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  style?: React.CSSProperties;
}

export const ToolbarBaseButton: React.FC<ToolbarBaseBtnProps> = ({
  children,
  onClick,
  title,
  style,
}) => (
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
