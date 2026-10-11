/**
 * CodeTemplate 代码模板指令编辑器
 * 用于在编辑区中渲染插入的代码模板，带有标题栏、语言标签和代码内容区
 *
 * 语法：
 * ::::code_template{title="模板标题" language="typescript" category="前端框架"}
 * 代码内容
 * ::::
 */
import { NestedLexicalEditor, useNestedEditorContext } from '@mdxeditor/editor';
import React, { useState } from 'react';
import {
  CopyOutlined,
  CheckOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { Button, Tooltip, message } from 'antd';

/** CodeTemplate 指令编辑器 Props */
interface CodeTemplateDirectiveEditorProps {
  mdastNode: any;
  [key: string]: any;
}

/**
 * CodeTemplate 代码模板指令编辑器
 * 渲染为带标题栏的代码块，支持复制功能
 */
export const CodeTemplateDirectiveEditor: React.FC<CodeTemplateDirectiveEditorProps> = ({
  mdastNode,
}) => {
  const { config, lexicalNode } = useNestedEditorContext();
  const theme = (config as any)?.theme;
  const [copied, setCopied] = useState(false);

  // 从属性中获取标题、分类、语言
  const title = mdastNode?.attributes?.title || '代码模板';
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
      className={`code-template-directive ${theme?.codeTemplate || ''}`}
      onClick={() => (lexicalNode as { select?: () => void })?.select?.()}
    >
      {/* 标题栏 */}
      <div className="code-template-directive-header">
        <div className="code-template-directive-title">
          <CodeOutlined className="code-template-directive-icon" />
          <span className="code-template-directive-title-text">{title}</span>
          {category && (
            <span className="code-template-directive-category">{category}</span>
          )}
          {language && (
            <span className="code-template-directive-language">{language}</span>
          )}
        </div>
        <div className="code-template-directive-actions">
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
      <div className="code-template-directive-content">
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

export default CodeTemplateDirectiveEditor;
