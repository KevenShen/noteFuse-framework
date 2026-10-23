// mock/Project/category.service.ts
// 分类服务层
// 职责：处理分类相关的核心业务逻辑，调用数据库（MockTable）和缓存（Redis）

import { BusinessError, ErrorCodes } from '../../Core';
import type { MockProjectCategory } from '../../Entities/project';
import { categoryTable } from '../../Entities/project';
import type {
  BatchDeleteCategoriesRequest,
  BatchDeleteCategoriesResponse,
  BatchMoveCategoriesRequest,
  BatchMoveCategoriesResponse,
  CategoryWithStats,
  CreateCategoryRequest,
  DeleteCategoryResponse,
  SaveCategorySortRequest,
  SaveCategorySortResponse,
  UpdateCategoryRequest,
} from './category.dto';
import type { CategoryChainData } from './category.repository';
import { categoryRepository } from './category.repository';

// ============================================================================
// 分类缓存辅助函数
// ============================================================================

// ============================================================================
// 分类服务类
// ============================================================================

class CategoryService {
  /**
   * 获取全部分类列表
   *
   * 【三级降级】Redis 排序索引 + Pipeline → MongoDB → MockTable（include 关联查询）
   * 【排序】按 parent_id + sort 有序（Redis 排序索引保证）
   * 【返回格式】CategoryWithStats（含 project_count + project_ids 统计字段）
   *
   * @returns 分类列表（按层级+排序有序）
   */
  async getCategoryList(): Promise<CategoryWithStats[]> {
    return categoryRepository.findAll();
  }

  /**
   * 创建分类
   *
   * 【业务校验】
   * - 父分类存在性校验（三级降级：Redis → MongoDB → MockTable）
   * - 最大深度校验（默认 3 级，支持 max_depth 参数覆盖）
   * - 同级名称重复校验
   *
   * 【数据读取】
   * - 父分类链路：findChainById（三级降级，含 children）
   * - 同级分类详情：findByIds（三级降级，已按 sort 排序）
   *
   * 【缓存参数计算】纯内存计算，无 IO
   * - ancestors / depth / parentChildren：从父分类链路推导
   * - 排序索引插入位置：从同级分类内存计算 pivot，同级为空时查 order:all List
   *
   * 【写入】通过 repository.create 一次完成
   * - L1 MockTable：create
   * - L2 MongoDB：insertOne（含 project_count=0, project_ids=[]）
   * - L3 Redis：Pipeline 批量初始化（详情 + 排序索引 + 链路 + 计数器 + 父分类 children）
   *
   * @param data 请求参数（name / parent_id / sort / icon / description / max_depth）
   * @returns 创建的分类（含 project_count=0 + project_ids=[]）
   */
  async createCategory(
    data: CreateCategoryRequest,
  ): Promise<CategoryWithStats> {
    const parentId = data.parent_id ?? 0;

    // ========== 1. 获取父分类链路数据（三级降级：Redis → MongoDB → MockTable）==========
    const parentChainData =
      parentId !== 0 ? await categoryRepository.findChainById(parentId) : null;

    // 1.1 父分类存在性校验
    if (parentId !== 0 && !parentChainData) {
      throw new BusinessError('父分类不存在');
    }

    // 1.2 最大三级深度校验（新分类层级 = 父分类 depth + 1）
    const maxDepth = Math.min(data.max_depth ?? 3, 3);
    const parentDepth = parentChainData?.depth ?? 0;
    if (parentDepth + 1 > maxDepth) {
      throw new BusinessError(
        `分类最多支持 ${maxDepth} 级，当前父分类已为第 ${
          parentDepth + 1
        } 级，无法再创建子分类`,
        ErrorCodes.Common.VALIDATION_FAILED,
      );
    }

    // 1.3 从父分类的 children 获取同级分类 ID，批量获取详情（已按 sort 排序）
    const siblingIds: number[] = parentChainData?.children ?? [];
    const siblingCategories: MockProjectCategory[] =
      await categoryRepository.findByIds(siblingIds);

    // 1.4 同级名称重复校验
    if (siblingCategories.some((c) => c.name === data.name)) {
      throw new BusinessError(
        '同级分类下已存在相同名称的分类',
        ErrorCodes.Project.CATEGORY_NAME_EXISTS,
      );
    }

    // 1.5 自动计算 sort（取同级最大 sort + 1）
    const maxSort =
      siblingCategories.length > 0
        ? Math.max(...siblingCategories.map((c) => c.sort))
        : 0;

    // ========== 2. 计算缓存参数（纯内存计算，无 IO，需在 create 之前完成）==========
    // 2.1 计算祖先链路（使用已查询的 parentChainData）
    let ancestors: number[] = [];
    let depth = 0;
    let parentChildren: number[] = [];

    if (parentId !== 0 && parentChainData?.chain) {
      ancestors = [...parentChainData.chain];
      depth = (parentChainData.depth ?? parentChainData.chain.length - 1) + 1;
      parentChildren = parentChainData.children ?? [];
    }

    // 2.2 计算排序索引的准确插入位置
    // 排序规则：先按 parent_id 升序，再按 sort 升序
    let pivotId: number | null = null;
    let insertAtBeginning = false;

    // siblingCategories 已按 sort 升序排序，从后向前找第一个 sort < newSort 的分类作为 pivot
    const newSort = data.sort ?? maxSort + 1;
    for (let i = siblingCategories.length - 1; i >= 0; i--) {
      if (siblingCategories[i].sort < newSort) {
        pivotId = siblingCategories[i].id;
        break;
      }
    }

    if (pivotId === null) {
      // pivotId 为 null 只可能是同级无分类（前端 sort 固定为 maxSort+1，同级存在时一定能找到 pivot）
      const orderedIds = await categoryRepository.getOrderList();

      if (orderedIds.length === 0) {
        insertAtBeginning = true;
      } else {
        // 同级无分类：查询 parent_id 找第一个 parent_id > parentId 的位置
        const parentIdResults = await categoryRepository.getParentIdsByIds(
          orderedIds,
        );

        let insertIndex = orderedIds.length;
        for (let i = 0; i < orderedIds.length; i++) {
          if ((parentIdResults[i] ?? 0) > parentId) {
            insertIndex = i;
            break;
          }
        }
        if (insertIndex === 0) {
          insertAtBeginning = true;
        } else {
          pivotId = orderedIds[insertIndex - 1];
        }
      }
    }

    // ========== 3. 创建分类（数据库 + 缓存，通过 Repository 一次完成）==========
    const newCategory = await categoryRepository.create(
      {
        name: data.name,
        parent_id: parentId,
        sort: newSort,
        icon: data.icon,
        description: data.description,
      } as MockProjectCategory,
      {
        depth,
        ancestors,
        parentId,
        parentChildren,
        insertAtBeginning,
        pivotId,
      },
    );

    // ========== 4. 返回结果 ==========
    return { ...newCategory, project_count: 0, project_ids: [] };
  }

  /**
   * 更新分类（仅 name/icon/description；移动/排序由其他接口处理）
   * 无变化时抛出 NO_CHANGES 错误
   */
  async updateCategory(
    id: number,
    data: UpdateCategoryRequest,
  ): Promise<CategoryWithStats> {
    // ========== 1. 校验分类存在（三级降级：Redis → MongoDB → 数据库）==========
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw new BusinessError('分类不存在', 404);
    }

    const updateData: Partial<MockProjectCategory> = {};

    // ========== 2. 预计算变化字段（无变化时尽早返回，避免后续 IO）==========
    // 注：icon/description 统一转为字符串，确保 Redis hset 和 MongoDB 存储一致
    if (data.name !== undefined && data.name !== category.name) {
      updateData.name = data.name;
    }
    if (data.icon !== undefined && (data.icon || '') !== category.icon) {
      updateData.icon = data.icon || '';
    }
    if (
      data.description !== undefined &&
      (data.description || '') !== category.description
    ) {
      updateData.description = data.description || '';
    }

    // 无实际变化时抛出业务错误，前端可直接提示用户
    if (Object.keys(updateData).length === 0) {
      throw new BusinessError(
        '数据无变化，不需要修改',
        ErrorCodes.Project.NO_CHANGES,
      );
    }

    // ========== 3. 名称修改：校验同级不重复 ==========
    if (updateData.name !== undefined) {
      const siblingIds = await categoryRepository.findSiblingIds(
        category.parent_id,
        id,
      );

      // 批量获取同级分类详情（三级降级，已按 sort 排序）
      const siblingCategories = await categoryRepository.findByIds(siblingIds);

      if (siblingCategories.some((c) => c.name === updateData.name)) {
        throw new BusinessError(
          '同级分类下已存在相同名称的分类',
          ErrorCodes.Project.CATEGORY_NAME_EXISTS,
        );
      }
    }

    // ========== 4. 执行数据库更新 + 缓存更新（通过 Repository 一次完成）==========
    const updatedCategory = await categoryRepository.update(
      id,
      updateData,
      true,
    );

    // ========== 5. 返回带统计字段的完整分类数据 ==========
    // 统计字段不受 name/icon/description 更新影响，直接复用 categoryRepository.findById 获取的数据
    return {
      ...updatedCategory!,
      project_count: category.project_count,
      project_ids: category.project_ids,
    } as CategoryWithStats;
  }

  /**
   * 删除单条分类（含校验：存在子分类或文集时禁止删除）
   *
   * 【实现】batchDeleteCategories 的单条包装，校验和删除逻辑见批量删除
   *
   * @param id 分类 ID
   * @returns 删除结果（含 deletedIds）
   */
  async deleteCategory(id: number): Promise<DeleteCategoryResponse> {
    return this.batchDeleteCategories({ ids: [id] });
  }

  /**
   * 批量删除分类（选中的子分类允许级联删除）
   * 校验不通过时抛出错误，提示第一个不可删除的分类
   */
  async batchDeleteCategories(
    data: BatchDeleteCategoriesRequest,
  ): Promise<BatchDeleteCategoriesResponse> {
    const idSet = new Set(data.ids.map(Number));
    const ids = Array.from(idSet);

    // ========== 1. 获取校验数据（Pipeline + 缓存未命中降级）==========
    const { checkResults, mongoCountMap, mongoChildrenMap } =
      await categoryRepository.getDeleteCheckData(ids);

    // ========== 2. 校验 + 收集父分类（复用第一步已获取的 chain，无需再次 IO）==========
    const parentChildrenToRemove = new Map<number, number[]>();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const chainHash = checkResults[i * 2] as Record<string, string> | null;
      const countStr = checkResults[i * 2 + 1] as string | null;

      // 从 chain hash 中提取 children 和 ancestors
      const childrenStr = chainHash?.children ?? null;
      const ancestorsStr = chainHash?.ancestors ?? null;

      // 2.1 子分类校验
      const children: number[] =
        childrenStr !== null
          ? JSON.parse(childrenStr)
          : mongoChildrenMap?.get(id) ?? [];
      if (children.some((cid) => !idSet.has(cid))) {
        throw new BusinessError(
          `分类ID:${id}，存在子分类，请先删除子分类`,
          ErrorCodes.Project.DELETE_HAS_CHILDREN,
          { failedId: id },
        );
      }

      // 2.2 文集数校验
      const projectCount =
        countStr !== null ? Number(countStr) : mongoCountMap?.get(id) ?? 0;
      if (projectCount > 0) {
        throw new BusinessError(
          `分类ID:${id}，该分类下存在文集，无法删除`,
          ErrorCodes.Project.DELETE_HAS_PROJECTS,
          { failedId: id },
        );
      }

      // 2.3 校验通过，收集父分类（从已获取的 ancestors 算 parent_id）
      const ancestors = ancestorsStr
        ? (JSON.parse(ancestorsStr) as number[])
        : [];
      const parentId =
        ancestors.length > 0 ? ancestors[ancestors.length - 1] : 0;
      if (parentId !== 0 && !idSet.has(parentId)) {
        const list = parentChildrenToRemove.get(parentId) ?? [];
        list.push(id);
        parentChildrenToRemove.set(parentId, list);
      }
    }
    const parentIds = [...parentChildrenToRemove.keys()];

    // ========== 3. 获取父分类的 children（调用复数版本，三级降级）==========
    const parentChains = await categoryRepository.findChainsByIds(parentIds);
    const parentChildrenMap = new Map<number, number[]>();
    parentIds.forEach((pid) => {
      parentChildrenMap.set(pid, parentChains.get(pid)?.children ?? []);
    });

    // ========== 4. 执行删除（数据库 + 缓存，通过 Repository 一次完成）==========
    try {
      await categoryRepository.batchDelete(ids, {
        parentChildrenToRemove,
        parentChildrenMap,
      });
    } catch (error) {
      console.error(
        '[CategoryCache] 批量删除失败，将在下次定时重建时修复:',
        error,
      );
    }

    return { deletedIds: ids };
  }

  /**
   * 批量移动分类（仅支持同级分类批量移动）
   *
   * 【约束】
   * - 批量移动的分类必须属于同一父分类（同级），否则抛出错误
   * - 防止移动到自己的子分类下（循环检测）
   *
   * 【功能】
   * - 同级校验：所有被移动分类的 parent_id 必须相同
   * - 循环检测：目标分类的祖先中不能包含被移动分类
   * - 批量更新数据库中的 parent_id 和 sort
   * - 递归更新移动分类及其后代的祖先链路
   * - 计算计数器差异，精确更新受影响的祖先计数器
   * - 更新排序索引（Pipeline 精确删除 + 插入）
   * - 同步更新 MongoDB（parent_id + sort）
   *
   * 【性能优化】
   * 【性能优化】
   * 1. 不获取全量分类数据，利用链路数据在内存中推导新链路
   * 2. 第3步一次性并行获取 sort/count/chain/详情，后续直接用内存数据
   * 3. 计数器使用 incrby 原子增减，无需先读取当前值
   * 4. 排序索引更新封装到 repository，跨级移动与同级拖动区分
   * 5. 返回值直接用内存中已更新的数据，避免最后再查一次
   * 6. 总网络往返：正常 11 次，最少 9 次
   *
   * @param data 请求参数（ids + target_parent_id）
   * @returns 移动结果（movedIds + targetParentId + affectedIds + categories）
   */
  async batchMoveCategories(
    data: BatchMoveCategoriesRequest,
  ): Promise<BatchMoveCategoriesResponse> {
    const idSet = new Set(data.ids.map(Number));
    const ids = Array.from(idSet);
    const targetId = Number(data.target_parent_id);

    // ========== 1. 链路数据获取 + 存在性校验 + 同级校验 ==========
    const movingChains = await categoryRepository.findChainsByIds(ids);

    // 1.1 存在性校验
    const missingIds = ids.filter((id) => !movingChains.has(id));
    if (missingIds.length > 0) {
      throw new BusinessError(
        `分类不存在: ${missingIds.join(', ')}`,
        ErrorCodes.Project.CATEGORY_NOT_FOUND,
      );
    }

    // 从链路数据提取 parent_id（ancestors 最后一个，为空则是顶级分类）
    const getParentIdFromChain = (chain: { ancestors: number[] }): number =>
      chain.ancestors.at(-1) ?? 0;

    // 1.2 同级校验：批量移动仅支持同级分类
    const oldParentId = getParentIdFromChain(movingChains.get(ids[0])!);
    const allSameParent = ids.every(
      (id) => getParentIdFromChain(movingChains.get(id)!) === oldParentId,
    );
    if (!allSameParent) {
      throw new BusinessError(
        '批量移动仅支持同级分类',
        ErrorCodes.Common.VALIDATION_FAILED,
      );
    }

    // 移动到原父分类，无变化
    if (targetId === oldParentId) {
      throw new BusinessError(
        '不能移动到原父分类',
        ErrorCodes.Common.VALIDATION_FAILED,
      );
    }

    // ========== 2. 循环检测 + 深度检测 ==========
    // 2.1 目标分类链路（一次获取，两个检测复用）
    let targetChain: CategoryChainData | null = null;
    if (targetId !== 0) {
      targetChain = await categoryRepository.findChainById(targetId);
    }

    // 2.2 循环检测：目标分类的祖先中不能有被移动的分类
    if (targetChain?.ancestors.some((aid) => idSet.has(aid))) {
      throw new BusinessError('不能将分类移动到其自身的子分类下');
    }

    // 2.3 深度检测：移动后子树最大深度不能超过 max_depth
    // 被移动分类深度 = targetDepth + 1，有子元素则再 +1
    const maxDepth = Math.min(data.max_depth ?? 3, 3);
    const targetDepth = targetChain?.depth ?? 0;
    const hasChildren = ids.some((id) => {
      const chain = movingChains.get(id);
      return chain && chain.children.length > 0;
    });
    const afterMoveMaxDepth = targetDepth + 1 + (hasChildren ? 1 : 0);
    if (afterMoveMaxDepth > maxDepth) {
      throw new BusinessError(
        `分类最多支持 ${maxDepth} 级，当前移动后子树最大深度为第 ${
          afterMoveMaxDepth + 1
        } 级`,
        ErrorCodes.Common.VALIDATION_FAILED,
      );
    }

    // ========== 3. 并行获取必要数据（避免全量查询）==========
    // 3.1 被移动分类的所有直接子元素 id（分类最多三级，最多一层子元素）
    const allChildren: number[] = [];
    for (const chain of movingChains.values()) {
      allChildren.push(...chain.children);
    }

    // 3.2 受影响的分类 id（被移动分类 + 子元素 + 新旧祖先 + 新旧父分类）
    const oldAncestors = movingChains.get(ids[0])?.ancestors ?? [];
    const targetAncestors = targetChain?.chain ?? [];
    const affectedIds = new Set<number>();
    ids.forEach((id) => affectedIds.add(id));
    allChildren.forEach((id) => affectedIds.add(id));
    oldAncestors.forEach((id) => affectedIds.add(id));
    targetAncestors.forEach((id) => affectedIds.add(id));
    if (oldParentId !== 0) affectedIds.add(oldParentId);
    if (targetId !== 0) affectedIds.add(targetId);

    // 3.3 目标父分类的现有子分类 id（计算 maxSort 用）
    const targetChildrenIds = targetChain?.children ?? [];

    // 3.4 并行获取：sort + count + chain + 详情（一次性获取，后续用内存数据）
    const [allSorts, allCounts, allChains, affectedCategories] =
      await Promise.all([
        categoryRepository.getSortsByIds([...targetChildrenIds, ...ids]),
        categoryRepository.getCountsByIds([...ids, ...allChildren]),
        categoryRepository.findChainsByIds(
          oldParentId !== 0 ? [...allChildren, oldParentId] : allChildren,
        ),
        categoryRepository.findByIds(Array.from(affectedIds)),
      ]);

    // 3.5 从合并的链路 Map 中分离子元素链路和旧父分类链路
    const childrenChains = new Map(
      [...allChains].filter(([id]) => id !== oldParentId),
    );
    const oldParentChain =
      oldParentId !== 0 ? allChains.get(oldParentId) ?? null : null;

    // 3.6 受影响分类 Map，便于后续内存更新
    const affectedCategoryMap = new Map(
      affectedCategories.map((c) => [c.id, c]),
    );

    // ========== 4. 计算新 sort（追加到目标父分类末尾，保持相对顺序）==========
    // 4.1 目标父分类下现有子分类的最大 sort（排除被移动的分类）
    let maxSort = 0;
    for (const id of targetChildrenIds) {
      if (!idSet.has(id)) {
        maxSort = Math.max(maxSort, allSorts.get(id) || 0);
      }
    }
    // 4.2 按原始 sort 排序被移动分类
    const sortedMovingIds = [...ids].sort(
      (a, b) => (allSorts.get(a) || 0) - (allSorts.get(b) || 0),
    );
    // 4.3 分配新 sort
    const newSortMap = new Map<number, number>();
    sortedMovingIds.forEach((id, index) => {
      newSortMap.set(id, maxSort + index + 1);
    });

    // ========== 5. 批量更新数据库（bulkUpdate，避免循环）==========
    const bulkUpdateOperations = ids.map((id) => ({
      where: { id },
      data: { parent_id: targetId, sort: newSortMap.get(id) },
    }));
    await categoryTable.bulkUpdate(bulkUpdateOperations);

    // ========== 6. 内存计算新链路，批量写入缓存 ==========
    const newChainData: Array<{ id: number; chainData: CategoryChainData }> =
      [];

    // 6.1 被移动分类的新链路
    for (const id of ids) {
      const oldChain = movingChains.get(id)!;
      newChainData.push({
        id,
        chainData: {
          chain: [...targetAncestors, id],
          depth: targetAncestors.length,
          ancestors: targetAncestors,
          children: oldChain.children, // 子元素不变
        },
      });
    }

    // 6.2 子元素的新链路（最多一层）
    for (const childId of allChildren) {
      const oldChain = childrenChains.get(childId);
      if (!oldChain) continue;
      const parentId = oldChain.ancestors.at(-1) ?? 0;
      const parentNewAncestors = [...targetAncestors, parentId];
      newChainData.push({
        id: childId,
        chainData: {
          chain: [...parentNewAncestors, childId],
          depth: parentNewAncestors.length,
          ancestors: parentNewAncestors,
          children: oldChain.children,
        },
      });
    }

    // 6.3 旧父分类的 children（移除被移动的分类）
    if (oldParentChain) {
      const updatedOldChildren = oldParentChain.children.filter(
        (cid) => !idSet.has(cid),
      );
      newChainData.push({
        id: oldParentId,
        chainData: {
          ...oldParentChain,
          children: updatedOldChildren,
        },
      });
    }

    // 6.4 新父分类的 children（添加被移动的分类）
    if (targetChain) {
      const updatedTargetChildren = [
        ...targetChain.children.filter((cid) => !idSet.has(cid)),
        ...sortedMovingIds,
      ];
      newChainData.push({
        id: targetId,
        chainData: {
          ...targetChain,
          children: updatedTargetChildren,
        },
      });
    }

    // 6.5 批量写入链路缓存（单次 Pipeline）
    await categoryRepository.batchSetChainCache(newChainData);

    // ========== 7. 计数器原子增减（incrby，无需先读取，减少一次 IO）==========
    // 7.1 被移动分类子树的总 project_count（自身 + 子元素）
    let totalMoveCount = 0;
    for (const id of ids) {
      totalMoveCount += allCounts.get(id) || 0;
      const children = movingChains.get(id)?.children ?? [];
      for (const childId of children) {
        totalMoveCount += allCounts.get(childId) || 0;
      }
    }

    // 7.2 计算每个受影响祖先的净变化 delta（旧祖先减，新祖先加，重叠为0）
    const countDeltas: Array<{ id: number; delta: number }> = [];
    const affectedAncestorIds = [
      ...new Set([...oldAncestors, ...targetAncestors]),
    ];
    for (const ancestorId of affectedAncestorIds) {
      const isOldAncestor = oldAncestors.includes(ancestorId);
      const isNewAncestor = targetAncestors.includes(ancestorId);
      let delta = 0;
      if (isOldAncestor) delta -= totalMoveCount;
      if (isNewAncestor) delta += totalMoveCount;
      if (delta !== 0) {
        countDeltas.push({ id: ancestorId, delta });
        // 同步更新内存中的 project_count
        const cat = affectedCategoryMap.get(ancestorId);
        if (cat) {
          const currentCount = (cat as any).project_count || 0;
          (cat as any).project_count = Math.max(0, currentCount + delta);
        }
      }
    }

    // 7.3 批量原子增减计数器
    await categoryRepository.batchIncrCountCache(countDeltas);

    // ========== 8. 更新排序索引 + Redis Hash（封装到 repository）==========
    await categoryRepository.moveCategoriesInOrderList(
      ids,
      targetId,
      newSortMap,
      sortedMovingIds,
    );

    // 8.1 同步更新内存中被移动分类的 parent_id 和 sort
    for (const id of ids) {
      const cat = affectedCategoryMap.get(id);
      if (cat) {
        cat.parent_id = targetId;
        cat.sort = newSortMap.get(id) ?? cat.sort;
      }
    }

    console.log(
      `[CategoryCache] 分类移动完成: moved=${idSet.size}, ` +
        `target=${targetId}, affected=${affectedIds.size}`,
    );

    // ========== 9. MongoDB 批量更新（失败不影响主流程，等待定时重建）==========
    try {
      await categoryRepository.bulkWriteMongo(
        ids.map((id) => ({
          type: 'update' as const,
          filter: { id },
          update: {
            $set: {
              parent_id: targetId,
              sort: newSortMap.get(id),
            },
          },
        })),
      );
    } catch (error) {
      console.error(
        '[CategoryCache] 分类移动 MongoDB 更新失败，将在下次定时重建时修复:',
        error,
      );
    }

    // ========== 10. 返回内存中已更新的受影响分类数据 ==========
    return {
      movedIds: ids,
      targetParentId: targetId,
      affectedIds: Array.from(affectedIds),
      categories: Array.from(affectedCategoryMap.values()),
    };
  }

  /**
   * 保存分类排序（同级拖动排序，parent_id 不变）
   *
   * 【功能】
   * - 仅修改同级分类的 sort 字段
   * - 校验所有被拖动分类属于同一父分类
   * - 精确更新排序索引（删除同级分组 + 按新 sort 重新插入）
   *
   * 【性能优化】
   * 1. 全部从 Redis 缓存读取，无全量查询
   * 2. 数据库/Redis/MongoDB 均使用批量操作
   * 3. 排序索引精确更新，不全量重建
   *
   * @param data 请求参数
   */
  async saveCategorySort(
    data: SaveCategorySortRequest,
  ): Promise<SaveCategorySortResponse> {
    const ids = data.sorts.map((s) => s.id);

    // ========== 1. 批量获取分类信息（三级降级：Redis → MongoDB → MockTable）==========
    const categories = await categoryRepository.findByIds(ids);

    if (categories.length === 0) {
      throw new BusinessError(
        '分类不存在',
        ErrorCodes.Project.CATEGORY_NOT_FOUND,
      );
    }

    // ========== 2. 同级校验：所有分类的 parent_id 必须相同 ==========
    const parentId = categories[0].parent_id;
    if (!categories.every((c) => c.parent_id === parentId)) {
      throw new BusinessError(
        '只支持同级分类排序',
        ErrorCodes.Common.VALIDATION_FAILED,
      );
    }

    // ========== 3. 获取所有同级分类 ID（三级降级：Redis → MongoDB → MockTable）==========
    // 复用 categoryRepository.findSiblingIds，传入 -1 作为 excludeId（不排除任何分类）
    const siblingIds = await categoryRepository.findSiblingIds(parentId, -1);

    // ========== 4. 获取所有同级分类的当前 sort，应用新值后重新排序 ==========
    const sortMap = await categoryRepository.getSortsByIds(siblingIds);
    // 应用新的 sort 值
    for (const item of data.sorts) {
      sortMap.set(item.id, item.sort);
    }
    // 按 sort 升序排列
    const sortedSiblingIds = [...siblingIds].sort(
      (a, b) => (sortMap.get(a) || 0) - (sortMap.get(b) || 0),
    );

    // ========== 5. 批量更新数据库 + Redis 缓存（通过 Repository 封装）==========
    const dbUpdates = data.sorts.map((item) => ({
      where: { id: item.id },
      data: { sort: item.sort },
    }));

    await Promise.all([
      categoryRepository.bulkUpdateTable(dbUpdates),
      categoryRepository.updateSortCache(
        data.sorts,
        siblingIds,
        sortedSiblingIds,
        parentId,
      ),
    ]);

    // ========== 6. 批量更新 MongoDB（通过 Repository）==========
    try {
      await categoryRepository.bulkWriteMongo(
        data.sorts.map((item) => ({
          type: 'update' as const,
          filter: { id: item.id },
          update: { $set: { sort: item.sort } },
        })),
      );
    } catch (error) {
      console.error(
        '[CategoryCache] 保存排序 MongoDB 更新失败，将在下次定时重建时修复:',
        error,
      );
    }

    // ========== 8. 返回更新后的分类（复用已有数据，无需额外 IO）==========
    // 复用第 1 部分的 categories + 第 4 部分的 sortMap（已包含新 sort 值）
    const updatedCategories = categories.map((cat) => ({
      ...cat,
      sort: sortMap.get(cat.id) ?? cat.sort,
    }));

    return { categories: updatedCategories };
  }

  /**
   * 精确更新分类项目数计数器（文集新增/删除/移动时调用）
   *
   * 【性能优势】
   * - 只更新受影响的分类计数器（O(1) INCRBY 操作）
   * - 不需要全量清除缓存，不需要重新计算所有分类的项目数
   *
   * @param categoryId 分类 ID
   * @param delta 变化量（+1 新增，-1 删除）
   */
  async updateCategoryCount(categoryId: number, delta: number): Promise<void> {
    // 读取祖先链路（三级降级：Redis → MongoDB → MockTable）
    const chainData = await categoryRepository.findChainById(categoryId);
    const idsToUpdate = chainData ? chainData.chain : [categoryId];

    // 批量原子增减计数器（封装到 repository，使用 incrBy）
    await categoryRepository.batchIncrCountCache(
      idsToUpdate.map((id) => ({ id, delta })),
    );
  }
}

export const categoryService = new CategoryService();
