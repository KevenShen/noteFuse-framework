/**
 * MockTable 全局实例与工厂函数（系统通用）
 * 
 * 提供便捷的表创建和管理功能
 * 示例数据和示例表请参考 example.ts
 */

import type { FlatItem } from './types';
import { MockTable } from './MockTable';

/**
 * 创建 MockTable 实例的工厂函数
 *
 * @param config 表配置（支持所有扩展配置：timestamps/softDelete/tree/indexes/async等）
 * @returns MockTable 实例（配置 async: true 时所有方法返回 Promise）
 *
 * @example
 * ```typescript
 * // 同步模式
 * const userTable = createTable<User>({
 *   name: 'users',
 *   initialData: [],
 * });
 *
 * // 异步模式
 * const asyncUserTable = createTable<User>({
 *   name: 'users',
 *   initialData: [],
 *   async: true,
 *   asyncConfig: { minDelay: 5, maxDelay: 20, delayMode: 'random' },
 * });
 * const user = await asyncUserTable.findById(1);
 * ```
 */
export function createTable<T extends FlatItem = any>(
  config: any
): MockTable<T> {
  return MockTable.create<T>(config);
}

/**
 * 数据库管理器
 * 管理多个表，提供表的注册、获取、删除等功能
 * 
 * @example
 * ```typescript
 * const db = new DatabaseManager();
 * const userTable = db.createTable('users', { initialData: [] });
 * const table = db.getTable('users');
 * ```
 */
export class DatabaseManager {
  private tables: Map<string, MockTable<any>> = new Map();

  /**
   * 创建并注册表
   *
   * @param name 表名
   * @param config 表配置
   * @returns MockTable 实例
   */
  createTable<T extends FlatItem = any>(
    name: string,
    config: any
  ): MockTable<T> {
    const table = MockTable.create<T>({ ...config, name });
    this.tables.set(name, table);
    return table;
  }

  /**
   * 获取已注册的表
   * 
   * @param name 表名
   * @returns MockTable 实例
   */
  getTable<T extends FlatItem = any>(name: string): MockTable<T> | undefined {
    return this.tables.get(name);
  }

  /**
   * 检查表是否存在
   * 
   * @param name 表名
   * @returns 是否存在
   */
  hasTable(name: string): boolean {
    return this.tables.has(name);
  }

  /**
   * 删除表
   * 
   * @param name 表名
   * @returns 是否删除成功
   */
  dropTable(name: string): boolean {
    return this.tables.delete(name);
  }

  /**
   * 获取所有表名
   * 
   * @returns 表名列表
   */
  listTables(): string[] {
    return Array.from(this.tables.keys());
  }

  /**
   * 获取数据库统计信息
   * 
   * @returns 统计信息
   */
  getStats(): {
    tableCount: number;
    tables: Array<{
      name: string;
      rowCount: number;
    }>;
  } {
    const tables = Array.from(this.tables.entries()).map(([name, table]) => ({
      name,
      rowCount: (table as any).count?.() || 0,
    }));

    return {
      tableCount: this.tables.size,
      tables,
    };
  }

  /**
   * 清空所有表
   */
  clearAll(): void {
    this.tables.forEach((table) => {
      (table as any).clear?.();
    });
    this.tables.clear();
  }
}

/**
 * 全局数据库管理器实例（单例模式）
 * 
 * @example
 * ```typescript
 * import { db } from '@/mock/Core/database';
 * 
 * // 创建表
 * db.createTable('users', { initialData: [] });
 * 
 * // 获取表
 * const userTable = db.getTable('users');
 * ```
 */
export const db = new DatabaseManager();

/**
 * 便捷函数：创建并注册一个表到全局数据库管理器
 * 
 * @param name 表名
 * @param config 表配置
 * @returns MockTable 实例
 * 
 * @example
 * ```typescript
 * const userTable = registerTable('users', { initialData: [] });
 * ```
 */
export function registerTable<T extends FlatItem = any>(
  name: string,
  config: any
): MockTable<T> {
  return db.createTable(name, config);
}

/**
 * 便捷函数：从全局数据库管理器获取表
 * 
 * @param name 表名
 * @returns MockTable 实例
 * 
 * @example
 * ```typescript
 * const userTable = getTable('users');
 * if (userTable) {
 *   const users = (userTable as any).find();
 * }
 * ```
 */
export function getTable<T extends FlatItem = any>(name: string): MockTable<T> | undefined {
  return db.getTable<T>(name);
}
