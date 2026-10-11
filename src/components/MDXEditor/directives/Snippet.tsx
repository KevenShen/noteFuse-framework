/**
 * Snippet 片段指令编辑器
 * 用于在编辑区中渲染插入的代码片段，带有标题栏和内容区
 *
 * 语法：
 * ::::snippet{title="片段标题" category="分类" language="typescript"}
 * 片段内容
 * ::::
 */
import { NestedLexicalEditor, useNestedEditorContext } from '@mdxeditor/editor';
import React, { useState } from 'react';
import {
  CopyOutlined,
  CheckOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { Button, Tooltip, message } from 'antd';

/** Snippet 指令编辑器 Props */
interface SnippetDirectiveEditorProps {
  mdastNode: any;
  [key: string]: any;
}

/**
 * Snippet 片段指令编辑器
 * 渲染为带标题栏的代码块，支持复制功能
 */
export const SnippetDirectiveEditor: React.FC<SnippetDirectiveEditorProps> = ({
  mdastNode,
}) => {
  const { config, lexicalNode } = useNestedEditorContext();
  const theme = (config as any)?.theme;
  const [copied, setCopied] = useState(false);

  // 从属性中获取标题、分类、语言
  const title = mdastNode?.attributes?.title || '代码片段';
  const category = mdastNode?.attributes?.category;
  const language = mdastNode?.attributes?.language;

  // 复制内容
  const handleCopy = async () => {
    try {
      // 从 mdastNode 中提取文本内容
      const extractText = (node: any): string => {
        if (!node) return '';
        if (node.type === 'text') return node.value || '';
        if (node.children) {
          return node.children.map(extractText).join('');
        }
        return '';
      };
      const content = extractText(mdastNode);
      await navigator.clipboard.writeText(content);
      setCopied(true);
      message.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      message.error('复制失败');
    }
  };

  return (
    <div
      className={`snippet-directive ${theme?.snippet || ''}`}
      onClick={() => (lexicalNode as { select?: () => void })?.select?.()}
    >
      {/* 标题栏 */}
      <div className="snippet-directive-header">
        <div className="snippet-directive-title">
          <FileTextOutlined className="snippet-directive-icon" />
          <span className="snippet-directive-title-text">{title}</span>
          {category && (
            <span className="snippet-directive-category">{category}</span>
          )}
          {language && (
            <span className="snippet-directive-language">{language}</span>
          )}
        </div>
        <div className="snippet-directive-actions">
          <Tooltip title={copied ? '已复制' : '复制'}>
            <Button
              type="text"
              size="small"
              icon={copied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
            />
          </Tooltip>
        </div>
      </div>

      {/* 内容区 */}
      <div className="snippet-directive-content">
        <NestedLexicalEditor
          block
          getContent={(node: any) => node.children}
          getUpdatedMdastNode={(node: any, children: any) => ({
            ...node,
            children,
          })}
        />
      </div>
    </div>
  );
};

export default SnippetDirectiveEditor;
