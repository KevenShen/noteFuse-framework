// mock/Module/Collect/repository.ts
// 收藏数据访问层（Repository 模式）
// 职责：封装收藏、分组、关联查询等存取细节
// 【数据分层】L1 MockTable（主存储）→ L3 Redis（三级缓存）

import {
  docTable,
  docVersionTable,
} from '../../Entities/doc';
import {
  projectCategoryTable,
  projectTable,
} from '../../Entities/project';
import {
  collectGroupTable,
  collectTable,
  collectGroupInfoCache,
  collectGroupListCache,
  collectInfoCache,
  collectListCache,
  collectByTargetCache,
  collectCountCache,
  type MockCollect,
  type MockCollectGroup,
} from '../../Entities/collect';

// ============================================================================
// 收藏数据访问类
// ============================================================================

class CollectRepository {
  // ==================== 收藏分组查询 ====================

  /**
   * 查询所有收藏分组
   * @returns 分组数组
   */
  async findAllGroups(): Promise<MockCollectGroup[]> {
    return collectGroupTable.findAll();
  }

  /**
   * 按 ID 查询收藏分组
   * @param id 分组 ID
   * @returns 分组对象
   */
  async findGroupById(id: number): Promise<MockCollectGroup | null> {
    const result = await collectGroupTable.findById(id);
    return result ?? null;
  }

  // ==================== 收藏分组写入 ====================

  /**
   * 创建收藏分组
   * @param data 分组数据
   * @returns 创建的分组
   */
  async createGroup(data: Partial<MockCollectGroup>): Promise<MockCollectGroup> {
    return collectGroupTable.create(data as MockCollectGroup);
  }

  /**
   * 更新收藏分组
   * @param id 分组 ID
   * @param data 更新数据
   * @returns 更新后的分组
   */
  async updateGroup(
    id: number,
    data: Partial<MockCollectGroup>,
  ): Promise<MockCollectGroup | null> {
    const result = await collectGroupTable.updateById(id, data);
    return result ?? null;
  }

  /**
   * 删除收藏分组
   * @param id 分组 ID
   */
  async deleteGroup(id: number): Promise<void> {
    await collectGroupTable.deleteById(id);
  }

  // ==================== 收藏记录查询 ====================

  /**
   * 查询所有收藏记录
   * @returns 收藏数组
   */
  async findAllCollects(): Promise<MockCollect[]> {
    return collectTable.findAll();
  }

  /**
   * 按 ID 查询收藏记录
   * @param id 收藏 ID
   * @returns 收藏对象
   */
  async findCollectById(id: number): Promise<MockCollect | null> {
    const result = await collectTable.findById(id);
    return result ?? null;
  }

  // ==================== 收藏记录写入 ====================

  /**
   * 创建收藏记录
   * @param data 收藏数据
   * @returns 创建的收藏
   */
  async createCollect(data: Partial<MockCollect>): Promise<MockCollect> {
    return collectTable.create(data as MockCollect);
  }

  /**
   * 更新收藏记录
   * @param id 收藏 ID
   * @param data 更新数据
   * @returns 更新后的收藏
   */
  async updateCollect(
    id: number,
    data: Partial<MockCollect>,
  ): Promise<MockCollect | null> {
    const result = await collectTable.updateById(id, data);
    return result ?? null;
  }

  /**
   * 删除收藏记录
   * @param id 收藏 ID
   */
  async deleteCollect(id: number): Promise<void> {
    await collectTable.deleteById(id);
  }

  // ==================== 关联查询 ====================

  /**
   * 查询所有文档
   * @returns 文档数组
   */
  async findAllDocs(): Promise<any[]> {
    return docTable.findAll();
  }

  /**
   * 按 ID 查询文档
   * @param id 文档 ID
   * @returns 文档对象
   */
  async findDocById(id: number): Promise<any> {
    return docTable.findById(id);
  }

  /**
   * 查询所有文档版本
   * @returns 版本数组
   */
  async findAllVersions(): Promise<any[]> {
    return docVersionTable.findAll();
  }

  /**
   * 查询所有文集
   * @returns 文集数组
   */
  async findAllProjects(): Promise<any[]> {
    return projectTable.findAll();
  }

  /**
   * 按 ID 查询文集
   * @param id 文集 ID
   * @returns 文集对象
   */
  async findProjectById(id: number): Promise<any> {
    return projectTable.findById(id);
  }

  /**
   * 查询所有项目分类
   * @returns 分类数组
   */
  async findAllProjectCategories(): Promise<any[]> {
    return projectCategoryTable.findAll();
  }

  // ==================== Redis 缓存操作 ====================

  /**
   * 清除分组列表缓存
   * @param userId 用户 ID
   * @param type 收藏类型
   */
  async clearGroupListCache(userId: number, type: string): Promise<void> {
    try {
      await collectGroupListCache.del(`${userId}:${type}`);
    } catch (error) {
      console.warn('[CollectRepository] 清除分组列表缓存失败:', error);
    }
  }

  /**
   * 清除分组详情缓存
   * @param groupId 分组 ID
   */
  async clearGroupInfoCache(groupId: number): Promise<void> {
    try {
      await collectGroupInfoCache.del(String(groupId));
    } catch (error) {
      console.warn('[CollectRepository] 清除分组详情缓存失败:', error);
    }
  }

  /**
   * 清除收藏列表缓存
   * @param userId 用户 ID
   * @param type 收藏类型
   * @param groupId 分组 ID
   */
  async clearCollectListCache(userId: number, type: string, groupId: number): Promise<void> {
    try {
      await collectListCache.del(`${userId}:${type}:${groupId}`);
    } catch (error) {
      console.warn('[CollectRepository] 清除收藏列表缓存失败:', error);
    }
  }

  /**
   * 清除收藏详情缓存
   * @param collectId 收藏 ID
   */
  async clearCollectInfoCache(collectId: number): Promise<void> {
    try {
      await collectInfoCache.del(String(collectId));
    } catch (error) {
      console.warn('[CollectRepository] 清除收藏详情缓存失败:', error);
    }
  }

  /**
   * 清除按目标查询缓存
   * @param userId 用户 ID
   * @param type 收藏类型
   * @param targetId 目标 ID
   */
  async clearCollectByTargetCache(userId: number, type: string, targetId: number): Promise<void> {
    try {
      await collectByTargetCache.del(`${userId}:${type}:${targetId}`);
    } catch (error) {
      console.warn('[CollectRepository] 清除按目标查询缓存失败:', error);
    }
  }

  /**
   * 清除分组数量缓存
   * @param groupId 分组 ID
   */
  async clearCollectCountCache(groupId: number): Promise<void> {
    try {
      await collectCountCache.del(String(groupId));
    } catch (error) {
      console.warn('[CollectRepository] 清除分组数量缓存失败:', error);
    }
  }
}

// ============================================================================
// 导出 Repository 实例
// ============================================================================

export const collectRepository = new CollectRepository();
