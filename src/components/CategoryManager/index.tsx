import {
  CaretRightOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import type { FormProps } from 'antd/es/form';
import type {
  ColumnType,
  ColumnsType,
  TableProps,
} from 'antd/es/table';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './index.less';

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
  showColumn?: boolean;
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
  dataSource: CategoryItem[];
  loading?: boolean;
  /** 最大分类层级数（2=仅二级，3=支持三级），默认3 */
  maxLevel?: number;
  extraFields?: ExtraFieldConfig[];
  extraColumns?: ColumnsType<CategoryItem>;
  columnDisplay?: ColumnDisplayConfig;
  nameColumnTitle?: string;
  sortColumnTitle?: string;
  /** 统计数值字段名（如 doc_count / article_count），默认 'count' */
  statField?: string;
  statColumnTitle?: string;
  actionColumnTitle?: string;
  nameLabel?: string;
  actions?: ActionConfig;
  addButtonText?: string;
  saveButtonText?: string;
  resetButtonText?: string;
  addChildButtonText?: string;
  editButtonText?: string;
  deleteButtonText?: string;
  batchDeleteButtonText?: string;
  batchMoveButtonText?: string;
  modalTitle?: string;
  batchMoveModalTitle?: string;
  selectedCountPrefix?: string;
  selectedCountSuffix?: string;
  onAdd?: (values: any, parentId?: number | string | null) => Promise<void> | void;
  onEdit?: (values: any, record: CategoryItem) => Promise<void> | void;
  onDelete?: (record: CategoryItem) => Promise<void> | void;
  onBatchDelete?: (keys: (number | string)[]) => Promise<void> | void;
  onBatchMove?: (keys: (number | string)[], targetParentId: number | string) => Promise<void> | void;
  onRefresh?: () => void;
  onSaveSort?: (sortedItems: CategoryItem[]) => Promise<void> | void;
  sortable?: boolean;
  selectable?: boolean;
  tableProps?: Partial<TableProps<CategoryItem>>;
  formProps?: Partial<FormProps>;
  defaultExpandAllRows?: boolean;
}
//#endregion

//#region 工具函数
/** 判断是否为扁平化数据（顶层存在 parent_id > 0 的节点） */
const isFlatData = (list: CategoryItem[]): boolean => {
  return list.some((item) => (item.parent_id ?? 0) !== 0);
};

/** 扁平化数组转树形结构（按 sort 排序） */
const flatToTree = (list: CategoryItem[]): CategoryItem[] => {
  const map = new Map<number | string, CategoryItem>();
  const roots: CategoryItem[] = [];
  list.forEach((item) => map.set(item.id, { ...item, children: [] }));
  list.forEach((item) => {
    const node = map.get(item.id)!;
    const pid = item.parent_id ?? 0;
    if (pid !== 0 && map.has(pid)) {
      map.get(pid)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortTree = (arr: CategoryItem[]) => {
    arr.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    arr.forEach((item) => item.children?.length && sortTree(item.children));
  };
  sortTree(roots);
  return roots;
};

/** 树形结构转扁平化数组（保留 sort 和 parent_id） */
const treeToFlat = (tree: CategoryItem[], parentId: number | string = 0): CategoryItem[] => {
  const result: CategoryItem[] = [];
  tree.forEach((item) => {
    const { children, ...rest } = item;
    result.push({ ...rest, parent_id: parentId });
    if (children?.length) result.push(...treeToFlat(children, item.id));
  });
  return result;
};

const findRecordById = (tree: CategoryItem[], id: number | string): CategoryItem | null => {
  for (const item of tree) {
    if (item.id === id) return item;
    if (item.children?.length) {
      const found = findRecordById(item.children, id);
      if (found) return found;
    }
  }
  return null;
};

const getSiblingsById = (tree: CategoryItem[], id: number | string): CategoryItem[] => {
  const record = findRecordById(tree, id);
  if (!record) return [];
  const parentId = record.parent_id ?? 0;
  if (parentId === 0) return tree;
  return findRecordById(tree, parentId)?.children || [];
};

const updateSiblingsInTree = (
  tree: CategoryItem[],
  parentId: number | string,
  newSiblings: CategoryItem[],
): CategoryItem[] => {
  if (parentId === 0) return newSiblings;
  return tree.map((item) => {
    if (item.id === parentId) return { ...item, children: newSiblings };
    if (item.children?.length) {
      return { ...item, children: updateSiblingsInTree(item.children, parentId, newSiblings) };
    }
    return item;
  });
};

/** 计算节点的子树深度（叶子节点=0，有一层子节点=1，以此类推） */
const getSubtreeDepth = (node: CategoryItem): number => {
  if (!node.children?.length) return 0;
  return 1 + Math.max(...node.children.map(getSubtreeDepth));
};

/** 计算节点在树中的层级（根节点=1，未找到返回0） */
const getNodeLevel = (
  tree: CategoryItem[],
  id: number | string,
  level: number = 1,
): number => {
  for (const item of tree) {
    if (item.id === id) return level;
    if (item.children?.length) {
      const found = getNodeLevel(item.children, id, level + 1);
      if (found) return found;
    }
  }
  return 0;
};

/**
 * 判断选中的节点是否可以移动到目标父分类下（不超过 maxLevel）
 * 最终层级 = 目标层级 + 选中节点最大子树深度 + 1
 */
const canMoveTo = (
  tree: CategoryItem[],
  selectedIds: (number | string)[],
  targetParentId: number | string,
  maxLevel: number,
): boolean => {
  let maxSubtreeDepth = 0;
  selectedIds.forEach((id) => {
    const node = findRecordById(tree, id);
    if (node) maxSubtreeDepth = Math.max(maxSubtreeDepth, getSubtreeDepth(node));
  });
  const targetLevel = targetParentId === 0 ? 0 : getNodeLevel(tree, targetParentId);
  return targetLevel + maxSubtreeDepth + 1 <= maxLevel;
};
//#endregion

const CategoryManager: React.FC<CategoryManagerProps> = ({
  dataSource,
  loading = false,
  maxLevel = 3,
  extraFields = [],
  extraColumns = [],
  columnDisplay = { sort: true, stat: true },
  nameColumnTitle = '分类名称',
  sortColumnTitle = '排序',
  statField = 'count',
  statColumnTitle = '数量',
  actionColumnTitle = '操作',
  nameLabel = '分类名称',
  actions = { add: true, edit: true, delete: true, addChild: true },
  addButtonText = '新增分类',
  saveButtonText = '保存排序',
  resetButtonText = '重置',
  addChildButtonText = '子分类',
  editButtonText = '编辑',
  deleteButtonText = '删除',
  batchDeleteButtonText = '批量删除',
  batchMoveButtonText = '移动到...',
  modalTitle = '分类',
  batchMoveModalTitle = '批量移动',
  selectedCountPrefix = '已选择',
  selectedCountSuffix = '项',
  onAdd,
  onEdit,
  onDelete,
  onBatchDelete,
  onBatchMove,
  onRefresh,
  sortable = false,
  selectable = false,
  onSaveSort,
  tableProps,
  formProps,
  defaultExpandAllRows = false,
}) => {
  const [form] = Form.useForm();

  // 内部统一使用树形数据：传入扁平化数据时自动转树，已是树形则直接使用
  const treeData = useMemo(
    () => (isFlatData(dataSource) ? flatToTree(dataSource) : dataSource),
    [dataSource],
  );

  //#region 状态
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CategoryItem | null>(null);
  const [parentId, setParentId] = useState<number | string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<(number | string)[]>([]);
  const [dragRowId, setDragRowId] = useState<number | string | null>(null);
  const [dropRowId, setDropRowId] = useState<number | string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const [localDataSource, setLocalDataSource] = useState<CategoryItem[]>(treeData);
  const [hasSortChanges, setHasSortChanges] = useState(false);
  const [savingSort, setSavingSort] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<(number | string)[]>([]);
  const [batchMoveVisible, setBatchMoveVisible] = useState(false);
  const [moveTargetParent, setMoveTargetParent] = useState<number | string>(0);
  const [batchMoving, setBatchMoving] = useState(false);
  //#endregion

  //#region 层级控制
  const idToLevelMap = useMemo(() => {
    const map = new Map<number | string, number>();
    const traverse = (items: CategoryItem[], level: number) => {
      items.forEach((item) => {
        map.set(item.id, level);
        if (item.children?.length) traverse(item.children, level + 1);
      });
    };
    traverse(localDataSource, 1);
    return map;
  }, [localDataSource]);

  const canAddChild = useCallback(
    (record: CategoryItem) => (idToLevelMap.get(record.id) || 1) < maxLevel,
    [idToLevelMap, maxLevel],
  );
  //#endregion

  // 响应式
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 外部数据同步
  useEffect(() => {
    setLocalDataSource(treeData);
    setHasSortChanges(false);
  }, [treeData]);

  // 默认展开（仅首次有数据时执行，后续刷新保持当前展开状态）
  const expandedInitialized = useRef(false);
  useEffect(() => {
    if (defaultExpandAllRows && localDataSource.length > 0 && !expandedInitialized.current) {
      expandedInitialized.current = true;
      const keys: (number | string)[] = [];
      const traverse = (items: CategoryItem[]) => {
        items.forEach((item) => {
          if (item.children?.length) {
            keys.push(item.id);
            traverse(item.children);
          }
        });
      };
      traverse(localDataSource);
      setExpandedRowKeys(keys);
    }
  }, [localDataSource, defaultExpandAllRows]);

  const handleExpand = useCallback((expanded: boolean, record: CategoryItem) => {
    setExpandedRowKeys((prev) =>
      expanded ? [...prev, record.id] : prev.filter((k) => k !== record.id),
    );
  }, []);

  //#region 拖拽排序
  const handleDragStart = useCallback(
    (e: React.DragEvent, record: CategoryItem) => {
      if (!sortable) return;
      setDragRowId(record.id);
      e.dataTransfer.effectAllowed = 'move';
    },
    [sortable],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, record: CategoryItem) => {
      if (!sortable || !dragRowId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const dragRow = findRecordById(localDataSource, dragRowId);
      if (!dragRow || dragRow.parent_id !== record.parent_id) return;
      setDropRowId(record.id);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDropPosition(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
    },
    [sortable, dragRowId, localDataSource],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, record: CategoryItem) => {
      if (!sortable || !dragRowId || dragRowId === record.id) return;
      e.preventDefault();
      const dragRow = findRecordById(localDataSource, dragRowId);
      if (!dragRow || dragRow.parent_id !== record.parent_id) {
        setDragRowId(null);
        setDropRowId(null);
        setDropPosition(null);
        return;
      }
      const siblings = getSiblingsById(localDataSource, record.id);
      const dragIndex = siblings.findIndex((i) => i.id === dragRowId);
      const dropIndex = siblings.findIndex((i) => i.id === record.id);
      if (dragIndex === -1 || dropIndex === -1) return;
      const newSiblings = [...siblings];
      const [removed] = newSiblings.splice(dragIndex, 1);
      const insertIndex = dropPosition === 'before' ? dropIndex : dropIndex + 1;
      newSiblings.splice(dragIndex < dropIndex ? insertIndex - 1 : insertIndex, 0, removed);
      const updated = newSiblings.map((item, i) => ({ ...item, sort: i + 1 }));
      setLocalDataSource(updateSiblingsInTree(localDataSource, record.parent_id ?? 0, updated));
      setHasSortChanges(true);
      setDragRowId(null);
      setDropRowId(null);
      setDropPosition(null);
    },
    [sortable, dragRowId, dropPosition, localDataSource],
  );

  const handleDragEnd = useCallback(() => {
    setDragRowId(null);
    setDropRowId(null);
    setDropPosition(null);
  }, []);

  const handleSaveSort = async () => {
    if (!onSaveSort) return;
    setSavingSort(true);
    try {
      // 内部树形数据转回扁平化，调用方始终处理扁平数据
      await onSaveSort(treeToFlat(localDataSource));
      setHasSortChanges(false);
      message.success('排序已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSavingSort(false);
    }
  };

  const handleResetSort = () => {
    setLocalDataSource(treeData);
    setHasSortChanges(false);
  };
  //#endregion

  //#region 弹窗操作
  const openDialog = useCallback(() => setDialogVisible(true), []);
  const closeDialog = useCallback(() => {
    setDialogVisible(false);
    setEditingRecord(null);
    setParentId(null);
    form.resetFields();
  }, [form]);

  const handleAdd = useCallback(() => {
    setEditingRecord(null);
    setParentId(null);
    form.resetFields();
    form.setFieldsValue({ sort: 1 });
    openDialog();
  }, [form, openDialog]);

  const handleAddChild = useCallback(
    (record: CategoryItem) => {
      setEditingRecord(null);
      setParentId(record.id);
      form.resetFields();
      form.setFieldsValue({ sort: 1 });
      openDialog();
    },
    [form, openDialog],
  );

  const handleEdit = useCallback(
    (record: CategoryItem) => {
      setEditingRecord(record);
      setParentId(record.parent_id ?? null);
      form.setFieldsValue(record);
      openDialog();
    },
    [form, openDialog],
  );

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingRecord) {
        await onEdit?.(values, editingRecord);
        message.success('编辑成功');
      } else {
        await onAdd?.(values, parentId);
        message.success('新增成功');
      }
      closeDialog();
      onRefresh?.();
    } catch (error: any) {
      if (!error?.errorFields) message.error(error?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  }, [form, editingRecord, parentId, onAdd, onEdit, closeDialog, onRefresh]);
  //#endregion

  //#region 批量操作
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    await onBatchDelete?.(selectedRowKeys);
    setSelectedRowKeys([]);
  };

  const parentOptions = useMemo(() => {
    const options: { label: string; value: number | string; disabled?: boolean }[] = [];
    const disabledIds = new Set<number | string>();
    const collectDisabled = (items: CategoryItem[], parentId: number | string) => {
      if (selectedRowKeys.includes(parentId)) disabledIds.add(parentId);
      items.forEach((item) => {
        if (selectedRowKeys.includes(item.id) || disabledIds.has(item.parent_id ?? 0)) {
          disabledIds.add(item.id);
        }
        if (item.children?.length) collectDisabled(item.children, item.id);
      });
    };
    collectDisabled(localDataSource, 0);

    // 判断移动到目标父分类后是否会超过最大层级
    const isOverLevel = (targetParentId: number | string) =>
      !canMoveTo(localDataSource, selectedRowKeys, targetParentId, maxLevel);

    // 根选项（作为一级分类）
    options.push({
      label: '无（作为一级分类）',
      value: 0,
      disabled: isOverLevel(0),
    });

    const build = (items: CategoryItem[], level = 0) => {
      items.forEach((item) => {
        const overLevel = isOverLevel(item.id);
        const disabled = disabledIds.has(item.id) || overLevel;
        options.push({
          label: `${'　'.repeat(level)}${level > 0 ? '└ ' : ''}${item.name}${overLevel ? '（超出最大层级）' : ''}`,
          value: item.id,
          disabled,
        });
        if (item.children?.length) build(item.children, level + 1);
      });
    };
    build(localDataSource);
    return options;
  }, [localDataSource, selectedRowKeys, maxLevel]);

  const handleBatchMoveConfirm = async () => {
    if (selectedRowKeys.length === 0) return;
    // 二次校验：防止绕过下拉限制，移动后超过最大层级
    if (!canMoveTo(localDataSource, selectedRowKeys, moveTargetParent, maxLevel)) {
      message.error('移动后将超过最大分类层级');
      return;
    }
    setBatchMoving(true);
    try {
      await onBatchMove?.(selectedRowKeys, moveTargetParent);
      message.success(`已移动 ${selectedRowKeys.length} 项`);
      setSelectedRowKeys([]);
      setBatchMoveVisible(false);
    } catch {
      message.error('移动失败');
    } finally {
      setBatchMoving(false);
    }
  };
  //#endregion

  const rowSelection = useMemo(() => {
    if (!selectable) return undefined;
    return {
      selectedRowKeys,
      onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as (number | string)[]),
      columnWidth: 48,
    };
  }, [selectable, selectedRowKeys]);

  //#region 表格列
  const autoGeneratedColumns = useMemo(() => {
    const cols: ColumnsType<CategoryItem> = [];
    extraFields.forEach((field) => {
      if (field.showColumn === false) return;
      cols.push({
        title: field.label,
        dataIndex: field.name,
        key: field.name,
        width: field.width,
        align: field.align,
        ellipsis: field.ellipsis,
        render: field.render,
      });
    });
    return cols;
  }, [extraFields]);

  const columns: ColumnsType<CategoryItem> = useMemo(() => {
    const base: ColumnsType<CategoryItem> = [
      { title: nameColumnTitle, dataIndex: 'name', key: 'name', ellipsis: true },
    ];
    if (columnDisplay.sort) {
      base.push({
        title: sortColumnTitle,
        dataIndex: 'sort',
        key: 'sort',
        width: 80,
        align: 'center',
        render: (sort: number) => sort ?? '-',
      });
    }
    if (columnDisplay.stat) {
      base.push({
        title: statColumnTitle,
        dataIndex: statField,
        key: statField,
        width: 80,
        align: 'center',
        render: (val: number) => <Tag color="blue">{val ?? 0}</Tag>,
      });
    }
    base.push(...autoGeneratedColumns, ...extraColumns);
    if (actions.addChild || actions.edit || actions.delete) {
      base.push({
        title: actionColumnTitle,
        key: 'action',
        width: 170,
        fixed: 'right',
        className: 'action-col',
        render: (_, record) => (
          <Space size={4}>
            {actions.addChild && canAddChild(record) && (
              <Button type="link" size="small" icon={<PlusCircleOutlined />} onClick={() => handleAddChild(record)}>
                {addChildButtonText}
              </Button>
            )}
            {actions.edit && (
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                {editButtonText}
              </Button>
            )}
            {actions.delete && (
              <Popconfirm
                title="确定删除该分类吗？"
                description="删除后不可恢复，子分类也将被删除"
                onConfirm={() => onDelete?.(record)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  {deleteButtonText}
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      });
    }
    return base;
  }, [
    nameColumnTitle, sortColumnTitle, statColumnTitle, actionColumnTitle,
    columnDisplay, statField, autoGeneratedColumns, extraColumns, actions,
    addChildButtonText, editButtonText, deleteButtonText,
    handleAddChild, handleEdit, onDelete, canAddChild,
  ]);
  //#endregion

  //#region 表单内容
  const renderFormContent = useCallback(() => (
    <Form form={form} layout="vertical" {...formProps}>
      <Form.Item name="name" label={nameLabel} rules={[{ required: true, message: `请输入${nameLabel}` }]}>
        <Input placeholder={`请输入${nameLabel}`} />
      </Form.Item>
      {columnDisplay.sort && (
        <Form.Item name="sort" label="排序" initialValue={1}>
          <InputNumber min={1} style={{ width: '100%' }} placeholder="数字越小越靠前" />
        </Form.Item>
      )}
      {extraFields.map((field) => {
        if (!field.formType && !field.renderFormItem) return null;
        return (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.label}
            rules={field.rules || (field.required ? [{ required: true, message: `请输入${field.label}` }] : undefined)}
          >
            {/* 优先使用自定义表单组件（Form.Item 自动注入 value 和 onChange） */}
            {field.renderFormItem ?? (
              <>
                {field.formType === 'input' && <Input placeholder={field.placeholder} />}
                {field.formType === 'textarea' && <Input.TextArea rows={3} placeholder={field.placeholder} />}
                {field.formType === 'inputNumber' && <InputNumber style={{ width: '100%' }} placeholder={field.placeholder} />}
                {field.formType === 'select' && <Select options={field.options} placeholder={field.placeholder} />}
              </>
            )}
          </Form.Item>
        );
      })}
    </Form>
  ), [form, formProps, nameLabel, columnDisplay.sort, extraFields]);
  //#endregion

  const dialogTitle = editingRecord ? `编辑${modalTitle}` : `新增${modalTitle}`;

  return (
    <div className="category-manager">
      <div className="cm-toolbar">
        <div className="cm-toolbar-left">
          {selectable && selectedRowKeys.length > 0 && (
            <Space size="middle">
              <span className="cm-selected-count">
                {selectedCountPrefix} <strong>{selectedRowKeys.length}</strong> {selectedCountSuffix}
              </span>
              {actions.delete && onBatchDelete && (
                <Popconfirm
                  title={`确定删除选中的 ${selectedRowKeys.length} 项吗？`}
                  description="删除后不可恢复，子分类也将被删除"
                  onConfirm={handleBatchDelete}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button danger size="small" icon={<DeleteOutlined />}>{batchDeleteButtonText}</Button>
                </Popconfirm>
              )}
              {onBatchMove && (
                <Button size="small" onClick={() => { setMoveTargetParent(0); setBatchMoveVisible(true); }}>
                  {batchMoveButtonText}
                </Button>
              )}
            </Space>
          )}
        </div>
        <div className="cm-toolbar-right">
          <Space size="small" wrap>
            {sortable && hasSortChanges && (
              <Button size="small" icon={<ReloadOutlined />} onClick={handleResetSort}>{resetButtonText}</Button>
            )}
            {sortable && (
              <Button
                type={hasSortChanges ? 'primary' : 'default'}
                icon={<SaveOutlined />}
                onClick={handleSaveSort}
                loading={savingSort}
                disabled={!hasSortChanges}
              >
                {saveButtonText}
              </Button>
            )}
            {actions.add && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{addButtonText}</Button>
            )}
          </Space>
        </div>
      </div>

      <Table<CategoryItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={localDataSource}
        pagination={false}
        rowSelection={rowSelection}
        expandable={{
          expandedRowKeys,
          onExpand: handleExpand,
          indentSize: 24,
          expandIcon: ({ expanded, onExpand, record }) => {
            // 有子分类且未达最大层级时才显示展开箭头
            const expandable = !!record.children?.length && canAddChild(record);
            if (!expandable) {
              return <span style={{ display: 'inline-block', width: 24, height: 24 }} />;
            }
            return (
              <span
                onClick={(e) => onExpand(record, e)}
                style={{
                  display: 'inline-block',
                  width: 24,
                  height: 24,
                  textAlign: 'center',
                  lineHeight: '24px',
                  cursor: 'pointer',
                  color: '#999',
                }}
              >
                <CaretRightOutlined rotate={expanded ? 90 : 0} />
              </span>
            );
          },
        }}
        scroll={{ x: 'max-content' }}
        onRow={(record) => ({
          draggable: sortable,
          onDragStart: (e) => handleDragStart(e, record),
          onDragOver: (e) => handleDragOver(e, record),
          onDrop: (e) => handleDrop(e, record),
          onDragEnd: handleDragEnd,
          className: [
            sortable ? 'drag-sort-row' : '',
            dragRowId === record.id ? 'row-dragging' : '',
            dropRowId === record.id && dropPosition === 'before' ? 'drop-before' : '',
            dropRowId === record.id && dropPosition === 'after' ? 'drop-after' : '',
          ].filter(Boolean).join(' '),
        })}
        {...tableProps}
      />

      {!isMobile && (
        <Modal
          title={dialogTitle}
          open={dialogVisible}
          onOk={handleSubmit}
          onCancel={closeDialog}
          confirmLoading={submitting}
          destroyOnClose
          okText="确定"
          cancelText="取消"
        >
          {renderFormContent()}
        </Modal>
      )}

      <Modal
        title={batchMoveModalTitle}
        open={batchMoveVisible}
        onOk={handleBatchMoveConfirm}
        onCancel={() => setBatchMoveVisible(false)}
        confirmLoading={batchMoving}
        okText="确定移动"
        cancelText="取消"
        width={420}
      >
        <div className="cm-batch-move-tip">
          将选中的 <strong>{selectedRowKeys.length}</strong> 个分类移动到：
        </div>
        <Form layout="vertical">
          <Form.Item label="目标父分类">
            <Select value={moveTargetParent} onChange={setMoveTargetParent} options={parentOptions} placeholder="选择目标分类" />
          </Form.Item>
        </Form>
      </Modal>

      {isMobile && (
        <Drawer
          title={dialogTitle}
          placement="bottom"
          open={dialogVisible}
          onClose={closeDialog}
          height="auto"
          destroyOnClose
          footer={
            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={closeDialog}>取消</Button>
                <Button type="primary" loading={submitting} onClick={handleSubmit}>确定</Button>
              </Space>
            </div>
          }
        >
          {renderFormContent()}
        </Drawer>
      )}
    </div>
  );
};

export default CategoryManager;
