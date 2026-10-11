/**
 * 带复制按钮的代码块编辑器
 * 全局替换 @mdxeditor/editor 默认代码块编辑器
 *
 * 性能优化：
 * - IntersectionObserver 懒初始化 CodeMirror
 * - 大代码块（>200行）rootMargin 设为 0，更晚加载，减少首屏压力
 * - 小代码块提前 200px 加载，避免滚动闪烁
 */
import { CodeMirrorEditor, type CodeBlockEditorProps } from '@mdxeditor/editor';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { copyTextToClipboard } from './clipboard';

const CodeBlockEditorWithCopy: React.FC<CodeBlockEditorProps> = (props) => {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 代码块行数（用于占位符高度和懒加载策略）
  const lineCount = (props.code || '').split('\n').length;
  const placeholderHeight = Math.min(Math.max(lineCount * 20 + 16, 60), 400);
  // 大代码块更晚加载（rootMargin 0），小代码块提前 200px 加载
  const rootMargin = lineCount > 200 ? '0px 0px' : '200px 0px';

  // IntersectionObserver：根据代码块大小动态调整加载时机
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // 立即检查是否在可视区（避免首屏可见代码块闪烁）
    const rect = el.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const margin = lineCount > 200 ? 0 : 200;
    if (rect.top < viewportHeight + margin && rect.bottom > -margin) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lineCount, rootMargin]);

  const handleCopy = useCallback(async () => {
    const ok = await copyTextToClipboard(props.code || '');
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [props.code]);

  // 占位符显示前 3 行代码预览
  const previewLines = (props.code || '').split('\n').slice(0, 3);

  return (
    <div className="code-block-wrapper" ref={wrapperRef}>
      <div className="code-block-header">
        <span className="code-block-language">
          {props.language || 'plaintext'}
        </span>
        <button
          type="button"
          className="code-block-copy-btn"
          onClick={handleCopy}
        >
          {copied ? '✓ 已复制' : '复制代码'}
        </button>
      </div>
      {visible ? (
        <CodeMirrorEditor {...props} />
      ) : (
        <div
          className="code-block-placeholder"
          style={{
            minHeight: placeholderHeight,
            padding: '12px 16px',
            background: '#f6f8fa',
            borderRadius: '0 0 6px 6px',
            fontFamily: 'monospace',
            fontSize: 13,
            lineHeight: 1.6,
            color: '#6a737d',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {previewLines.map((line, i) => (
            <div key={i}>{line || ' '}</div>
          ))}
          {lineCount > 3 && (
            <div style={{ color: '#999', marginTop: 4 }}>
              … 共 {lineCount} 行，滚动到此处加载完整编辑器
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CodeBlockEditorWithCopy;
