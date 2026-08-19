/**
 * 统一工具栏组件
 * 所有按钮使用同一套 UI（ToolbarBaseButton / ToolbarDropdown）
 * 点击行为根据当前模式（rich-text / source）自动切换
 *
 * 模式切换由官方 DiffSourceToggleWrapper 提供
 */
import React from 'react';
import { Space, Button, Tooltip } from 'antd';
import { ColumnWidthOutlined, EditOutlined } from '@ant-design/icons';
import { DiffSourceToggleWrapper } from '@mdxeditor/editor';
import type { MDXEditorMethods } from '@mdxeditor/editor';
import ViewModeTracker from './ViewModeTracker';
import { useCursorPosition } from '../hooks/useCursorPosition';
import { toolbarGroups, type ToolbarActionContext } from '../utils/toolbarConfig';
import type { EditorCursorPos, ExtendedViewMode } from '../types';

export interface UnifiedToolbarProps {
  /** 要显示的按钮组 key 列表 */
  activeButtons: readonly string[];
  /** 富文本编辑器实例引用 */
  editorRef: React.RefObject<MDXEditorMethods | null>;
  /** CodeMirror EditorView 实例引用（源码模式使用） */
  editorViewRef: React.MutableRefObject<unknown>;
  /** 自定义工具栏内容 */
  customToolbarContent?: React.ReactNode;
  /** 是否只读 */
  readOnly?: boolean;
  /** 光标变化回调 */
  handleCursorChange: (pos: EditorCursorPos) => void;
  /** 视图模式变化回调 */
  handleModeChange: (mode: ExtendedViewMode) => void;
  /** 当前视图模式（split 模式下需要外部传入） */
  currentViewMode?: ExtendedViewMode;
  /** 目录是否显示 */
  tocVisible?: boolean;
  /** 切换目录显示 */
  onToggleToc?: () => void;
}

/** 分栏模式切换按钮 */
const SplitModeButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <Button type="primary" size="small" icon={<ColumnWidthOutlined />} onClick={onClick}>
    分栏
  </Button>
);

const UnifiedToolbar: React.FC<UnifiedToolbarProps> = ({
  activeButtons,
  editorRef,
  editorViewRef,
  customToolbarContent,
  readOnly,
  handleCursorChange,
  handleModeChange,
  currentViewMode,
  tocVisible,
  onToggleToc,
}) => {
  const groupMap = React.useMemo(() => {
    const map = new Map(toolbarGroups.map((g) => [g.key, g]));
    return map;
  }, []);

  const isSplitMode = currentViewMode === 'split';

  // 光标位置跟踪（split 模式下不跟踪）
  useCursorPosition({
    readOnly: readOnly || isSplitMode,
    onCursorChange: handleCursorChange,
  });

  /** 渲染统一工具栏按钮（根据模式绑定不同行为） */
  const renderButtons = (mode: 'rich-text' | 'source') => {
    const ctx: ToolbarActionContext = {
      mode,
      editorRef,
      editorViewRef: editorViewRef as React.MutableRefObject<any>,
    };
    return (
      <Space size={4} wrap>
        <SplitModeButton onClick={() => handleModeChange('split')} />
        {activeButtons.map((key) => {
          const group = groupMap.get(key);
          if (!group) return null;
          return <React.Fragment key={key}>{group.render(ctx)}</React.Fragment>;
        })}
        {customToolbarContent}
      </Space>
    );
  };

  return (
    <div className="mdx-editor-toolbar">
      <div className="toolbar-left">
        {isSplitMode ? (
          // split 模式：源码按钮组 + 退出分栏按钮
          <Space size={4} wrap>
            <Tooltip title="退出分栏模式">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleModeChange('rich-text')}
              />
            </Tooltip>
            {renderButtons('source')}
          </Space>
        ) : (
          // 其他模式：DiffSourceToggleWrapper 提供模式切换，children 和 SourceToolbar 渲染相同 UI
          <DiffSourceToggleWrapper SourceToolbar={renderButtons('source')}>
            {renderButtons('rich-text')}
          </DiffSourceToggleWrapper>
        )}
      </div>
      <div className="toolbar-right">
        {onToggleToc && (
          <Tooltip title={tocVisible ? '隐藏目录' : '显示目录'}>
            <Button
              type={tocVisible ? 'primary' : 'text'}
              size="small"
              icon={<span style={{ fontSize: 14 }}>☰</span>}
              onClick={onToggleToc}
            />
          </Tooltip>
        )}
        {!isSplitMode && <ViewModeTracker onViewModeChange={handleModeChange} />}
      </div>
    </div>
  );
};

export default UnifiedToolbar;
