import {
  CaretRightOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import { useSetState } from 'ahooks';
import { Button, Form, Popconfirm, Space, Table, Tag, message } from 'antd';
import type { ColumnsType, TableProps } from 'antd/es/table';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  BatchMoveModal,
  CategoryFormModal,
  CategoryToolbar,
} from './components';
import { useDragSort } from './hooks/useDragSort';
import './index.less';
import type {
  CategoryItem,
  CategoryManagerProps,
  ColumnDisplayConfig,
  ExtraFieldConfig,
} from './types';
import { flatToTree, isFlatData } from './utils';

const CategoryManager: React.FC<CategoryManagerProps> = ({
  dataSource,
  nameColumnTitle = '分类名称',
  sortColumnTitle = '排序',
  statColumnTitle = '数量',
  actionColumnTitle = '操作',
  nameLabel = '分类名称',
  statField = 'count',
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
  loading = false,
  maxLevel = 3,
  extraFields = [],
  extraColumns = [],
  columnDisplay = { sort: true, stat: true },
  actions = { add: true, edit: true, delete: true, addChild: true },
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
  // 传入 statField 时递归汇总统计字段（父分类 = 自身 + 所有后代）
  const treeData = useMemo(
    () =>
      isFlatData(dataSource)
        ? flatToTree(dataSource, statField)
        : dataSource,
    [dataSource, statField],
  );

  //#region 状态
  const [state, setState] = useSetState({
    dialogVisible: false,
    editingRecord: null as CategoryItem | null,
    parentId: null as number | string | null,
    expandedRowKeys: [] as (number | string)[],
    localDataSource: treeData as CategoryItem[],
    hasSortChanges: false,
    selectedRowKeys: [] as (number | string)[],
    batchMoveVisible: false,
    moveTargetParent: 0 as number | string,
    isMobile: false,
    submitting: false,
    savingSort: false,
    batchMoving: false,
  });
  const {
    dialogVisible,
    editingRecord,
    parentId,
    expandedRowKeys,
    localDataSource,
    hasSortChanges,
    selectedRowKeys,
    batchMoveVisible,
    moveTargetParent,
    isMobile,
    submitting,
    savingSort,
    batchMoving,
  } = state;
  //#endregion

  //#region 层级控制
  /** 预先计算整棵树中每个节点的层级，存入 Map 方便快速查询，避免每次递归遍历树 */
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

  /** 判断某个节点是否还能添加子节点（当前层级 < maxLevel 时才可加） */
  const canAddChild = useCallback(
    (record: CategoryItem) => (idToLevelMap.get(record.id) || 1) < maxLevel,
    [idToLevelMap, maxLevel],
  );
  //#endregion

  // 响应式
  useEffect(() => {
    const handleResize = () => setState({ isMobile: window.innerWidth < 768 });
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 外部数据同步
  useEffect(() => {
    setState({ localDataSource: treeData, hasSortChanges: false });
  }, [treeData]);

  // 默认展开（仅首次有数据时执行，后续刷新保持当前展开状态）
  const expandedInitialized = useRef(false);
  useEffect(() => {
    if (
      defaultExpandAllRows &&
      localDataSource.length > 0 &&
      !expandedInitialized.current
    ) {
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
      setState({ expandedRowKeys: keys });
    }
  }, [localDataSource, defaultExpandAllRows]);

  const handleExpand = useCallback(
    (expanded: boolean, record: CategoryItem) => {
      setState((prev) =>
        expanded
          ? { ...prev, expandedRowKeys: [...prev.expandedRowKeys, record.id] }
          : {
              ...prev,
              expandedRowKeys: prev.expandedRowKeys.filter(
                (k) => k !== record.id,
              ),
            },
      );
    },
    [],
  );

  //#region 拖拽排序（委托给 useDragSort hook，仅本地更新，保存/重置由外部控制）
  const {
    dragRowId,
    dropRowId,
    dropPosition,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  } = useDragSort({
    sortable,
    localDataSource,
    onLocalDataSourceChange: (newTree) =>
      setState({ localDataSource: newTree }),
    onSortChange: () => setState({ hasSortChanges: true }),
  });
  //#endregion

  //#region 排序保存/重置
  const handleSaveSort = async () => {
    if (!onSaveSort) return;
    setState({ savingSort: true });
    try {
      // 树形数据转回扁平化，调用方始终处理扁平数据
      const flatList: CategoryItem[] = [];
      const flatten = (items: CategoryItem[], parentId: number | string) => {
        items.forEach((item) => {
          const { children, ...rest } = item;
          flatList.push({ ...rest, parent_id: parentId });
          if (children?.length) flatten(children, item.id);
        });
      };
      flatten(localDataSource, 0);
      await onSaveSort(flatList);
      setState({ hasSortChanges: false });
      message.success('排序已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setState({ savingSort: false });
    }
  };

  const handleResetSort = () => {
    setState({ localDataSource: treeData, hasSortChanges: false });
  };
  //#endregion

  //#region 弹窗操作
  const openDialog = useCallback(() => setState({ dialogVisible: true }), []);
  const closeDialog = useCallback(() => {
    setState({ dialogVisible: false });
    setState({ editingRecord: null });
    setState({ parentId: null });
    form.resetFields();
  }, [form]);

  const handleAdd = useCallback(() => {
    setState({ editingRecord: null });
    setState({ parentId: null });
    form.resetFields();
    // 自动计算根分类最大 sort + 1（排序输入框 disabled，仅显示）
    const maxSort = localDataSource.reduce(
      (max, item) => Math.max(max, item.sort || 0),
      0,
    );
    form.setFieldsValue({ sort: maxSort + 1 });
    openDialog();
  }, [form, openDialog, localDataSource]);

  const handleAddChild = useCallback(
    (record: CategoryItem) => {
      setState({ editingRecord: null });
      setState({ parentId: record.id });
      form.resetFields();
      // 自动计算该父分类下子节点最大 sort + 1
      const maxSort = (record.children || []).reduce(
        (max, item) => Math.max(max, item.sort || 0),
        0,
      );
      form.setFieldsValue({ sort: maxSort + 1 });
      openDialog();
    },
    [form, openDialog],
  );

  const handleEdit = useCallback(
    (record: CategoryItem) => {
      setState({ editingRecord: record });
      setState({ parentId: record.parent_id ?? null });
      form.setFieldsValue(record);
      openDialog();
    },
    [form, openDialog],
  );

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setState({ submitting: true });
      if (editingRecord) {
        // 编辑：构造提交数据
        // 1. 从 editingRecord 去掉 children（树形节点特有，扁平化数据不需要）
        // 2. 过滤 values 中的 undefined，避免覆盖 editingRecord 中正确的 parent_id 等字段
        //    （validateFields 对没有 Form.Item 的字段会返回 undefined）
        const { children: _ignored, ...recordWithoutChildren } = editingRecord;
        const cleanValues = Object.fromEntries(
          Object.entries(values).filter(([_, v]) => v !== undefined),
        );
        await onEdit?.(
          { ...recordWithoutChildren, ...cleanValues },
          editingRecord,
        );
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
      setState({ submitting: false });
    }
  }, [form, editingRecord, parentId, onAdd, onEdit, closeDialog, onRefresh]);
  //#endregion

  //#region 批量操作
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    await onBatchDelete?.(selectedRowKeys);
    setState({ selectedRowKeys: [] });
  };

  const handleOpenBatchMove = () => {
    setState({ moveTargetParent: 0 });
    setState({ batchMoveVisible: true });
  };

  const handleBatchMoveConfirm = async () => {
    if (selectedRowKeys.length === 0) return;
    setState({ batchMoving: true });
    try {
      await onBatchMove?.(selectedRowKeys, moveTargetParent);
      message.success(`已移动 ${selectedRowKeys.length} 项`);
      setState({ selectedRowKeys: [] });
      setState({ batchMoveVisible: false });
      // 移动后刷新数据，确保树形结构正确显示
      onRefresh?.();
    } catch {
      message.error('移动失败');
    } finally {
      setState({ batchMoving: false });
    }
  };
  //#endregion

  const rowSelection = useMemo(() => {
    if (!selectable) return undefined;
    return {
      selectedRowKeys,
      onChange: (keys: React.Key[]) =>
        setState({ selectedRowKeys: keys as (number | string)[] }),
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
      {
        title: nameColumnTitle,
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
      },
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
              <Button
                type="link"
                size="small"
                icon={<PlusCircleOutlined />}
                onClick={() => handleAddChild(record)}
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
                title="确定删除该分类吗？"
                description="删除后不可恢复，子分类也将被删除"
                onConfirm={() => onDelete?.(record)}
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
        ),
      });
    }
    return base;
  }, [
    nameColumnTitle,
    sortColumnTitle,
    statColumnTitle,
    actionColumnTitle,
    columnDisplay,
    statField,
    autoGeneratedColumns,
    extraColumns,
    actions,
    addChildButtonText,
    editButtonText,
    deleteButtonText,
    handleAddChild,
    handleEdit,
    onDelete,
    canAddChild,
  ]);
  //#endregion

  return (
    <div className="category-manager">
      <CategoryToolbar
        selectable={selectable}
        selectedRowKeys={selectedRowKeys}
        selectedCountPrefix={selectedCountPrefix}
        selectedCountSuffix={selectedCountSuffix}
        actions={actions}
        onBatchDelete={handleBatchDelete}
        onBatchMove={handleOpenBatchMove}
        batchDeleteButtonText={batchDeleteButtonText}
        batchMoveButtonText={batchMoveButtonText}
        addButtonText={addButtonText}
        onAdd={handleAdd}
        sortable={sortable}
        hasSortChanges={hasSortChanges}
        saveButtonText={saveButtonText}
        resetButtonText={resetButtonText}
        savingSort={savingSort}
        onSaveSort={handleSaveSort}
        onResetSort={handleResetSort}
      />

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
              return (
                <span
                  style={{ display: 'inline-block', width: 24, height: 24 }}
                />
              );
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
        {...(tableProps as Partial<TableProps<CategoryItem>>)}
      />

      <CategoryFormModal
        visible={dialogVisible}
        editingRecord={editingRecord}
        form={form}
        onOk={handleSubmit}
        onCancel={closeDialog}
        submitting={submitting}
        nameLabel={nameLabel}
        columnDisplay={columnDisplay as ColumnDisplayConfig}
        extraFields={extraFields as ExtraFieldConfig[]}
        formProps={formProps}
        modalTitle={modalTitle}
        isMobile={isMobile}
      />

      <BatchMoveModal
        visible={batchMoveVisible}
        selectedRowKeys={selectedRowKeys}
        moveTargetParent={moveTargetParent}
        onMoveTargetChange={(value) => setState({ moveTargetParent: value })}
        onOk={handleBatchMoveConfirm}
        onCancel={() => setState({ batchMoveVisible: false })}
        batchMoving={batchMoving}
        modalTitle={batchMoveModalTitle}
        localDataSource={localDataSource}
        maxLevel={maxLevel}
      />
    </div>
  );
};

export default CategoryManager;
export type {
  ActionConfig,
  CategoryItem,
  CategoryManagerProps,
  ColumnDisplayConfig,
  ExtraFieldConfig,
} from './types';
