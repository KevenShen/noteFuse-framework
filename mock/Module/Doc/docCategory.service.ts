// mock/Doc/docCategory.service.ts
// 文档分类管理服务层
// 职责：处理文档分类相关的核心业务逻辑，调用数据库（MockTable）和缓存（Redis）

import { BusinessError } from '../../Core';
import {
  docCategoryChainCache,
  docCategoryDocsCache,
  docCategoryInfoCache,
  docCategoryMongoCollection,
  docCategoryOrderCache,
  docCategoryTable,
  docTable,
  type MockDocCategory,
} from '../../Entities/doc';
import { projectMongoCollection, projectTable } from '../../Entities/project';
import type { DocCategoryWithStats } from './docCategory.dto';

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
    // ========== 1. 尝试从 MongoDB 获取（L2） ==========
    try {
      const mongoCategories = await docCategoryMongoCollection
        .find({ project_id: projectId })
        .sort({ parent_id: 1, sort: 1 })
        .toArray();
      if (mongoCategories && mongoCategories.length > 0) {
        return mongoCategories.map(({ doc_count, children, ...cat }) => cat);
      }
    } catch (error) {
      console.warn('[DocCategory] MongoDB 读取失败，降级到 Redis 缓存:', error);
    }

    // ========== 2. 降级到 Redis 缓存获取（L3） ==========
    try {
      // 2.1 从排序索引缓存读取分类 ID 列表
      const categoryIds = await docCategoryOrderCache.lrange(
        String(projectId),
        0,
        -1,
      );
      if (categoryIds && categoryIds.length > 0) {
        // 2.2 使用 Pipeline 批量读取所有分类的详情
        const pipeline = docCategoryInfoCache.pipeline();
        for (const id of categoryIds) {
          pipeline.hgetAll(`${projectId}:${id}`);
        }
        const results = await pipeline.execAsync();

        // 2.3 解析 Pipeline 结果，组装分类列表
        const categories: MockDocCategory[] = [];
        for (let i = 0; i < categoryIds.length; i++) {
          const categoryInfo = results[i] as Record<string, string> | null;
          if (categoryInfo && Object.keys(categoryInfo).length > 0) {
            categories.push({
              id: Number(categoryInfo.id),
              name: categoryInfo.name,
              parent_id: Number(categoryInfo.parent_id),
              project_id: Number(categoryInfo.project_id),
              sort: Number(categoryInfo.sort),
              icon: categoryInfo.icon || undefined,
              created_at: categoryInfo.created_at,
            });
          }
        }

        // 2.4 如果成功获取到分类，返回结果
        if (categories.length > 0) {
          return categories;
        }
      }
    } catch (error) {
      console.warn('[DocCategory] Redis 缓存读取失败，降级到 L1 数据库:', error);
    }

    // ========== 3. 降级到 L1 数据库（MockTable） ==========
    const allCategories = await docCategoryTable.findAll();
    const result = allCategories
      .filter((c) => c.project_id === projectId)
      .sort((a, b) => {
        if (a.parent_id !== b.parent_id) return a.parent_id - b.parent_id;
        return a.sort - b.sort;
      });

    // 3.1 异步写入 Redis 缓存（不阻塞主流程，下次查询可命中缓存）
    if (result.length > 0) {
      try {
        const pipeline = docCategoryInfoCache.pipeline();

        // 写入排序索引（先删除旧的，再写入新的）
        pipeline.del(String(projectId));
        pipeline.rpush(String(projectId), ...result.map((c) => c.id));

        // 批量写入分类详情
        for (const cat of result) {
          pipeline.hmset(`${projectId}:${cat.id}`, {
            id: String(cat.id),
            name: cat.name,
            parent_id: String(cat.parent_id),
            project_id: String(cat.project_id),
            sort: String(cat.sort),
            icon: cat.icon || '',
            created_at: cat.created_at,
          });
        }

        await pipeline.execAsync();
      } catch (error) {
        console.warn('[DocCategory] 写入 Redis 缓存失败:', error);
      }
    }

    return result;
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
    // ========== 1. 获取所有分类（优先 MongoDB，降级 L1） ==========
    let allCategories: MockDocCategory[] = [];
    try {
      const query: any = {};
      if (options?.project_id) {
        query.project_id = options.project_id;
      }
      const mongoCategories = await docCategoryMongoCollection
        .find(query)
        .sort({ project_id: 1, parent_id: 1, sort: 1 })
        .toArray();
      if (mongoCategories && mongoCategories.length > 0) {
        allCategories = mongoCategories.map(
          ({ doc_count, children, ...cat }: any) => cat,
        );
      }
    } catch (error) {
      console.warn('[DocCategory] MongoDB 读取失败，降级到 L1:', error);
    }

    // 降级到 L1 数据库
    if (allCategories.length === 0) {
      allCategories = await docCategoryTable.findAll();
      if (options?.project_id) {
        allCategories = allCategories.filter(
          (c) => c.project_id === options!.project_id,
        );
      }
    }

    // 关键词筛选
    if (options?.keyword) {
      const kw = options.keyword.toLowerCase();
      allCategories = allCategories.filter((c) =>
        c.name.toLowerCase().includes(kw),
      );
    }

    // ========== 2. 计算每个分类的文档数量（含后代） ==========
    const allDocs = await docTable.findAll();

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
    // ========== 1. 检查文集是否存在（优先 MongoDB，降级 L1） ==========
    let projectExists = false;
    try {
      const project = await projectMongoCollection.findOne({
        id: data.project_id,
      });
      projectExists = !!project;
    } catch (error) {
      console.warn('[DocCategory] MongoDB 检查文集失败，降级到 L1:', error);
      const project = await projectTable.findById(data.project_id);
      projectExists = !!project;
    }
    if (!projectExists) {
      throw new BusinessError('文集不存在');
    }

    // ========== 2. 获取当前文集的分类列表（三级降级） ==========
    const existingCategories = await this.getDocCategories(data.project_id);
    const parentId = data.parent_id || 0;

    // 2.1 检查父分类是否存在（如果指定了）
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

    // 2.3 自动计算 sort（同级最大 sort + 1，避免删除后重复）
    const siblingSorts = existingCategories
      .filter((c) => c.parent_id === parentId)
      .map((c) => c.sort);
    const maxSort = siblingSorts.length > 0 ? Math.max(...siblingSorts) : 0;

    // ========== 3. 创建分类（L1 主存储） ==========
    const newCategory = await docCategoryTable.create({
      project_id: data.project_id,
      name: data.name,
      parent_id: parentId,
      sort: data.sort ?? maxSort + 1,
      icon: data.icon || '',
      created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
    } as MockDocCategory);

    // ========== 4. 同步写入 MongoDB（L2） ==========
    try {
      await docCategoryMongoCollection.insertOne({
        ...newCategory,
        doc_count: 0,
        children: [],
      });
    } catch (error) {
      console.warn('[DocCategory] 写入 MongoDB 失败:', error);
    }

    // ========== 5. 精确更新 Redis 缓存（L3） ==========
    try {
      const projectId = String(data.project_id);

      // 5.1 计算新分类的祖先链路数据
      let chain: number[] = [newCategory.id];
      let depth = 0;
      let ancestors: number[] = [];

      if (parentId !== 0) {
        const parentCategory = existingCategories.find((c) => c.id === parentId);
        if (parentCategory) {
          const ancestorIds: number[] = [];
          let current = parentCategory;
          while (current && current.parent_id !== 0) {
            ancestorIds.unshift(current.parent_id);
            current = existingCategories.find(
              (c) => c.id === current!.parent_id,
            )!;
          }
          ancestorIds.push(parentId);
          ancestors = ancestorIds;
          chain = [...ancestorIds, newCategory.id];
          depth = ancestorIds.length;
        }
      }

      // 5.2 计算排序索引的准确插入位置
      const sortedList = [...existingCategories, newCategory].sort((a, b) => {
        if (a.parent_id !== b.parent_id) return a.parent_id - b.parent_id;
        return a.sort - b.sort;
      });
      const newIndex = sortedList.findIndex((c) => c.id === newCategory.id);
      const pivotId = newIndex > 0 ? sortedList[newIndex - 1].id : null;
      const insertAtBeginning = newIndex === 0;

      // 5.3 构建 docCategoryInfoCache 的 Pipeline
      const infoPipeline = docCategoryInfoCache.pipeline();

      if (insertAtBeginning) {
        infoPipeline.lpush(projectId, newCategory.id);
      } else if (pivotId !== null) {
        infoPipeline.linsert(projectId, 'AFTER', pivotId, newCategory.id);
      } else {
        console.warn('[DocCategory] 未找到插入位置，使用 rpush 兜底');
        infoPipeline.rpush(projectId, newCategory.id);
      }

      infoPipeline.hmset(`${projectId}:${newCategory.id}`, {
        id: String(newCategory.id),
        name: newCategory.name,
        parent_id: String(newCategory.parent_id),
        project_id: String(newCategory.project_id),
        sort: String(newCategory.sort),
        icon: newCategory.icon || '',
        created_at: newCategory.created_at,
      });

      await infoPipeline.execAsync();

      // 5.4 构建 docCategoryChainCache 的 Pipeline
      const chainPipeline = docCategoryChainCache.pipeline();

      chainPipeline.hmset(`${projectId}:${newCategory.id}`, {
        chain: JSON.stringify(chain),
        depth: String(depth),
        ancestors: JSON.stringify(ancestors),
        children: '[]',
      });

      // 如果有父分类，更新父分类的 children 字段
      if (parentId !== 0) {
        const parentChain = await docCategoryChainCache.hgetAll(
          `${projectId}:${parentId}`,
        );
        let parentChildren: number[] = [];
        if (parentChain && parentChain.children) {
          try {
            parentChildren = JSON.parse(parentChain.children);
          } catch (e) {
            parentChildren = [];
          }
        }
        if (!parentChildren.includes(newCategory.id)) {
          parentChildren.push(newCategory.id);
        }
        chainPipeline.hset(
          `${projectId}:${parentId}`,
          'children',
          JSON.stringify(parentChildren),
        );
      }

      await chainPipeline.execAsync();
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
    // ========== 1. 获取当前分类信息 ==========
    let oldCategory: MockDocCategory | undefined;

    try {
      const mongoCategory = await docCategoryMongoCollection.findOne({ id });
      if (mongoCategory) {
        const { doc_count, children, ...cat } = mongoCategory as any;
        oldCategory = cat as MockDocCategory;
      }
    } catch (error) {
      console.warn('[DocCategory] MongoDB 获取旧分类信息失败，降级到 L1:', error);
    }

    if (!oldCategory) {
      try {
        oldCategory = await docCategoryTable.findById(id);
      } catch (error) {
        console.warn('[DocCategory] 获取旧分类信息失败:', error);
      }
    }

    if (!oldCategory) {
      throw new BusinessError('分类不存在', 404);
    }

    const projectIdStr = String(oldCategory.project_id);
    const oldParentId = oldCategory.parent_id;
    const newParentId =
      data.parent_id !== undefined ? data.parent_id : oldParentId;
    const parentChanged = newParentId !== oldParentId;
    const sortChanged = data.sort !== undefined && data.sort !== oldCategory.sort;

    // ========== 2. 构建更新数据（只更新提供的字段） ==========
    const updateData: Partial<MockDocCategory> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.parent_id !== undefined) updateData.parent_id = data.parent_id;
    if (data.sort !== undefined) updateData.sort = data.sort;
    if (data.icon !== undefined) updateData.icon = data.icon;

    // ========== 3. 更新分类（L1 主存储） ==========
    const updatedCategory = await docCategoryTable.updateById(id, updateData);
    if (!updatedCategory) {
      throw new BusinessError('分类更新失败', 500);
    }

    // ========== 4. 同步更新 MongoDB（L2） ==========
    try {
      await docCategoryMongoCollection.updateOne({ id }, { $set: updateData });
    } catch (error) {
      console.warn('[DocCategory] 更新 MongoDB 失败:', error);
    }

    // ========== 5. 精确更新 Redis 缓存（L3） ==========
    try {
      // 5.1 更新分类详情
      const infoPipeline = docCategoryInfoCache.pipeline();

      infoPipeline.hmset(`${projectIdStr}:${id}`, {
        id: String(updatedCategory.id),
        name: updatedCategory.name,
        parent_id: String(updatedCategory.parent_id),
        project_id: String(updatedCategory.project_id),
        sort: String(updatedCategory.sort),
        icon: updatedCategory.icon || '',
        created_at: updatedCategory.created_at,
      });

      // 5.2 如果 parent_id 或 sort 变更，更新排序索引
      if (parentChanged || sortChanged) {
        const currentOrder = await docCategoryOrderCache.lrange(
          projectIdStr,
          0,
          -1,
        );

        if (currentOrder && currentOrder.length > 0) {
          const allCategories = await this.getDocCategories(oldCategory.project_id);
          const sortedList = allCategories
            .filter((c) => c.id !== id)
            .concat([updatedCategory])
            .sort((a, b) => {
              if (a.parent_id !== b.parent_id) return a.parent_id - b.parent_id;
              return a.sort - b.sort;
            });

          infoPipeline.del(projectIdStr);
          const sortedIds = sortedList.map((c) => c.id);
          infoPipeline.rpush(projectIdStr, ...sortedIds);
        }
      }

      await infoPipeline.execAsync();

      // 5.3 如果 parent_id 变更，更新链路数据
      if (parentChanged) {
        const chainPipeline = docCategoryChainCache.pipeline();

        // 计算新的链路数据
        let newChain: number[] = [id];
        let newDepth = 0;
        let newAncestors: number[] = [];

        if (newParentId !== 0) {
          const allCategories = await this.getDocCategories(oldCategory.project_id);
          const parentCategory = allCategories.find((c) => c.id === newParentId);
          if (parentCategory) {
            const ancestorIds: number[] = [];
            let current = parentCategory;
            while (current && current.parent_id !== 0) {
              ancestorIds.unshift(current.parent_id);
              current = allCategories.find((c) => c.id === current!.parent_id)!;
            }
            ancestorIds.push(newParentId);
            newAncestors = ancestorIds;
            newChain = [...ancestorIds, id];
            newDepth = ancestorIds.length;
          }
        }

        chainPipeline.hmset(`${projectIdStr}:${id}`, {
          chain: JSON.stringify(newChain),
          depth: String(newDepth),
          ancestors: JSON.stringify(newAncestors),
        });

        // 从旧父分类的 children 中移除该分类 ID
        if (oldParentId !== 0) {
          const oldParentChain = await docCategoryChainCache.hgetAll(
            `${projectIdStr}:${oldParentId}`,
          );
          let oldParentChildren: number[] = [];
          if (oldParentChain && oldParentChain.children) {
            try {
              oldParentChildren = JSON.parse(oldParentChain.children);
            } catch (e) {
              oldParentChildren = [];
            }
          }
          oldParentChildren = oldParentChildren.filter(
            (childId) => childId !== id,
          );
          chainPipeline.hset(
            `${projectIdStr}:${oldParentId}`,
            'children',
            JSON.stringify(oldParentChildren),
          );
        }

        // 添加到新父分类的 children 中
        if (newParentId !== 0) {
          const newParentChain = await docCategoryChainCache.hgetAll(
            `${projectIdStr}:${newParentId}`,
          );
          let newParentChildren: number[] = [];
          if (newParentChain && newParentChain.children) {
            try {
              newParentChildren = JSON.parse(newParentChain.children);
            } catch (e) {
              newParentChildren = [];
            }
          }
          if (!newParentChildren.includes(id)) {
            newParentChildren.push(id);
          }
          chainPipeline.hset(
            `${projectIdStr}:${newParentId}`,
            'children',
            JSON.stringify(newParentChildren),
          );
        }

        await chainPipeline.execAsync();

        console.warn(
          '[DocCategory] parent_id 变更，后代分类的链路缓存将在下次查询时自动重建',
        );
      }
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
    // ========== 1. 检查分类是否存在 ==========
    let category: MockDocCategory | undefined;
    try {
      const mongoCategory = await docCategoryMongoCollection.findOne({ id });
      if (mongoCategory) {
        const { doc_count, children, ...cat } = mongoCategory as any;
        category = cat as MockDocCategory;
      }
    } catch (error) {
      console.warn('[DocCategory] MongoDB 获取分类失败，降级到 L1:', error);
    }

    if (!category) {
      category = await docCategoryTable.findById(id);
    }

    if (!category) {
      throw new BusinessError('分类不存在', 404);
    }

    const projectIdStr = String(category.project_id);
    const parentId = category.parent_id;

    // ========== 2. 检查是否有子分类 ==========
    let hasChildren = false;
    try {
      const chainData = await docCategoryChainCache.hgetAll(
        `${projectIdStr}:${id}`,
      );
      if (chainData && chainData.children) {
        const children = JSON.parse(chainData.children);
        hasChildren = Array.isArray(children) && children.length > 0;
      } else {
        const allCategories = await this.getDocCategories(category.project_id);
        hasChildren = allCategories.some((c) => c.parent_id === id);
      }
    } catch (error) {
      console.warn('[DocCategory] 检查子分类失败，降级到数据库查询:', error);
      const allCategories = await this.getDocCategories(category.project_id);
      hasChildren = allCategories.some((c) => c.parent_id === id);
    }

    if (hasChildren) {
      throw new BusinessError('该分类下存在子分类，请先删除子分类');
    }

    // ========== 3. 检查是否有文档 ==========
    let hasDocs = false;
    try {
      const docIds = await docCategoryDocsCache.smembers(`${projectIdStr}:${id}`);
      hasDocs = Array.isArray(docIds) && docIds.length > 0;
    } catch (error) {
      console.warn('[DocCategory] 检查文档失败，降级到数据库查询:', error);
      const allDocs = await docTable.findAll();
      hasDocs = allDocs.some((d) => d.doc_category_id === id);
    }

    if (hasDocs) {
      throw new BusinessError('该分类下存在文档，请先移动或删除文档');
    }

    // ========== 4. 删除分类（L1 主存储） ==========
    await docCategoryTable.deleteById(id);

    // ========== 5. 同步删除 MongoDB（L2） ==========
    try {
      await docCategoryMongoCollection.deleteOne({ id });
    } catch (error) {
      console.warn('[DocCategory] 删除 MongoDB 失败:', error);
    }

    // ========== 6. 精确更新 Redis 缓存（L3） ==========
    try {
      // 6.1 构建 docCategoryInfoCache 的 Pipeline
      const infoPipeline = docCategoryInfoCache.pipeline();

      infoPipeline.lrem(projectIdStr, 0, id);
      infoPipeline.del(`${projectIdStr}:${id}`);

      await infoPipeline.execAsync();

      // 6.2 构建 docCategoryChainCache 的 Pipeline
      const chainPipeline = docCategoryChainCache.pipeline();

      chainPipeline.del(`${projectIdStr}:${id}`);

      // 如果有父分类，从父分类的 children 中移除该分类 ID
      if (parentId !== 0) {
        const parentChain = await docCategoryChainCache.hgetAll(
          `${projectIdStr}:${parentId}`,
        );
        let parentChildren: number[] = [];
        if (parentChain && parentChain.children) {
          try {
            parentChildren = JSON.parse(parentChain.children);
          } catch (e) {
            parentChildren = [];
          }
        }
        parentChildren = parentChildren.filter((childId) => childId !== id);
        chainPipeline.hset(
          `${projectIdStr}:${parentId}`,
          'children',
          JSON.stringify(parentChildren),
        );
      }

      await chainPipeline.execAsync();

      // 6.3 删除分类下的文档 ID 集合
      try {
        await docCategoryDocsCache.del(`${projectIdStr}:${id}`);
      } catch (error) {
        console.warn('[DocCategory] 删除分类文档集合缓存失败:', error);
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
  async batchDeleteDocCategories(data: {
    ids: number[];
  }): Promise<null> {
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
