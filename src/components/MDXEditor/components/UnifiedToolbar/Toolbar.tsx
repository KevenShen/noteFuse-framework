/**
 * 统一工具栏组件
 * 所有按钮使用同一套 UI（ToolbarBaseButton / ToolbarDropdown）
 * 点击行为根据当前模式（rich-text / source）自动切换
 *
 * 内部自管理：光标位置跟踪、按钮组计算、视图模式跟踪
 * 外部控制：目录显示（跨组件状态，同时控制 DocumentToc）
 * 四种模式统一切换：富文本 / 源码 / 对比 / 分栏
 */
import {
  CodeOutlined,
  ColumnHeightOutlined,
  ColumnWidthOutlined,
  EditOutlined,
} from '@ant-design/icons';
import {
  useRealm,
  viewMode$,
  type MDXEditorMethods,
  type ViewMode,
} from '@mdxeditor/editor';
import { Button, Space, Tooltip } from 'antd';
import React, { useEffect, useMemo } from 'react';
import { useCursorPosition } from '../../hooks';
import type { EditorCursorPos, EditorViewLike, ExtendedViewMode } from '../../types';
import {
  defaultToolbarButtons,
  toolbarGroups,
  type ToolbarActionContext,
} from './toolbarConfig';

export interface ToolbarProps {
  /** 富文本编辑器实例引用 */
  editorRef: React.RefObject<MDXEditorMethods | null>;
  /** CodeMirror EditorView 实例引用（源码模式使用） */
  editorViewRef: React.MutableRefObject<EditorViewLike | null>;
  /** 光标位置 ref（由父组件传入，内部更新，供外部获取） */
  cursorPosRef: React.MutableRefObject<EditorCursorPos>;
  /** 是否只读 */
  readOnly?: boolean;
  /** 当前视图模式（split 模式下需要外部传入） */
  currentViewMode?: ExtendedViewMode;
  /** 要显示的按钮组 key 列表（可选，默认用 defaultToolbarButtons） */
  toolbarButtons?: readonly string[];
  /** 自定义工具栏内容 */
  customToolbarContent?: React.ReactNode;
  /** 目录是否显示（跨组件状态，同时控制 DocumentToc） */
  tocVisible?: boolean;
  /** 切换目录显示 */
  onToggleToc?: () => void;
  /** 视图模式变化回调 */
  onModeChange: (mode: ExtendedViewMode) => void;
}

const ToolbarBase: React.FC<ToolbarProps> = ({
  editorRef,
  editorViewRef,
  cursorPosRef,
  readOnly,
  currentViewMode,
  toolbarButtons,
  customToolbarContent,
  tocVisible,
  onToggleToc,
  onModeChange,
}) => {
  // ==================== 按钮组计算（内部管理） ====================
  const activeButtons = useMemo(
    () => toolbarButtons ?? defaultToolbarButtons,
    [toolbarButtons],
  );

  const groupMap = useMemo(
    () => new Map(toolbarGroups.map((g) => [g.key, g])),
    [],
  );

  // 确保 currentViewMode 有默认值
  const safeViewMode: ExtendedViewMode = currentViewMode ?? 'rich-text';
  const isSplitMode = safeViewMode === 'split';
  const tocDisabled = safeViewMode === 'diff';

  // ==================== 光标位置跟踪（内部管理，更新到传入的 ref） ====================
  useCursorPosition({
    readOnly: readOnly || isSplitMode,
    onCursorChange: (pos: EditorCursorPos) => {
      cursorPosRef.current = { ...cursorPosRef.current, ...pos };
    },
  });

  // ==================== 按钮渲染 ====================
  const renderButtons = (mode: 'rich-text' | 'source') => {
    const ctx: ToolbarActionContext = {
      mode,
      editorRef,
      editorViewRef: editorViewRef,
    };
    return (
      <Space size={4} wrap>
        {activeButtons.map((key) => {
          const group = groupMap.get(key);
          if (!group) return null;
          return <React.Fragment key={key}>{group.render(ctx)}</React.Fragment>;
        })}
        {customToolbarContent}
      </Space>
    );
  };

  // 当前模式下使用的按钮组（分栏模式用源码按钮）
  const buttonMode: 'rich-text' | 'source' =
    safeViewMode === 'rich-text' ? 'rich-text' : 'source';

  // ==================== 渲染 ====================
  return (
    <div className="mdx-editor-toolbar">
      <div className="toolbar-left">
        {/* 编辑按钮组（根据当前模式选择 rich-text 或 source 版本） */}
        {renderButtons(buttonMode)}
      </div>
      <div className="toolbar-right">
        {/* 四种模式统一切换器 */}
        <ModeSwitcher
          currentViewMode={safeViewMode}
          onModeChange={onModeChange}
        />

        {/* 目录切换按钮（跨组件状态，由外部控制） */}
        {onToggleToc &&
          (tocVisible ? (
            <Button
              type="default"
              size="large"
              icon={<span style={{ fontSize: 14 }}>☰</span>}
              onClick={onToggleToc}
              disabled={tocDisabled}
            >
              隐藏目录
            </Button>
          ) : (
            <Tooltip title={tocDisabled ? '对比模式不支持目录' : '显示目录'}>
              <Button
                type="text"
                size="large"
                icon={<span style={{ fontSize: 14 }}>☰</span>}
                onClick={onToggleToc}
                disabled={tocDisabled}
              />
            </Tooltip>
          ))}

        {/* 视图模式跟踪器（非分栏模式下监听内部模式变化，同步到外部状态） */}
        {!isSplitMode && <ViewModeTracker onViewModeChange={onModeChange} />}
      </div>
    </div>
  );
};

// React.memo：只在关键 props 变化时重渲染，忽略回调函数引用变化
const Toolbar = React.memo(ToolbarBase, (prev, next) => {
  return (
    prev.toolbarButtons === next.toolbarButtons &&
    prev.readOnly === next.readOnly &&
    prev.currentViewMode === next.currentViewMode &&
    prev.tocVisible === next.tocVisible &&
    prev.editorRef === next.editorRef &&
    prev.editorViewRef === next.editorViewRef &&
    prev.cursorPosRef === next.cursorPosRef &&
    prev.customToolbarContent === next.customToolbarContent
  );
});

// ==================== ViewModeTracker 视图模式跟踪器 ====================
// 监听 @mdxeditor/editor 内部的 viewMode$ 变化，同步到外部状态
// 注意：useRealm 只能在 MDXEditor 内部调用，因此只在非分栏模式下渲染

interface ViewModeTrackerProps {
  onViewModeChange: (mode: ViewMode) => void;
}

const ViewModeTracker: React.FC<ViewModeTrackerProps> = ({
  onViewModeChange,
}) => {
  const realm = useRealm();
  useEffect(() => {
    const unsubscribe = realm.sub(viewMode$, (rawValue: ViewMode | null) => {
      onViewModeChange(rawValue ?? 'rich-text');
    });
    return unsubscribe;
  }, [realm, onViewModeChange]);
  return null;
};

// ==================== ModeSwitcher 四种模式统一切换器 ====================
// 模式：富文本(rich-text) / 源码(source) / 对比(diff) / 分栏(split)
// 注意：useRealm 只能在 MDXEditor 内部调用，分栏模式下工具栏在外部渲染，
// 因此拆分为两个子组件，根据当前模式条件渲染。

interface ModeSwitcherProps {
  currentViewMode: ExtendedViewMode;
  onModeChange: (mode: ExtendedViewMode) => void;
}

/** 模式按钮配置（icon + Tooltip 文字提示） */
const MODE_ITEMS: {
  key: ExtendedViewMode;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: 'rich-text', label: '富文本模式', icon: <EditOutlined /> },
  { key: 'source', label: '源码模式', icon: <CodeOutlined /> },
  { key: 'diff', label: '对比模式', icon: <ColumnHeightOutlined /> },
  { key: 'split', label: '分栏模式', icon: <ColumnWidthOutlined /> },
];

/** 非分栏模式切换器 — 内部调用 useRealm，可直接设置官方 viewMode$ */
const RichTextModeSwitcher: React.FC<ModeSwitcherProps> = ({
  currentViewMode,
  onModeChange,
}) => {
  const realm = useRealm();

  const handleModeClick = (mode: ExtendedViewMode) => {
    if (mode === 'split') {
      // split 是自定义模式，通过回调通知父组件
      onModeChange('split');
    } else {
      // rich-text/source/diff 是官方模式，通过 realm 设置 viewMode$
      // ViewModeTracker 会监听到变化并同步到外部状态
      realm.pub(viewMode$, mode);
    }
  };

  return (
    <div className="mode-switcher">
      {MODE_ITEMS.map((item) => (
        <Tooltip key={item.key} title={item.label}>
          <button
            type="button"
            className={`mode-switcher-btn ${
              currentViewMode === item.key ? 'active' : ''
            }`}
            onClick={() => handleModeClick(item.key)}
          >
            {item.icon}
          </button>
        </Tooltip>
      ))}
    </div>
  );
};

/** 分栏模式切换器 — 不依赖 useRealm，所有模式通过回调切换 */
const SplitModeSwitcher: React.FC<ModeSwitcherProps> = ({
  currentViewMode,
  onModeChange,
}) => {
  return (
    <div className="mode-switcher">
      {MODE_ITEMS.map((item) => (
        <Tooltip key={item.key} title={item.label}>
          <button
            type="button"
            className={`mode-switcher-btn ${
              currentViewMode === item.key ? 'active' : ''
            }`}
            onClick={() => onModeChange(item.key)}
          >
            {item.icon}
          </button>
        </Tooltip>
      ))}
    </div>
  );
};

/** 统一模式切换器入口（根据当前模式选择子组件） */
const ModeSwitcher: React.FC<ModeSwitcherProps> = (props) =>
  props.currentViewMode === 'split' ? (
    <SplitModeSwitcher {...props} />
  ) : (
    <RichTextModeSwitcher {...props} />
  );

export default Toolbar;
