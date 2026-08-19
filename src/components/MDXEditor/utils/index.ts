// utils/index.ts - 工具函数统一导出
export * from './clipboard';        // 剪贴板：复制、粘贴格式化、引用块规范化
export * from './markdownInsert';   // 源码模式 Markdown 语法插入
export * from './richTextInsert';   // 富文本模式弹窗插入
export * from './generateMarkup';   // 纯文本生成（视频/音频/附件/Tabs）
export * from './codeMirror';       // CodeMirror 扩展（快捷键 + EditorView 捕获）
export { toolbarGroups } from './toolbarConfig';
export type { ToolbarActionContext, ToolbarGroupConfig } from './toolbarConfig';
