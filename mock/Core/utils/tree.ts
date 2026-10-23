/**
 * 树形数据通用计算工具
 *
 * 【功能】
 * 对任意树形结构的节点和关联数据进行预计算，包括：
 * - 排序（按 parent_id + sort）
 * - 子节点映射（parent_id -> 子节点 ID 列表）
 * - 关联数据映射（分类 ID -> 关联项 ID 列表）
 * - 祖先链路（chain / depth / ancestors / children）
 * - 数量累加（自底向上计算每个节点及其子孙的关联项总数）
 *
 * 【特点】
 * - 纯函数：无副作用，不依赖任何缓存组件，可独立进行单元测试
 * - 泛型化：支持任意类型的节点和关联数据
 * - 算法复杂度：O(N + M)，N=节点数，M=关联项数
 *
 * 【使用场景】
 * - 文集分类缓存预计算
 * - 文档分类缓存预计算
 * - 其他树形结构的预计算
 */

/** 树形缓存计算结果 */
export interface TreeCacheData<TNode> {
  /** 排序后的节点列表（按 parent_id + sort） */
  sorted: TNode[];
  /** 子节点映射：parent_id -> 直接子节点 ID 列表 */
  childrenMap: Map<number, number[]>;
  /** 直接关联项映射：节点 ID -> 直接挂载的关联项 ID 列表 */
  directItemsMap: Map<number, number[]>;
  /** 链路缓存映射：节点 ID -> { chain, depth, ancestors, children } */
  chainCacheMap: Map<
    number,
    {
      /** 从根到当前节点的完整链路（含当前节点） */
      chain: number[];
      /** 深度（根节点为 0） */
      depth: number;
      /** 祖先节点 ID 列表（不含当前节点） */
      ancestors: number[];
      /** 直接子节点 ID 列表 */
      children: number[];
    }
  >;
  /** 总数映射：节点 ID -> 该节点及其所有子孙的关联项总数 */
  totalCountMap: Map<number, number>;
}

/** 树形缓存计算配置（字段访问器） */
export interface TreeCacheOptions<TNode, TItem> {
  /** 获取节点 ID */
  getId: (node: TNode) => number;
  /** 获取节点父 ID */
  getParentId: (node: TNode) => number;
  /** 获取节点排序值 */
  getSort: (node: TNode) => number;
  /** 获取关联项 ID */
  getItemId: (item: TItem) => number;
  /** 获取关联项所属的节点 ID */
  getItemNodeId: (item: TItem) => number;
}

/**
 * 通用树形数据缓存预计算
 *
 * @param nodes 全部节点数据
 * @param items 全部关联项数据
 * @param options 字段访问器配置
 * @returns 预计算结果（sorted/childrenMap/directItemsMap/chainCacheMap/totalCountMap）
 */
export function computeTreeCacheData<TNode, TItem>(
  nodes: TNode[],
  items: TItem[],
  options: TreeCacheOptions<TNode, TItem>,
): TreeCacheData<TNode> {
  const { getId, getParentId, getSort, getItemId, getItemNodeId } = options;

  // 1. 按 parent_id + sort 排序（保证父节点先于子节点处理）
  const sorted = [...nodes].sort((a, b) => {
    const parentA = getParentId(a);
    const parentB = getParentId(b);
    if (parentA !== parentB) return parentA - parentB;
    return getSort(a) - getSort(b);
  });

  // 2. 构建子节点映射（邻接表）：parent_id -> 直接子节点 ID 列表
  const childrenMap = new Map<number, number[]>();
  nodes.forEach((node) => {
    const parentId = getParentId(node);
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId)!.push(getId(node));
  });

  // 3. O(M) 统计每个节点下直接挂载的关联项 ID 列表
  const directItemsMap = new Map<number, number[]>();
  items.forEach((item) => {
    const nodeId = getItemNodeId(item);
    if (!directItemsMap.has(nodeId)) {
      directItemsMap.set(nodeId, []);
    }
    directItemsMap.get(nodeId)!.push(getItemId(item));
  });

  // 4. O(N) 自顶向下计算链路 + 自底向上累加数量
  const chainCacheMap = new Map<
    number,
    {
      chain: number[];
      depth: number;
      ancestors: number[];
      children: number[];
    }
  >();
  const totalCountMap = new Map<number, number>();

  sorted.forEach((node) => {
    const nodeId = getId(node);
    const parentId = getParentId(node);

    // 4.1 计算祖先链路（记忆化，O(1) 复用父节点结果）
    const directChildren = childrenMap.get(nodeId) || [];
    const parentChain = chainCacheMap.get(parentId);

    chainCacheMap.set(
      nodeId,
      parentChain
        ? {
            depth: parentChain.depth + 1,
            chain: [...parentChain.chain, nodeId],
            ancestors: [...parentChain.ancestors, parentId],
            children: directChildren,
          }
        : {
            depth: 0,
            chain: [nodeId],
            ancestors: [],
            children: directChildren,
          },
    );

    // 4.2 计算关联项总数（自底向上累加，O(1) 复用子节点结果）
    const selfCount = (directItemsMap.get(nodeId) || []).length;
    const childIds = childrenMap.get(nodeId) || [];
    const childrenCount = childIds.reduce(
      (sum, childId) => sum + (totalCountMap.get(childId) || 0),
      0,
    );
    totalCountMap.set(nodeId, selfCount + childrenCount);
  });

  return { sorted, childrenMap, directItemsMap, chainCacheMap, totalCountMap };
}
