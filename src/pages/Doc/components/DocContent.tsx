// src/pages/Doc/components/DocContent.tsx
// 文档详情页内容区 - 标题 + Markdown 内容 + 作者信息 + 标签 + 上下篇
// 组件自治：自行从 model 获取 UI 状态（阅读模式/批注编辑/收藏等），自行 dispatch 更新
import MDXEditor, { type MDXEditorRef } from '@/components/MDXEditor';
import type { DocVersion } from '@/components/DocTree/types';
import { useShallowSelector } from '@/hooks';
import { copyToClipboard } from '@/utils/index';
import {
  ClockCircleOutlined,
  DownloadOutlined,
  LeftOutlined,
  MessageOutlined,
  ProfileOutlined,
  RightOutlined,
  ShareAltOutlined,
  StarOutlined,
  TagsOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useDispatch } from '@umijs/max';
import { Avatar, Button, Divider, Space, Tag, Tooltip, message } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';
import React, { useEffect, useMemo, useRef } from 'react';
import type { DocItem } from '@/pages/Project/types';
import DocTitle from './DocTitle';
import { mergeAnnotations, filterMarkers, extractSectionByTitle, type AnnotationItem } from '../utils/annotationUtils';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface DocContentProps {
  doc: DocItem | null;
  /** 当前版本 ID（从路由获取，用于计算 currentVersion） */
  versionId: string | null;
  loading: boolean;
  markdownDocRef: React.RefObject<MDXEditorRef>;
  onSelectDoc: (docId: number) => void;
  onSaveAnnotation: () => void;
  onCancelAnnotationEdit: () => void;
  onEditAnnotation?: (annotation: AnnotationItem) => void;
  onDeleteAnnotation?: (annotation: AnnotationItem) => void;
}

const DocContent: React.FC<DocContentProps> = ({
  doc,
  versionId,
  loading,
  markdownDocRef,
  onSelectDoc,
  onSaveAnnotation,
  onCancelAnnotationEdit,
  onEditAnnotation,
  onDeleteAnnotation,
}) => {
  const dispatch = useDispatch();

  // 自行从 model 获取 UI 状态和数据
  const {
    outlineMode,
    outlineContent,
    versionOverviewMode,
    focusMode,
    focusAnchor,
    collected,
    readMode,
    annotations,
    annotationEditMode,
    editingAnnotation,
    annotationContent,
    annotationSaving,
    docVersions,
    docList,
  } = useShallowSelector((state: any) => ({
    outlineMode: state.docDetail.outlineMode,
    outlineContent: state.docDetail.outlineContent,
    versionOverviewMode: state.docDetail.versionOverviewMode,
    focusMode: state.docDetail.focusMode,
    focusAnchor: state.docDetail.focusAnchor,
    collected: state.docDetail.collected,
    readMode: state.docDetail.readMode,
    annotations: state.docAnnotations.docAnnotations,
    annotationEditMode: state.docAnnotations.annotationEditMode,
    editingAnnotation: state.docAnnotations.editingAnnotation,
    annotationContent: state.docAnnotations.annotationContent,
    annotationSaving: state.docAnnotations.annotationSaving,
    docVersions: state.docVersions.docVersions,
    docList: state.docList.docList,
  }));

  // ==================== 当前版本（组件内部计算） ====================
  const currentVersion = useMemo(() => {
    if (!docVersions || docVersions.length === 0 || !doc?.id) return null;
    if (versionId) {
      return docVersions.find((v: any) => v.id === Number(versionId)) || null;
    }
    return (
      docVersions.find((v: any) => v.doc_id === doc.id && v.is_current) || null
    );
  }, [docVersions, doc?.id, versionId]);

  // ==================== 上一篇/下一篇（组件内部计算） ====================
  const { prev: prevDoc, next: nextDoc } = useMemo(() => {
    if (!doc?.id || !docList) return { prev: null, next: null };
    const allDocs = [...docList].sort((a: any, b: any) => a.sort - b.sort);
    const currentIndex = allDocs.findIndex((d: any) => d.id === doc.id);
    return {
      prev:
        currentIndex > 0
          ? {
              key: String(allDocs[currentIndex - 1].id),
              title: allDocs[currentIndex - 1].name,
            }
          : null,
      next:
        currentIndex < allDocs.length - 1 && currentIndex >= 0
          ? {
              key: String(allDocs[currentIndex + 1].id),
              title: allDocs[currentIndex + 1].name,
            }
          : null,
    };
  }, [docList, doc?.id]);

  // 内容容器 ref（用于事件委托）
  const contentContainerRef = useRef<HTMLDivElement>(null);

  // 分享文档
  const handleShare = () => {
    const url = window.location.href;
    copyToClipboard(url);
    message.success('文档链接已复制到剪贴板');
  };

  // 切换收藏
  const handleToggleCollect = () => {
    dispatch({ type: 'docDetail/toggleCollected' });
  };

  // 退出大纲模式
  const handleExitOutline = () => {
    dispatch({ type: 'docDetail/setOutlineMode', payload: false });
  };

  // 退出版本总览模式
  const handleExitVersionOverview = () => {
    dispatch({ type: 'docDetail/setVersionOverviewMode', payload: false });
  };

  // 退出聚焦模式
  const handleExitFocus = () => {
    dispatch({ type: 'docDetail/setFocusMode', payload: false });
    dispatch({ type: 'docDetail/setFocusAnchor', payload: '' });
  };

  // 批注内容变化
  const handleAnnotationContentChange = (content: string) => {
    dispatch({ type: 'docAnnotations/setAnnotationContent', payload: content });
  };

  // 事件委托：处理批注块的编辑/删除按钮点击
  useEffect(() => {
    const container = contentContainerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 检查是否点击了批注块的按钮
      const btn = target.closest('.doc-annotation-btn') as HTMLElement | null;
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const annotationId = Number(btn.getAttribute('data-annotation-id'));

      if (!action || !annotationId) return;

      // 找到对应的批注对象
      const annotation = annotations?.find((a: any) => a.id === annotationId);
      if (!annotation) return;

      if (action === 'edit' && onEditAnnotation) {
        onEditAnnotation(annotation);
      } else if (action === 'delete' && onDeleteAnnotation) {
        onDeleteAnnotation(annotation);
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [annotations, onEditAnnotation, onDeleteAnnotation]);

  // 【注】批注编辑模式切换时的内容同步已由 MDXEditor 组件自动处理
  // MDXEditor 现在支持可编辑模式下 value 变化自动同步 displayValue
  // 进入批注编辑模式：value 变为 annotationContent（空），编辑器自动清空
  // 退出批注编辑模式：value 恢复为原文，编辑器自动恢复

  if (loading) {
    return (
      <div className="doc-content-wrapper">
        <div className="doc-detail">
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
            加载文档内容中...
          </div>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="doc-content-wrapper">
        <div className="doc-detail">
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
            文档不存在
          </div>
        </div>
      </div>
    );
  }

  // 聚焦模式：只显示聚焦的锚点内容
  if (focusMode && focusAnchor) {
    // 从原文中提取指定标题的章节内容
    const fullContent = currentVersion?.content || doc?.content || '';
    const sectionContent = extractSectionByTitle(fullContent, focusAnchor);

    return (
      <div className="doc-content-wrapper focus-mode">
        <div className="focus-mode-header">
          <span className="focus-mode-title">聚焦阅读：{focusAnchor}</span>
          <Button type="primary" size="small" onClick={handleExitFocus}>
            退出聚焦
          </Button>
        </div>
        <div className="focus-mode-content">
          {sectionContent ? (
            <MDXEditor
              value={sectionContent}
              readOnly={true}
              height="100%"
              showToc={false}
              showToolbar={false}
              defaultViewMode="source"
            />
          ) : (
            <div style={{ padding: '40px 20px', color: '#999', textAlign: 'center' }}>
              未找到「{focusAnchor}」章节内容
            </div>
          )}
        </div>
      </div>
    );
  }

  // Markdown 内容：优先取单独传入的当前版本 content，回退到 doc.content，最后默认提示
  const rawContent = outlineMode
    ? outlineContent
    : versionOverviewMode
      ? doc?.version_overview || ''
      : annotationEditMode
        ? annotationContent  // 批注编辑模式：显示批注内容
        : currentVersion?.content || doc?.content || `# ${doc?.name || '文档'}\n\n该文档暂无内容。`;

  // 根据阅读模式处理内容
  // 大纲模式、版本总览模式、批注编辑模式不处理标记
  const content = outlineMode || versionOverviewMode || annotationEditMode
    ? rawContent
    : readMode === 'annotation'
      ? mergeAnnotations(rawContent, annotations || [])  // 批注模式：合并原文和批注
      : filterMarkers(rawContent);                  // 原文模式：过滤标记

  return (
    <div className="doc-content-wrapper" ref={contentContainerRef}>
      <div className="doc-detail">
        {/* 标题 + 版本信息（同一行，标题居中，版本信息贴着右边） */}
        <DocTitle title={doc.name} currentVersion={currentVersion} />

        <Divider style={{ margin: '6px 0 2px' }} />

        {/* 大纲阅读模式提示条 */}
        {outlineMode && (
          <div className="outline-mode-banner">
            <span className="outline-mode-title">
              <UnorderedListOutlined /> 大纲阅读模式
            </span>
            <span className="outline-mode-desc">
              当前显示文档大纲，用于快速预览文档结构
            </span>
            <Button type="primary" size="small" onClick={handleExitOutline}>
              退出大纲
            </Button>
          </div>
        )}

        {/* 版本总览阅读模式提示条 */}
        {versionOverviewMode && (
          <div className="outline-mode-banner" style={{ background: 'linear-gradient(90deg, #f6ffed 0%, #f0fff0 100%)', borderBottom: '1px solid #b7eb8f' }}>
            <span className="outline-mode-title" style={{ color: '#389e0d' }}>
              <ProfileOutlined /> 版本总览模式
            </span>
            <span className="outline-mode-desc">
              当前显示文档版本更新总览，用于快速查看版本变更记录
            </span>
            <Button type="primary" size="small" onClick={handleExitVersionOverview}>
              退出总览
            </Button>
          </div>
        )}

        {/* 批注编辑模式提示条 */}
        {annotationEditMode && (
          <div className="annotation-edit-banner">
            <span className="annotation-edit-title">
              <MessageOutlined /> 正在编辑批注
              {editingAnnotation ? `（批注 #${editingAnnotation.id}）` : '（新批注）'}
            </span>
            <span className="annotation-edit-desc">
              当前编辑批注内容，支持 Markdown 格式，点击保存完成编辑
            </span>
            <div className="annotation-edit-actions">
              <Button
                type="primary"
                size="small"
                loading={annotationSaving}
                onClick={onSaveAnnotation}
              >
                保存
              </Button>
              <Button size="small" onClick={onCancelAnnotationEdit}>
                取消
              </Button>
            </div>
          </div>
        )}

        {/* Markdown 内容区：flex: 1 填充剩余空间，内容多时滚动 */}
        <div className="doc-markdown-container">
          <MDXEditor
            ref={markdownDocRef}
            value={content}
            readOnly={!annotationEditMode}  // 批注编辑模式下可编辑
            height="100%"
            showToc={false}
            showToolbar={annotationEditMode}  // 批注编辑模式下显示工具栏
            onChange={annotationEditMode ? handleAnnotationContentChange : undefined}
          />
        </div>

        {/* 底部内容容器：内容少时自动贴底，内容多时正常流动 */}
        <div className="doc-detail-bottom">
          <Divider style={{ margin: '12px 0 16px' }} />

          <div className="doc-detail-footer">
          <div className="footer-main">
            <div className="footer-left">
              <Avatar
                size={20}
                style={{ backgroundColor: '#1890ff', fontSize: 10 }}
              >
                {currentVersion?.author_name?.charAt(0) || doc?.author_name?.charAt(0) || 'U'}
              </Avatar>
              <span className="footer-author">{currentVersion?.author_name || doc?.author_name || '未知'}</span>
              <span className="footer-divider">·</span>
              <span className="footer-time">
                <ClockCircleOutlined />{' '}
                {dayjs(doc.modify_time).format('YYYY年M月D日 HH:mm')}
              </span>
            </div>
            <div className="footer-right">
              <Tooltip title="转发文档">
                <Button
                  type="text"
                  size="small"
                  icon={<ShareAltOutlined />}
                  onClick={handleShare}
                >
                  转发文档
                </Button>
              </Tooltip>
              <Tooltip title={collected ? '取消收藏' : '收藏文档'}>
                <Button
                  type="text"
                  size="small"
                  icon={
                    <StarOutlined
                      style={{
                        color: collected ? '#faad14' : undefined,
                        fill: collected ? '#faad14' : 'none',
                      }}
                    />
                  }
                  onClick={handleToggleCollect}
                >
                  收藏文档
                </Button>
              </Tooltip>
              <Tooltip title="下载文档">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => message.info('下载功能开发中')}
                >
                  下载文档
                </Button>
              </Tooltip>
            </div>
          </div>

          {/* 文档标签 */}
          {doc.tags && doc.tags.length > 0 && (
            <div className="footer-tags">
              <TagsOutlined className="footer-tags-icon" />
              <Space size={6} wrap>
                {doc.tags.map((tag: any) => (
                  <Tag key={tag.id} color={tag.color} className="footer-tag">
                    {tag.name}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </div>

        {/* 上一篇/下一篇 */}
        <div className="doc-nav">
          {prevDoc ? (
            <div
              className="doc-nav-prev"
              onClick={() => onSelectDoc(Number(prevDoc.key))}
            >
              <LeftOutlined className="nav-icon" />
              <div className="nav-content">
                <div className="nav-label">上一篇</div>
                <div className="nav-title">{prevDoc.title}</div>
              </div>
            </div>
          ) : (
            <div className="nav-placeholder" />
          )}
          {nextDoc ? (
            <div
              className="doc-nav-next"
              onClick={() => onSelectDoc(Number(nextDoc.key))}
            >
              <div className="nav-content">
                <div className="nav-label">下一篇</div>
                <div className="nav-title">{nextDoc.title}</div>
              </div>
              <RightOutlined className="nav-icon" />
            </div>
          ) : (
            <div className="nav-placeholder" />
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default DocContent;
