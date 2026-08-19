/**
 * 共享插件配置工厂
 * 消除主编辑器与预览编辑器的重复插件定义
 */
import {
  codeBlockPlugin,
  codeMirrorPlugin,
  directivesPlugin,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  type CodeBlockEditorDescriptor,
} from '@mdxeditor/editor';
import { CODE_LANGUAGES } from './constants';
import { directiveDescriptors } from './directives';
import CodeBlockEditorWithCopy from './components/CodeBlockEditor';
import { markdownKeymap } from './utils/codeMirror';

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
  extra?: any[];
}

/**
 * 创建基础插件集合（主编辑器和预览编辑器共用）
 */
export const createBasePlugins = (options: BasePluginsOptions = {}): any[] => {
  const { enableKeymap = true, extra = [] } = options;

  const plugins: any[] = [
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
    markdownShortcutPlugin(),
  ];

  return [...plugins, ...extra];
};
