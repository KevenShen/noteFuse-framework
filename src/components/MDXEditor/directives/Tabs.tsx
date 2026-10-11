/**
 * Tabs 指令渲染器
 * - TabDirectiveEditor: 单个标签页内容（tabs 容器外独立渲染时使用）
 * - TabsDirectiveEditor: 标签页容器（头部切换 + NestedLexicalEditor 内容编辑）
 *
 * 功能：
 * - 单击切换 tab，双击编辑标题
 * - 头部 + 按钮新增 tab
 * - tab 尾部始终显示删除图标（低透明度，hover 高亮），Popconfirm 二次确认
 * - 最后一个 tab 隐藏删除按钮（至少保留一个）
 *
 * 架构：useActiveTab hook 封装 tab 过滤/activeKey 管理/边界保护，
 *      useMdastNodeUpdater 处理 mdastNode 更新；样式统一在 .directive-tabs-* 类名。
 */
import { CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  NestedLexicalEditor,
  useLexicalNodeRemove,
  useMdastNodeUpdater,
} from '@mdxeditor/editor';
import { Popconfirm } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { useActiveTab } from '../hooks';
import { useEditorReadOnly } from '../index';

/** 单个标签页内容渲染器（tabs 容器外独立 :::tab 时使用） */
// export const TabDirectiveEditor: React.FC<any> = (props) => (
//   <div className="directive-tab-content" style={{ minHeight: 60 }}>
//     <GenericDirectiveEditor {...props} />
//   </div>
// );

/** 可编辑的 tab 标题按钮（含删除图标） */
const EditableTabButton: React.FC<{
  label: string;
  active: boolean;
  canDelete: boolean;
  onClick: () => void;
  onLabelChange: (newLabel: string) => void;
  onDelete: () => void;
}> = ({ label, active, canDelete, onClick, onLabelChange, onDelete }) => {
  const readOnly = useEditorReadOnly();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
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
    if (trimmed && trimmed !== label) {
      onLabelChange(trimmed);
    } else {
      setDraft(label);
    }
  };

  // 单击检测双击：250ms 内第二次点击视为双击（进入编辑），否则视为单击（切换 tab）
  // 只读模式下直接切换，不检测双击
  const handleButtonClick = (e: React.MouseEvent) => {
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

  // 点击删除图标：取消待执行的单击切换，阻止冒泡（Popconfirm 会接管后续确认）
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="directive-tabs-btn directive-tabs-btn-edit"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(label);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      className={`directive-tabs-btn${active ? ' active' : ''}`}
      onClick={handleButtonClick}
      title={readOnly ? '单击切换' : '单击切换 · 双击编辑'}
    >
      {label}
      {canDelete && !readOnly && (
        <Popconfirm
          title="确定删除该标签页？"
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={onDelete}
        >
          <span
            className="directive-tabs-btn-delete"
            onClick={handleDeleteClick}
            title="删除标签页"
          >
            <CloseOutlined style={{ fontSize: 10 }} />
          </span>
        </Popconfirm>
      )}
    </button>
  );
};

/** 标签页容器 - 头部切换 + 内容编辑 */
export const TabsDirectiveEditor: React.FC<any> = (props) => {
  const { tabItems, activeKey, setActiveKey } = useActiveTab(props.mdastNode);
  const updateMdastNode = useMdastNodeUpdater<any>();
  const removeNode = useLexicalNodeRemove();
  const readOnly = useEditorReadOnly();

  /** 新增 tab */
  const addTab = () => {
    const newTab = {
      type: 'containerDirective',
      name: 'tab',
      attributes: { label: `Tab${tabItems.length + 1}` },
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: '' }] },
      ],
    };
    const currentChildren = props.mdastNode?.children || [];
    updateMdastNode({ children: [...currentChildren, newTab] });
    setTimeout(() => setActiveKey(tabItems.length), 0);
  };

  /** 删除指定索引的 tab */
  const deleteTab = (idx: number) => {
    if (tabItems.length <= 1) return;
    const currentChildren = props.mdastNode?.children || [];
    let tabIdx = 0;
    const newChildren = currentChildren.filter((c: any) => {
      if (c.name !== 'tab') return true;
      const keep = tabIdx !== idx;
      tabIdx++;
      return keep;
    });
    updateMdastNode({ children: newChildren });
  };

  /** 修改指定索引 tab 的 label */
  const updateTabLabel = (idx: number, newLabel: string) => {
    const currentChildren = props.mdastNode?.children || [];
    let tabIdx = 0;
    const newChildren = currentChildren.map((c: any) => {
      if (c.name !== 'tab') return c;
      const result =
        tabIdx === idx
          ? { ...c, attributes: { ...c.attributes, label: newLabel } }
          : c;
      tabIdx++;
      return result;
    });
    updateMdastNode({ children: newChildren });
  };

  // 空 tabs 容器
  if (tabItems.length === 0) {
    return (
      <div className="directive-tabs-empty">
        暂无标签页
        {!readOnly && (
          <button
            className="directive-tabs-add"
            onClick={addTab}
            style={{ marginLeft: 8 }}
          >
            + 新增
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="directive-tabs">
      {/* Tab 头部栏 */}
      <div className="directive-tabs-header">
        {tabItems.map((child: any, idx: number) => (
          <EditableTabButton
            key={`${idx}-${child.attributes?.label || ''}`}
            label={child.attributes?.label || `Tab${idx + 1}`}
            active={activeKey === idx}
            canDelete={tabItems.length > 1}
            onClick={() => setActiveKey(idx)}
            onLabelChange={(newLabel) => updateTabLabel(idx, newLabel)}
            onDelete={() => deleteTab(idx)}
          />
        ))}
        {!readOnly && (
          <button
            className="directive-tabs-btn directive-tabs-add"
            onClick={addTab}
            title="新增标签页"
          >
            +
          </button>
        )}
        {!readOnly && (
          <Popconfirm
            title="确定删除整个标签页容器？"
            description="所有标签页及内容将被永久删除，不可恢复。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={removeNode}
          >
            <span
              className="directive-tabs-btn directive-tabs-remove-all"
              title="删除整个标签页容器"
            >
              <DeleteOutlined style={{ fontSize: 12 }} />
            </span>
          </Popconfirm>
        )}
      </div>
      {/* 当前激活 Tab 内容区 */}
      <div className="directive-tabs-content">
        <NestedLexicalEditor
          key={activeKey}
          getContent={(tabsNode: any) => {
            const tabNodes = (tabsNode.children || []).filter(
              (c: any) => c.name === 'tab',
            );
            return tabNodes[activeKey]?.children || [];
          }}
          getUpdatedMdastNode={(tabsNode: any, newChildren: any) => {
            let tabIdx = 0;
            return {
              ...tabsNode,
              children: (tabsNode.children || []).map((c: any) => {
                if (c.name !== 'tab') return c;
                const result =
                  tabIdx === activeKey ? { ...c, children: newChildren } : c;
                tabIdx++;
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
