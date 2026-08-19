/**
 * Tabs 指令渲染器
 * - TabDirectiveEditor: 单个标签页内容
 * - TabsDirectiveEditor: 标签页容器（头部切换 + 内容编辑）
 */
import React, { useState, useMemo } from 'react';
import { NestedLexicalEditor, GenericDirectiveEditor } from '@mdxeditor/editor';

/** 单个标签页内容渲染器 */
export const TabDirectiveEditor: React.FC<any> = (props) => (
  <div className="directive-tab-content" style={{ minHeight: 60 }}>
    <GenericDirectiveEditor {...props} />
  </div>
);

/** 标签页容器 - 头部切换 + 内容编辑 */
export const TabsDirectiveEditor: React.FC<any> = (props) => {
  const [activeKey, setActiveKey] = useState(0);

  const tabItems = useMemo(() => {
    const children = props.mdastNode?.children || [];
    return children.filter((node: any) => node.name === 'tab');
  }, [props.mdastNode]);

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      {/* Tab 头部栏 */}
      <div style={{ display: 'flex', gap: 4, padding: 8, background: '#f9fafb' }}>
        {tabItems.map((child: any, idx: number) => (
          <button
            key={idx}
            onClick={() => setActiveKey(idx)}
            style={{
              padding: '4px 12px',
              border: 'none',
              borderRadius: 4,
              background: activeKey === idx ? '#3b82f6' : '#e5e7eb',
              color: activeKey === idx ? '#fff' : '#333',
              cursor: 'pointer',
            }}
          >
            {child.attributes?.label || `Tab${idx + 1}`}
          </button>
        ))}
      </div>
      {/* 当前激活 Tab 内容区（内部富文本） */}
      <div style={{ padding: 12 }}>
        {tabItems[activeKey] && (
          <NestedLexicalEditor
            getContent={(n: any) => n.children}
            getUpdatedMdastNode={(origin: any, newChildren: any) => ({ ...origin, children: newChildren })}
            block
            contentEditableProps={{ style: { minHeight: 80 } }}
          />
        )}
      </div>
    </div>
  );
};
