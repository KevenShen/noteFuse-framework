import type React from 'react';
import type { FormProps } from 'antd/es/form';
import type { ColumnType, ColumnsType, TableProps } from 'antd/es/table';

//#region 类型定义
/** 树形分类基础条目 */
export interface CategoryItem {
  id: number | string;
  name: string;
  parent_id?: number | string | null;
  sort?: number;
  children?: CategoryItem[];
  [key: string]: any;
}

/** 联动扩展字段配置：一套配置同时生成表格列 + 表单输入项 */
export interface ExtraFieldConfig {
  name: string;
  label: string;
  formType?: 'input' | 'inputNumber' | 'textarea' | 'select';
  /** 自定义表单组件（优先级高于 formType），组件需支持 value 和 onChange（Form.Item 自动注入） */
  renderFormItem?: React.ReactNode;
  required?: boolean;
  placeholder?: string;
  rules?: any[];
  options?: { label: string; value: any }[];
  /** 是否在表格列中显示，默认 true */
  showColumn?: boolean;
  /** 是否在新增/编辑表单中显示，默认 true。设为 false 时需通过 onAdd/onEdit 手动注入该字段 */
  showInForm?: boolean;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  render?: ColumnType<CategoryItem>['render'];
  ellipsis?: boolean;
}

/** 操作按钮权限配置 */
export interface ActionConfig {
  add?: boolean;
  edit?: boolean;
  delete?: boolean;
  addChild?: boolean;
}

/** 内置表格列显隐控制 */
export interface ColumnDisplayConfig {
  sort?: boolean;
  stat?: boolean;
}

export interface CategoryManagerProps {
  // ==================== 数据 ====================
  /** 分类数据源，支持扁平化数组（含 parent_id）或树形数组（含 children），组件内部自动识别转换 */
  dataSource: CategoryItem[];
  /** 表格加载状态 */
  loading?: boolean;

  // ==================== 层级与扩展 ====================
  /** 最大分类层级数（2=仅二级，3=支持三级），默认3 */
  maxLevel?: number;
  /** 联动扩展字段配置：一套配置同时生成表格列 + 表单输入项（如 icon、description 等） */
  extraFields?: ExtraFieldConfig[];
  /** 额外的自定义表格列（追加到内置列之后、操作列之前） */
  extraColumns?: ColumnsType<CategoryItem>;
  /** 内置表格列显隐控制（sort 排序列 / stat 数量列），默认均显示 */
  columnDisplay?: ColumnDisplayConfig;

  // ==================== 列标题与文案 ====================
  /** 名称列标题，默认"分类名称" */
  nameColumnTitle?: string;
  /** 排序列标题，默认"排序" */
  sortColumnTitle?: string;
  /** 统计数值字段名（如 doc_count / article_count），默认 'count' */
  statField?: string;
  /** 数量列标题，默认"数量" */
  statColumnTitle?: string;
  /** 操作列标题，默认"操作" */
  actionColumnTitle?: string;
  /** 表单中名称字段的 label，默认"分类名称" */
  nameLabel?: string;

  // ==================== 操作权限 ====================
  /** 操作按钮权限配置（add 新增 / edit 编辑 / delete 删除 / addChild 新增子分类），默认全部启用 */
  actions?: ActionConfig;

  // ==================== 按钮文案 ====================
  /** 新增按钮文案，默认"新增分类" */
  addButtonText?: string;
  /** 保存排序按钮文案，默认"保存排序" */
  saveButtonText?: string;
  /** 重置排序按钮文案，默认"重置" */
  resetButtonText?: string;
  /** 新增子分类按钮文案，默认"子分类" */
  addChildButtonText?: string;
  /** 编辑按钮文案，默认"编辑" */
  editButtonText?: string;
  /** 删除按钮文案，默认"删除" */
  deleteButtonText?: string;
  /** 批量删除按钮文案，默认"批量删除" */
  batchDeleteButtonText?: string;
  /** 批量移动按钮文案，默认"移动到..." */
  batchMoveButtonText?: string;

  // ==================== 弹窗标题 ====================
  /** 新增/编辑弹窗标题前缀，最终显示为"新增{modalTitle}"或"编辑{modalTitle}"，默认"分类" */
  modalTitle?: string;
  /** 批量移动弹窗标题，默认"批量移动" */
  batchMoveModalTitle?: string;

  // ==================== 批量选择文案 ====================
  /** 已选择数量前缀文案，默认"已选择" */
  selectedCountPrefix?: string;
  /** 已选择数量后缀文案，默认"项" */
  selectedCountSuffix?: string;

  // ==================== 功能开关 ====================
  /** 是否启用拖拽排序（启用后行可拖动，拖动后需点"保存排序"确认），默认 false */
  sortable?: boolean;
  /** 是否启用行选择（启用后显示复选框和批量操作栏），默认 false */
  selectable?: boolean;

  // ==================== 透传配置 ====================
  /** 透传给 antd Table 的 props（会被组件内部必要属性覆盖） */
  tableProps?: Partial<TableProps<CategoryItem>>;
  /** 透传给 antd Form 的 props（用于新增/编辑表单） */
  formProps?: Partial<FormProps>;
  /** 首次有数据时是否默认展开所有行，默认 false */
  defaultExpandAllRows?: boolean;

  // ==================== 回调函数 ====================
  /** 新增/编辑/删除操作成功后触发，通常用于刷新外部数据 */
  onRefresh?: () => void;
  /**
   * 新增分类回调
   * @param values 表单值（含 name、sort 及 extraFields 定义的字段）
   * @param parentId 父分类 ID（null/0 表示根分类）
   */
  onAdd?: (
    values: any,
    parentId?: number | string | null,
  ) => Promise<void> | void;
  /**
   * 编辑分类回调
   * @param values 表单值
   * @param record 被编辑的原始分类记录
   */
  onEdit?: (values: any, record: CategoryItem) => Promise<void> | void;
  /**
   * 删除分类回调
   * @param record 被删除的分类记录（含子分类，需级联删除）
   */
  onDelete?: (record: CategoryItem) => Promise<void> | void;
  /**
   * 批量删除回调
   * @param keys 选中的分类 ID 列表
   */
  onBatchDelete?: (keys: (number | string)[]) => Promise<void> | void;
  /**
   * 批量移动回调
   * @param keys 选中的分类 ID 列表
   * @param targetParentId 目标父分类 ID（0 表示移到根层级）
   */
  onBatchMove?: (
    keys: (number | string)[],
    targetParentId: number | string,
  ) => Promise<void> | void;
  /**
   * 保存排序回调（拖动排序后点"保存排序"按钮触发）
   * @param sortedItems 全量扁平化分类列表（含重新计算的 sort 字段）
   */
  onSaveSort?: (sortedItems: CategoryItem[]) => Promise<void> | void;
}
//#endregion
