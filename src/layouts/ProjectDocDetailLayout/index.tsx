// src/layouts/ProjectDetailLayout/index.tsx
// 文集详情页布局 - 左侧目录 + 右侧内容 + 工具栏
import {
  ArrowLeftOutlined,
  BulbOutlined,
  CloseOutlined,
  DownloadOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  MoreOutlined,
  PlusOutlined,
  SettingOutlined,
  ShareAltOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, MenuProps, Space, Tooltip } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './index.less';

export interface ProjectDocDetailLayoutProps {
  /** 左侧标题 */
  sidebarTitle?: React.ReactNode;
  /** 左侧内容（自定义 React 节点，可传入 DocTree 等组件） */
  sidebarContent: React.ReactNode;
  /** 标题点击回调（返回概览） */
  onTitleClick?: () => void;
  /** 右侧顶部工具栏额外内容 */
  toolbarExtra?: React.ReactNode;
  /** 右侧工具栏更多菜单（不传则用默认） */
  moreMenuItems?: MenuProps['items'];
  /** 新建按钮文字 */
  createButtonText?: string;
  onCreate?: () => void;
  onBack?: () => void;
  onSettings?: () => void;
  onShare?: () => void;
  onExport?: () => void;
  /** 内容区 */
  children: React.ReactNode;
  /** 右侧工具坞内容 */
  rightPanel?: React.ReactNode;
  showRightPanel?: boolean;
  rightPanelWidth?: number;
  /** 内容区初始字体大小（px），默认 18 */
  defaultFontSize?: number;
}

const ProjectDocDetailLayout: React.FC<ProjectDocDetailLayoutProps> = ({
  sidebarTitle,
  sidebarContent,
  onTitleClick,
  toolbarExtra,
  moreMenuItems,
  createButtonText = '新建文档',
  onCreate,
  onBack,
  onSettings,
  onShare,
  onExport,
  children,
  rightPanel,
  showRightPanel = false,
  rightPanelWidth = 260,
  defaultFontSize = 18,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerVisible, setMobileDrawerVisible] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [fontSize, setFontSize] = useState(defaultFontSize);
  const [darkMode, setDarkMode] = useState(false);
  const [contentFullscreen, setContentFullscreen] = useState(false);
  // 工具栏隐藏状态（滚动时动态隐藏/显示）
  const [toolbarHidden, setToolbarHidden] = useState(false);
  // 上一次滚动位置（用于判断滚动方向）
  const lastScrollTopRef = useRef(0);
  // 滚动事件节流计时器
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 工具栏状态锁定计时器（防止频繁切换导致跳动）
  const toolbarLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 工具栏状态是否被锁定
  const toolbarLockedRef = useRef(false);

  const resizingRef = useRef<{ startX: number; startWidth: number }>({
    startX: 0,
    startWidth: 0,
  });
  const contentRef = useRef<HTMLDivElement>(null);

  // ========== 响应式 ==========
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) setSidebarCollapsed(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ========== 深色模式 ==========
  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', darkMode);
    return () => document.documentElement.classList.remove('dark-mode');
  }, [darkMode]);

  // ========== 侧边栏拖拽宽度 ==========
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      resizingRef.current = { startX: e.clientX, startWidth: sidebarWidth };
    },
    [sidebarWidth],
  );

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizingRef.current.startX;
      setSidebarWidth(
        Math.min(Math.max(resizingRef.current.startWidth + delta, 200), 400),
      );
    };
    const handleMouseUp = () => setIsResizing(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // ========== 全屏 ==========
  const toggleContentFullscreen = async () => {
    const el = contentRef.current as any;
    const doc = document as any;
    try {
      if (!contentFullscreen && el) {
        setContentFullscreen(true);
        await (
          el.requestFullscreen ||
          el.webkitRequestFullscreen ||
          el.mozRequestFullScreen ||
          el.msRequestFullscreen
        )?.call(el);
      } else {
        setContentFullscreen(false);
        await (
          doc.exitFullscreen ||
          doc.webkitExitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.msExitFullscreen
        )?.call(doc);
      }
    } catch (e) {
      console.error('全屏操作失败', e);
      setContentFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const fsEl =
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement;
      setContentFullscreen(!!fsEl && fsEl === contentRef.current);
    };
    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange',
    ];
    events.forEach((evt) =>
      document.addEventListener(evt, handleFullscreenChange),
    );
    return () =>
      events.forEach((evt) =>
        document.removeEventListener(evt, handleFullscreenChange),
      );
  }, []);

  // ========== 字体 ==========
  const increaseFont = () => setFontSize((f) => Math.min(f + 2, 28));
  const decreaseFont = () => setFontSize((f) => Math.max(f - 2, 14));

  // ========== 工具栏滚动隐藏/显示 ==========
  // 下拉（向下滚动）时隐藏工具栏，上拉（向上滚动）时显示工具栏
  // 滚动到顶部时始终显示工具栏
  // 【优化】增加状态锁定机制，防止滚动到底部时弹性滚动导致频繁切换造成跳动
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const handleScroll = () => {
      // 节流：避免频繁触发
      if (scrollTimerRef.current) return;
      scrollTimerRef.current = setTimeout(() => {
        scrollTimerRef.current = null;
      }, 16); // 约 60fps

      // 如果工具栏状态被锁定，不处理方向变化（但仍更新滚动位置）
      const currentScrollTop = contentEl.scrollTop;
      const scrollDelta = currentScrollTop - lastScrollTopRef.current;
      lastScrollTopRef.current = currentScrollTop;

      if (toolbarLockedRef.current) return;

      // 计算是否滚动到底部（允许 5px 误差）
      const isAtBottom =
        contentEl.scrollHeight - contentEl.clientHeight - currentScrollTop <= 5;

      // 滚动到顶部时，始终显示工具栏
      if (currentScrollTop <= 10) {
        setToolbarHidden(false);
      }
      // 滚动到底部时，保持隐藏（避免弹性滚动导致反复切换）
      else if (isAtBottom) {
        setToolbarHidden(true);
      }
      // 向下滚动（下拉）且滚动距离超过阈值，隐藏工具栏
      else if (scrollDelta > 5) {
        setToolbarHidden(true);
        // 锁定状态 300ms，防止频繁切换
        lockToolbarState();
      }
      // 向上滚动（上拉）且滚动距离超过阈值，显示工具栏
      else if (scrollDelta < -5) {
        setToolbarHidden(false);
        // 锁定状态 300ms，防止频繁切换
        lockToolbarState();
      }
    };

    // 锁定工具栏状态一段时间，防止弹性滚动导致频繁切换
    const lockToolbarState = () => {
      if (toolbarLockTimerRef.current) {
        clearTimeout(toolbarLockTimerRef.current);
      }
      toolbarLockedRef.current = true;
      toolbarLockTimerRef.current = setTimeout(() => {
        toolbarLockedRef.current = false;
        toolbarLockTimerRef.current = null;
      }, 300);
    };

    contentEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      contentEl.removeEventListener('scroll', handleScroll);
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
      if (toolbarLockTimerRef.current) {
        clearTimeout(toolbarLockTimerRef.current);
      }
    };
  }, []);

  // ========== 公共渲染片段 ==========
  // 工具按钮：PC端带Tooltip，移动端不带
  const renderToolButton = (
    icon: React.ReactNode,
    onClick: () => void,
    title: string | undefined,
    withTooltip: boolean,
  ) => {
    const btn = (
      <Button size="large" type="text" icon={icon} onClick={onClick} />
    );
    return withTooltip && title ? <Tooltip title={title}>{btn}</Tooltip> : btn;
  };

  // 阅读控制按钮
  const renderReadingControls = (withTooltip: boolean) => (
    <Space size={0}>
      {!withTooltip && (
        <Button
          size="large"
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setMobileDrawerVisible(true)}
        />
      )}
      {withTooltip &&
        renderToolButton(
          sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />,
          () => setSidebarCollapsed(!sidebarCollapsed),
          sidebarCollapsed ? '展开目录' : '收起目录',
          withTooltip,
        )}
      {renderToolButton(
        <ZoomOutOutlined />,
        decreaseFont,
        '减小字体',
        withTooltip,
      )}
      {renderToolButton(
        <ZoomInOutlined />,
        increaseFont,
        '增大字体',
        withTooltip,
      )}
      {renderToolButton(
        <BulbOutlined />,
        () => setDarkMode(!darkMode),
        darkMode ? '浅色模式' : '深色模式',
        withTooltip,
      )}
      {renderToolButton(
        contentFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />,
        toggleContentFullscreen,
        contentFullscreen ? '退出全屏' : '内容全屏',
        withTooltip,
      )}
    </Space>
  );

  // 更多菜单
  const finalMoreItems: MenuProps['items'] = moreMenuItems || [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '文集设置',
      onClick: onSettings,
    },
    {
      key: 'share',
      icon: <ShareAltOutlined />,
      label: '分享文集',
      onClick: onShare,
    },
    {
      key: 'export',
      icon: <DownloadOutlined />,
      label: '导出文集',
      onClick: onExport,
    },
  ];

  // 右侧操作按钮
  const renderActionButtons = (small: boolean) => (
    <Space size={small ? 0 : 8}>
      {onCreate && (
        <Button
          type="primary"
          size={small ? 'small' : 'medium'}
          icon={<PlusOutlined />}
          onClick={onCreate}
        >
          {!small && createButtonText}
        </Button>
      )}
      {toolbarExtra}
      <Dropdown menu={{ items: finalMoreItems }} trigger={['click']}>
        <Button size="large" type="text" icon={<MoreOutlined />} />
      </Dropdown>
    </Space>
  );

  // 侧边栏头部（返回+标题）
  const renderSidebarHeader = (onClose?: () => void) => (
    <div className="doc-sidebar-header">
      <Space>
        {onBack && (
          <Button
            type="text"
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              onClose?.();
              onBack?.();
            }}
            className="sidebar-back-btn"
          />
        )}
        <div
          className="sidebar-title"
          onClick={() => {
            onClose?.();
            onTitleClick?.();
          }}
          style={{ cursor: onTitleClick ? 'pointer' : 'default' }}
        >
          {sidebarTitle}
        </div>
      </Space>
      {onClose && (
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onClose}
        />
      )}
    </div>
  );

  // 侧边栏主体（头部+内容）
  const renderSidebarBody = (onClose?: () => void) => (
    <>
      {renderSidebarHeader(onClose)}
      <div className="doc-sidebar-content">{sidebarContent}</div>
    </>
  );

  const rootClassName = `doc-layout ${isMobile ? 'doc-layout-mobile' : ''} ${
    sidebarCollapsed ? 'sidebar-collapsed' : ''
  } ${darkMode ? 'dark-mode' : ''}`;

  // ========== 移动端布局 ==========
  if (isMobile) {
    return (
      <div
        className={rootClassName}
        style={{ ['--doc-font-size' as any]: `${fontSize}px` }}
      >
        <div className={`doc-toolbar ${toolbarHidden ? 'toolbar-hidden' : ''}`}>
          {renderReadingControls(false)}
          {renderActionButtons(true)}
        </div>

        {/* 移动端抽屉 */}
        <div
          className={`mobile-drawer-mask ${mobileDrawerVisible ? 'show' : ''}`}
          onClick={() => setMobileDrawerVisible(false)}
        />
        <div
          className={`mobile-drawer-sidebar ${
            mobileDrawerVisible ? 'show' : ''
          }`}
        >
          {renderSidebarBody(() => setMobileDrawerVisible(false))}
        </div>

        <div
          className={`doc-content ${
            contentFullscreen ? 'content-fullscreen' : ''
          }`}
          ref={contentRef}
        >
          {children}
        </div>
      </div>
    );
  }

  // ========== PC 端布局 ==========
  return (
    <div
      className={rootClassName}
      style={{ ['--doc-font-size' as any]: `${fontSize}px` }}
    >
      {!sidebarCollapsed && (
        <>
          <div className="doc-sidebar" style={{ width: sidebarWidth }}>
            {renderSidebarBody()}
          </div>
          <div
            className={`doc-resizer ${isResizing ? 'resizing' : ''}`}
            onMouseDown={handleResizeStart}
          />
        </>
      )}

      <div className="doc-main">
        <div className={`doc-toolbar ${toolbarHidden ? 'toolbar-hidden' : ''}`}>
          {renderReadingControls(true)}
          {renderActionButtons(false)}
        </div>
        <div
          className={`doc-content ${
            contentFullscreen ? 'content-fullscreen' : ''
          }`}
          ref={contentRef}
        >
          {children}
        </div>
      </div>

      {showRightPanel && rightPanel && (
        <div className="doc-right-panel" style={{ width: rightPanelWidth }}>
          {rightPanel}
        </div>
      )}
    </div>
  );
};

export default ProjectDocDetailLayout;
