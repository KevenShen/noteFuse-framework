import { useCallback, useState } from 'react';
import type { CategoryItem } from '../types';
import {
  findRecordById,
  getSiblingsById,
  updateSiblingsInTree,
} from '../utils';

interface UseDragSortOptions {
  sortable: boolean;
  localDataSource: CategoryItem[];
  /** 拖拽后乐观更新本地数据的回调 */
  onLocalDataSourceChange: (newTree: CategoryItem[]) => void;
  /** 排序变更回调（用于触发 hasSortChanges 标记） */
  onSortChange?: () => void;
}

/**
 * 分类拖拽排序 Hook
 * 负责拖拽状态管理 + 同级重排（仅本地更新，保存/重置由外部控制）
 */
export function useDragSort({
  sortable,
  localDataSource,
  onLocalDataSourceChange,
  onSortChange,
}: UseDragSortOptions) {
  const [dragRowId, setDragRowId] = useState<number | string | null>(null);
  const [dropRowId, setDropRowId] = useState<number | string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(
    null,
  );

  const clearDragState = useCallback(() => {
    setDragRowId(null);
    setDropRowId(null);
    setDropPosition(null);
  }, []);

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
      setDropPosition(
        e.clientY < rect.top + rect.height / 2 ? 'before' : 'after',
      );
    },
    [sortable, dragRowId, localDataSource],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, record: CategoryItem) => {
      if (!sortable || !dragRowId || dragRowId === record.id) return;
      e.preventDefault();
      const dragRow = findRecordById(localDataSource, dragRowId);
      if (!dragRow || dragRow.parent_id !== record.parent_id) {
        clearDragState();
        return;
      }
      const siblings = getSiblingsById(localDataSource, record.id);
      const dragIndex = siblings.findIndex((i) => i.id === dragRowId);
      const dropIndex = siblings.findIndex((i) => i.id === record.id);
      if (dragIndex === -1 || dropIndex === -1) return;
      const newSiblings = [...siblings];
      const [removed] = newSiblings.splice(dragIndex, 1);
      const insertIndex =
        dropPosition === 'before' ? dropIndex : dropIndex + 1;
      newSiblings.splice(
        dragIndex < dropIndex ? insertIndex - 1 : insertIndex,
        0,
        removed,
      );
      // 重新计算当前层级的 sort（仅本地更新，不自动保存）
      const updated = newSiblings.map((item, i) => ({ ...item, sort: i + 1 }));
      const newTree = updateSiblingsInTree(
        localDataSource,
        record.parent_id ?? 0,
        updated,
      );
      onLocalDataSourceChange(newTree);
      onSortChange?.();
      clearDragState();
    },
    [
      sortable,
      dragRowId,
      dropPosition,
      localDataSource,
      onLocalDataSourceChange,
      onSortChange,
      clearDragState,
    ],
  );

  const handleDragEnd = useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  return {
    dragRowId,
    dropRowId,
    dropPosition,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  };
}
