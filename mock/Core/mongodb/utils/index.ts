/**
 * 工具函数统一导出
 * 
 * 【工具分组】
 * - query.utils: 查询操作符工具（matchFieldValue/deepEqual/matchDocument）
 * - nested.utils: 嵌套字段工具（getNestedValue/setNestedValue/unsetNestedValue）
 * - update.utils: 更新操作符工具（applyUpdate）
 * - helper.utils: 便捷工具函数（createObjectId/isValidObjectId）
 * - async.utils: 异步模式工具（resolveAsyncDelayConfig/simulateDelay/wrapAsync 等）
 */

// 查询操作符工具
export {
  matchFieldValue,
  deepEqual,
  matchDocument,
} from './query.utils';

// 嵌套字段工具
export {
  getNestedValue,
  setNestedValue,
  unsetNestedValue,
} from './nested.utils';

// 更新操作符工具
export {
  applyUpdate,
} from './update.utils';

// 便捷工具函数
export {
  createObjectId,
  isValidObjectId,
} from './helper.utils';

// 异步模式工具
export {
  resolveAsyncDelayConfig,
  simulateDelay,
  createAsyncStats,
  updateAsyncStats,
  wrapAsync,
  isAsyncMongo,
} from './async.utils';
