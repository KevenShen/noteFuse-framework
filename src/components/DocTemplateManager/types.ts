// src/components/DocTemplateManager/types.ts
// 文档模板管理器类型定义

/** 模板分类 */
export interface DocTemplateCategory {
  /** 分类ID */
  id: number;
  /** 分类名称 */
  name: string;
  /** 排序 */
  sort: number;
}

/** 文档模板 */
export interface DocTemplateItem {
  /** 模板ID */
  id: number;
  /** 模板标题 */
  title: string;
  /** 模板描述 */
  description: string;
  /** 分类ID */
  category_id: number;
  /** 模板内容（Markdown格式） */
  content: string;
  /** 作者（可选） */
  author?: string;
  /** 创建时间 */
  created_at?: string;
  /** 更新时间 */
  updated_at?: string;
  /** 是否系统模板（不可删除） */
  is_system?: boolean;
}

/** DocTemplateManager 组件 Props */
export interface DocTemplateManagerProps {
  /** 插入模板回调 */
  onInsert?: (template: DocTemplateItem) => void;
  /** 编辑模板回调（点击模板标题或编辑按钮时触发） */
  onEdit?: (template: DocTemplateItem) => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/** 保存模板弹窗 Props */
export interface SaveTemplateModalProps {
  /** 是否显示 */
  visible: boolean;
  /** 初始内容 */
  initialContent?: string;
  /** 初始标题 */
  initialTitle?: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 保存回调 */
  onSave: (template: Omit<DocTemplateItem, 'id' | 'created_at' | 'updated_at' | 'is_system'>) => void;
}
