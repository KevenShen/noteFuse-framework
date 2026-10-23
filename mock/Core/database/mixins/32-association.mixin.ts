/**
 * 32 - 关联关系 Mixin（Sequelize 风格）
 * 包含：hasOne / hasMany / belongsTo / belongsToMany / getAssociation / setAssociation / include 支持
 *
 * 【使用示例】
 * // 定义关联
 * categoryTable.hasMany(projectTable, { foreignKey: 'project_category_id', as: 'projects' });
 * projectTable.belongsTo(categoryTable, { foreignKey: 'project_category_id', as: 'category' });
 *
 * // 查询时包含关联
 * categoryTable.findById(1, { include: ['projects'] });
 * categoryTable.findAll({ include: ['projects'] });
 *
 * // 手动获取/设置关联
 * categoryTable.getAssociation(1, 'projects');
 * categoryTable.setAssociation(1, 'projects', [101, 102]);
 */
import type { AssociationConfig, IncludeOption } from '../types/association.types';
import type { MixinConstructor } from './mixin.types';

export function WithAssociation<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 关联关系存储 { alias: AssociationConfig } */
    associations: Map<string, AssociationConfig> = new Map();

    // ==================== 关联定义 ====================

    /**
     * 定义一对一关联（源表有一个目标表记录）
     * 外键在目标表中
     */
    hasOne(target: any, options: { foreignKey: string; as: string }): void {
      this.associations.set(options.as, {
        type: 'hasOne',
        target,
        foreignKey: options.foreignKey,
        as: options.as,
      });
    }

    /**
     * 定义一对多关联（源表有多个目标表记录）
     * 外键在目标表中
     */
    hasMany(target: any, options: { foreignKey: string; as: string }): void {
      this.associations.set(options.as, {
        type: 'hasMany',
        target,
        foreignKey: options.foreignKey,
        as: options.as,
      });
    }

    /**
     * 定义多对一关联（源表属于一个目标表记录）
     * 外键在源表中
     */
    belongsTo(target: any, options: { foreignKey: string; as: string }): void {
      this.associations.set(options.as, {
        type: 'belongsTo',
        target,
        foreignKey: options.foreignKey,
        as: options.as,
      });
    }

    /**
     * 定义多对多关联（通过中间表）
     */
    belongsToMany(
      target: any,
      options: {
        foreignKey: string;
        as: string;
        through: any;
        sourceKey?: string;
        targetKey?: string;
      },
    ): void {
      this.associations.set(options.as, {
        type: 'belongsToMany',
        target,
        foreignKey: options.foreignKey,
        as: options.as,
        through: options.through,
        sourceKey: options.sourceKey || 'id',
        targetKey: options.targetKey || 'id',
      });
    }

    // ==================== 关联查询 ====================

    /**
     * 获取关联数据
     * @param sourceId 源记录 ID
     * @param alias 关联别名
     * @returns 关联数据（单个对象或数组）
     */
    getAssociation(sourceId: number | string, alias: string): any {
      const config = this.associations.get(alias);
      if (!config) {
        throw new Error(`关联 "${alias}" 未定义`);
      }

      const { type, target, foreignKey, through, sourceKey, targetKey } = config;

      switch (type) {
        case 'hasOne': {
          // 外键在目标表：target.foreignKey = sourceId
          return target.findOne({ [foreignKey]: sourceId });
        }
        case 'hasMany': {
          // 外键在目标表：target.foreignKey = sourceId
          return target.find({ [foreignKey]: sourceId });
        }
        case 'belongsTo': {
          // 外键在源表：先查源记录，再用外键查目标
          const source = (this as any).findById(sourceId);
          if (!source) return null;
          return target.findById(source[foreignKey]);
        }
        case 'belongsToMany': {
          // 通过中间表查询
          if (!through) throw new Error(`多对多关联 "${alias}" 缺少中间表`);
          const sourceField = sourceKey || 'id';
          const targetField = targetKey || 'id';
          // 查中间表：找到所有关联记录
          const links = through.find({ [foreignKey]: sourceId });
          const targetIds = links.map((link: any) => link[targetField]);
          return target.find({ id: { $in: targetIds } });
        }
        default:
          return null;
      }
    }

    /**
     * 设置关联数据
     * @param sourceId 源记录 ID
     * @param alias 关联别名
     * @param value 关联值（单个 ID、ID 数组、或目标记录）
     */
    setAssociation(
      sourceId: number | string,
      alias: string,
      value: any,
    ): void {
      const config = this.associations.get(alias);
      if (!config) {
        throw new Error(`关联 "${alias}" 未定义`);
      }

      const { type, target, foreignKey, through, sourceKey, targetKey } = config;

      switch (type) {
        case 'hasOne': {
          // 外键在目标表：更新目标记录的外键
          const targetId = typeof value === 'object' ? value.id : value;
          target.update({ id: targetId }, { [foreignKey]: sourceId });
          break;
        }
        case 'hasMany': {
          // 外键在目标表：先清空旧关联，再设置新关联
          const targetIds = Array.isArray(value)
            ? value.map((v: any) => (typeof v === 'object' ? v.id : v))
            : [typeof value === 'object' ? value.id : value];
          // 清空旧关联
          target.update({ [foreignKey]: sourceId }, { [foreignKey]: null });
          // 设置新关联
          for (const tid of targetIds) {
            target.update({ id: tid }, { [foreignKey]: sourceId });
          }
          break;
        }
        case 'belongsTo': {
          // 外键在源表：更新源记录的外键
          const targetId = typeof value === 'object' ? value.id : value;
          (this as any).update({ id: sourceId }, { [foreignKey]: targetId });
          break;
        }
        case 'belongsToMany': {
          // 通过中间表：先删除旧关联，再插入新关联
          if (!through) throw new Error(`多对多关联 "${alias}" 缺少中间表`);
          const sourceField = sourceKey || 'id';
          const targetField = targetKey || 'id';
          const targetIds = Array.isArray(value)
            ? value.map((v: any) => (typeof v === 'object' ? v.id : v))
            : [typeof value === 'object' ? value.id : value];
          // 删除旧关联
          through.delete({ [foreignKey]: sourceId });
          // 插入新关联
          for (const tid of targetIds) {
            through.create({ [foreignKey]: sourceId, [targetField]: tid });
          }
          break;
        }
      }
    }

    // ==================== Include 支持 ====================

    /**
     * 为查询结果应用 include 选项（加载关联数据）
     * @param result 单条记录或记录数组
     * @param include include 选项
     * @returns 加载关联后的结果
     */
    applyInclude(result: any, include: IncludeOption[]): any {
      if (!include || include.length === 0) return result;

      const loadAssociations = (item: any): any => {
        if (!item || typeof item !== 'object') return item;
        const enriched = { ...item };
        for (const inc of include) {
          const alias = typeof inc === 'string' ? inc : inc.association;
          const config = this.associations.get(alias);
          if (!config) continue;

          const associated = this.getAssociation(item.id, alias);
          enriched[alias] = associated;

          // 嵌套 include
          if (typeof inc === 'object' && inc.include && config.target) {
            if (Array.isArray(associated)) {
              enriched[alias] = associated.map((a: any) =>
                config.target.applyInclude(a, inc.include!),
              );
            } else if (associated) {
              enriched[alias] = config.target.applyInclude(
                associated,
                inc.include!,
              );
            }
          }
        }
        return enriched;
      };

      if (Array.isArray(result)) {
        return result.map(loadAssociations);
      }
      return loadAssociations(result);
    }

    // ==================== 重写查询方法（支持 include） ====================

    /** 根据 ID 查找（支持 include） */
    findById(id: number | string, options?: any): any | undefined {
      const result = super.findById(id, options);
      if (!result || !options?.include) return result;
      return this.applyInclude(result, options.include);
    }

    /** 查询全部（支持 include） */
    findAll(options?: any): any[] {
      const result = super.findAll(options);
      if (!options?.include) return result;
      return this.applyInclude(result, options.include);
    }

    /** 根据条件查找（支持 include） */
    find(condition: any, options?: any): any[] {
      const result = super.find(condition, options);
      if (!options?.include) return result;
      return this.applyInclude(result, options.include);
    }

    /** 根据条件查找单条（支持 include） */
    findOne(condition: any, options?: any): any | undefined {
      const result = super.findOne(condition, options);
      if (!result || !options?.include) return result;
      return this.applyInclude(result, options.include);
    }
  };
}
