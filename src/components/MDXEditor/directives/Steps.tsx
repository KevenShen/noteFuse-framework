/**
 * Steps 指令渲染器
 * - StepDirectiveEditor: 单个步骤内容（steps 容器外独立渲染时使用）
 * - StepsDirectiveEditor: 步骤容器（左侧垂直导航 + 右侧内容区）
 *
 * P1 体验增强：
 * - 双击步骤标题可直接编辑
 * - 左侧底部 + 按钮新增步骤
 * - 步骤项 hover 显示删除按钮，Popconfirm 确认
 * - 内容区右上角 🗑 删除整个容器，Popconfirm 确认
 *
 * 架构：useActiveItem hook 通用激活管理，
 *      useMdastNodeUpdater 更新步骤标题/增删步骤，
 *      useLexicalNodeRemove 删除整个容器；
 *      样式统一在 index.less 的 .directive-steps-* 类名。
 */
import React, { useState, useRef, useEffect } from 'react';
import { Popconfirm } from 'antd';
import { CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  NestedLexicalEditor,
  useMdastNodeUpdater,
  useLexicalNodeRemove,
} from '@mdxeditor/editor';
import { useActiveItem } from '../hooks';
import { useEditorReadOnly } from '../index';

/** 单个步骤内容渲染器（steps 容器外独立 :::step 时使用） */
// export const StepDirectiveEditor: React.FC<any> = (props) => (
//   <div className="directive-step" style={{ minHeight: 60 }}>
//     <GenericDirectiveEditor {...props} />
//   </div>
// );

/** 可编辑的步骤导航项（单击切换 / 双击编辑标题 / 删除） */
const EditableStepItem: React.FC<{
  title: string;
  index: number;
  active: boolean;
  isLast: boolean;
  canDelete: boolean;
  onClick: () => void;
  onTitleChange: (newTitle: string) => void;
  onDelete: () => void;
}> = ({ title, index, active, isLast, canDelete, onClick, onTitleChange, onDelete }) => {
  const readOnly = useEditorReadOnly();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
    };
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) {
      onTitleChange(trimmed);
    } else {
      setDraft(title);
    }
  };

  // 单击检测双击：只读模式下直接切换，不检测双击
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) {
      onClick();
      return;
    }
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      setEditing(true);
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        onClick();
      }, 250);
    }
  };

  return (
    <div
      className={`directive-steps-item${active ? ' active' : ''}`}
      onClick={handleClick}
      title={readOnly ? '单击切换' : '单击切换 · 双击编辑'}
    >
      <div className="directive-steps-circle">{index + 1}</div>

      {editing ? (
        <input
          ref={inputRef}
          className="directive-steps-title-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <span className="directive-steps-title">{title}</span>
      )}

      {canDelete && !readOnly && (
        <Popconfirm
          title="确定删除该步骤？"
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={onDelete}
        >
          <span
            className="directive-steps-delete"
            onClick={(e) => {
              e.stopPropagation();
              if (clickTimerRef.current) {
                clearTimeout(clickTimerRef.current);
                clickTimerRef.current = null;
              }
            }}
            title="删除步骤"
          >
            <CloseOutlined style={{ fontSize: 10 }} />
          </span>
        </Popconfirm>
      )}

      {!isLast && <div className="directive-steps-connector" />}
    </div>
  );
};

/** 步骤容器 - 左侧垂直导航 + 右侧内容编辑 */
export const StepsDirectiveEditor: React.FC<any> = (props) => {
  const { items: stepItems, activeKey, setActiveKey } = useActiveItem(props.mdastNode, 'step');
  const updateMdastNode = useMdastNodeUpdater<any>();
  const removeNode = useLexicalNodeRemove();
  const readOnly = useEditorReadOnly();

  /** 新增步骤 */
  const addStep = () => {
    const newStep = {
      type: 'containerDirective',
      name: 'step',
      attributes: { title: `步骤${stepItems.length + 1}` },
      children: [{ type: 'paragraph', children: [{ type: 'text', value: '' }] }],
    };
    const currentChildren = props.mdastNode?.children || [];
    updateMdastNode({ children: [...currentChildren, newStep] });
    setTimeout(() => setActiveKey(stepItems.length), 0);
  };

  /** 删除指定索引的步骤 */
  const deleteStep = (idx: number) => {
    if (stepItems.length <= 1) return;
    const currentChildren = props.mdastNode?.children || [];
    let stepIdx = 0;
    const newChildren = currentChildren.filter((c: any) => {
      if (c.name !== 'step') return true;
      const keep = stepIdx !== idx;
      stepIdx++;
      return keep;
    });
    updateMdastNode({ children: newChildren });
  };

  /** 修改指定索引步骤的标题 */
  const updateStepTitle = (idx: number, newTitle: string) => {
    const currentChildren = props.mdastNode?.children || [];
    let stepIdx = 0;
    const newChildren = currentChildren.map((c: any) => {
      if (c.name !== 'step') return c;
      const result = stepIdx === idx ? { ...c, attributes: { ...c.attributes, title: newTitle } } : c;
      stepIdx++;
      return result;
    });
    updateMdastNode({ children: newChildren });
  };

  // 空 steps 容器
  if (stepItems.length === 0) {
    return (
      <div className="directive-steps-empty">
        暂无步骤
        {!readOnly && (
          <button className="directive-steps-add" onClick={addStep} style={{ marginLeft: 8 }}>
            + 新增
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="directive-steps">
      {/* 左侧垂直导航 */}
      <div className="directive-steps-nav">
        {stepItems.map((item: any, idx: number) => (
          <EditableStepItem
            key={`${idx}-${item.attributes?.title || ''}`}
            title={item.attributes?.title || `步骤${idx + 1}`}
            index={idx}
            active={activeKey === idx}
            isLast={idx === stepItems.length - 1}
            canDelete={stepItems.length > 1}
            onClick={() => setActiveKey(idx)}
            onTitleChange={(newTitle) => updateStepTitle(idx, newTitle)}
            onDelete={() => deleteStep(idx)}
          />
        ))}
        {!readOnly && (
          <button className="directive-steps-add" onClick={addStep} title="新增步骤">
            +
          </button>
        )}
      </div>

      {/* 右侧内容区 */}
      <div className="directive-steps-content">
        {/* 内容区头部：删除整个容器按钮（只读时隐藏） */}
        {!readOnly && (
          <div className="directive-steps-content-header">
            <Popconfirm
              title="确定删除整个步骤容器？"
              description="所有步骤及内容将被永久删除，不可恢复。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={removeNode}
            >
              <span className="directive-steps-remove-all" title="删除整个步骤容器">
                <DeleteOutlined style={{ fontSize: 12 }} />
              </span>
            </Popconfirm>
          </div>
        )}

        <NestedLexicalEditor
          key={activeKey}
          getContent={(stepsNode: any) => {
            const stepNodes = (stepsNode.children || []).filter((c: any) => c.name === 'step');
            return stepNodes[activeKey]?.children || [];
          }}
          getUpdatedMdastNode={(stepsNode: any, newChildren: any) => {
            let stepIdx = 0;
            return {
              ...stepsNode,
              children: (stepsNode.children || []).map((c: any) => {
                if (c.name !== 'step') return c;
                const result = stepIdx === activeKey ? { ...c, children: newChildren } : c;
                stepIdx++;
                return result;
              }),
            };
          }}
          block
          contentEditableProps={{ style: { minHeight: 80 } }}
        />
      </div>
    </div>
  );
};
