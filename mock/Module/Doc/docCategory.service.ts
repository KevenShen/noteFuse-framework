// mock/Doc/docCategory.service.ts
// 文档分类管理服务层
// 职责：处理文档分类相关的核心业务逻辑

import { BusinessError } from '../../Core';
import type { MockDocCategory } from '../../Entities/doc';
import type { DocCategoryWithStats } from './docCategory.dto';
import { docCategoryRepository } from './docCategory.repository';

// ============================================================================
// 文档分类服务类
// ============================================================================

class DocCategoryService {
  // ==================== 获取分类 ====================

  /**
   * 获取文集下的文档分类列表（三级降级：MongoDB → Redis → 数据库）
   *
   * @param projectId 文集 ID
   * @returns 分类列表（已按 parent_id + sort 排序）
   */
  async getDocCategories(projectId: number): Promise<MockDocCategory[]> {
    return docCategoryRepository.findByProjectId(projectId);
  }

  /**
   * 获取所有文档分类列表（跨文集，带文档数量）
   *
   * @param options 可选筛选参数（project_id、keyword）
   * @returns 带文档数量的分类列表
   */
  async getAllDocCategoriesWithDocCount(options?: {
    project_id?: number;
    keyword?: string;
  }): Promise<DocCategoryWithStats[]> {
    // 1. 获取所有分类
    let allCategories = await docCategoryRepository.findAll({
      project_id: options?.project_id,
    });

    // 关键词筛选
    if (options?.keyword) {
      const kw = options.keyword.toLowerCase();
      allCategories = allCategories.filter((c) =>
        c.name.toLowerCase().includes(kw),
      );
    }

    // 2. 计算每个分类的文档数量（含后代）
    const allDocs = await docCategoryRepository.findAllDocs();

    // 构建分类映射，便于查找后代
    const categoryMap = new Map<number, MockDocCategory>();
    allCategories.forEach((c) => categoryMap.set(c.id, c));

    // 获取某个分类的所有后代 ID（递归）
    const getDescendantIds = (categoryId: number): number[] => {
      const descendants: number[] = [];
      const children = allCategories.filter((c) => c.parent_id === categoryId);
      for (const child of children) {
        descendants.push(child.id);
        descendants.push(...getDescendantIds(child.id));
      }
      return descendants;
    };

    // 计算每个分类的文档数量（含后代分类下的文档）
    const result: DocCategoryWithStats[] = allCategories.map((category) => {
      const relatedIds = [category.id, ...getDescendantIds(category.id)];
      const docCount = allDocs.filter((d) =>
        relatedIds.includes(d.doc_category_id),
      ).length;
      return {
        ...category,
        doc_count: docCount,
      };
    });

    // 排序：先按 project_id，再按 parent_id，再按 sort
    result.sort((a, b) => {
      if (a.project_id !== b.project_id) return a.project_id - b.project_id;
      if (a.parent_id !== b.parent_id) return a.parent_id - b.parent_id;
      return a.sort - b.sort;
    });

    return result;
  }

  // ==================== 创建分类 ====================

  /**
   * 新建文档分类
   *
   * @param data 请求参数（project_id、name 必填）
   * @returns 创建的分类
   */
  async createDocCategory(data: {
    project_id: number;
    name: string;
    parent_id?: number;
    sort?: number;
    icon?: string;
  }): Promise<MockDocCategory> {
    // 1. 检查文集是否存在
    const projectExists = await docCategoryRepository.projectExists(data.project_id);
    if (!projectExists) {
      throw new BusinessError('文集不存在');
    }

    // 2. 获取当前文集的分类列表
    const existingCategories = await this.getDocCategories(data.project_id);
    const parentId = data.parent_id || 0;

    // 2.1 检查父分类是否存在
    if (parentId !== 0) {
      const parentExists = existingCategories.some((c) => c.id === parentId);
      if (!parentExists) {
        throw new BusinessError('父分类不存在');
      }
    }

    // 2.2 同级名称重复校验
    const nameExists = existingCategories.some(
      (c) => c.parent_id === parentId && c.name === data.name,
    );
    if (nameExists) {
      throw new BusinessError('同级分类下已存在相同名称的分类');
    }

    // 2.3 自动计算 sort
    const siblingSorts = existingCategories
      .filter((c) => c.parent_id === parentId)
      .map((c) => c.sort);
    const maxSort = siblingSorts.length > 0 ? Math.max(...siblingSorts) : 0;

    // 3. 创建分类（MockTable + MongoDB）
    const newCategory = await docCategoryRepository.create({
      project_id: data.project_id,
      name: data.name,
      parent_id: parentId,
      sort: data.sort ?? maxSort + 1,
      icon: data.icon || '',
      created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
    } as Partial<MockDocCategory>);

    // 4. Redis 缓存更新
    try {
      const projectId = String(data.project_id);

      // 4.1 计算祖先链路数据
      let chain: number[] = [newCategory.id];
      let depth = 0;
      let ancestors: number[] = [];

      if (parentId !== 0) {
        const ancestorIds: number[] = [];
        let current = existingCategories.find((c) => c.id === parentId);
        while (current && current.parent_id !== 0) {
          ancestorIds.unshift(current.parent_id);
          current = existingCategories.find((c) => c.id === current!.parent_id);
        }
        ancestorIds.push(parentId);
        ancestors = ancestorIds;
        chain = [...ancestorIds, newCategory.id];
        depth = ancestorIds.length;
      }

      // 4.2 写入分类详情缓存
      await docCategoryRepository.setCategoryInfo(data.project_id, newCategory);

      // 4.3 写入链路数据缓存
      await docCategoryRepository.setChain(data.project_id, newCategory.id, {
        chain,
        depth,
        ancestors,
        children: [],
      });

      // 4.4 更新排序索引
      const sortedList = [...existingCategories, newCategory].sort((a, b) => {
        if (a.parent_id !== b.parent_id) return a.parent_id - b.parent_id;
        return a.sort - b.sort;
      });
      const sortedIds = sortedList.map((c) => c.id);
      await docCategoryRepository.setOrderList(data.project_id, sortedIds);

      // 4.5 更新父分类的 children
      if (parentId !== 0) {
        const parentChain = await docCategoryRepository.getChain(data.project_id, parentId);
        let parentChildren: number[] = [];
        if (parentChain && parentChain.children) {
          try {
            parentChildren = JSON.parse(parentChain.children);
          } catch {
            parentChildren = [];
          }
        }
        if (!parentChildren.includes(newCategory.id)) {
          parentChildren.push(newCategory.id);
        }
        await docCategoryRepository.setParentChildren(data.project_id, parentId, parentChildren);
      }
    } catch (error) {
      console.warn('[DocCategory] 更新 Redis 缓存失败:', error);
    }

    return newCategory;
  }

  // ==================== 更新分类 ====================

  /**
   * 更新文档分类
   *
   * @param id 分类 ID
   * @param data 更新数据
   * @returns 更新后的分类
   */
  async updateDocCategory(
    id: number,
    data: {
      name?: string;
      parent_id?: number;
      sort?: number;
      icon?: string;
    },
  ): Promise<MockDocCategory> {
    // 1. 查询分类
    const oldCategory = await docCategoryRepository.findById(id);
    if (!oldCategory) {
      throw new BusinessError('分类不存在', 404);
    }

    const projectIdStr = String(oldCategory.project_id);
    const oldParentId = oldCategory.parent_id;
    const newParentId =
      data.parent_id !== undefined ? data.parent_id : oldParentId;
    const parentChanged = newParentId !== oldParentId;

    // 2. 构建更新数据
    const updateData: Partial<MockDocCategory> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.parent_id !== undefined) updateData.parent_id = data.parent_id;
    if (data.sort !== undefined) updateData.sort = data.sort;
    if (data.icon !== undefined) updateData.icon = data.icon;

    // 3. 更新分类（MockTable + MongoDB）
    const updatedCategory = await docCategoryRepository.update(id, updateData);
    if (!updatedCategory) {
      throw new BusinessError('分类更新失败', 500);
    }

    // 4. Redis 缓存更新
    try {
      // 4.1 更新分类详情
      await docCategoryRepository.setCategoryInfo(oldCategory.project_id, updatedCategory);

      // 4.2 如果 parent_id 变更，更新链路数据
      if (parentChanged) {
        const allCategories = await this.getDocCategories(oldCategory.project_id);

        // 计算新的链路数据
        let newChain: number[] = [id];
        let newDepth = 0;
        let newAncestors: number[] = [];

        if (newParentId !== 0) {
          const parentCategory = allCategories.find((c) => c.id === newParentId);
          if (parentCategory) {
            const ancestorIds: number[] = [];
            let current = parentCategory;
            while (current && current.parent_id !== 0) {
              ancestorIds.unshift(current.parent_id);
              current = allCategories.find((c) => c.id === current!.parent_id);
            }
            ancestorIds.push(newParentId);
            newAncestors = ancestorIds;
            newChain = [...ancestorIds, id];
            newDepth = ancestorIds.length;
          }
        }

        await docCategoryRepository.setChain(oldCategory.project_id, id, {
          chain: newChain,
          depth: newDepth,
          ancestors: newAncestors,
          children: [],
        });

        // 从旧父分类的 children 中移除
        if (oldParentId !== 0) {
          const oldParentChain = await docCategoryRepository.getChain(oldCategory.project_id, oldParentId);
          let oldParentChildren: number[] = [];
          if (oldParentChain && oldParentChain.children) {
            try {
              oldParentChildren = JSON.parse(oldParentChain.children);
            } catch {
              oldParentChildren = [];
            }
          }
          oldParentChildren = oldParentChildren.filter((childId) => childId !== id);
          await docCategoryRepository.setParentChildren(oldCategory.project_id, oldParentId, oldParentChildren);
        }

        // 添加到新父分类的 children 中
        if (newParentId !== 0) {
          const newParentChain = await docCategoryRepository.getChain(oldCategory.project_id, newParentId);
          let newParentChildren: number[] = [];
          if (newParentChain && newParentChain.children) {
            try {
              newParentChildren = JSON.parse(newParentChain.children);
            } catch {
              newParentChildren = [];
            }
          }
          if (!newParentChildren.includes(id)) {
            newParentChildren.push(id);
          }
          await docCategoryRepository.setParentChildren(oldCategory.project_id, newParentId, newParentChildren);
        }
      }

      // 4.3 更新排序索引
      const allCategories = await this.getDocCategories(oldCategory.project_id);
      const sortedList = allCategories.sort((a, b) => {
        if (a.parent_id !== b.parent_id) return a.parent_id - b.parent_id;
        return a.sort - b.sort;
      });
      const sortedIds = sortedList.map((c) => c.id);
      await docCategoryRepository.setOrderList(oldCategory.project_id, sortedIds);
    } catch (error) {
      console.warn('[DocCategory] 更新 Redis 缓存失败:', error);
    }

    return updatedCategory;
  }

  // ==================== 删除分类 ====================

  /**
   * 删除文档分类（含校验：存在子分类或文档时禁止删除）
   *
   * @param id 分类 ID
   * @returns null
   */
  async deleteDocCategory(id: number): Promise<null> {
    // 1. 查询分类
    const category = await docCategoryRepository.findById(id);
    if (!category) {
      throw new BusinessError('分类不存在', 404);
    }

    const projectIdStr = String(category.project_id);
    const parentId = category.parent_id;

    // 2. 检查是否有子分类
    let hasChildren = false;
    try {
      const chainData = await docCategoryRepository.getChain(category.project_id, id);
      if (chainData && chainData.children) {
        const children = JSON.parse(chainData.children);
        hasChildren = Array.isArray(children) && children.length > 0;
      } else {
        const allCategories = await this.getDocCategories(category.project_id);
        hasChildren = allCategories.some((c) => c.parent_id === id);
      }
    } catch {
      const allCategories = await this.getDocCategories(category.project_id);
      hasChildren = allCategories.some((c) => c.parent_id === id);
    }

    if (hasChildren) {
      throw new BusinessError('该分类下存在子分类，请先删除子分类');
    }

    // 3. 检查是否有文档
    let hasDocs = false;
    try {
      const docIds = await docCategoryRepository.getDocIdsByCategoryId(category.project_id, id);
      hasDocs = Array.isArray(docIds) && docIds.length > 0;
    } catch {
      const docCount = await docCategoryRepository.countDocsByCategoryId(id);
      hasDocs = docCount > 0;
    }

    if (hasDocs) {
      throw new BusinessError('该分类下存在文档，请先移动或删除文档');
    }

    // 4. 删除分类（MockTable + MongoDB）
    await docCategoryRepository.delete(id);

    // 5. Redis 缓存清理
    try {
      await docCategoryRepository.removeFromOrderList(category.project_id, id);
      await docCategoryRepository.deleteCategoryInfo(category.project_id, id);
      await docCategoryRepository.deleteChain(category.project_id, id);
      await docCategoryRepository.deleteDocIdsCache(category.project_id, id);

      // 更新父分类的 children
      if (parentId !== 0) {
        const parentChain = await docCategoryRepository.getChain(category.project_id, parentId);
        let parentChildren: number[] = [];
        if (parentChain && parentChain.children) {
          try {
            parentChildren = JSON.parse(parentChain.children);
          } catch {
            parentChildren = [];
          }
        }
        parentChildren = parentChildren.filter((childId) => childId !== id);
        await docCategoryRepository.setParentChildren(category.project_id, parentId, parentChildren);
      }
    } catch (error) {
      console.warn('[DocCategory] 更新 Redis 缓存失败:', error);
    }

    return null;
  }

  // ==================== 批量操作 ====================

  /**
   * 批量删除文档分类
   *
   * @param data 请求参数（ids: 分类 ID 数组）
   * @returns null
   */
  async batchDeleteDocCategories(data: { ids: number[] }): Promise<null> {
    const { ids } = data;

    // 获取所有分类，用于判断父子关系
    const allCategories = await docCategoryTable.findAll();
    const categoryMap = new Map<number, MockDocCategory>();
    allCategories.forEach((c) => categoryMap.set(c.id, c));

    // 按层级排序：先删子分类（depth 大的），再删父分类
    const getDepth = (categoryId: number): number => {
      let depth = 0;
      let current = categoryMap.get(categoryId);
      while (current && current.parent_id !== 0) {
        depth++;
        current = categoryMap.get(current.parent_id);
      }
      return depth;
    };

    const sortedIds = [...ids].sort((a, b) => getDepth(b) - getDepth(a));

    // 逐个删除（复用 deleteDocCategory 的校验逻辑）
    const errors: string[] = [];
    for (const id of sortedIds) {
      try {
        await this.deleteDocCategory(id);
      } catch (error: any) {
        const category = categoryMap.get(id);
        errors.push(`${category?.name || id}: ${error.message || '删除失败'}`);
      }
    }

    if (errors.length > 0) {
      throw new BusinessError(`部分分类删除失败：${errors.join('；')}`);
    }

    return null;
  }

  /**
   * 批量移动文档分类
   *
   * @param data 请求参数（ids、target_parent_id）
   * @returns null
   */
  async batchMoveDocCategories(data: {
    ids: number[];
    target_parent_id: number;
  }): Promise<null> {
    const { ids, target_parent_id } = data;

    // 获取所有分类
    const allCategories = await docCategoryTable.findAll();
    const categoryMap = new Map<number, MockDocCategory>();
    allCategories.forEach((c) => categoryMap.set(c.id, c));

    // 校验目标父分类存在（如果不是顶级）
    if (target_parent_id !== 0) {
      const targetParent = categoryMap.get(target_parent_id);
      if (!targetParent) {
        throw new BusinessError('目标父分类不存在');
      }
    }

    // 检查是否移动到自己的子分类下
    const isDescendant = (parentId: number, childId: number): boolean => {
      let current = categoryMap.get(parentId);
      while (current) {
        if (current.id === childId) return true;
        if (current.parent_id === 0) break;
        current = categoryMap.get(current.parent_id);
      }
      return false;
    };

    for (const id of ids) {
      if (target_parent_id !== 0 && isDescendant(target_parent_id, id)) {
        const category = categoryMap.get(id);
        throw new BusinessError(
          `不能将「${category?.name || id}」移动到其子分类下`,
        );
      }
    }

    // 获取目标父分类下的现有分类，计算 maxSort
    const targetSiblings = allCategories.filter(
      (c) => c.parent_id === target_parent_id,
    );
    let maxSort =
      targetSiblings.length > 0
        ? Math.max(...targetSiblings.map((c) => c.sort))
        : 0;

    // 逐个移动
    for (const id of ids) {
      const category = categoryMap.get(id);
      if (!category) continue;

      maxSort++;
      await this.updateDocCategory(id, {
        parent_id: target_parent_id,
        sort: maxSort,
      });
    }

    return null;
  }

  // ==================== 保存排序 ====================

  /**
   * 保存文档分类排序
   *
   * @param data 请求参数（sorts: 排序数组）
   * @returns null
   */
  async saveDocCategorySort(data: {
    sorts: Array<{ id: number; sort: number; parent_id?: number }>;
  }): Promise<null> {
    const { sorts } = data;

    for (const item of sorts) {
      const updateData: { sort: number; parent_id?: number } = {
        sort: item.sort,
      };
      if (item.parent_id !== undefined) {
        updateData.parent_id = item.parent_id;
      }
      await this.updateDocCategory(item.id, updateData);
    }

    return null;
  }
}

// ============================================================================
// 导出服务实例
// ============================================================================

export const docCategoryService = new DocCategoryService();
