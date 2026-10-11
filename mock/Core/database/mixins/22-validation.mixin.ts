/**
 * 22 - 数据验证 Mixin
 * 包含：validate、setValidation
 */
import type { FlatItem } from '../types/base.types';
import type { ValidationConfig, ValidationResult, ValidationError } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithValidation<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 验证数据 */
    validate(data: Partial<any>): ValidationResult {
      if (!(this as any).validationConfig) return { valid: true, errors: [] };
      const errors: ValidationError[] = [];

      // 兼容两种 rules 格式：
      // 1. 数组格式：[{ field: 'username', required: true, ... }, ...]
      // 2. 对象格式：{ username: { required: true, ... }, ... }
      const rawRules = (this as any).validationConfig.rules;
      const rules = Array.isArray(rawRules)
        ? rawRules
        : Object.entries(rawRules || {}).map(([field, rule]) => ({ field, ...(rule as any) }));

      for (const rule of rules) {
        const value = data[rule.field];
        // 字段是否在 data 中显式存在（用于区分部分更新和全量创建）
        const fieldExists = Object.prototype.hasOwnProperty.call(data, rule.field);

        // required 验证：只有字段在 data 中显式存在且值为空时才报错
        // （部分更新时未传入的字段不应该报 required 错误）
        if (rule.required && fieldExists && (value == null || value === '')) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} 是必填项`, type: 'required' });
          continue;
        }
        // 字段不在 data 中（部分更新未传入），跳过后续验证
        if (!fieldExists || value == null) continue;
        
        if (rule.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (actualType !== rule.type) {
            errors.push({ field: rule.field, message: rule.message || `${rule.field} 类型错误`, type: 'type' });
            continue;
          }
        }
        
        if (rule.minLength !== undefined && String(value).length < rule.minLength) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} 长度不能小于 ${rule.minLength}`, type: 'minLength' });
        }
        if (rule.maxLength !== undefined && String(value).length > rule.maxLength) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} 长度不能大于 ${rule.maxLength}`, type: 'maxLength' });
        }
        if (rule.min !== undefined && Number(value) < rule.min) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} 不能小于 ${rule.min}`, type: 'min' });
        }
        if (rule.max !== undefined && Number(value) > rule.max) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} 不能大于 ${rule.max}`, type: 'max' });
        }
        if (rule.pattern && !rule.pattern.test(String(value))) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} 格式不正确`, type: 'pattern' });
        }
        if (rule.enum && !rule.enum.includes(value)) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} 必须是 ${rule.enum.join(', ')} 之一`, type: 'enum' });
        }
        if (rule.validator) {
          const result = rule.validator(value, data);
          if (result !== true) {
            errors.push({ field: rule.field, message: typeof result === 'string' ? result : (rule.message || `${rule.field} 验证失败`), type: 'custom' });
          }
        }
      }
      
      return { valid: errors.length === 0, errors };
    }

    /** 设置验证配置 */
    setValidation(config: ValidationConfig): void {
      (this as any).validationConfig = config;
    }
  };
}
