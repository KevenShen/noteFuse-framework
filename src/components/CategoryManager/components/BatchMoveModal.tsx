import { Form, Modal, Select } from 'antd';
import React, { useMemo } from 'react';
import type { CategoryItem } from '../types';
import { canMoveTo } from '../utils';

interface BatchMoveModalProps {
  visible: boolean;
  selectedRowKeys: (number | string)[];
  moveTargetParent: number | string;
  onMoveTargetChange: (value: number | string) => void;
  onOk: () => void;
  onCancel: () => void;
  batchMoving: boolean;
  modalTitle: string;
  localDataSource: CategoryItem[];
  maxLevel: number;
}

/** 批量移动分类弹窗 */
const BatchMoveModal: React.FC<BatchMoveModalProps> = ({
  visible,
  selectedRowKeys,
  moveTargetParent,
  onMoveTargetChange,
  onOk,
  onCancel,
  batchMoving,
  modalTitle,
  localDataSource,
  maxLevel,
}) => {
  // 计算可选父分类列表（含禁用态：自身及后代不可选、超最大层级不可选）
  const parentOptions = useMemo(() => {
    const options: {
      label: string;
      value: number | string;
      disabled?: boolean;
    }[] = [];
    const disabledIds = new Set<number | string>();
    const collectDisabled = (
      items: CategoryItem[],
      parentId: number | string,
    ) => {
      if (selectedRowKeys.includes(parentId)) disabledIds.add(parentId);
      items.forEach((item) => {
        if (
          selectedRowKeys.includes(item.id) ||
          disabledIds.has(item.parent_id ?? 0)
        ) {
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
          label: `${'　'.repeat(level)}${level > 0 ? '└ ' : ''}${item.name}${
            overLevel ? '（超出最大层级）' : ''
          }`,
          value: item.id,
          disabled,
        });
        if (item.children?.length) build(item.children, level + 1);
      });
    };
    build(localDataSource);
    return options;
  }, [localDataSource, selectedRowKeys, maxLevel]);

  return (
    <Modal
      title={modalTitle}
      open={visible}
      onOk={onOk}
      onCancel={onCancel}
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
          <Select
            value={moveTargetParent}
            onChange={onMoveTargetChange}
            options={parentOptions}
            placeholder="选择目标分类"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default BatchMoveModal;
