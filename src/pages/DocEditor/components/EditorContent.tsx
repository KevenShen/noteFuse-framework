// src/pages/DocEditor/components/EditorContent.tsx
// 文档编辑页内容区 - 统一使用 MDXEditor 组件（编辑/预览两种模式 + 内容/大纲切换）
// 组件自治：自行从 docEditor model 获取编辑器模式状态，自行 dispatch 更新
import MDXEditor, { type MDXEditorRef } from '@/components/MDXEditor';
import { useShallowSelector } from '@/hooks';
import { UnorderedListOutlined, FileTextOutlined, ProfileOutlined } from '@ant-design/icons';
import { useDispatch } from '@umijs/max';
import { Button, Spin, Tag } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DocItem } from '@/pages/Project/types';
import type { DocVersion } from '@/components/DocTree/types';
import DocTitle from './DocTitle';
import './EditorContent.less';

interface EditorContentProps {
  doc: DocItem | null;
  currentVersion: DocVersion | null;
  loading: boolean;
  mdxEditorRef: React.RefObject<MDXEditorRef>;
  onContentChange: (content: string) => void;
  /** 大纲内容变化回调 */
  onOutlineContentChange?: (outline: string) => void;
  onTitleChange?: (title: string) => void;
  // ==================== 版本总览编辑模式 ====================
  /** 版本总览内容变化回调 */
  onVersionOverviewContentChange?: (content: string) => void;
  // ==================== 版本对比编辑模式 ====================
  /** 是否处于版本对比编辑模式 */
  versionEditMode?: boolean;
  /** 基底版本信息 */
  baseVersion?: any;
  /** 新版本信息 */
  newVersionInfo?: any;
  /** 新版本内容 */
  newVersionContent?: string;
  /** 新版本内容变化回调 */
  onNewVersionContentChange?: (content: string) => void;
  /** 保存新版本回调 */
  onSaveNewVersion?: () => void;
  /** 取消对比编辑模式回调 */
  onCancelVersionEdit?: () => void;
}

const EditorContent: React.FC<EditorContentProps> = ({
  doc,
  currentVersion,
  loading,
  mdxEditorRef,
  onContentChange,
  onOutlineContentChange,
  onTitleChange,
  // 版本总览编辑模式
  onVersionOverviewContentChange,
  // 版本对比编辑模式
  versionEditMode = false,
  baseVersion,
  newVersionInfo,
  newVersionContent = '',
  onNewVersionContentChange,
  onSaveNewVersion,
  onCancelVersionEdit,
}) => {
  const dispatch = useDispatch();

  // 自行从 docEditor model 获取编辑器模式状态
  const {
    editorMode,
    outlineMode,
    versionOverviewMode,
    saving,
  } = useShallowSelector((state: any) => ({
    editorMode: state.docEditor.editorMode,
    outlineMode: state.docEditor.outlineMode,
    versionOverviewMode: state.docEditor.versionOverviewMode,
    saving: state.docEditor.saving,
  }));

  // 文档内容、大纲内容、版本总览内容分别管理（state + ref 双轨，ref 保存最新值避免闭包问题）
  const [docContent, setDocContent] = useState('');
  const [outlineContent, setOutlineContent] = useState('');
  const [versionOverviewContent, setVersionOverviewContent] = useState('');
  const docContentRef = useRef('');
  const outlineContentRef = useRef('');
  const versionOverviewContentRef = useRef('');
  // 标记内容是否已初始化（避免重复 setMarkdown）
  const contentInitializedRef = useRef(false);
  // 上一次的 outlineMode，用于检测模式切换
  const prevOutlineModeRef = useRef(outlineMode);
  // 上一次的 versionOverviewMode，用于检测模式切换
  const prevVersionOverviewModeRef = useRef(versionOverviewMode);

  // 同步更新内容（state + ref 同时更新）
  const updateDocContent = useCallback((content: string) => {
    docContentRef.current = content;
    setDocContent(content);
  }, []);

  const updateOutlineContent = useCallback((content: string) => {
    outlineContentRef.current = content;
    setOutlineContent(content);
  }, []);

  const updateVersionOverviewContent = useCallback((content: string) => {
    versionOverviewContentRef.current = content;
    setVersionOverviewContent(content);
  }, []);

  // 初始化版本内容（文档内容 + 大纲内容 + 版本总览内容）
  useEffect(() => {
    if (currentVersion && doc) {
      const content = currentVersion.content || '';
      const outline = (currentVersion as any).outline || '';
      const versionOverview = doc.version_overview || '';
      updateDocContent(content);
      updateOutlineContent(outline);
      updateVersionOverviewContent(versionOverview);
      // 延迟到下一帧执行，确保编辑器实例已创建
      requestAnimationFrame(() => {
        // 根据当前模式初始化编辑器内容
        let initialContent = content;
        if (outlineMode) {
          initialContent = outline;
        } else if (versionOverviewMode) {
          initialContent = versionOverview;
        }
        mdxEditorRef.current?.setMarkdown(initialContent);
        contentInitializedRef.current = true;
      });
    }
  }, [currentVersion?.id, doc?.version_overview, mdxEditorRef, outlineMode, versionOverviewMode, updateDocContent, updateOutlineContent, updateVersionOverviewContent]);

  // 监听 outlineMode 变化，切换编辑器内容（使用同一个 MDXEditor 实例）
  // 关键：从 ref 读取最新内容，避免闭包中的旧 state 问题
  useEffect(() => {
    if (!contentInitializedRef.current) return;
    if (prevOutlineModeRef.current === outlineMode) return;

    // 保存当前编辑器内容到对应的 ref（立即保存，不依赖 setState）
    const currentContent = mdxEditorRef.current?.getMarkdown() || '';
    if (prevOutlineModeRef.current) {
      // 之前是大纲模式，保存大纲内容
      outlineContentRef.current = currentContent;
      setOutlineContent(currentContent);
      onOutlineContentChange?.(currentContent);
    } else {
      // 之前是内容模式，保存文档内容
      docContentRef.current = currentContent;
      setDocContent(currentContent);
      onContentChange(currentContent);
    }

    // 切换到新模式的内容（从 ref 读取最新值，确保是最新的内容）
    const targetContent = outlineMode ? outlineContentRef.current : docContentRef.current;
    requestAnimationFrame(() => {
      mdxEditorRef.current?.setMarkdown(targetContent);
    });

    prevOutlineModeRef.current = outlineMode;
  }, [outlineMode, mdxEditorRef, onContentChange, onOutlineContentChange]);

  // 内容变化（使用 useCallback 稳定引用，避免 MDXEditor 不必要重渲染）
  const handleContentChange = useCallback(
    (content: string) => {
      if (outlineMode) {
        // 大纲模式：更新大纲内容（ref + state）
        outlineContentRef.current = content;
        setOutlineContent(content);
        onOutlineContentChange?.(content);
      } else if (versionOverviewMode) {
        // 版本总览模式：更新版本总览内容（ref + state）
        versionOverviewContentRef.current = content;
        setVersionOverviewContent(content);
        onVersionOverviewContentChange?.(content);
      } else {
        // 内容模式：更新文档内容（ref + state）
        docContentRef.current = content;
        setDocContent(content);
        onContentChange(content);
      }
    },
    [outlineMode, versionOverviewMode, onContentChange, onOutlineContentChange, onVersionOverviewContentChange],
  );

  // 退出大纲模式
  const handleExitOutlineMode = () => {
    dispatch({ type: 'docEditor/setOutlineMode', payload: false });
  };

  // 退出版本总览模式
  const handleExitVersionOverviewMode = () => {
    dispatch({ type: 'docEditor/setVersionOverviewMode', payload: false });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载文档中..." />
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0', color: '#999' }}>
        文档不存在
      </div>
    );
  }

  // ==================== 版本对比编辑模式渲染 ====================
  if (versionEditMode && baseVersion && newVersionInfo) {
    return (
      <div
        className="doc-editor-content version-edit-mode"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* 版本对比编辑模式顶部提示条（仅显示信息，操作按钮已移至顶部 EditorToolbar） */}
        <div className="version-edit-banner">
          <div className="version-edit-banner-left" style={{ width: '100%' }}>
            <span className="version-edit-icon">🔄</span>
            <span className="version-edit-title">版本对比编辑</span>
            <Tag color="blue" className="version-edit-tag">新建版本</Tag>
            <span className="version-edit-info">
              基底版本：<strong>{baseVersion.version}</strong>
              {' → '}
              新版本：<strong>{newVersionInfo.version}</strong>
              （{newVersionInfo.status === 'draft' ? '草稿' : newVersionInfo.status === 'published' ? '已发布' : newVersionInfo.status === 'archived' ? '已归档' : '废弃'}）
            </span>
            <Tag color="default" style={{ marginLeft: 8 }}>
              左栏：基底版本（只读对比）
            </Tag>
            <Tag color="blue">
              右栏：新版本（可编辑）
            </Tag>
            <span style={{ marginLeft: 'auto', color: '#8c8c8c', fontSize: 12 }}>
              操作按钮请使用顶部工具栏的「取消」和「存为新版本」
            </span>
          </div>
        </div>

        {/* 使用同一个 MDXEditor 实例的对比模式：左栏基底版本（只读），右栏新版本（可编辑） */}
        <div
          className="version-edit-editor"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            padding: '0 12px 12px',
          }}
        >
          <MDXEditor
            key={`version-diff-${newVersionInfo.version}`}
            value={newVersionContent}
            onChange={onNewVersionContentChange}
            readOnly={false}
            showToolbar={true}
            showToc={false}
            height="100%"
            defaultViewMode="diff"
            oldVersionMarkdown={baseVersion.content || ''}
          />
        </div>
      </div>
    );
  }

  // ==================== 版本总览编辑模式渲染（使用 MDXEditor 对比模式） ====================
  if (versionOverviewMode && editorMode !== 'preview') {
    const originalOverview = doc?.version_overview || '';
    return (
      <div
        className="doc-editor-content version-overview-edit-mode"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* 版本总览编辑模式提示条 */}
        <div className="outline-mode-banner" style={{ background: 'linear-gradient(90deg, #f6ffed 0%, #f0fff0 100%)', borderBottom: '1px solid #b7eb8f' }}>
          <div className="outline-mode-banner-left">
            <ProfileOutlined className="outline-mode-icon" style={{ color: '#52c41a' }} />
            <span className="outline-mode-title" style={{ color: '#389e0d' }}>正在编辑版本总览</span>
            <Tag color="green" className="outline-mode-tag">对比模式</Tag>
            <span className="outline-mode-desc">
              左栏显示原始版本总览（只读对比），右栏编辑新版本总览，保存后将更新文档的 version_overview 字段
            </span>
          </div>
          <Button
            type="primary"
            size="small"
            icon={<FileTextOutlined />}
            onClick={handleExitVersionOverviewMode}
          >
            返回内容编辑
          </Button>
        </div>

        {/* 使用 MDXEditor 对比模式编辑版本总览：左栏原始内容（只读），右栏新内容（可编辑） */}
        <div
          className="version-overview-editor"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            padding: '0 12px 12px',
          }}
        >
          <MDXEditor
            key={`version-overview-${doc?.id}`}
            value={versionOverviewContent}
            onChange={handleContentChange}
            readOnly={false}
            showToolbar={true}
            showToc={false}
            height="100%"
            defaultViewMode="diff"
            oldVersionMarkdown={originalOverview}
          />
        </div>
      </div>
    );
  }

  // 根据模式计算 MDXEditor 配置
  const isReadOnly = editorMode === 'preview';
  const showToolbar = !isReadOnly;
  // 预览模式不需要 ref（只读），编辑模式需要 ref
  const editorRef = isReadOnly ? undefined : mdxEditorRef;

  // 当前显示的内容（用于 value 初始值）
  const currentContent = outlineMode ? outlineContent : docContent;

  return (
    <div
      className="doc-editor-content"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* 文档标题栏 */}
      <div
        className="doc-editor-header"
        style={{
          flexShrink: 0,
          // 标题和版本信息同一行，padding 更紧凑
          padding: isReadOnly ? '16px 32px 12px' : '10px 20px',
          borderBottom: '1px solid #f0f0f0',
          background: isReadOnly ? 'transparent' : '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          {/* 左侧：标题 + 版本信息（独立组件，避免输入时重渲染 MDXEditor） */}
          <DocTitle
            doc={doc}
            currentVersion={currentVersion}
            readOnly={isReadOnly}
            onTitleChange={onTitleChange}
          />

          {/* 右侧：预留空间（按钮已移至工具栏） */}
          <div style={{ flexShrink: 0, width: 1 }} />
        </div>
      </div>

      {/* 编辑器区域（flex:1 占满剩余空间，贴底） */}
      <div
        className="doc-editor-body"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
          // 左右 padding 与标题栏一致，确保标题 input 和 MDXEditor 同宽度
          padding: isReadOnly ? '0 32px 32px' : '0 20px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 大纲编辑模式提示条（醒目提示当前正在编辑大纲） */}
        {outlineMode && !isReadOnly && (
          <div className="outline-mode-banner">
            <div className="outline-mode-banner-left">
              <UnorderedListOutlined className="outline-mode-icon" />
              <span className="outline-mode-title">正在编辑大纲</span>
              <Tag color="orange" className="outline-mode-tag">大纲模式</Tag>
              <span className="outline-mode-desc">
                当前编辑的是文档大纲结构，保存后将更新版本的 outline 字段
              </span>
            </div>
            <Button
              type="primary"
              size="small"
              icon={<FileTextOutlined />}
              onClick={handleExitOutlineMode}
            >
              返回内容编辑
            </Button>
          </div>
        )}

        {/* 统一使用 MDXEditor，通过 props 控制编辑/预览两种模式 */}
        {/* 通过 key 强制在版本切换时重新初始化，避免内容残留 */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <MDXEditor
            key={currentVersion?.id}
            ref={editorRef}
            value={currentContent}
            onChange={isReadOnly ? undefined : handleContentChange}
            readOnly={isReadOnly}
            showToolbar={showToolbar}
            showToc={false}
            height="100%"
          />
        </div>
      </div>
    </div>
  );
};

export default EditorContent;
