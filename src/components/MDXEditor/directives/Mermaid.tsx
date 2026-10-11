/**
 * Mermaid 图表容器指令（:::mermaid）
 *
 * P0：基础渲染 — mermaid.render() 异步渲染 SVG
 * P2：增强功能 — 复制源码、下载 SVG、缩放控制、标题双击编辑、删除、只读适配
 * P3：优化与 polish — 编辑/预览切换、类型切换、SVG 缓存、错误恢复、实时预览
 *
 * Mermaid 源码用 ```text 代码块包裹，确保行首缩进被 Markdown 解析器保留。
 * 编辑/预览容器始终挂载，用 CSS display 控制显隐，避免条件渲染导致 ref 丢失。
 */
import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ReloadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { useLexicalNodeRemove, useMdastNodeUpdater } from '@mdxeditor/editor';
import { Popconfirm, Select } from 'antd';
import mermaid from 'mermaid';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  MERMAID_TYPE_LIST,
  getMermaidContent,
} from '../components/EditorTools/generateMarkup';
import { useEditorReadOnly } from '../index';

// 全局只初始化一次
let mermaidInitialized = false;
const initMermaid = () => {
  if (!mermaidInitialized) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
    mermaidInitialized = true;
  }
};

// 唯一 id 计数器（替代 Math.random，避免冲突）
let mermaidIdCounter = 0;
const genId = () => `mermaid-${++mermaidIdCounter}`;

/** 递归提取 mdast 节点中的 Mermaid 源码（兼容 text/paragraph/code/pre） */
const extractMermaidCode = (node: any): string => {
  if (node.type === 'text' || node.type === 'code') return node.value || '';
  if (node.type === 'pre')
    return node.children?.map(extractMermaidCode).join('') || '';
  if (node.children) return node.children.map(extractMermaidCode).join('');
  return '';
};

/** 工具栏按钮通用样式（模块级常量，避免每次渲染重新创建） */
const TOOLBAR_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 4,
  cursor: 'pointer',
  color: '#595959',
  fontSize: 14,
  transition: 'all 0.2s',
  border: 'none',
  background: 'transparent',
};

/** Mermaid 类型下拉选项（模块级常量，避免每次渲染重新生成） */
const MERMAID_TYPE_OPTIONS = MERMAID_TYPE_LIST.map((t) => ({
  value: t,
  label: t,
}));

/** 防抖 hook */
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

/** 可编辑的图表标题（双击编辑） */
const EditableMermaidTitle: React.FC<{
  title: string;
  onChange: (newTitle: string) => void;
}> = ({ title, onChange }) => {
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
    if (trimmed !== title) onChange(trimmed);
    else setDraft(title);
  };

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
        className="directive-mermaid-title-edit"
        value={draft}
        placeholder="图表标题"
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
    );
  }

  return (
    <div
      className="directive-mermaid-title"
      onClick={handleClick}
      title={readOnly ? undefined : '双击编辑标题'}
    >
      {title || <span style={{ color: '#bfbfbf' }}>添加标题</span>}
    </div>
  );
};

export const MermaidDirectiveEditor: React.FC<any> = (props) => {
  const { mdastNode } = props;
  const containerRef = useRef<HTMLDivElement>(null); // 预览模式 SVG 容器
  const editPreviewRef = useRef<HTMLDivElement>(null); // 编辑模式实时预览 SVG 容器
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftCode, setDraftCode] = useState('');

  // SVG 缓存：相同源码不重复渲染
  const svgCacheRef = useRef<Map<string, string>>(new Map());

  const readOnly = useEditorReadOnly();
  const updateMdastNode = useMdastNodeUpdater<any>();
  const removeNode = useLexicalNodeRemove();

  // 提取 Mermaid 源码（只取第一个 code 子节点）
  const firstChild = mdastNode?.children?.[0];
  const mermaidCode: string = firstChild
    ? extractMermaidCode(firstChild).trim()
    : '';
  const title: string = mdastNode?.attributes?.title || '';
  const type: string = mdastNode?.attributes?.type || 'flowchart';

  // 编辑模式下的实时预览源码（300ms 防抖）
  const debouncedDraft = useDebounce(draftCode, 300);
  const renderCode = isEditing ? debouncedDraft : mermaidCode;

  // 异步渲染 SVG（带缓存）
  // 用 useLayoutEffect 确保 DOM 更新后同步执行，避免条件渲染导致 ref 丢失
  // 根据 isEditing 选择正确的 ref（预览模式用 containerRef，编辑模式用 editPreviewRef）
  useLayoutEffect(() => {
    if (!renderCode) return;
    initMermaid();

    const targetRef = isEditing ? editPreviewRef : containerRef;
    let cancelled = false;

    // 缓存命中：直接复用 SVG
    const cached = svgCacheRef.current.get(renderCode);
    if (cached && targetRef.current) {
      targetRef.current.innerHTML = cached;
      setLoading(false);
      setError(null);
      return;
    }

    const id = genId();
    setLoading(true);
    setError(null);

    mermaid
      .render(id, renderCode)
      .then((result: { svg: string }) => {
        if (!cancelled && targetRef.current) {
          targetRef.current.innerHTML = result.svg;
          svgCacheRef.current.set(renderCode, result.svg);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Mermaid 渲染失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [renderCode, isEditing]);

  // 复制源码（提取公共逻辑，避免 try/catch 重复）
  const markCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopySource = async () => {
    const code = isEditing ? draftCode : mermaidCode;
    try {
      await navigator.clipboard.writeText(code);
      markCopied();
    } catch {
      // 降级方案：用临时 textarea + execCommand
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      markCopied();
    }
  };

  // 下载 SVG（根据模式选择正确的 ref，修复编辑模式下下载失败的 bug）
  const handleDownloadSvg = () => {
    const targetRef = isEditing ? editPreviewRef : containerRef;
    const svgEl = targetRef.current?.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mermaid-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 缩放控制
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.1, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.3));
  const handleZoomReset = () => setZoom(1);

  // 标题更新
  const handleTitleChange = (newTitle: string) => {
    updateMdastNode({
      attributes: { ...mdastNode?.attributes, title: newTitle },
    });
  };

  // 类型切换
  const handleTypeChange = (newType: string) => {
    updateMdastNode({
      attributes: { ...mdastNode?.attributes, type: newType },
    });
  };

  // 进入编辑模式
  const handleEnterEdit = () => {
    setDraftCode(mermaidCode);
    setIsEditing(true);
  };

  // 保存编辑
  const handleSaveEdit = () => {
    const code = draftCode.trim();
    if (firstChild) {
      updateMdastNode({
        children: [{ ...firstChild, value: code }],
      });
    }
    setIsEditing(false);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setDraftCode('');
    setIsEditing(false);
  };

  // 错误恢复：重置为当前类型的默认模板
  const handleResetToTemplate = () => {
    const template = getMermaidContent(type);
    if (firstChild) {
      updateMdastNode({
        children: [{ ...firstChild, value: template }],
      });
    }
    setError(null);
    setIsEditing(false);
  };

  return (
    <div className="directive-mermaid">
      {/* 头部：标题 + 工具栏（同一行） */}
      <div className="directive-mermaid-header">
        <EditableMermaidTitle title={title} onChange={handleTitleChange} />
        <div className="directive-mermaid-toolbar">
          {/* 类型切换下拉（只读模式禁用） */}
          <Select
            value={type}
            size="small"
            variant="borderless"
            style={{ width: 110, fontSize: 12 }}
            disabled={readOnly}
            onChange={handleTypeChange}
            options={MERMAID_TYPE_OPTIONS}
          />

          {/* 编辑/预览切换（只读模式隐藏） */}
          {!readOnly && (
            <button
              style={{
                ...TOOLBAR_BTN_STYLE,
                color: isEditing ? '#1677ff' : '#595959',
              }}
              title={isEditing ? '预览模式' : '编辑源码'}
              onClick={isEditing ? handleSaveEdit : handleEnterEdit}
            >
              <EditOutlined />
            </button>
          )}

          <span className="directive-mermaid-toolbar-divider" />

          {/* 复制源码 */}
          <button
            style={TOOLBAR_BTN_STYLE}
            title="复制源码"
            onClick={handleCopySource}
          >
            {copied ? (
              <span style={{ color: '#52c41a', fontSize: 12 }}>已复制</span>
            ) : (
              <CopyOutlined />
            )}
          </button>

          {/* 下载 SVG */}
          <button
            style={TOOLBAR_BTN_STYLE}
            title="下载 SVG"
            onClick={handleDownloadSvg}
            disabled={!!error || isEditing}
          >
            <DownloadOutlined />
          </button>

          <span className="directive-mermaid-toolbar-divider" />

          {/* 缩放控制 */}
          <button
            style={TOOLBAR_BTN_STYLE}
            title="缩小"
            onClick={handleZoomOut}
            disabled={zoom <= 0.3 || isEditing}
          >
            <ZoomOutOutlined />
          </button>
          <span className="directive-mermaid-zoom-value">
            {Math.round(zoom * 100)}%
          </span>
          <button
            style={TOOLBAR_BTN_STYLE}
            title="放大"
            onClick={handleZoomIn}
            disabled={zoom >= 3 || isEditing}
          >
            <ZoomInOutlined />
          </button>
          <button
            style={TOOLBAR_BTN_STYLE}
            title="重置缩放"
            onClick={handleZoomReset}
            disabled={zoom === 1 || isEditing}
          >
            <ReloadOutlined />
          </button>

          {/* 删除按钮（只读模式隐藏） */}
          {!readOnly && (
            <>
              <span className="directive-mermaid-toolbar-divider" />
              <Popconfirm
                title="确定删除此图表？"
                onConfirm={removeNode}
                okText="删除"
                cancelText="取消"
              >
                <button
                  style={{ ...TOOLBAR_BTN_STYLE, color: '#bfbfbf' }}
                  title="删除图表"
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = '#ff4d4f')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = '#bfbfbf')
                  }
                >
                  <DeleteOutlined />
                </button>
              </Popconfirm>
            </>
          )}
        </div>
      </div>

      {/* 编辑模式：源码编辑区 + 实时预览（始终挂载，用 display 控制显隐，避免 ref 丢失） */}
      <div
        className="directive-mermaid-editor"
        style={{ display: isEditing ? undefined : 'none' }}
      >
        <textarea
          className="directive-mermaid-textarea"
          value={draftCode}
          onChange={(e) => setDraftCode(e.target.value)}
          spellCheck={false}
          placeholder="在此输入 Mermaid 源码..."
        />
        <div className="directive-mermaid-editor-actions">
          <button
            className="directive-mermaid-btn-primary"
            onClick={handleSaveEdit}
          >
            保存
          </button>
          <button
            className="directive-mermaid-btn-default"
            onClick={handleCancelEdit}
          >
            取消
          </button>
          <button
            className="directive-mermaid-btn-default"
            onClick={handleResetToTemplate}
          >
            重置为模板
          </button>
        </div>
        {/* 实时预览区：editPreviewRef 始终挂载 */}
        <div className="directive-mermaid-live-preview">
          <div className="directive-mermaid-live-preview-label">实时预览</div>
          {loading && <div className="directive-mermaid-loading">渲染中…</div>}
          {error && (
            <div className="directive-mermaid-error" style={{ margin: 0 }}>
              <div className="directive-mermaid-error-title">⚠ 渲染错误</div>
              <pre className="directive-mermaid-error-msg">{error}</pre>
            </div>
          )}
          <div
            className="directive-mermaid-content"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              display: error || loading ? 'none' : undefined,
            }}
            ref={editPreviewRef}
          />
        </div>
      </div>

      {/* 预览模式：SVG 内容区（始终挂载，用 display 控制显隐，避免 ref 丢失） */}
      <div style={{ display: isEditing ? 'none' : undefined }}>
        {loading && !error && (
          <div className="directive-mermaid-loading">图表渲染中…</div>
        )}

        {error && (
          <div className="directive-mermaid-error">
            <div className="directive-mermaid-error-title">
              ⚠ Mermaid 渲染错误
            </div>
            <pre className="directive-mermaid-error-msg">{error}</pre>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              {!readOnly && (
                <button
                  className="directive-mermaid-btn-primary"
                  onClick={handleResetToTemplate}
                >
                  重置为模板
                </button>
              )}
              {!readOnly && (
                <button
                  className="directive-mermaid-btn-default"
                  onClick={handleEnterEdit}
                >
                  编辑源码
                </button>
              )}
            </div>
            <details className="directive-mermaid-error-source">
              <summary>查看源码</summary>
              <pre>{mermaidCode}</pre>
            </details>
          </div>
        )}

        {/* containerRef 始终挂载，用 display 控制 error/loading 状态 */}
        <div
          className="directive-mermaid-content"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            display: error || loading ? 'none' : undefined,
          }}
          ref={containerRef}
        />
      </div>
    </div>
  );
};
