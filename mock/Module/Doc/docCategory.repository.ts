// mock/Module/Doc/docCategory.repository.ts
// 文档分类数据访问层（Repository 模式）
// 职责：封装分类、文档、文集等存取细节
// 【数据分层】L1 MockTable（主存储）→ L2 MongoDB（二级缓存）→ L3 Redis（三级缓存）

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

// ============================================================================
// 文档分类数据访问类
// ============================================================================

class DocCategoryRepository {
  // ==================== 分类查询（三级降级：MongoDB → Redis → MockTable） ====================

  /**
   * 查询文集下的所有分类（三级降级：MongoDB → Redis → MockTable）
   * @param projectId 文集 ID
   * @returns 分类列表（已按 parent_id + sort 排序）
   */
  async findByProjectId(projectId: number): Promise<MockDocCategory[]> {
    // L2：MongoDB
    try {
      const mongoCategories = await docCategoryMongoCollection
        .find({ project_id: projectId })
        .sort({ parent_id: 1, sort: 1 })
        .toArray();
      if (mongoCategories && mongoCategories.length > 0) {
        return mongoCategories.map(({ doc_count, children, ...cat }) => cat) as MockDocCategory[];
      }
    } catch {
      // MongoDB 失败，降级到 Redis
    }

    // L3：Redis 缓存
    try {
      const categoryIds = await docCategoryOrderCache.lrange(
        String(projectId),
        0,
        -1,
      );
      if (categoryIds && categoryIds.length > 0) {
        const pipeline = docCategoryInfoCache.pipeline();
        for (const id of categoryIds) {
          pipeline.hgetAll(`${projectId}:${id}`);
        }
        const results = await pipeline.execAsync();

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
            } as MockDocCategory);
          }
        }

        if (categories.length > 0) {
          return categories;
        }
      }
    } catch {
      // Redis 失败，降级到 MockTable
    }

    // L1：MockTable
    const allCategories = await docCategoryTable.findAll();
    const result = allCategories
      .filter((c) => c.project_id === projectId)
      .sort((a, b) => {
        if (a.parent_id !== b.parent_id) return a.parent_id - b.parent_id;
        return a.sort - b.sort;
      });

    // 异步写入 Redis 缓存
    if (result.length > 0) {
      try {
        const pipeline = docCategoryInfoCache.pipeline();
        pipeline.del(String(projectId));
        pipeline.rpush(String(projectId), ...result.map((c) => c.id));

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
        console.warn('[DocCategoryRepository] 写入 Redis 缓存失败:', error);
      }
    }

    return result;
  }

  /**
   * 按 ID 查询分类（三级降级：MongoDB → MockTable）
   * @param id 分类 ID
   * @returns 分类对象
   */
  async findById(id: number): Promise<MockDocCategory | null> {
    // L2：MongoDB
    try {
      const mongoCategory = await docCategoryMongoCollection.findOne({ id });
      if (mongoCategory) {
        const { doc_count, children, ...cat } = mongoCategory as any;
        return cat as MockDocCategory;
      }
    } catch {
      // MongoDB 失败，降级到 MockTable
    }

    // L1：MockTable
    const result = await docCategoryTable.findById(id);
    return result ?? null;
  }

  /**
   * 查询所有分类（跨文集）
   * @param options 可选筛选参数
   * @returns 分类数组
   */
  async findAll(options?: { project_id?: number }): Promise<MockDocCategory[]> {
    let allCategories: MockDocCategory[] = [];

    // L2：MongoDB
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
    } catch {
      // MongoDB 失败，降级到 MockTable
    }

    // L1：MockTable
    if (allCategories.length === 0) {
      allCategories = await docCategoryTable.findAll();
      if (options?.project_id) {
        allCategories = allCategories.filter(
          (c) => c.project_id === options!.project_id,
        );
      }
    }

    return allCategories;
  }

  // ==================== 分类写入（双写：MockTable + MongoDB） ====================

  /**
   * 创建分类（MockTable + MongoDB 双写）
   * @param data 分类数据
   * @returns 创建的分类
   */
  async create(data: Partial<MockDocCategory>): Promise<MockDocCategory> {
    const newCategory = await docCategoryTable.create(data as MockDocCategory);

    try {
      await docCategoryMongoCollection.insertOne({
        ...newCategory,
        doc_count: 0,
        children: [],
      });
    } catch (error) {
      console.warn('[DocCategoryRepository] 创建分类 MongoDB 失败:', error);
    }

    return newCategory;
  }

  /**
   * 更新分类（MockTable + MongoDB 双写）
   * @param id 分类 ID
   * @param data 更新数据
   * @returns 更新后的分类
   */
  async update(
    id: number,
    data: Partial<MockDocCategory>,
  ): Promise<MockDocCategory | null> {
    const updatedCategory = await docCategoryTable.updateById(id, data);

    try {
      await docCategoryMongoCollection.updateOne({ id }, { $set: data });
    } catch (error) {
      console.warn('[DocCategoryRepository] 更新分类 MongoDB 失败:', error);
    }

    return updatedCategory ?? null;
  }

  /**
   * 删除分类（MockTable + MongoDB 双删）
   * @param id 分类 ID
   */
  async delete(id: number): Promise<void> {
    await docCategoryTable.deleteById(id);

    try {
      await docCategoryMongoCollection.deleteOne({ id });
    } catch (error) {
      console.warn('[DocCategoryRepository] 删除分类 MongoDB 失败:', error);
    }
  }

  // ==================== Redis 缓存操作 ====================

  /**
   * 获取排序索引中的分类 ID 列表
   * @param projectId 文集 ID
   * @returns 分类 ID 数组
   */
  async getOrderList(projectId: number): Promise<number[]> {
    const ids = await docCategoryOrderCache.lrange(String(projectId), 0, -1);
    return (ids as number[]) || [];
  }

  /**
   * 写入排序索引
   * @param projectId 文集 ID
   * @param ids 分类 ID 数组
   */
  async setOrderList(projectId: number, ids: number[]): Promise<void> {
    const pipeline = docCategoryOrderCache.pipeline();
    pipeline.del(String(projectId));
    pipeline.rpush(String(projectId), ...ids);
    await pipeline.execAsync();
  }

  /**
   * 从排序索引中删除指定分类 ID
   * @param projectId 文集 ID
   * @param id 分类 ID
   */
  async removeFromOrderList(projectId: number, id: number): Promise<void> {
    await docCategoryOrderCache.lrem(String(projectId), 0, id);
  }

  /**
   * 获取分类详情缓存
   * @param projectId 文集 ID
   * @param id 分类 ID
   * @returns 分类详情 Hash
   */
  async getCategoryInfo(projectId: number, id: number): Promise<Record<string, string> | null> {
    return docCategoryInfoCache.hgetAll(`${projectId}:${id}`);
  }

  /**
   * 写入分类详情缓存
   * @param projectId 文集 ID
   * @param category 分类对象
   */
  async setCategoryInfo(projectId: number, category: MockDocCategory): Promise<void> {
    await docCategoryInfoCache.hmset(`${projectId}:${category.id}`, {
      id: String(category.id),
      name: category.name,
      parent_id: String(category.parent_id),
      project_id: String(category.project_id),
      sort: String(category.sort),
      icon: category.icon || '',
      created_at: category.created_at,
    });
  }

  /**
   * 删除分类详情缓存
   * @param projectId 文集 ID
   * @param id 分类 ID
   */
  async deleteCategoryInfo(projectId: number, id: number): Promise<void> {
    await docCategoryInfoCache.del(`${projectId}:${id}`);
  }

  /**
   * 获取分类链路数据
   * @param projectId 文集 ID
   * @param id 分类 ID
   * @returns 链路数据 Hash
   */
  async getChain(projectId: number, id: number): Promise<Record<string, string> | null> {
    return docCategoryChainCache.hgetAll(`${projectId}:${id}`);
  }

  /**
   * 写入分类链路数据
   * @param projectId 文集 ID
   * @param id 分类 ID
   * @param chainData 链路数据
   */
  async setChain(
    projectId: number,
    id: number,
    chainData: { chain: number[]; depth: number; ancestors: number[]; children: number[] },
  ): Promise<void> {
    await docCategoryChainCache.hmset(`${projectId}:${id}`, {
      chain: JSON.stringify(chainData.chain),
      depth: String(chainData.depth),
      ancestors: JSON.stringify(chainData.ancestors),
      children: JSON.stringify(chainData.children),
    });
  }

  /**
   * 删除分类链路数据
   * @param projectId 文集 ID
   * @param id 分类 ID
   */
  async deleteChain(projectId: number, id: number): Promise<void> {
    await docCategoryChainCache.del(`${projectId}:${id}`);
  }

  /**
   * 更新父分类的 children 字段
   * @param projectId 文集 ID
   * @param parentId 父分类 ID
   * @param children 子分类 ID 数组
   */
  async setParentChildren(projectId: number, parentId: number, children: number[]): Promise<void> {
    await docCategoryChainCache.hset(
      `${projectId}:${parentId}`,
      'children',
      JSON.stringify(children),
    );
  }

  /**
   * 获取分类下的文档 ID 集合
   * @param projectId 文集 ID
   * @param categoryId 分类 ID
   * @returns 文档 ID 数组
   */
  async getDocIdsByCategoryId(projectId: number, categoryId: number): Promise<string[]> {
    try {
      const docIds = await docCategoryDocsCache.smembers(`${projectId}:${categoryId}`);
      return docIds || [];
    } catch {
      return [];
    }
  }

  /**
   * 删除分类的文档 ID 集合缓存
   * @param projectId 文集 ID
   * @param categoryId 分类 ID
   */
  async deleteDocIdsCache(projectId: number, categoryId: number): Promise<void> {
    try {
      await docCategoryDocsCache.del(`${projectId}:${categoryId}`);
    } catch (error) {
      console.warn('[DocCategoryRepository] 删除文档集合缓存失败:', error);
    }
  }

  // ==================== 文档查询 ====================

  /**
   * 统计分类下的文档数量
   * @param categoryId 分类 ID
   * @returns 文档数量
   */
  async countDocsByCategoryId(categoryId: number): Promise<number> {
    const allDocs = await docTable.findAll();
    return allDocs.filter((d) => d.doc_category_id === categoryId).length;
  }

  /**
   * 查询所有文档
   * @returns 文档数组
   */
  async findAllDocs(): Promise<any[]> {
    return docTable.findAll();
  }

  // ==================== 文集查询 ====================

  /**
   * 检查文集是否存在（三级降级：MongoDB → MockTable）
   * @param projectId 文集 ID
   * @returns 是否存在
   */
  async projectExists(projectId: number): Promise<boolean> {
    try {
      const project = await projectMongoCollection.findOne({ id: projectId });
      return !!project;
    } catch {
      // MongoDB 失败，降级到 MockTable
    }
    const project = await projectTable.findById(projectId);
    return !!project;
  }
}

// ============================================================================
// 导出 Repository 实例
// ============================================================================

export const docCategoryRepository = new DocCategoryRepository();
