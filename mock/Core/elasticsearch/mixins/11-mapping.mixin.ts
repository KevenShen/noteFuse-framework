/**
 * L4 高级功能层 - 映射管理 Mixin
 * 
 * 包含：获取映射、更新映射、字段映射类型推断、动态映射、字段类型验证等
 */

import type { MixinConstructor } from './mixin.types';
import type { Document, FieldType, PropertyMapping } from '../types';

// 类型别名（兼容旧命名）
type MappingType = FieldType;
type FieldMapping = PropertyMapping;

/**
 * 映射管理 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithMapping<T extends MixinConstructor>(Base: T) {
  return class MappingMixin extends Base {
    // ==================== 获取映射 ====================

    /**
     * 获取索引映射
     * 
     * @param indexName 索引名
     * @returns 映射信息
     */
    getMapping(indexName: string): {
      [indexName: string]: {
        mappings: {
          properties: Record<string, FieldMapping>;
        };
      };
    } | null {
      const index = (this as any).indices.get(indexName);
      if (!index) return null;

      return {
        [indexName]: {
          mappings: {
            properties: index.mapping || {},
          },
        },
      };
    }

    /**
     * 获取字段映射
     * 
     * @param indexName 索引名
     * @param fieldName 字段名（支持点号嵌套，如 'user.name'）
     * @returns 字段映射或 null
     */
    getFieldMapping(indexName: string, fieldName: string): FieldMapping | null {
      const index = (this as any).indices.get(indexName);
      if (!index || !index.mapping) return null;

      const parts = fieldName.split('.');
      let current: any = index.mapping;

      for (const part of parts) {
        if (current[part]) {
          if (current[part].properties) {
            current = current[part].properties;
          } else {
            return current[part];
          }
        } else {
          return null;
        }
      }

      return current;
    }

    // ==================== 更新映射 ====================

    /**
     * 更新索引映射
     * 
     * @param indexName 索引名
     * @param mapping 映射配置
     * @returns 是否成功
     */
    updateMapping(
      indexName: string,
      mapping: {
        properties: Record<string, FieldMapping>;
      },
    ): boolean {
      const index = (this as any).indices.get(indexName);
      if (!index) return false;

      // 合并映射（只允许添加新字段，不允许修改已有字段类型）
      if (!index.mapping) {
        index.mapping = {};
      }

      for (const [fieldName, fieldMapping] of Object.entries(mapping.properties)) {
        const existing = this.getFieldMapping(indexName, fieldName);
        if (existing && existing.type !== fieldMapping.type) {
          // 不允许修改已有字段类型
          console.warn(`Cannot change mapping type for field '${fieldName}' from '${existing.type}' to '${fieldMapping.type}'`);
          continue;
        }
        this.setFieldMapping(indexName, fieldName, fieldMapping);
      }

      return true;
    }

    /**
     * 设置字段映射
     * 
     * @param indexName 索引名
     * @param fieldName 字段名（支持点号嵌套）
     * @param fieldMapping 字段映射配置
     * @returns 是否成功
     */
    setFieldMapping(
      indexName: string,
      fieldName: string,
      fieldMapping: FieldMapping,
    ): boolean {
      const index = (this as any).indices.get(indexName);
      if (!index) return false;

      if (!index.mapping) {
        index.mapping = {};
      }

      const parts = fieldName.split('.');
      let current: any = index.mapping;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = { type: 'object', properties: {} };
        }
        if (!current[part].properties) {
          current[part].properties = {};
        }
        current = current[part].properties;
      }

      current[parts[parts.length - 1]] = fieldMapping;
      return true;
    }

    // ==================== 字段类型推断 ====================

    /**
     * 根据文档值推断字段类型
     * 
     * @param value 值
     * @returns 推断的字段类型
     */
    inferFieldType(value: any): MappingType {
      if (value === null || value === undefined) {
        return 'keyword';
      }

      if (typeof value === 'boolean') {
        return 'boolean';
      }

      if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          return 'integer';
        }
        return 'float';
      }

      if (typeof value === 'string') {
        // 尝试解析为日期
        if (this.isDateString(value)) {
          return 'date';
        }
        // 长文本使用 text，短文本使用 keyword
        return value.length > 256 ? 'text' : 'keyword';
      }

      if (value instanceof Date) {
        return 'date';
      }

      if (Array.isArray(value)) {
        if (value.length > 0) {
          return this.inferFieldType(value[0]);
        }
        return 'keyword';
      }

      if (typeof value === 'object') {
        // 检查是否为地理点
        if (value.lat !== undefined && value.lon !== undefined) {
          return 'geo_point';
        }
        return 'object';
      }

      return 'keyword';
    }

    /**
     * 根据文档自动生成映射
     * 
     * @param docs 文档列表
     * @returns 映射配置
     */
    generateMappingFromDocs(docs: Document[]): {
      properties: Record<string, FieldMapping>;
    } {
      const properties: Record<string, FieldMapping> = {};
      const fieldTypes = new Map<string, Set<MappingType>>();

      // 收集所有字段的类型
      for (const doc of docs) {
        this.collectFieldTypes(doc._source, '', fieldTypes);
      }

      // 为每个字段选择最合适的类型
      for (const [fieldName, types] of fieldTypes.entries()) {
        const fieldMapping = this.selectFieldType(types);
        if (fieldMapping) {
          const parts = fieldName.split('.');
          let current: any = properties;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
              current[parts[i]] = { type: 'object', properties: {} };
            }
            if (!current[parts[i]].properties) {
              current[parts[i]].properties = {};
            }
            current = current[parts[i]].properties;
          }
          current[parts[parts.length - 1]] = fieldMapping;
        }
      }

      return { properties };
    }

    // ==================== 动态映射 ====================

    /**
     * 动态映射：根据新文档自动更新映射
     * 
     * @param indexName 索引名
     * @param doc 文档
     * @returns 是否更新了映射
     */
    dynamicMapping(indexName: string, doc: Document): boolean {
      const index = (this as any).indices.get(indexName);
      if (!index) return false;

      let updated = false;
      const fieldTypes = new Map<string, Set<MappingType>>();
      this.collectFieldTypes(doc._source, '', fieldTypes);

      for (const [fieldName, types] of fieldTypes.entries()) {
        const existing = this.getFieldMapping(indexName, fieldName);
        if (!existing) {
          // 新字段，自动添加映射
          const fieldMapping = this.selectFieldType(types);
          if (fieldMapping) {
            this.setFieldMapping(indexName, fieldName, fieldMapping);
            updated = true;
          }
        }
      }

      return updated;
    }

    // ==================== 字段类型验证 ====================

    /**
     * 验证文档字段类型是否符合映射
     * 
     * @param indexName 索引名
     * @param doc 文档
     * @returns 验证结果
     */
    validateDocumentMapping(
      indexName: string,
      doc: Document,
    ): {
      valid: boolean;
      errors: Array<{
        field: string;
        expectedType: string;
        actualType: string;
        message: string;
      }>;
    } {
      const errors: Array<{
        field: string;
        expectedType: string;
        actualType: string;
        message: string;
      }> = [];

      this.validateFields(doc._source, '', indexName, errors);

      return {
        valid: errors.length === 0,
        errors,
      };
    }

    // ==================== 工具方法 ====================

    /**
     * 检查字符串是否为日期格式
     * 
     * @param str 字符串
     * @returns 是否为日期字符串
     */
    protected isDateString(str: string): boolean {
      // 常见日期格式
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}$/,
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        /^\d{4}\/\d{2}\/\d{2}$/,
        /^\d{2}\/\d{2}\/\d{4}$/,
      ];

      for (const pattern of datePatterns) {
        if (pattern.test(str)) {
          const date = new Date(str);
          return !isNaN(date.getTime());
        }
      }

      return false;
    }

    /**
     * 收集文档中的字段类型
     * 
     * @param obj 对象
     * @param prefix 字段前缀
     * @param fieldTypes 字段类型映射
     */
    protected collectFieldTypes(
      obj: any,
      prefix: string,
      fieldTypes: Map<string, Set<MappingType>>,
    ): void {
      if (!obj || typeof obj !== 'object') return;

      for (const [key, value] of Object.entries(obj)) {
        const fieldName = prefix ? `${prefix}.${key}` : key;

        if (value !== null && value !== undefined) {
          const type = this.inferFieldType(value);
          if (!fieldTypes.has(fieldName)) {
            fieldTypes.set(fieldName, new Set());
          }
          fieldTypes.get(fieldName)!.add(type);

          // 递归处理嵌套对象
          if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            // 检查是否为地理点
            const geoValue = value as any;
            if (!(geoValue.lat !== undefined && geoValue.lon !== undefined)) {
              this.collectFieldTypes(value, fieldName, fieldTypes);
            }
          }
        }
      }
    }

    /**
     * 为字段选择最合适的类型
     * 
     * @param types 类型集合
     * @returns 字段映射配置
     */
    protected selectFieldType(types: Set<MappingType>): FieldMapping | null {
      if (types.size === 0) return null;

      // 如果只有一种类型，直接使用
      if (types.size === 1) {
        const type = Array.from(types)[0];
        return this.createFieldMapping(type);
      }

      // 多种类型时，选择最通用的类型
      const typeArray = Array.from(types);

      // 数值类型统一为 float
      if (typeArray.every(t => ['integer', 'long', 'float', 'double'].includes(t))) {
        return this.createFieldMapping('float');
      }

      // 字符串类型统一为 keyword
      if (typeArray.every(t => ['keyword', 'text'].includes(t))) {
        return this.createFieldMapping('keyword');
      }

      // 混合类型使用 keyword
      return this.createFieldMapping('keyword');
    }

    /**
     * 创建字段映射配置
     * 
     * @param type 字段类型
     * @returns 字段映射配置
     */
    protected createFieldMapping(type: MappingType): FieldMapping {
      const mapping: any = { type };

      // 为 text 类型添加 keyword 子字段
      if (type === 'text') {
        mapping.fields = {
          keyword: { type: 'keyword', ignore_above: 256 },
        };
      }

      // 为 date 类型添加格式
      if (type === 'date') {
        mapping.format = 'strict_date_optional_time||epoch_millis';
      }

      return mapping;
    }

    /**
     * 验证字段
     * 
     * @param obj 对象
     * @param prefix 字段前缀
     * @param indexName 索引名
     * @param errors 错误列表
     */
    protected validateFields(
      obj: any,
      prefix: string,
      indexName: string,
      errors: Array<{
        field: string;
        expectedType: string;
        actualType: string;
        message: string;
      }>,
    ): void {
      if (!obj || typeof obj !== 'object') return;

      for (const [key, value] of Object.entries(obj)) {
        const fieldName = prefix ? `${prefix}.${key}` : key;
        const fieldMapping = this.getFieldMapping(indexName, fieldName);

        if (fieldMapping && value !== null && value !== undefined) {
          const actualType = this.inferFieldType(value);
          if (!this.isTypeCompatible(fieldMapping.type, actualType)) {
            errors.push({
              field: fieldName,
              expectedType: fieldMapping.type,
              actualType: actualType,
              message: `Field '${fieldName}' expects type '${fieldMapping.type}', but got '${actualType}'`,
            });
          }
        }

        // 递归验证嵌套对象
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          this.validateFields(value, fieldName, indexName, errors);
        }
      }
    }

    /**
     * 检查类型是否兼容
     * 
     * @param expectedType 期望类型
     * @param actualType 实际类型
     * @returns 是否兼容
     */
    protected isTypeCompatible(expectedType: MappingType, actualType: MappingType): boolean {
      // 完全匹配
      if (expectedType === actualType) return true;

      // 数值类型兼容
      const numericTypes = ['integer', 'long', 'short', 'byte', 'float', 'double', 'half_float', 'scaled_float'];
      if (numericTypes.includes(expectedType) && numericTypes.includes(actualType)) return true;

      // 字符串类型兼容
      const stringTypes = ['keyword', 'text', 'wildcard', 'constant_keyword'];
      if (stringTypes.includes(expectedType) && stringTypes.includes(actualType)) return true;

      // text 和 keyword 互相兼容
      if ((expectedType === 'text' && actualType === 'keyword') ||
          (expectedType === 'keyword' && actualType === 'text')) return true;

      return false;
    }
  };
}
