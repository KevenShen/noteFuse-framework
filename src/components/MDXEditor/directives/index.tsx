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
import { MenuDirectiveEditor, MenuItemDirectiveEditor } from './Menu';
import { StepDirectiveEditor, StepsDirectiveEditor } from './Steps';
import { TabDirectiveEditor, TabsDirectiveEditor } from './Tabs';

/**
 * 自定义 Admonition 编辑器：修复点击提示块区域时焦点不进入编辑区的问题
 */
const AdmonitionEditor = ({ mdastNode }: { mdastNode: any }) => {
  const { config, lexicalNode } = useNestedEditorContext();
  const theme = (config as any)?.theme;
  return (
    <div
      className={theme?.admonition?.[mdastNode.name]}
      onClick={() => lexicalNode?.select()}
      style={{ cursor: 'text' }}
    >
      <NestedLexicalEditor
        block
        getContent={(node: any) => node.children}
        getUpdatedMdastNode={(node: any, children: any) => ({ ...node, children })}
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
  containerDirective('card', ['title', 'type'], CardDirectiveEditor),
  containerDirective('menu', ['mode'], MenuDirectiveEditor),
  containerDirective('menuitem', ['label'], MenuItemDirectiveEditor),
  containerDirective('steps', [], StepsDirectiveEditor),
  containerDirective('step', ['title', 'status'], StepDirectiveEditor),
  containerDirective('tabs', [], TabsDirectiveEditor),
  containerDirective('tab', ['label'], TabDirectiveEditor),
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
