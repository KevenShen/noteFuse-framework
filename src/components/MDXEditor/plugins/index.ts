/**
 * @file MDXEditor 插件配置统一导出
 * @description 所有插件配置工厂的集中导出入口，简化外部导入路径
 */

// CodeMirror 扩展
export {
  createEditorViewCapture,
  markdownKeymap,
} from './codeMirrorExtensions';

// 基础插件
export {
  createBasePlugins,
  codeBlockEditorDescriptor,
  imageUploadHandler,
  type BasePluginsOptions,
} from './basePlugins';
