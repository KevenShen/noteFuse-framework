// mock/Module/Quick/repository.ts
// 快捷操作数据访问层（Repository 模式）
// 职责：封装快捷分组、操作项、关联关系等存取细节
// 【数据分层】L1 MockTable（主存储）→ L3 Redis（三级缓存）

import {
  quickItemTable,
  quickGroupTable,
  quickGroupRelationTable,
  quickItemInfoCache,
  quickItemListCache,
  quickItemHotCache,
  quickGroupInfoCache,
  quickGroupListCache,
  quickGroupItemsCache,
  type MockQuickGroup,
  type MockQuickGroupRelation,
  type MockQuickItem,
} from '../../Entities/quick';

// ============================================================================
// 快捷操作数据访问类
// ============================================================================

class QuickRepository {
  // ==================== 快捷分组查询 ====================

  /**
   * 查询所有快捷分组
   * @returns 分组数组
   */
  async findAllGroups(): Promise<MockQuickGroup[]> {
    return quickGroupTable.findAll();
  }

  /**
   * 按 ID 查询快捷分组
   * @param id 分组 ID
   * @returns 分组对象
   */
  async findGroupById(id: number): Promise<MockQuickGroup | null> {
    const result = await quickGroupTable.findById(id);
    return result ?? null;
  }

  // ==================== 快捷分组写入 ====================

  /**
   * 创建快捷分组
   * @param data 分组数据
   * @returns 创建的分组
   */
  async createGroup(data: Partial<MockQuickGroup>): Promise<MockQuickGroup> {
    return quickGroupTable.create(data as MockQuickGroup);
  }

  /**
   * 更新快捷分组
   * @param id 分组 ID
   * @param data 更新数据
   * @returns 更新后的分组
   */
  async updateGroup(
    id: number,
    data: Partial<MockQuickGroup>,
  ): Promise<MockQuickGroup | null> {
    const result = await quickGroupTable.updateById(id, data);
    return result ?? null;
  }

  /**
   * 删除快捷分组
   * @param id 分组 ID
   */
  async deleteGroup(id: number): Promise<void> {
    await quickGroupTable.deleteById(id);
  }

  // ==================== 快捷操作项查询 ====================

  /**
   * 查询所有快捷操作项
   * @returns 操作项数组
   */
  async findAllItems(): Promise<MockQuickItem[]> {
    return quickItemTable.findAll();
  }

  /**
   * 按 ID 查询快捷操作项
   * @param id 操作项 ID
   * @returns 操作项对象
   */
  async findItemById(id: number): Promise<MockQuickItem | null> {
    const result = await quickItemTable.findById(id);
    return result ?? null;
  }

  // ==================== 快捷操作项写入 ====================

  /**
   * 创建快捷操作项
   * @param data 操作项数据
   * @returns 创建的操作项
   */
  async createItem(data: Partial<MockQuickItem>): Promise<MockQuickItem> {
    return quickItemTable.create(data as MockQuickItem);
  }

  /**
   * 更新快捷操作项
   * @param id 操作项 ID
   * @param data 更新数据
   * @returns 更新后的操作项
   */
  async updateItem(
    id: number,
    data: Partial<MockQuickItem>,
  ): Promise<MockQuickItem | null> {
    const result = await quickItemTable.updateById(id, data);
    return result ?? null;
  }

  /**
   * 删除快捷操作项
   * @param id 操作项 ID
   */
  async deleteItem(id: number): Promise<void> {
    await quickItemTable.deleteById(id);
  }

  // ==================== 分组关联查询 ====================

  /**
   * 查询所有分组关联
   * @returns 关联数组
   */
  async findAllRelations(): Promise<MockQuickGroupRelation[]> {
    return quickGroupRelationTable.findAll();
  }

  // ==================== 分组关联写入 ====================

  /**
   * 创建分组关联
   * @param data 关联数据
   * @returns 创建的关联
   */
  async createRelation(data: Partial<MockQuickGroupRelation>): Promise<MockQuickGroupRelation> {
    return quickGroupRelationTable.create(data as MockQuickGroupRelation);
  }

  /**
   * 删除分组关联
   * @param id 关联 ID
   */
  async deleteRelation(id: number): Promise<void> {
    await quickGroupRelationTable.deleteById(id);
  }

  // ==================== Redis 缓存操作 ====================

  /**
   * 清除分组列表缓存
   * @param userId 用户 ID
   */
  async clearGroupListCache(userId: number): Promise<void> {
    try {
      await quickGroupListCache.del(String(userId));
    } catch (error) {
      console.warn('[QuickRepository] 清除分组列表缓存失败:', error);
    }
  }

  /**
   * 清除分组详情缓存
   * @param groupId 分组 ID
   */
  async clearGroupInfoCache(groupId: number): Promise<void> {
    try {
      await quickGroupInfoCache.del(String(groupId));
    } catch (error) {
      console.warn('[QuickRepository] 清除分组详情缓存失败:', error);
    }
  }

  /**
   * 清除分组下操作项缓存
   * @param groupId 分组 ID
   */
  async clearGroupItemsCache(groupId: number): Promise<void> {
    try {
      await quickGroupItemsCache.del(String(groupId));
    } catch (error) {
      console.warn('[QuickRepository] 清除分组下操作项缓存失败:', error);
    }
  }

  /**
   * 清除操作项列表缓存
   * @param userId 用户 ID
   */
  async clearItemListCache(userId: number): Promise<void> {
    try {
      await quickItemListCache.del(String(userId));
    } catch (error) {
      console.warn('[QuickRepository] 清除操作项列表缓存失败:', error);
    }
  }

  /**
   * 清除操作项详情缓存
   * @param itemId 操作项 ID
   */
  async clearItemInfoCache(itemId: number): Promise<void> {
    try {
      await quickItemInfoCache.del(String(itemId));
    } catch (error) {
      console.warn('[QuickRepository] 清除操作项详情缓存失败:', error);
    }
  }

  /**
   * 清除热门操作项缓存
   * @param type 操作类型
   */
  async clearItemHotCache(type: string): Promise<void> {
    try {
      await quickItemHotCache.del(type);
    } catch (error) {
      console.warn('[QuickRepository] 清除热门操作项缓存失败:', error);
    }
  }

  /**
   * 清空所有分组列表缓存
   */
  async flushGroupListCache(): Promise<void> {
    try {
      await quickGroupListCache.flushAll();
    } catch (error) {
      console.warn('[QuickRepository] 清空分组列表缓存失败:', error);
    }
  }
}

// ============================================================================
// 导出 Repository 实例
// ============================================================================

export const quickRepository = new QuickRepository();
