import {
  DeleteOutlined,
  EditOutlined,
  MinusOutlined,
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
import type { ColumnsType, RowSelection, TableProps } from 'antd/es/table';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './index.less';

// ==================== 类型定义 ====================
export interface SimpleCategoryItem {
  id: number | string;
  name: string;
  color?: string;
  count?: number;
  sort?: number;
  parent_id?: number | string | null;
  children?: SimpleCategoryItem[];
  [key: string]: any;
}

export interface ColorOption {
  label: string;
  value: string;
}

export interface FormFieldConfig {
  name: string;
  label: string;
  type: 'input' | 'inputNumber' | 'textarea' | 'select';
  required?: boolean;
  placeholder?: string;
  rules?: any[];
  options?: { label: string; value: any }[];
}

export interface ActionConfig {
  add?: boolean;
  edit?: boolean;
  delete?: boolean;
  addChild?: boolean;
}

export interface ColumnDisplayConfig {
  color?: boolean;
  count?: boolean;
  sort?: boolean;
}

export interface SimpleCategoryManagerProps {
  /** 树形数据 */
  dataSource: SimpleCategoryItem[];
  loading?: boolean;

  // ===== 列配置 =====
  columnDisplay?: ColumnDisplayConfig;
  extraColumns?: ColumnsType<SimpleCategoryItem>;
  nameColumnTitle?: string;
  colorColumnTitle?: string;
  countColumnTitle?: string;
  sortColumnTitle?: string;
  actionColumnTitle?: string;

  // ===== 颜色配置 =====
  colorOptions?: ColorOption[];
  defaultColor?: string;

  // ===== 表单配置 =====
  extraFormFields?: FormFieldConfig[];
  nameLabel?: string;
  colorLabel?: string;

  // ===== 操作按钮配置 =====
  actions?: ActionConfig;
  addButtonText?: string;
  saveButtonText?: string;
  resetButtonText?: string;
  addChildButtonText?: string;
  editButtonText?: string;
  deleteButtonText?: string;
  batchDeleteButtonText?: string;
  batchMoveButtonText?: string;

  // ===== 弹窗配置 =====
  modalTitle?: string;
  batchMoveModalTitle?: string;

  // ===== 文案配置 =====
  selectedCountPrefix?: string;
  selectedCountSuffix?: string;

  // ===== 回调 =====
  onAdd?: (
    values: any,
    parentId?: number | string | null,
  ) => Promise<void> | void;
  onEdit?: (values: any, record: SimpleCategoryItem) => Promise<void> | void;
  onDelete?: (record: SimpleCategoryItem) => Promise<void> | void;
  onBatchDelete?: (keys: (number | string)[]) => Promise<void> | void;
  onBatchMove?: (
    keys: (number | string)[],
    targetParentId: number | string,
  ) => Promise<void> | void;
  onSaveSort?: (sortedItems: SimpleCategoryItem[]) => Promise<void> | void;
  onRefresh?: () => void;

  // ===== 功能开关 =====
  sortable?: boolean;
  selectable?: boolean;

  // ===== 透传 =====
  tableProps?: Partial<TableProps<SimpleCategoryItem>>;
  formProps?: Partial<FormProps>;
  defaultExpandAllRows?: boolean;
}

//#region 工具函数（纯函数，无闭包依赖）
/** 深拷贝树形结构 */
function deepCloneTree<T>(tree: T[]): T[] {
  return JSON.parse(JSON.stringify(tree));
}

const findRecordById = (
  tree: SimpleCategoryItem[],
  id: number | string,
): SimpleCategoryItem | null => {
  for (const item of tree) {
    if (item.id === id) return item;
    if (item.children && item.children.length > 0) {
      const found = findRecordById(item.children, id);
      if (found) return found;
    }
  }
  return null;
};

/**
 * 获取节点层级：一级=1，二级=2，三级=3
 * 每次传入最新树，消除闭包滞后bug
 */
const getItemLevel = (
  tree: SimpleCategoryItem[],
  targetId: number | string,
  level = 1,
): number => {
  for (const item of tree) {
    if (item.id === targetId) return level;
    if (item.children && item.children.length > 0) {
      const res = getItemLevel(item.children, targetId, level + 1);
      if (res > 0) return res;
    }
  }
  return 0;
};

const getParentOfNode = (
  tree: SimpleCategoryItem[],
  targetId: number | string,
): SimpleCategoryItem | null => {
  for (const item of tree) {
    if (item.children && item.children.some((c) => c.id === targetId)) {
      return item;
    }
    if (item.children && item.children.length > 0) {
      const found = getParentOfNode(item.children, targetId);
      if (found) return found;
    }
  }
  return null;
};

const getSiblingsById = (
  tree: SimpleCategoryItem[],
  id: number | string,
): SimpleCategoryItem[] => {
  const record = findRecordById(tree, id);
  if (!record) return [];
  const parentId = record.parent_id ?? 0;
  if (parentId === 0) return tree;
  const parent = findRecordById(tree, parentId);
  return parent?.children || [];
};

const updateSiblingsInTree = (
  tree: SimpleCategoryItem[],
  parentId: number | string,
  newSiblings: SimpleCategoryItem[],
): SimpleCategoryItem[] => {
  if (parentId === 0) return newSiblings;
  return tree.map((item) => {
    if (item.id === parentId) {
      return { ...item, children: newSiblings };
    }
    if (item.children && item.children.length > 0) {
      return {
        ...item,
        children: updateSiblingsInTree(item.children, parentId, newSiblings),
      };
    }
    return item;
  });
};

const flattenTree = (tree: SimpleCategoryItem[]): SimpleCategoryItem[] => {
  const result: SimpleCategoryItem[] = [];
  const traverse = (items: SimpleCategoryItem[]) => {
    items.forEach((item) => {
      const { children, ...rest } = item;
      result.push(rest);
      if (children && children.length > 0) {
        traverse(children);
      }
    });
  };
  traverse(tree);
  return result;
};
//#endregion

// ==================== 扩充默认颜色选项（20个） ====================
const defaultColorOptions: ColorOption[] = [
  { value: 'blue', label: '蓝色' },
  { value: 'geekblue', label: '深蓝' },
  { value: 'cyan', label: '青色' },
  { value: 'lightblue', label: '浅蓝' },

  { value: 'green', label: '绿色' },
  { value: 'lime', label: '青柠' },
  { value: 'emerald', label: '翠玉绿' },

  { value: 'purple', label: '紫色' },
  { value: 'magenta', label: '桃色' },
  { value: 'pink', label: '粉色' },

  { value: 'orange', label: '橙色' },
  { value: 'volcano', label: '火山橙' },
  { value: 'gold', label: '金色' },
  { value: 'yellow', label: '黄色' },

  { value: 'red', label: '红色' },
  { value: 'rose', label: '玫瑰红' },

  { value: 'gray', label: '灰色' },
  { value: 'silver', label: '银灰' },

  { value: 'indigo', label: '靛蓝' },
  { value: 'violet', label: '紫罗兰' },
];

// ==================== 组件实现 ====================
const SimpleCategoryManager: React.FC<SimpleCategoryManagerProps> = ({
  dataSource,
  loading = false,

  columnDisplay = { color: true, count: true, sort: false },
  extraColumns = [],
  nameColumnTitle = '名称',
  colorColumnTitle = '颜色',
  countColumnTitle = '数量',
  sortColumnTitle = '排序',
  actionColumnTitle = '操作',

  colorOptions = defaultColorOptions,
  defaultColor = 'blue',

  extraFormFields = [],
  nameLabel = '名称',
  colorLabel = '颜色',

  actions = { add: true, edit: true, delete: true, addChild: true },
  addButtonText = '新增',
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
  onSaveSort,
  onRefresh,

  sortable = false,
  selectable = false,

  tableProps,
  formProps,
  defaultExpandAllRows = true,
}) => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SimpleCategoryItem | null>(
    null,
  );
  const [parentId, setParentId] = useState<number | string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<(number | string)[]>(
    [],
  );

  // 拖拽状态
  const [dragRowId, setDragRowId] = useState<number | string | null>(null);
  const [dropRowId, setDropRowId] = useState<number | string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(
    null,
  );
  const [localDataSource, setLocalDataSource] = useState<SimpleCategoryItem[]>(
    () => deepCloneTree(dataSource),
  );
  const [hasSortChanges, setHasSortChanges] = useState(false);
  const [savingSort, setSavingSort] = useState(false);

  // 多选状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<(number | string)[]>(
    [],
  );

  // 批量移动
  const [batchMoveVisible, setBatchMoveVisible] = useState(false);
  const [moveTargetParent, setMoveTargetParent] = useState<number | string>(0);
  const [batchMoving, setBatchMoving] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const mobile = isMobile;

  // 外部dataSource变更，深拷贝刷新本地树
  useEffect(() => {
    setLocalDataSource(deepCloneTree(dataSource));
    setHasSortChanges(false);
  }, [dataSource]);

  const getAllExpandableKeys = useCallback((items: SimpleCategoryItem[]) => {
    const keys: (number | string)[] = [];
    const traverse = (list: SimpleCategoryItem[]) => {
      list.forEach((item) => {
        if (item.children && item.children.length > 0) {
          keys.push(item.id);
          traverse(item.children);
        }
      });
    };
    traverse(items);
    return keys;
  }, []);

  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (
      defaultExpandAllRows &&
      isFirstLoad.current &&
      localDataSource.length > 0
    ) {
      setExpandedRowKeys(getAllExpandableKeys(localDataSource));
      isFirstLoad.current = false;
    }
  }, [localDataSource, defaultExpandAllRows, getAllExpandableKeys]);

  const handleExpand = useCallback(
    (expanded: boolean, record: SimpleCategoryItem) => {
      setExpandedRowKeys((prev) => {
        if (expanded) {
          return [...prev, record.id];
        }
        return prev.filter((key) => key !== record.id);
      });
    },
    [],
  );

  // ==================== 拖拽排序【修复版】 ====================
  const handleDragStart = useCallback(
    (e: React.DragEvent, record: SimpleCategoryItem) => {
      if (!sortable) return;
      setDragRowId(record.id);
      e.dataTransfer.effectAllowed = 'move';
    },
    [sortable],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, record: SimpleCategoryItem) => {
      if (!sortable || !dragRowId || dragRowId === record.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      // 实时读取最新树，避免闭包旧数据
      const tree = localDataSource;
      const dragRow = findRecordById(tree, dragRowId);
      if (!dragRow) return;

      // ✅ 核心校验：拖拽源 和 放置目标 必须属于同一个父节点，禁止跨父拖拽
      const dragParentId = dragRow.parent_id ?? 0;
      const targetParentId = record.parent_id ?? 0;
      if (dragParentId !== targetParentId) {
        setDropRowId(null);
        setDropPosition(null);
        return;
      }

      setDropRowId(record.id);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      setDropPosition(e.clientY < midY ? 'before' : 'after');
    },
    [sortable, dragRowId, localDataSource],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, record: SimpleCategoryItem) => {
      if (!sortable || !dragRowId || dragRowId === record.id) {
        setDragRowId(null);
        setDropRowId(null);
        setDropPosition(null);
        return;
      }
      e.preventDefault();

      const tree = localDataSource;
      const dragRow = findRecordById(tree, dragRowId);
      if (!dragRow) {
        setDragRowId(null);
        setDropRowId(null);
        setDropPosition(null);
        return;
      }

      // 再次校验父级一致
      const dragParentId = dragRow.parent_id ?? 0;
      const targetParentId = record.parent_id ?? 0;
      if (dragParentId !== targetParentId) {
        message.warning('仅支持在同一父分类内调整顺序，不能跨父移动');
        setDragRowId(null);
        setDropRowId(null);
        setDropPosition(null);
        return;
      }

      const siblings = getSiblingsById(tree, record.id);
      const dragIndex = siblings.findIndex((item) => item.id === dragRowId);
      const dropIndex = siblings.findIndex((item) => item.id === record.id);
      if (dragIndex === -1 || dropIndex === -1) return;

      // 构造新数组
      const newSiblings = [...siblings];
      const [removed] = newSiblings.splice(dragIndex, 1);
      let insertIndex = dropPosition === 'before' ? dropIndex : dropIndex + 1;
      if (dragIndex < dropIndex) {
        insertIndex -= 1;
      }
      newSiblings.splice(insertIndex, 0, removed);

      // 重排sort
      const updatedSiblings = newSiblings.map((item, index) => ({
        ...item,
        sort: index + 1,
      }));

      // 生成全新树形，不修改原引用
      const newTree = updateSiblingsInTree(
        deepCloneTree(tree),
        record.parent_id ?? 0,
        updatedSiblings,
      );
      setLocalDataSource(newTree);
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
      await onSaveSort(flattenTree(localDataSource));
      setHasSortChanges(false);
      message.success('排序已保存');
    } catch (err) {
      message.error('保存失败');
    } finally {
      setSavingSort(false);
    }
  };

  const handleResetSort = () => {
    setLocalDataSource(deepCloneTree(dataSource));
    setHasSortChanges(false);
  };

  // ==================== 弹窗操作 ====================
  const openDialog = useCallback(() => {
    if (mobile) {
      setDrawerVisible(true);
    } else {
      setModalVisible(true);
    }
  }, [mobile]);

  const closeDialog = useCallback(() => {
    setModalVisible(false);
    setDrawerVisible(false);
    setEditingRecord(null);
    setParentId(null);
    form.resetFields();
  }, [form]);

  const handleAdd = useCallback(() => {
    setEditingRecord(null);
    setParentId(null);
    form.resetFields();
    form.setFieldsValue({ color: defaultColor, sort: 1 });
    openDialog();
  }, [form, openDialog, defaultColor]);

  const handleAddChild = useCallback(
    (record: SimpleCategoryItem) => {
      setEditingRecord(null);
      setParentId(record.id);
      form.resetFields();
      form.setFieldsValue({ color: defaultColor, sort: 1 });
      openDialog();
    },
    [form, openDialog, defaultColor],
  );

  const handleEdit = useCallback(
    (record: SimpleCategoryItem) => {
      setEditingRecord(record);
      setParentId(record.parent_id ?? null);
      form.setFieldsValue(record);
      openDialog();
    },
    [form, openDialog],
  );

  const handleDelete = useCallback(
    async (record: SimpleCategoryItem) => {
      await onDelete?.(record);
    },
    [onDelete],
  );

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    await onBatchDelete?.(selectedRowKeys);
    setSelectedRowKeys([]);
  };

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
      if (error?.errorFields) return;
      message.error(error?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  }, [form, editingRecord, parentId, onAdd, onEdit, closeDialog, onRefresh]);

  // ==================== 批量移动 ====================
  const parentOptions = useMemo(() => {
    const tree = localDataSource;
    const options: {
      label: string;
      value: number | string;
      disabled?: boolean;
    }[] = [{ label: '无（作为一级）', value: 0 }];

    const disabledIds = new Set<number | string>();
    const collectDisabled = (items: SimpleCategoryItem[]) => {
      items.forEach((item) => {
        if (
          selectedRowKeys.includes(item.id) ||
          disabledIds.has(item.parent_id ?? 0)
        ) {
          disabledIds.add(item.id);
        }
        if (item.children && item.children.length > 0) {
          collectDisabled(item.children);
        }
      });
    };
    collectDisabled(tree);

    const buildOptions = (items: SimpleCategoryItem[], level = 0) => {
      items.forEach((item) => {
        const indent = '　'.repeat(level);
        const prefix = level > 0 ? '└ ' : '';
        options.push({
          label: `${indent}${prefix}${item.name}`,
          value: item.id,
          disabled: disabledIds.has(item.id),
        });
        if (item.children && item.children.length > 0) {
          buildOptions(item.children, level + 1);
        }
      });
    };
    buildOptions(tree);

    return options;
  }, [localDataSource, selectedRowKeys]);

  const handleOpenBatchMove = () => {
    setMoveTargetParent(0);
    setBatchMoveVisible(true);
  };

  const handleBatchMoveConfirm = async () => {
    if (selectedRowKeys.length === 0) return;
    setBatchMoving(true);
    try {
      await onBatchMove?.(selectedRowKeys, moveTargetParent);
      message.success(`已移动 ${selectedRowKeys.length} 项`);
      setSelectedRowKeys([]);
      setBatchMoveVisible(false);
    } catch (err) {
      message.error('移动失败');
    } finally {
      setBatchMoving(false);
    }
  };

  // ==================== 多选 ====================
  const rowSelection: RowSelection<SimpleCategoryItem> | undefined =
    useMemo(() => {
      if (!selectable) return undefined;
      return {
        selectedRowKeys,
        onChange: (keys) => setSelectedRowKeys(keys),
        columnWidth: 48,
      };
    }, [selectable, selectedRowKeys]);

  // ==================== 列定义 ====================
  const columns: ColumnsType<SimpleCategoryItem> = useMemo(() => {
    const tree = localDataSource;
    const baseColumns: ColumnsType<SimpleCategoryItem> = [
      {
        title: nameColumnTitle,
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        render: (name: string, record) => {
          const hasChild = record.children && record.children.length > 0;
          const expanded = expandedRowKeys.includes(record.id);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {hasChild ? (
                expanded ? (
                  <MinusOutlined style={{ fontSize: 12, color: '#666' }} />
                ) : (
                  <PlusOutlined style={{ fontSize: 12, color: '#666' }} />
                )
              ) : (
                <span style={{ width: 12 }} />
              )}
              <span>{name}</span>
            </div>
          );
        },
      },
    ];

    if (columnDisplay.color) {
      baseColumns.push({
        title: colorColumnTitle,
        dataIndex: 'color',
        key: 'color',
        width: 100,
        align: 'center',
        render: (_color: string | undefined, record) => {
          const tagColor = _color || defaultColor;
          return <Tag color={tagColor}>{record.name}</Tag>;
        },
      });
    }

    if (columnDisplay.sort) {
      baseColumns.push({
        title: sortColumnTitle,
        dataIndex: 'sort',
        key: 'sort',
        width: 80,
        align: 'center',
        render: (sort: number) => sort ?? '-',
      });
    }

    if (columnDisplay.count) {
      baseColumns.push({
        title: countColumnTitle,
        dataIndex: 'count',
        key: 'count',
        width: 80,
        align: 'center',
        render: (count: number) => count ?? 0,
      });
    }

    baseColumns.push(...extraColumns);

    const hasAction = actions.addChild || actions.edit || actions.delete;
    if (hasAction) {
      baseColumns.push({
        title: actionColumnTitle,
        key: 'action',
        width: 170,
        fixed: 'right',
        className: 'action-col',
        render: (_, record) => {
          // 实时传入最新树，修复层级计算滞后
          const level = getItemLevel(tree, record.id);
          const canAddChild = level < 3;

          return (
            <Space size={4}>
              {actions.addChild && (
                <Button
                  type="link"
                  size="small"
                  icon={<PlusCircleOutlined />}
                  onClick={() => handleAddChild(record)}
                  disabled={!canAddChild}
                >
                  {addChildButtonText}
                </Button>
              )}
              {actions.edit && (
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(record)}
                >
                  {editButtonText}
                </Button>
              )}
              {actions.delete && (
                <Popconfirm
                  title="确定删除吗？"
                  description="删除后子分类也将被删除"
                  onConfirm={() => handleDelete(record)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                  >
                    {deleteButtonText}
                  </Button>
                </Popconfirm>
              )}
            </Space>
          );
        },
      });
    }

    return baseColumns;
  }, [
    nameColumnTitle,
    colorColumnTitle,
    sortColumnTitle,
    countColumnTitle,
    actionColumnTitle,
    columnDisplay,
    extraColumns,
    actions,
    addChildButtonText,
    editButtonText,
    deleteButtonText,
    handleAddChild,
    handleEdit,
    handleDelete,
    expandedRowKeys,
    localDataSource,
    defaultColor,
  ]);

  // ==================== 表单渲染 ====================
  const renderFormContent = useCallback(() => {
    return (
      <Form form={form} layout="vertical" {...formProps}>
        <Form.Item
          name="name"
          label={nameLabel}
          rules={[{ required: true, message: `请输入${nameLabel}` }]}
        >
          <Input placeholder={`请输入${nameLabel}`} />
        </Form.Item>

        <Form.Item name="color" label={colorLabel} initialValue={defaultColor}>
          <Select placeholder="选择颜色" showSearch optionFilterProp="label">
            {colorOptions.map((opt) => (
              <Select.Option key={opt.value} value={opt.value}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      backgroundColor: opt.value,
                      display: 'inline-block',
                    }}
                  />
                  <span>{opt.label}</span>
                </div>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {columnDisplay.sort && (
          <Form.Item name="sort" label="排序" initialValue={1}>
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              placeholder="数字越小越靠前"
            />
          </Form.Item>
        )}

        {extraFormFields.map((field) => (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.label}
            rules={
              field.rules ||
              (field.required
                ? [{ required: true, message: `请输入${field.label}` }]
                : undefined)
            }
          >
            {field.type === 'input' && (
              <Input placeholder={field.placeholder} />
            )}
            {field.type === 'textarea' && (
              <Input.TextArea rows={3} placeholder={field.placeholder} />
            )}
            {field.type === 'inputNumber' && (
              <InputNumber
                style={{ width: '100%' }}
                placeholder={field.placeholder}
              />
            )}
            {field.type === 'select' && (
              <Select options={field.options} placeholder={field.placeholder} />
            )}
          </Form.Item>
        ))}
      </Form>
    );
  }, [
    form,
    formProps,
    nameLabel,
    colorLabel,
    defaultColor,
    colorOptions,
    columnDisplay.sort,
    extraFormFields,
  ]);

  const dialogTitle = editingRecord ? `编辑${modalTitle}` : `新增${modalTitle}`;

  return (
    <div className="simple-category-manager">
      {/* 工具栏 */}
      <div className="scm-toolbar">
        <div className="scm-toolbar-left">
          {selectable && selectedRowKeys.length > 0 && (
            <Space size="middle">
              <span className="scm-selected-count">
                {selectedCountPrefix} <strong>{selectedRowKeys.length}</strong>{' '}
                {selectedCountSuffix}
              </span>
              {actions.delete && onBatchDelete && (
                <Popconfirm
                  title={`确定删除选中的 ${selectedRowKeys.length} 项吗？`}
                  description="删除后子分类也将被删除"
                  onConfirm={handleBatchDelete}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button danger size="small" icon={<DeleteOutlined />}>
                    {batchDeleteButtonText}
                  </Button>
                </Popconfirm>
              )}
              {onBatchMove && (
                <Button size="small" onClick={handleOpenBatchMove}>
                  {batchMoveButtonText}
                </Button>
              )}
            </Space>
          )}
        </div>

        <div className="scm-toolbar-right">
          <Space size="small" wrap>
            {sortable && hasSortChanges && (
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleResetSort}
              >
                {resetButtonText}
              </Button>
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
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                {addButtonText}
              </Button>
            )}
          </Space>
        </div>
      </div>

      <Table<SimpleCategoryItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={localDataSource}
        pagination={false}
        rowSelection={rowSelection}
        expandable={{
          expandedRowKeys,
          onExpand: handleExpand,
          showExpandColumn: false,
        }}
        scroll={{ x: 'max-content' }}
        size="small"
        onRow={(record) => ({
          draggable: sortable,
          onDragStart: (e) => handleDragStart(e, record),
          onDragOver: (e) => handleDragOver(e, record),
          onDrop: (e) => handleDrop(e, record),
          onDragEnd: handleDragEnd,
          className: [
            sortable ? 'drag-sort-row' : '',
            dragRowId === record.id ? 'row-dragging' : '',
            dropRowId === record.id && dropPosition === 'before'
              ? 'drop-before'
              : '',
            dropRowId === record.id && dropPosition === 'after'
              ? 'drop-after'
              : '',
          ]
            .filter(Boolean)
            .join(' '),
        })}
        {...tableProps}
      />

      {/* 新增/编辑弹窗 */}
      {!mobile && (
        <Modal
          title={dialogTitle}
          open={modalVisible}
          onOk={handleSubmit}
          onCancel={closeDialog}
          confirmLoading={submitting}
          destroyOnClose
          okText="确定"
          cancelText="取消"
          width={420}
        >
          {renderFormContent()}
        </Modal>
      )}

      {mobile && (
        <Drawer
          title={dialogTitle}
          placement="bottom"
          open={drawerVisible}
          onClose={closeDialog}
          height="auto"
          destroyOnClose
          footer={
            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={closeDialog}>取消</Button>
                <Button
                  type="primary"
                  loading={submitting}
                  onClick={handleSubmit}
                >
                  确定
                </Button>
              </Space>
            </div>
          }
        >
          {renderFormContent()}
        </Drawer>
      )}

      {/* 批量移动弹窗 */}
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
        <div style={{ marginBottom: 16 }}>
          将选中的{' '}
          <strong style={{ color: '#1890ff' }}>{selectedRowKeys.length}</strong>{' '}
          项移动到：
        </div>
        <Form layout="vertical">
          <Form.Item label="目标父分类">
            <Select
              value={moveTargetParent}
              onChange={setMoveTargetParent}
              options={parentOptions}
              placeholder="选择目标分类"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SimpleCategoryManager;
