/**
 * 21 - 外键约束 Mixin
 * 包含：addForeignKey、dropForeignKey、getForeignKeys、checkForeignKeysOnInsert、checkForeignKeysOnDelete
 */
import type { FlatItem } from '../types/base.types';
import type { ForeignKeyDefinition, ForeignKeyAction } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithForeignKey<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 添加外键约束 */
    addForeignKey(definition: ForeignKeyDefinition): void {
      (this as any).foreignKeys.set(definition.name, definition);
    }

    /** 删除外键约束 */
    dropForeignKey(name: string): boolean {
      return (this as any).foreignKeys.delete(name);
    }

    /** 获取所有外键约束 */
    getForeignKeys(): ForeignKeyDefinition[] {
      return Array.from((this as any).foreignKeys.values());
    }

    /** 检查外键约束（插入/更新前） */
    protected checkForeignKeysOnInsert(data: any): void {
      for (const [, fk] of (this as any).foreignKeys) {
        const value = data[fk.field];
        if (value == null) continue;
        const referencedTable = (this as any).tableRegistry?.get(fk.referencedTable);
        if (!referencedTable) continue;
        const exists = referencedTable.findById(value);
        if (!exists) throw new Error(`外键约束失败: ${fk.field}=${value} 在表 ${fk.referencedTable} 中不存在`);
      }
    }

    /** 检查外键约束（删除前） */
    protected checkForeignKeysOnDelete(item: any): void {
      for (const [, fk] of (this as any).foreignKeys) {
        if ((this as any).tableRegistry) {
          for (const [tableName, table] of (this as any).tableRegistry) {
            if (tableName === (this as any).getTableName()) continue;
            const referencingFks = table.getForeignKeys?.() || [];
            for (const refFk of referencingFks) {
              if (refFk.referencedTable === (this as any).getTableName() && refFk.referencedField === 'id') {
                const referencingItems = table.find({ [refFk.field]: item.id });
                if (referencingItems.length > 0) {
                  this.handleForeignKeyAction(fk.onDelete || 'RESTRICT', item, table, refFk);
                }
              }
            }
          }
        }
      }
    }

    /** 处理外键动作 */
    private handleForeignKeyAction(action: ForeignKeyAction, item: any, referencingTable: any, fk: ForeignKeyDefinition): void {
      switch (action) {
        case 'CASCADE': referencingTable.delete({ [fk.field]: item.id }); break;
        case 'SET NULL': referencingTable.update({ [fk.field]: item.id }, { [fk.field]: null }); break;
        case 'RESTRICT':
        case 'NO ACTION':
          throw new Error(`外键约束失败: 记录 ${item.id} 被表 ${referencingTable.getTableName()} 引用`);
        default: break;
      }
    }
  };
}
