import type { CategoryItem } from './types';

//#region 工具函数
/** 判断是否为扁平化数据（顶层存在 parent_id > 0 的节点） */
export const isFlatData = (list: CategoryItem[]): boolean => {
  return list.some((item) => (item.parent_id ?? 0) !== 0);
};

/**
 * 扁平化数组转树形结构（按 sort 排序）
 * @param list 扁平化分类数组
 * @param statField 统计字段名（如 project_count），传入后会递归汇总：节点值 = 自身值 + 所有后代值之和
 */
export const flatToTree = (
  list: CategoryItem[],
  statField?: string,
): CategoryItem[] => {
  const map = new Map<number | string, CategoryItem>();
  const roots: CategoryItem[] = [];
  list.forEach((item) => map.set(item.id, { ...item, children: [] }));
  list.forEach((item) => {
    const node = map.get(item.id)!;
    // 强制转换为数字，避免 parent_id 为字符串时 map.has 匹配失败
    const pid = Number(item.parent_id ?? 0);
    if (pid !== 0 && !Number.isNaN(pid) && map.has(pid)) {
      map.get(pid)!.children!.push(node);
    } else if (pid !== 0 && !Number.isNaN(pid) && map.has(String(pid))) {
      // 兜底：如果 id 是字符串类型
      map.get(String(pid))!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  // 递归汇总统计字段（自身 + 所有后代），修复父分类文集数显示为 0 的问题
  if (statField) {
    const aggregateStat = (node: CategoryItem): number => {
      const self = Number(node[statField] ?? 0);
      const childrenSum = (node.children || []).reduce(
        (sum, child) => sum + aggregateStat(child),
        0,
      );
      node[statField] = self + childrenSum;
      return node[statField];
    };
    roots.forEach(aggregateStat);
  }

  const sortTree = (arr: CategoryItem[]) => {
    arr.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    arr.forEach((item) => item.children?.length && sortTree(item.children));
  };
  sortTree(roots);
  return roots;
};

/** 在树形结构中按 id 查找节点，找到就返回该节点对象，找不到就返回 null。递归 + 深度优先搜索 */
export const findRecordById = (
  tree: CategoryItem[],
  id: number | string,
): CategoryItem | null => {
  for (const item of tree) {
    if (item.id === id) return item;
    if (item.children?.length) {
      const found = findRecordById(item.children, id);
      if (found) return found;
    }
  }
  return null;
};

/** 根据节点 id，找到它的所有兄弟节点（包括它自己） */
export const getSiblingsById = (
  tree: CategoryItem[],
  id: number | string,
): CategoryItem[] => {
  const record = findRecordById(tree, id);
  if (!record) return [];
  const parentId = record.parent_id ?? 0;
  if (parentId === 0) return tree;
  return findRecordById(tree, parentId)?.children || [];
};

/** 在树形结构中，找到指定 parentId 的节点，用新的子节点数组 newSiblings 替换它的 children，返回一棵新的树（不可变更新） */
export const updateSiblingsInTree = (
  tree: CategoryItem[],
  parentId: number | string,
  newSiblings: CategoryItem[],
): CategoryItem[] => {
  if (parentId === 0) return newSiblings;
  return tree.map((item) => {
    if (item.id === parentId) return { ...item, children: newSiblings };
    if (item.children?.length) {
      return {
        ...item,
        children: updateSiblingsInTree(item.children, parentId, newSiblings),
      };
    }
    return item;
  });
};

/** 计算节点的子树深度（叶子节点=0，有一层子节点=1，以此类推） */
export const getSubtreeDepth = (node: CategoryItem): number => {
  if (!node.children?.length) return 0;
  return 1 + Math.max(...node.children.map(getSubtreeDepth));
};

/** 计算节点在树中的层级（根节点=1，未找到返回0） */
export const getNodeLevel = (
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
export const canMoveTo = (
  tree: CategoryItem[],
  selectedIds: (number | string)[],
  targetParentId: number | string,
  maxLevel: number,
): boolean => {
  let maxSubtreeDepth = 0;
  selectedIds.forEach((id) => {
    const node = findRecordById(tree, id);
    if (node)
      maxSubtreeDepth = Math.max(maxSubtreeDepth, getSubtreeDepth(node));
  });
  const targetLevel =
    targetParentId === 0 ? 0 : getNodeLevel(tree, targetParentId);
  return targetLevel + maxSubtreeDepth + 1 <= maxLevel;
};
//#endregion
