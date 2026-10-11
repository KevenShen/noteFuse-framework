// src/utils/tree.ts
// 树形结构工具函数（纯逻辑，不含 UI）
// 功能：扁平化数据转树、树形数据转扁平化、节点查询、菜单数据生成

// ==================== 类型定义 ====================

/** 扁平化数据项（必须包含 id 和 parent_id） */
export interface FlatItem {
  id: number | string;
  parent_id: number | string;
  name?: string;
  sort?: number;
  [key: string]: any;
}

/** 树形数据项 */
export interface TreeNode<T extends FlatItem = FlatItem> extends FlatItem {
  children?: TreeNode<T>[];
}

/** 菜单项数据结构（纯数据，不含 JSX） */
export interface MenuDataItem {
  /** 唯一标识 */
  key: string;
  /** 显示文本 */
  label: string;
  /** 子菜单 */
  children?: MenuDataItem[];
  /** 是否为分隔线 */
  type?: 'divider';
  /** 原始数据项 */
  data?: FlatItem;
  /** 层级深度（0 为根） */
  level?: number;
  /** 是否有子节点 */
  hasChildren?: boolean;
  /** 是否为"全部XX"选项（子菜单中的全部选项） */
  isAllInSubmenu?: boolean;
}

/** 生成菜单数据的配置选项 */
export interface BuildMenuDataOptions {
  /** 是否显示"全部"选项（默认 true） */
  showAll?: boolean;
  /** "全部"选项的 key（默认 '0'） */
  allKey?: string;
  /** "全部"选项的标签（默认 '全部分类'） */
  allLabel?: string;
  /** 是否显示"未分类"选项（默认 true） */
  showUncategorized?: boolean;
  /** "未分类"选项的 key（默认 '-1'） */
  uncategorizedKey?: string;
  /** "未分类"选项的标签（默认 '未分类'） */
  uncategorizedLabel?: string;
  /** 是否在有子节点的分类下显示"全部XX"选项（默认 true） */
  showAllInSubmenu?: boolean;
  /** "全部XX"选项的前缀（默认 '全部'） */
  allInSubmenuPrefix?: string;
  /** 根节点的 parent_id（默认 0） */
  rootParentId?: number | string;
}

// ==================== 扁平化转树 ====================

/**
 * 将扁平化数据转换为树形结构
 * @param list 扁平化数据数组
 * @param options 配置选项
 * @returns 树形数据数组
 */
export function flatListToTree<T extends FlatItem>(
  list: T[],
  options?: {
    /** 根节点的 parent_id（默认 0） */
    rootParentId?: number | string;
    /** 是否按 sort 字段排序（默认 true） */
    sortBySort?: boolean;
  },
): TreeNode<T>[] {
  const { rootParentId = 0, sortBySort = true } = options || {};

  // 建立映射
  const map = new Map<number | string, TreeNode<T>>();
  const roots: TreeNode<T>[] = [];

  list.forEach((item) => {
    map.set(item.id, { ...item, children: [] });
  });

  // 组装树形
  list.forEach((item) => {
    const node = map.get(item.id)!;
    if (item.parent_id !== rootParentId && map.has(item.parent_id)) {
      const parent = map.get(item.parent_id)!;
      parent.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  // 按 sort 排序
  if (sortBySort) {
    const sortFn = (a: TreeNode<T>, b: TreeNode<T>) =>
      (a.sort || 0) - (b.sort || 0);
    const sortRecursive = (arr: TreeNode<T>[]) => {
      arr.sort(sortFn);
      arr.forEach((item) => {
        if (item.children && item.children.length > 0) {
          sortRecursive(item.children);
        }
      });
    };
    sortRecursive(roots);
  }

  return roots;
}

// ==================== 树形转扁平化 ====================

/**
 * 将树形数据转换为扁平化数据（深度优先遍历）
 * @param tree 树形数据数组
 * @returns 扁平化数据数组
 */
export function treeToFlatList<T extends FlatItem>(tree: TreeNode<T>[]): T[] {
  const result: T[] = [];

  const traverse = (nodes: TreeNode<T>[]) => {
    nodes.forEach((node) => {
      const { children, ...rest } = node;
      result.push(rest as T);
      if (children && children.length > 0) {
        traverse(children);
      }
    });
  };

  traverse(tree);
  return result;
}

// ==================== 生成菜单数据（纯数据，不含 UI） ====================

/**
 * 将扁平化分类数据转换为菜单的纯数据结构
 * 支持任意层级，每级都可选，有子节点的分类下会显示"全部XX"选项
 *
 * 性能优化：使用 Map 建立 parent_id -> children 映射，时间复杂度 O(n)
 *
 * @param list 扁平化分类数据数组
 * @param options 配置选项
 * @returns 菜单的纯数据结构数组
 */
export function buildCategoryMenuData(
  list: FlatItem[],
  options?: BuildMenuDataOptions,
): MenuDataItem[] {
  const {
    showAll = true,
    allKey = '0',
    allLabel = '全部分类',
    showUncategorized = true,
    uncategorizedKey = '-1',
    uncategorizedLabel = '未分类',
    showAllInSubmenu = true,
    allInSubmenuPrefix = '全部',
    rootParentId = 0,
  } = options || {};

  const items: MenuDataItem[] = [];

  // 添加"全部"选项
  if (showAll) {
    items.push({
      key: allKey,
      label: allLabel,
      level: 0,
      hasChildren: false,
    });
  }

  // 添加"未分类"选项
  if (showUncategorized) {
    items.push({
      key: uncategorizedKey,
      label: uncategorizedLabel,
      level: 0,
      hasChildren: false,
    });
  }

  // 添加分隔线
  if (showAll || showUncategorized) {
    items.push({ key: `divider-${items.length}`, label: '', type: 'divider' });
  }

  // 性能优化：使用 Map 建立 parent_id -> children 映射
  const childrenMap = new Map<number | string, FlatItem[]>();
  list.forEach((item) => {
    const children = childrenMap.get(item.parent_id) || [];
    children.push(item);
    childrenMap.set(item.parent_id, children);
  });

  // 递归构建节点
  const buildNode = (cat: FlatItem, level: number): MenuDataItem => {
    const children = childrenMap.get(cat.id) || [];
    const hasChildren = children.length > 0;

    // 叶子节点：直接返回
    if (!hasChildren) {
      return {
        key: String(cat.id),
        label: cat.name || String(cat.id),
        data: cat,
        level,
        hasChildren: false,
      };
    }

    // 有子节点：返回子菜单
    const submenuChildren: MenuDataItem[] = [];

    // 添加"全部XX"选项
    if (showAllInSubmenu) {
      submenuChildren.push({
        key: String(cat.id),
        label: `${allInSubmenuPrefix}${cat.name}`,
        data: cat,
        level: level + 1,
        hasChildren: false,
        isAllInSubmenu: true,
      });
      submenuChildren.push({
        key: `divider-${cat.id}`,
        label: '',
        type: 'divider',
      });
    }

    // 添加子节点
    children.forEach((child) => {
      submenuChildren.push(buildNode(child, level + 1));
    });

    return {
      key: `sub-${cat.id}`,
      label: cat.name || String(cat.id),
      data: cat,
      level,
      hasChildren: true,
      children: submenuChildren,
    };
  };

  // 构建根节点
  const roots = childrenMap.get(rootParentId) || [];
  roots.forEach((root) => items.push(buildNode(root, 0)));

  return items;
}

// ==================== 工具函数 ====================

/**
 * 获取节点的祖先路径（从根到当前节点，不包含当前节点）
 * 内部公共函数，用于 getAncestorIds 和 getNodeDepth
 * @param list 扁平化数据数组
 * @param id 节点 ID
 * @returns 祖先节点数组（从根到父节点）
 */
function getAncestorPath<T extends FlatItem>(
  list: T[],
  id: number | string,
): T[] {
  const path: T[] = [];
  let currentId = id;

  while (currentId !== 0) {
    const item = list.find((i) => i.id === currentId);
    if (!item || item.parent_id === 0) break;
    const parent = list.find((i) => i.id === item.parent_id);
    if (!parent) break;
    path.unshift(parent);
    currentId = item.parent_id;
  }

  return path;
}

/**
 * 获取节点的所有子节点 ID（包括自身）
 * @param list 扁平化数据数组
 * @param id 节点 ID
 * @returns 包含自身和所有子节点的 ID 数组
 */
export function getNodeAndChildrenIds(
  list: FlatItem[],
  id: number | string,
): (number | string)[] {
  const result: (number | string)[] = [id];

  const findChildren = (parentId: number | string) => {
    list
      .filter((item) => item.parent_id === parentId)
      .forEach((child) => {
        result.push(child.id);
        findChildren(child.id);
      });
  };

  findChildren(id);
  return result;
}

/**
 * 获取节点的所有祖先节点 ID
 * @param list 扁平化数据数组
 * @param id 节点 ID
 * @returns 祖先节点 ID 数组（从根到父节点）
 */
export function getAncestorIds(
  list: FlatItem[],
  id: number | string,
): (number | string)[] {
  return getAncestorPath(list, id).map((item) => item.id);
}

/**
 * 判断节点是否有子节点
 * @param list 扁平化数据数组
 * @param id 节点 ID
 * @returns 是否有子节点
 */
export function hasChildren(list: FlatItem[], id: number | string): boolean {
  return list.some((item) => item.parent_id === id);
}

/**
 * 获取节点的层级深度（根节点为 0）
 * @param list 扁平化数据数组
 * @param id 节点 ID
 * @returns 层级深度
 */
export function getNodeDepth(list: FlatItem[], id: number | string): number {
  return getAncestorPath(list, id).length;
}

/**
 * 查找节点
 * @param list 扁平化数据数组
 * @param id 节点 ID
 * @returns 节点数据，找不到返回 undefined
 */
export function findNode<T extends FlatItem>(
  list: T[],
  id: number | string,
): T | undefined {
  return list.find((item) => item.id === id);
}

/**
 * 获取叶子节点列表（没有子节点的节点）
 * @param list 扁平化数据数组
 * @returns 叶子节点数组
 */
export function getLeafNodes<T extends FlatItem>(list: T[]): T[] {
  return list.filter((item) => !hasChildren(list, item.id));
}

/**
 * 获取根节点列表
 * @param list 扁平化数据数组
 * @param rootParentId 根节点的 parent_id（默认 0）
 * @returns 根节点数组
 */
export function getRootNodes<T extends FlatItem>(
  list: T[],
  rootParentId: number | string = 0,
): T[] {
  return list.filter((item) => item.parent_id === rootParentId);
}
