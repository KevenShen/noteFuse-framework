/**
 * 文档目录组件
 * 按 h1-h6 层级缩进显示，点击跳转到对应标题
 * 右侧浮动面板样式
 */
import React, { useMemo } from 'react';
import { useDocumentToc, type TocItem } from '../hooks/useDocumentToc';
import type { EditorViewLike } from '../types';

export interface DocumentTocProps {
  /** 编辑器容器 ref */
  containerRef: React.RefObject<HTMLElement | null>;
  /** CodeMirror EditorView ref */
  editorViewRef?: React.MutableRefObject<EditorViewLike | null>;
  /** 当前模式 */
  mode: 'rich-text' | 'source' | 'split';
  /** 是否显示 */
  visible: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

const DocumentToc: React.FC<DocumentTocProps> = ({
  containerRef,
  editorViewRef,
  mode,
  visible,
  onClose,
}) => {
  const { items, scrollTo } = useDocumentToc({
    containerRef,
    editorViewRef,
    mode,
    enabled: visible,
  });

  // 计算最大层级用于缩进比例
  const maxLevel = useMemo(() => {
    if (items.length === 0) return 6;
    return Math.max(...items.map((i) => i.level));
  }, [items]);

  if (!visible) return null;

  return (
    <div className="mdx-editor-toc">
      <div className="mdx-editor-toc-header">
        <span className="mdx-editor-toc-title">文档目录</span>
        {onClose && (
          <button
            type="button"
            className="mdx-editor-toc-close"
            onClick={onClose}
            title="关闭目录"
          >
            ×
          </button>
        )}
      </div>
      <div className="mdx-editor-toc-body">
        {items.length === 0 ? (
          <div className="mdx-editor-toc-empty">暂无标题</div>
        ) : (
          <ul className="mdx-editor-toc-list">
            {items.map((item) => (
              <li
                key={item.id}
                className={`mdx-editor-toc-item mdx-editor-toc-level-${item.level}`}
                style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
              >
                <button
                  type="button"
                  className="mdx-editor-toc-link"
                  onClick={() => scrollTo(item)}
                  title={item.text}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DocumentToc;
