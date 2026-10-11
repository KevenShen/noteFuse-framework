/**
 * Redis 工具函数
 * 包含：isExpired、patternToRegex
 */
import type { CacheItem } from '../types';

/** 检查缓存项是否过期 */
export const isExpired = (item: CacheItem): boolean => {
  return item.expireAt !== null && Date.now() > item.expireAt;
};

/** 通配符模式转换为正则表达式 */
export const patternToRegex = (pattern: string): RegExp => {
  return new RegExp(
    pattern.replace(/[.*+?^${}()|[\]\\]/g, (match) =>
      match === '*' ? '.*' : match === '?' ? '.' : `\\${match}`,
    ),
  );
};
