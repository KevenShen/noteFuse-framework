/**
 * Card 指令渲染器
 * - 支持 5 种类型：default / info / success / warning / error
 * - 支持 title / subtitle 属性，双击可编辑
 * - 支持折叠/展开（collapsed）
 * - 内容区 NestedLexicalEditor 富文本编辑
 * - 右上角删除整个卡片按钮（Popconfirm 确认）
 *
 * 架构：useMdastNodeUpdater 更新标题/副标题，
 *      useLexicalNodeRemove 删除整个卡片，
 *      NestedLexicalEditor 编辑内容；
 *      样式统一在 index.less 的 .directive-card-* 类名。
 */
import { DeleteOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import {
  NestedLexicalEditor,
  useLexicalNodeRemove,
  useMdastNodeUpdater,
} from '@mdxeditor/editor';
import { Dropdown, Popconfirm } from 'antd';
import React, { useEffect, useRef, useState } from 'react';

import { useEditorReadOnly } from '../index';

// 卡片类型（与 CSS 类名对应）
export type CardType = 'default' | 'info' | 'success' | 'warning' | 'error';

// 类型选项（用于下拉切换器）
const CARD_TYPE_OPTIONS: { key: CardType; label: string; color: string }[] = [
  { key: 'default', label: '默认', color: '#bfbfbf' },
  { key: 'info', label: '信息', color: '#1677ff' },
  { key: 'success', label: '成功', color: '#52c41a' },
  { key: 'warning', label: '警告', color: '#faad14' },
  { key: 'error', label: '错误', color: '#ff4d4f' },
];

/**
 * 通用可编辑文本组件（双击编辑）
 * 用于卡片标题、副标题等可编辑文本
 */
const EditableCardText: React.FC<{
  value: string;
  type: CardType;
  onChange: (newValue: string) => void;
  className?: string;
  editClassName?: string;
  placeholder?: string;
  editHint?: string;
}> = ({
  value,
  type,
  onChange,
  className,
  editClassName,
  placeholder,
  editHint,
}) => {
  const readOnly = useEditorReadOnly();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
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
    if (trimmed !== value) onChange(trimmed);
    else setDraft(value);
  };

  // 单击检测双击（只读模式下不响应）
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      setEditing(true);
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
      }, 250);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={
          editClassName ||
          `directive-card-title-edit directive-card-${type}-title-edit`
        }
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div
      className={
        className || `directive-card-title directive-card-${type}-title`
      }
      onClick={handleClick}
      title={readOnly ? undefined : editHint || '双击编辑'}
    >
      {value || (
        <span style={{ color: '#bfbfbf' }}>{placeholder || '添加文本'}</span>
      )}
    </div>
  );
};

/** 卡片容器 */
export const CardDirectiveEditor: React.FC<any> = (props) => {
  const type: CardType = props.mdastNode?.attributes?.type || 'default';
  const title = props.mdastNode?.attributes?.title || '';
  const subtitle = props.mdastNode?.attributes?.subtitle || '';
  const updateMdastNode = useMdastNodeUpdater<any>();
  const removeNode = useLexicalNodeRemove();
  const readOnly = useEditorReadOnly();

  // 折叠状态（默认展开）
  const [collapsed, setCollapsed] = useState(false);

  const updateAttr = (attrs: Record<string, string>) => {
    updateMdastNode({
      attributes: { ...props.mdastNode?.attributes, ...attrs },
    });
  };

  const updateTitle = (newTitle: string) => updateAttr({ title: newTitle });
  const updateSubtitle = (newSubtitle: string) =>
    updateAttr({ subtitle: newSubtitle });
  const updateType = (newType: CardType) => updateAttr({ type: newType });

  const currentTypeColor =
    CARD_TYPE_OPTIONS.find((o) => o.key === type)?.color || '#bfbfbf';

  // 类型切换下拉菜单
  const typeMenu = {
    items: CARD_TYPE_OPTIONS.map((opt) => ({
      key: opt.key,
      label: (
        <span className="directive-card-type-option">
          <span
            className="directive-card-type-dot"
            style={{ background: opt.color }}
          />
          {opt.label}
        </span>
      ),
      onClick: () => updateType(opt.key),
    })),
    selectedKeys: [type],
  };

  // 操作区：类型切换 + 删除（只读时隐藏）
  const renderActions = () => {
    if (readOnly) return null;
    return (
      <div className="directive-card-actions">
        <Dropdown menu={typeMenu} trigger={['click']}>
          <span className="directive-card-type-switch" title="切换类型配色">
            <span
              className="directive-card-type-dot"
              style={{ background: currentTypeColor }}
            />
          </span>
        </Dropdown>
        <Popconfirm
          title="确定删除该卡片？"
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={removeNode}
        >
          <span className="directive-card-delete" title="删除卡片">
            <DeleteOutlined style={{ fontSize: 12 }} />
          </span>
        </Popconfirm>
      </div>
    );
  };

  // 折叠按钮（始终可用，只读模式也可折叠）
  const renderCollapseBtn = () => (
    <span
      className="directive-card-collapse"
      onClick={(e) => {
        e.stopPropagation();
        setCollapsed((c) => !c);
      }}
      title={collapsed ? '展开' : '折叠'}
    >
      {collapsed ? (
        <RightOutlined style={{ fontSize: 10 }} />
      ) : (
        <DownOutlined style={{ fontSize: 10 }} />
      )}
    </span>
  );

  const hasHeader = title || subtitle;

  return (
    <div
      className={`directive-card directive-card-${type}${
        collapsed ? ' directive-card-collapsed' : ''
      }`}
    >
      {/* 卡片头部：折叠按钮 + 标题/副标题 + 操作区 */}
      {hasHeader && (
        <div className="directive-card-header">
          <div className="directive-card-titles">
            {renderCollapseBtn()}
            <div className="directive-card-title-group">
              {title && (
                <EditableCardText
                  value={title}
                  type={type}
                  onChange={updateTitle}
                  className={`directive-card-title directive-card-${type}-title`}
                  editClassName={`directive-card-title-edit directive-card-${type}-title-edit`}
                  placeholder="卡片标题"
                  editHint="双击编辑标题"
                />
              )}
              {subtitle && (
                <EditableCardText
                  value={subtitle}
                  type={type}
                  onChange={updateSubtitle}
                  className="directive-card-subtitle"
                  editClassName="directive-card-subtitle-edit"
                  placeholder="添加副标题"
                  editHint="双击编辑副标题"
                />
              )}
            </div>
          </div>
          {renderActions()}
        </div>
      )}

      {/* 无标题时，折叠按钮 + 操作区浮动在右上角 */}
      {!hasHeader && (
        <div className="directive-card-actions directive-card-actions-float">
          {renderCollapseBtn()}
          {!readOnly && (
            <>
              <Dropdown menu={typeMenu} trigger={['click']}>
                <span
                  className="directive-card-type-switch"
                  title="切换类型配色"
                >
                  <span
                    className="directive-card-type-dot"
                    style={{ background: currentTypeColor }}
                  />
                </span>
              </Dropdown>
              <Popconfirm
                title="确定删除该卡片？"
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={removeNode}
              >
                <span className="directive-card-delete" title="删除卡片">
                  <DeleteOutlined style={{ fontSize: 12 }} />
                </span>
              </Popconfirm>
            </>
          )}
        </div>
      )}

      {/* 卡片内容区（折叠时由 .directive-card-collapsed 样式控制隐藏） */}
      <div className="directive-card-content">
        <NestedLexicalEditor
          getContent={(cardNode: any) => cardNode.children || []}
          getUpdatedMdastNode={(cardNode: any, newChildren: any) => ({
            ...cardNode,
            children: newChildren,
          })}
          block
          contentEditableProps={{ style: { minHeight: 40 } }}
        />
      </div>
    </div>
  );
};
