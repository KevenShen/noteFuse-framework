import React, { useMemo } from 'react';
import { GenericDirectiveEditor } from '@mdxeditor/editor';

// 单个步骤 - 只渲染内容（步骤条由父级Steps统一渲染）
export const StepDirectiveEditor: React.FC<any> = (props) => {
  return (
    <div className="directive-step" style={{ padding: '4px', minHeight: 60 }}>
      <GenericDirectiveEditor {...props} />
    </div>
  );
};

// 步骤条容器 - 平铺所有步骤内容
export const StepsDirectiveEditor: React.FC<any> = (props) => {
  // 从子节点提取所有 step 的标题（仅展示）
  const stepItems = useMemo(() => {
    const children = props.mdastNode?.children || [];
    return children
      .filter((node: any) => node.name === 'step')
      .map((node: any, idx: number) => ({
        title: node.attributes?.title || `步骤${idx + 1}`,
        status: node.attributes?.status || '',
      }));
  }, [props.mdastNode]);

  return (
    <div
      className="directive-steps"
      style={{ margin: '12px 0' }}
    >
      {/* 步骤条（仅展示） */}
      <div className="steps-nav" style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        {stepItems.map((item: any, idx: number) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: idx === stepItems.length - 1 ? 'none' : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: idx === 0 ? '#1677ff' : '#d9d9d9',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {idx + 1}
              </div>
              <span style={{
                fontSize: '13px',
                color: idx === 0 ? '#1677ff' : 'rgba(0,0,0,0.65)',
                fontWeight: idx === 0 ? 500 : 400,
                whiteSpace: 'nowrap',
              }}>
                {item.title}
              </span>
            </div>
            {idx < stepItems.length - 1 && (
              <div style={{
                flex: 1,
                height: '1px',
                background: '#e8e8e8',
                margin: '0 8px',
                minWidth: '16px',
              }} />
            )}
          </div>
        ))}
      </div>
      {/* 所有步骤内容平铺显示 */}
      <div className="steps-content" style={{ padding: '8px 4px' }}>
        <GenericDirectiveEditor {...props} />
      </div>
    </div>
  );
};
