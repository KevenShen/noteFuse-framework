/**
 * 数据转换工具函数
 *
 * 【功能分组】
 * - 基础类型转换：toNumber / toString / toBoolean / parseJSON / toUndefinable
 * - Hash 转换工厂：createHashConverter（约定优于配置，只需指定非 string 字段）
 *
 * 【设计理念】
 * Redis Hash 存储的所有字段值都是字符串。大部分业务字段也是 string 类型，
 * 因此采用"约定优于配置"：string 字段自动从 hash 复制，只需指定需要转换类型的字段。
 */

// ============================================================================
// 基础类型转换工具
// ============================================================================

/**
 * 安全转换为数字
 *
 * @param value 待转换的值
 * @param defaultValue 默认值（转换失败时返回）
 * @returns 转换后的数字
 */
export function toNumber(value: string | undefined | null, defaultValue: number = 0): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * 安全转换为字符串
 *
 * @param value 待转换的值
 * @param defaultValue 默认值
 * @returns 转换后的字符串
 */
export function toString(value: string | undefined | null, defaultValue: string = ''): string {
  return value ?? defaultValue;
}

/**
 * 空字符串转 undefined
 * 用于可选字段：Redis 中存储为空字符串，业务逻辑中需要 undefined
 *
 * @param value 待转换的值
 * @returns 非空字符串或 undefined
 */
export function toUndefinable(value: string | undefined | null): string | undefined {
  return value && value !== '' ? value : undefined;
}

/**
 * 安全转换为布尔值
 *
 * @param value 待转换的值（'true' / 'false' / '1' / '0'）
 * @returns 转换后的布尔值
 */
export function toBoolean(value: string | undefined | null): boolean {
  return value === 'true' || value === '1';
}

/**
 * 安全解析 JSON
 *
 * @typeParam T - 解析后的类型
 * @param value 待解析的 JSON 字符串
 * @param defaultValue 默认值（解析失败时返回）
 * @returns 解析后的对象
 */
export function parseJSON<T>(value: string | undefined | null, defaultValue: T | null = null): T | null {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

// ============================================================================
// Hash 转换工厂（约定优于配置）
// ============================================================================

/**
 * Hash 转换器配置（只需指定非 string 字段）
 *
 * @typeParam T - 目标类型
 */
export interface HashConverterConfig<T> {
  /** 需要转换为 number 的字段名 */
  numbers?: (keyof T)[];
  /** 需要转换为 boolean 的字段名 */
  booleans?: (keyof T)[];
  /** 需要解析为 JSON 对象的字段名 */
  jsons?: (keyof T)[];
  /** 空字符串需要转 undefined 的字段名（可选 string 字段） */
  undefinables?: (keyof T)[];
}

/**
 * 创建 Hash 转换器
 *
 * 【约定优于配置】
 * - string 字段：自动从 hash 复制，无需声明
 * - number 字段：在 numbers 数组中声明
 * - boolean 字段：在 booleans 数组中声明
 * - JSON 字段：在 jsons 数组中声明
 * - 可选 string 字段（空串转 undefined）：在 undefinables 数组中声明
 *
 * @typeParam T - 目标类型
 * @param config 转换配置（只需指定非 string 字段）
 * @returns 转换函数
 *
 * @example
 * ```typescript
 * const hashToCategory = createHashConverter<MockProjectCategory>({
 *   numbers: ['id', 'parent_id', 'sort', 'create_time'],
 *   undefinables: ['icon', 'description'],
 * });
 *
 * const category = hashToCategory(redisHashData);
 * ```
 */
export function createHashConverter<T extends Record<string, any>>(
  config: HashConverterConfig<T>,
): (hash: Record<string, string>) => T {
  const { numbers = [], booleans = [], jsons = [], undefinables = [] } = config;

  return (hash: Record<string, string>): T => {
    // string 字段自动从 hash 复制
    const result = { ...hash } as Record<string, any>;

    // 转换 number 字段
    for (const key of numbers) {
      result[key as string] = toNumber(hash[key as string]);
    }

    // 转换 boolean 字段
    for (const key of booleans) {
      result[key as string] = toBoolean(hash[key as string]);
    }

    // 转换 JSON 字段
    for (const key of jsons) {
      result[key as string] = parseJSON(hash[key as string]);
    }

    // 可选 string 字段（空串转 undefined）
    for (const key of undefinables) {
      result[key as string] = toUndefinable(hash[key as string]);
    }

    return result as T;
  };
}
