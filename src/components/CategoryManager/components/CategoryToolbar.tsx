import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { Button, Popconfirm, Space } from 'antd';
import React from 'react';
import type { ActionConfig } from '../types';

interface CategoryToolbarProps {
  selectable: boolean;
  selectedRowKeys: (number | string)[];
  selectedCountPrefix: string;
  selectedCountSuffix: string;
  actions: ActionConfig;
  onBatchDelete?: () => void;
  onBatchMove?: () => void;
  batchDeleteButtonText: string;
  batchMoveButtonText: string;
  addButtonText: string;
  onAdd: () => void;
  // 排序相关
  sortable: boolean;
  hasSortChanges: boolean;
  saveButtonText: string;
  resetButtonText: string;
  savingSort: boolean;
  onSaveSort: () => void;
  onResetSort: () => void;
}

/** 分类管理工具栏：左侧批量操作（选中时显示），右侧排序保存/重置 + 新增按钮 */
const CategoryToolbar: React.FC<CategoryToolbarProps> = ({
  selectable,
  selectedRowKeys,
  selectedCountPrefix,
  selectedCountSuffix,
  actions,
  onBatchDelete,
  onBatchMove,
  batchDeleteButtonText,
  batchMoveButtonText,
  addButtonText,
  onAdd,
  sortable,
  hasSortChanges,
  saveButtonText,
  resetButtonText,
  savingSort,
  onSaveSort,
  onResetSort,
}) => {
  return (
    <div className="cm-toolbar">
      <div className="cm-toolbar-left">
        {selectable && selectedRowKeys.length > 0 && (
          <Space size="middle">
            <span className="cm-selected-count">
              {selectedCountPrefix} <strong>{selectedRowKeys.length}</strong>{' '}
              {selectedCountSuffix}
            </span>
            {actions.delete && onBatchDelete && (
              <Popconfirm
                title={`确定删除选中的 ${selectedRowKeys.length} 项吗？`}
                description="删除后不可恢复，子分类也将被删除"
                onConfirm={onBatchDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button danger size="small" icon={<DeleteOutlined />}>
                  {batchDeleteButtonText}
                </Button>
              </Popconfirm>
            )}
            {onBatchMove && (
              <Button size="small" onClick={onBatchMove}>
                {batchMoveButtonText}
              </Button>
            )}
          </Space>
        )}
      </div>
      <div className="cm-toolbar-right">
        <Space size="small" wrap>
          {sortable && hasSortChanges && (
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={onResetSort}
            >
              {resetButtonText}
            </Button>
          )}
          {sortable && (
            <Button
              type={hasSortChanges ? 'primary' : 'default'}
              icon={<SaveOutlined />}
              onClick={onSaveSort}
              loading={savingSort}
              disabled={!hasSortChanges}
            >
              {saveButtonText}
            </Button>
          )}
          {actions.add && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
              {addButtonText}
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
};

export default CategoryToolbar;
