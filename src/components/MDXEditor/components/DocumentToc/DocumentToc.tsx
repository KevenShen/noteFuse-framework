/**
 * 文档目录组件：
 * 按 h1-h6 层级缩进显示，点击跳转到对应标题
 * 右侧浮动面板样式
 *
 * 功能：
 * - 展开状态：显示完整目录面板（标题 + 收起按钮 + 关闭按钮 + 目录列表）
 * - 收起状态：显示为窄条（仅保留展开按钮，垂直文字"目录"）
 * - 收起/展开功能独立于工具栏，只读模式下也可用
 *
 * 性能优化：React.memo 包裹，只在 visible/mode 变化时重渲染
 * （containerRef/editorViewRef 引用稳定，onClose 忽略比较）
 */
import React, { useMemo } from 'react';
import { useDocumentToc, useTocCollapse } from '../../hooks';
import type { EditorViewLike } from '../../types';

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

const DocumentTocBase: React.FC<DocumentTocProps> = ({
  containerRef,
  editorViewRef,
  mode,
  visible,
  onClose,
}) => {
  // 收起交互逻辑（抽离到 hook，包含移动端点击外部收起）
  const { collapsed, setCollapsed } = useTocCollapse(visible);

  // 目录数据获取
  const { items, scrollTo } = useDocumentToc({
    containerRef,
    editorViewRef,
    mode,
    enabled: visible && !collapsed,
  });

  // 计算最大层级用于缩进比例（保留以备动态缩进计算）
  const maxLevel = useMemo(() => {
    if (items.length === 0) return 6;
    return Math.max(...items.map((i) => i.level));
  }, [items]);

  if (!visible) return null;

  // 收起状态：显示为窄条，点击展开
  if (collapsed) {
    return (
      <div
        className="mdx-editor-toc-collapsed"
        onClick={() => setCollapsed(false)}
        title="展开目录"
      >
        <span className="mdx-editor-toc-collapsed-text">目录</span>
      </div>
    );
  }

  // 展开状态：显示完整目录面板
  return (
    <div className="mdx-editor-toc">
      <div className="mdx-editor-toc-header">
        <span className="mdx-editor-toc-title">文档目录</span>
        <div className="mdx-editor-toc-actions">
          {/* 收起按钮：独立于工具栏，只读模式下也可用 */}
          <button
            type="button"
            className="mdx-editor-toc-collapse"
            onClick={() => setCollapsed(true)}
            title="收起目录"
          >
            ‹
          </button>
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

// React.memo：只在 visible/mode 变化时重渲染，忽略 onClose 引用变化
const DocumentToc = React.memo(DocumentTocBase, (prev, next) => {
  return (
    prev.visible === next.visible &&
    prev.mode === next.mode &&
    prev.containerRef === next.containerRef &&
    prev.editorViewRef === next.editorViewRef
  );
});

export default DocumentToc;
