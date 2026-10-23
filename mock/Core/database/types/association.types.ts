/**
 * 关联关系类型定义（Sequelize 风格）
 * 支持：hasOne / hasMany / belongsTo / belongsToMany
 */
import type { MockTable } from '../MockTable';

/** 关联类型 */
export type AssociationType = 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';

/** 关联配置 */
export interface AssociationConfig {
  /** 关联类型 */
  type: AssociationType;
  /** 目标表 */
  target: MockTable<any>;
  /** 外键字段名（在源表或目标表中） */
  foreignKey: string;
  /** 关联别名（用于 include 和 get/set 方法） */
  as: string;
  /** 多对多中间表（仅 belongsToMany 需要） */
  through?: MockTable<any>;
  /** 中间表中源表的外键（仅 belongsToMany） */
  sourceKey?: string;
  /** 中间表中目标表的外键（仅 belongsToMany） */
  targetKey?: string;
}

/** Include 选项（字符串或对象） */
export type IncludeOption =
  | string
  | {
      /** 关联别名 */
      association: string;
      /** 嵌套 include */
      include?: IncludeOption[];
      /** 关联表过滤条件 */
      where?: Record<string, any>;
    };

/** 带 include 的查询选项 */
export interface FindOptionsWithInclude {
  include?: IncludeOption[];
}
