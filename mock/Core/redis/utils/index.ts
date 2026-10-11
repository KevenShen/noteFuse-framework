/**
 * 工具函数统一导出
 * 
 * 【工具分组】
 * - redis.utils: Redis工具函数（isExpired/patternToRegex）
 * - async-cache.utils: 异步缓存工具函数（simulateDelay/wrapAsync/resolveAsyncDelayConfig）
 */

export {
  isExpired,
  patternToRegex,
} from './redis.utils';

export {
  resolveAsyncDelayConfig,
  simulateDelay,
  createAsyncCacheStats,
  updateAsyncCacheStats,
  wrapAsync,
  isAsyncCache,
} from './async-cache.utils';
