/**
 * 基础插件配置工厂
 * - createBasePlugins: 创建基础插件集合（主编辑器和预览编辑器共用）
 * - codeBlockEditorDescriptor: 自定义代码块编辑器描述器
 * - imageUploadHandler: 图片上传处理（转 base64）
 *
 * 从 components/UnifiedToolbar/plugins.ts 迁移，非组件逻辑应放在 plugins/ 目录
 */
import {
  codeBlockPlugin,
  codeMirrorPlugin,
  directivesPlugin,
  headingsPlugin,
  jsxPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  type CodeBlockEditorDescriptor,
  type RealmPlugin,
} from '@mdxeditor/editor';
import CodeBlockEditorWithCopy from '../components/EditorTools/CodeBlockEditor';
import { CODE_LANGUAGES } from '../constants';
import { directiveDescriptors } from '../directives';
import { markdownKeymap } from './codeMirrorExtensions';

/** 图片上传：转 base64（提取到模块外，避免每次渲染重建） */
export const imageUploadHandler = async (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

/** 代码块编辑器描述器：全局替换默认代码块为带复制按钮的自定义编辑器 */
export const codeBlockEditorDescriptor: CodeBlockEditorDescriptor = {
  match: () => true,
  priority: 1,
  Editor: CodeBlockEditorWithCopy,
};

export interface BasePluginsOptions {
  /** 是否启用 CodeMirror 快捷键扩展（预览模式可关闭） */
  enableKeymap?: boolean;
  /** 额外追加的插件 */
  extra?: RealmPlugin[];
}

/**
 * 创建基础插件集合（主编辑器和预览编辑器共用）
 */
export const createBasePlugins = (
  options: BasePluginsOptions = {},
): RealmPlugin[] => {
  const { enableKeymap = true, extra = [] } = options;

  const plugins: RealmPlugin[] = [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    tablePlugin(),
    imagePlugin({ imageUploadHandler }),
    linkPlugin(),
    linkDialogPlugin(),
    thematicBreakPlugin(),
    codeBlockPlugin({
      defaultCodeBlockLanguage: 'plaintext',
      codeBlockEditorDescriptors: [codeBlockEditorDescriptor],
    }),
    codeMirrorPlugin({
      codeBlockLanguages: CODE_LANGUAGES,
      codeMirrorExtensions: enableKeymap ? [markdownKeymap] : [],
    }),
    directivesPlugin({ directiveDescriptors }),
    jsxPlugin(),  // 支持原始 HTML/JSX 渲染（批注卡片使用 HTML 渲染）
    markdownShortcutPlugin(),
  ];

  return [...plugins, ...extra];
};
