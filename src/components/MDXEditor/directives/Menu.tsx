import React, { useMemo } from 'react';
import { GenericDirectiveEditor } from '@mdxeditor/editor';

// 单个菜单项 - 只渲染内容（菜单由父级Menu统一渲染）
export const MenuItemDirectiveEditor: React.FC<any> = (props) => {
  return (
    <div className="directive-menuitem" style={{ padding: '8px 4px', minHeight: 60 }}>
      <GenericDirectiveEditor {...props} />
    </div>
  );
};

// 导航菜单 - 平铺所有菜单项内容
export const MenuDirectiveEditor: React.FC<any> = (props) => {
  const mode = props.mdastNode?.attributes?.mode || 'horizontal';

  // 从子节点提取所有菜单项（仅展示）
  const menuItems = useMemo(() => {
    const children = props.mdastNode?.children || [];
    return children
      .filter((node: any) => node.name === 'menuitem')
      .map((node: any, idx: number) => node.attributes?.label || `菜单项${idx + 1}`);
  }, [props.mdastNode]);

  const isVertical = mode === 'vertical';

  return (
    <div
      className={`directive-menu menu-${mode}`}
      style={{
        margin: '12px 0',
        display: isVertical ? 'flex' : 'block',
        border: '1px solid #e8e8e8',
        borderRadius: '6px',
        overflow: 'hidden',
      }}
    >
      {/* 菜单导航（仅展示） */}
      <div
        className="menu-nav"
        style={{
          display: 'flex',
          flexDirection: isVertical ? 'column' : 'row',
          background: '#fafafa',
          borderRight: isVertical ? '1px solid #e8e8e8' : 'none',
          borderBottom: isVertical ? 'none' : '1px solid #e8e8e8',
          minWidth: isVertical ? '120px' : 'auto',
        }}
      >
        {menuItems.map((label: string, idx: number) => (
          <div
            key={idx}
            style={{
              padding: isVertical ? '10px 16px' : '8px 20px',
              fontSize: '13px',
              color: idx === 0 ? '#1677ff' : 'rgba(0,0,0,0.65)',
              fontWeight: idx === 0 ? 500 : 400,
              userSelect: 'none',
              borderLeft: isVertical
                ? idx === 0
                  ? '2px solid #1677ff'
                  : '2px solid transparent'
                : 'none',
              borderBottom: !isVertical
                ? idx === 0
                  ? '2px solid #1677ff'
                  : '2px solid transparent'
                : 'none',
              marginBottom: !isVertical ? -1 : 0,
              background: idx === 0 ? '#fff' : 'transparent',
            }}
          >
            {label}
          </div>
        ))}
      </div>
      {/* 所有菜单项内容平铺显示 */}
      <div className="menu-content" style={{ flex: 1, padding: '12px 16px', background: '#fff' }}>
        <GenericDirectiveEditor {...props} />
      </div>
    </div>
  );
};
