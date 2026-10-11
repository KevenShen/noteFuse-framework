/**
 * 自定义 Directive 描述符配置
 * 支持：admonition（提示块）、card（卡片）、menu（菜单）、steps（步骤条）、tabs（标签页）
 */
import type { DirectiveDescriptor } from '@mdxeditor/editor';
import {
  AdmonitionDirectiveDescriptor,
  NestedLexicalEditor,
  useNestedEditorContext,
} from '@mdxeditor/editor';
import React from 'react';
import { CardDirectiveEditor } from './Card';
import { CodeTemplateDirectiveEditor } from './CodeTemplate';
import { MermaidDirectiveEditor } from './Mermaid';
import { SnippetDirectiveEditor } from './Snippet';
import { StepsDirectiveEditor } from './Steps';
import { TabsDirectiveEditor } from './Tabs';

/**
 * 自定义 Admonition 编辑器：修复点击提示块区域时焦点不进入编辑区的问题
 *
 * 注意：useNestedEditorContext 返回的 lexicalNode 类型为
 * DecoratorNode<any> & { setMdastNode: ... }，类型声明中缺少 select 方法，
 * 但运行时 LexicalNode 确实有 select()，因此使用类型断言。
 */
const AdmonitionEditor = ({ mdastNode }: { mdastNode: any }) => {
  const { config, lexicalNode } = useNestedEditorContext();
  const theme = (config as any)?.theme;
  return (
    <div
      className={theme?.admonition?.[mdastNode.name]}
      onClick={() => (lexicalNode as { select?: () => void })?.select?.()}
      style={{ cursor: 'text' }}
    >
      <NestedLexicalEditor
        block
        getContent={(node: any) => node.children}
        getUpdatedMdastNode={(node: any, children: any) => ({
          ...node,
          children,
        })}
      />
    </div>
  );
};

const CustomAdmonitionDirectiveDescriptor: DirectiveDescriptor<any> = {
  ...AdmonitionDirectiveDescriptor,
  Editor: AdmonitionEditor,
};

/** 容器指令工厂 */
const containerDirective = (
  name: string,
  attributes: string[],
  Editor: React.ComponentType<any>,
): DirectiveDescriptor<any> => ({
  testNode: (node) => node.name === name,
  name,
  attributes,
  hasChildren: true,
  type: 'containerDirective',
  Editor,
});

export const directiveDescriptors: DirectiveDescriptor<any>[] = [
  // 官方内置：Docusaurus 风格提示块
  CustomAdmonitionDirectiveDescriptor,
  // 自定义容器指令
  containerDirective(
    'card',
    ['title', 'subtitle', 'type'],
    CardDirectiveEditor,
  ),
  containerDirective(
    'code_template',
    ['title', 'language', 'category'],
    CodeTemplateDirectiveEditor,
  ),
  containerDirective('mermaid', ['type', 'title'], MermaidDirectiveEditor),
  containerDirective(
    'snippet',
    ['title', 'category', 'language'],
    SnippetDirectiveEditor,
  ),
  containerDirective('steps', [], StepsDirectiveEditor),
  containerDirective('tabs', [], TabsDirectiveEditor),
  // 兜底：未知 textDirective 原样渲染为文本，防止普通文本中的 :xxx 被误解析
  {
    testNode: (node: any) => node.type === 'textDirective',
    name: 'text-directive-fallback',
    attributes: [],
    hasChildren: true,
    type: 'textDirective',
    Editor: ({ mdastNode, children }: any) =>
      React.createElement(React.Fragment, null, `:${mdastNode.name}`, children),
  },
];
