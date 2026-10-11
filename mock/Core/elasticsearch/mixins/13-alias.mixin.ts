/**
 * L4 高级功能层 - 别名管理 Mixin
 * 
 * 包含：创建别名、删除别名、获取别名、别名存在性检查、别名重命名、别名切换等
 */

import type { MixinConstructor } from './mixin.types';

/**
 * 别名管理 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithAlias<T extends MixinConstructor>(Base: T) {
  return class AliasMixin extends Base {
    // ==================== 创建别名 ====================

    /**
     * 创建别名
     * 
     * @param indexName 索引名
     * @param aliasName 别名
     * @param options 选项（路由、过滤器等）
     * @returns 是否成功
     */
    createAlias(
      indexName: string,
      aliasName: string,
      options: {
        is_write_index?: boolean;
        routing?: string;
        index_routing?: string;
        search_routing?: string;
        filter?: any;
      } = {},
    ): boolean {
      const index = (this as any).indices.get(indexName);
      if (!index) return false;

      if (!index.aliases) {
        index.aliases = new Map();
      }

      index.aliases.set(aliasName, {
        index: indexName,
        alias: aliasName,
        ...options,
      });

      // 同时维护全局别名映射
      if (!(this as any).aliasMap) {
        (this as any).aliasMap = new Map();
      }
      (this as any).aliasMap.set(aliasName, indexName);

      return true;
    }

    /**
     * 批量创建别名
     * 
     * @param aliases 别名列表
     * @returns 成功创建的数量
     */
    bulkCreateAliases(
      aliases: Array<{
        index: string;
        alias: string;
        is_write_index?: boolean;
        routing?: string;
        filter?: any;
      }>,
    ): number {
      let successCount = 0;
      for (const alias of aliases) {
        if (this.createAlias(alias.index, alias.alias, alias)) {
          successCount++;
        }
      }
      return successCount;
    }

    // ==================== 删除别名 ====================

    /**
     * 删除别名
     * 
     * @param indexName 索引名
     * @param aliasName 别名
     * @returns 是否成功
     */
    deleteAlias(indexName: string, aliasName: string): boolean {
      const index = (this as any).indices.get(indexName);
      if (!index || !index.aliases) return false;

      const deleted = index.aliases.delete(aliasName);

      // 同时更新全局别名映射
      if ((this as any).aliasMap) {
        (this as any).aliasMap.delete(aliasName);
      }

      return deleted;
    }

    /**
     * 删除索引的所有别名
     * 
     * @param indexName 索引名
     * @returns 删除的别名数量
     */
    deleteAllAliases(indexName: string): number {
      const index = (this as any).indices.get(indexName);
      if (!index || !index.aliases) return 0;

      const count = index.aliases.size;

      // 从全局别名映射中删除
      if ((this as any).aliasMap) {
        for (const aliasName of index.aliases.keys()) {
          (this as any).aliasMap.delete(aliasName);
        }
      }

      index.aliases.clear();
      return count;
    }

    // ==================== 获取别名 ====================

    /**
     * 获取索引的别名
     * 
     * @param indexName 索引名（可选，不指定则返回所有别名）
     * @returns 别名信息
     */
    getAliases(indexName?: string): Record<string, any> {
      const result: Record<string, any> = {};

      if (indexName) {
        const index = (this as any).indices.get(indexName);
        if (index && index.aliases) {
          for (const [aliasName, aliasInfo] of index.aliases) {
            result[aliasName] = {
              aliases: {
                [aliasName]: aliasInfo,
              },
            };
          }
        }
      } else {
        // 返回所有索引的别名
        for (const [idxName, index] of (this as any).indices) {
          if (index.aliases && index.aliases.size > 0) {
            const aliases: Record<string, any> = {};
            for (const [aliasName, aliasInfo] of index.aliases) {
              aliases[aliasName] = aliasInfo;
            }
            result[idxName] = { aliases };
          }
        }
      }

      return result;
    }

    /**
     * 获取别名对应的索引
     * 
     * @param aliasName 别名
     * @returns 索引名或 null
     */
    getAliasIndex(aliasName: string): string | null {
      if ((this as any).aliasMap) {
        return (this as any).aliasMap.get(aliasName) || null;
      }

      // 遍历所有索引查找
      for (const [indexName, index] of (this as any).indices) {
        if (index.aliases && index.aliases.has(aliasName)) {
          return indexName;
        }
      }

      return null;
    }

    /**
     * 获取别名的详细信息
     * 
     * @param aliasName 别名
     * @returns 别名信息或 null
     */
    getAliasInfo(aliasName: string): any | null {
      const indexName = this.getAliasIndex(aliasName);
      if (!indexName) return null;

      const index = (this as any).indices.get(indexName);
      if (!index || !index.aliases) return null;

      return index.aliases.get(aliasName) || null;
    }

    // ==================== 别名存在性检查 ====================

    /**
     * 检查别名是否存在
     * 
     * @param aliasName 别名
     * @returns 是否存在
     */
    aliasExists(aliasName: string): boolean {
      return this.getAliasIndex(aliasName) !== null;
    }

    /**
     * 检查索引是否有指定别名
     * 
     * @param indexName 索引名
     * @param aliasName 别名
     * @returns 是否有该别名
     */
    indexHasAlias(indexName: string, aliasName: string): boolean {
      const index = (this as any).indices.get(indexName);
      if (!index || !index.aliases) return false;
      return index.aliases.has(aliasName);
    }

    // ==================== 别名操作 ====================

    /**
     * 重命名别名
     * 
     * @param oldAliasName 旧别名
     * @param newAliasName 新别名
     * @returns 是否成功
     */
    renameAlias(oldAliasName: string, newAliasName: string): boolean {
      const indexName = this.getAliasIndex(oldAliasName);
      if (!indexName) return false;

      const aliasInfo = this.getAliasInfo(oldAliasName);
      if (!aliasInfo) return false;

      // 创建新别名
      this.createAlias(indexName, newAliasName, aliasInfo);

      // 删除旧别名
      this.deleteAlias(indexName, oldAliasName);

      return true;
    }

    /**
     * 切换别名（原子操作：从旧索引移除，添加到新索引）
     * 
     * @param aliasName 别名
     * @param oldIndexName 旧索引名
     * @param newIndexName 新索引名
     * @returns 是否成功
     */
    switchAlias(
      aliasName: string,
      oldIndexName: string,
      newIndexName: string,
    ): boolean {
      // 检查旧索引是否有该别名
      if (!this.indexHasAlias(oldIndexName, aliasName)) {
        return false;
      }

      // 获取别名信息
      const aliasInfo = this.getAliasInfo(aliasName);

      // 从旧索引删除
      this.deleteAlias(oldIndexName, aliasName);

      // 添加到新索引
      this.createAlias(newIndexName, aliasName, aliasInfo || {});

      return true;
    }

    /**
     * 批量更新别名（支持添加和删除）
     * 
     * @param actions 操作列表
     * @returns 操作结果
     */
    updateAliases(
      actions: Array<{
        add?: { index: string; alias: string; [key: string]: any };
        remove?: { index: string; alias: string };
        remove_index?: { index: string };
      }>,
    ): {
      acknowledged: boolean;
      actions: number;
    } {
      let actionCount = 0;

      for (const action of actions) {
        if (action.add) {
          const { index, alias, ...options } = action.add;
          if (this.createAlias(index, alias, options as any)) {
            actionCount++;
          }
        }
        if (action.remove) {
          if (this.deleteAlias(action.remove.index, action.remove.alias)) {
            actionCount++;
          }
        }
        if (action.remove_index) {
          // 删除索引及其所有别名
          this.deleteAllAliases(action.remove_index.index);
          if ((this as any).indices) {
            (this as any).indices.delete(action.remove_index.index);
          }
          actionCount++;
        }
      }

      return {
        acknowledged: true,
        actions: actionCount,
      };
    }

    // ==================== 别名解析 ====================

    /**
     * 解析索引名（如果是别名，返回对应的索引名）
     * 
     * @param indexName 索引名或别名
     * @returns 实际索引名
     */
    resolveIndexName(indexName: string): string {
      // 检查是否为别名
      const actualIndex = this.getAliasIndex(indexName);
      if (actualIndex) {
        return actualIndex;
      }
      return indexName;
    }

    /**
     * 解析多个索引名（支持通配符和别名）
     * 
     * @param indexNames 索引名列表（逗号分隔或数组）
     * @returns 实际索引名列表
     */
    resolveIndexNames(indexNames: string | string[]): string[] {
      const names = Array.isArray(indexNames) ? indexNames : indexNames.split(',');
      const resolved: string[] = [];

      for (const name of names) {
        const trimmed = name.trim();
        if (!trimmed) continue;

        // 处理通配符
        if (trimmed.includes('*')) {
          const pattern = new RegExp('^' + trimmed.replace(/\*/g, '.*') + '$');
          for (const indexName of (this as any).indices.keys()) {
            if (pattern.test(indexName)) {
              resolved.push(indexName);
            }
          }
        } else {
          // 解析别名
          const resolvedName = this.resolveIndexName(trimmed);
          if (!resolved.includes(resolvedName)) {
            resolved.push(resolvedName);
          }
        }
      }

      return resolved;
    }

    // ==================== 别名统计 ====================

    /**
     * 获取别名统计信息
     * 
     * @returns 统计信息
     */
    getAliasStats(): {
      total_aliases: number;
      total_indices_with_aliases: number;
      aliases_per_index: Record<string, number>;
    } {
      let totalAliases = 0;
      let totalIndicesWithAliases = 0;
      const aliasesPerIndex: Record<string, number> = {};

      for (const [indexName, index] of (this as any).indices) {
        if (index.aliases && index.aliases.size > 0) {
          totalAliases += index.aliases.size;
          totalIndicesWithAliases++;
          aliasesPerIndex[indexName] = index.aliases.size;
        }
      }

      return {
        total_aliases: totalAliases,
        total_indices_with_aliases: totalIndicesWithAliases,
        aliases_per_index: aliasesPerIndex,
      };
    }
  };
}
