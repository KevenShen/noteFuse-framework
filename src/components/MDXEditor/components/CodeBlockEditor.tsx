/**
 * 带复制按钮的代码块编辑器
 * 全局替换 @mdxeditor/editor 默认代码块编辑器
 */
import React, { useState, useCallback } from 'react';
import { CodeMirrorEditor, type CodeBlockEditorProps } from '@mdxeditor/editor';
import { copyTextToClipboard } from '../utils/clipboard';

const CodeBlockEditorWithCopy: React.FC<CodeBlockEditorProps> = (props) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const ok = await copyTextToClipboard(props.code || '');
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [props.code]);

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-language">{props.language || 'plaintext'}</span>
        <button type="button" className="code-block-copy-btn" onClick={handleCopy}>
          {copied ? '✓ 已复制' : '复制代码'}
        </button>
      </div>
      <CodeMirrorEditor {...props} />
    </div>
  );
};

export default CodeBlockEditorWithCopy;
