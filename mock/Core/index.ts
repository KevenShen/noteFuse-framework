// mock/Core/index.ts
// Mock 核心架构统一导出
// 包含：数据库 ORM（MockTable）、Redis 缓存模拟（MockRedis）、通用工具函数、通用中间件、实体数据

// ==================== 数据库 ORM ====================
export { MockTable } from './database';
export type {
  FlatItem,
  TableConfig,
  QueryCondition,
  SortOption,
  PaginationOption,
  PaginatedResult,
} from './database';

// ==================== Redis 缓存模拟 ====================
export { MockRedis, redis } from './redis';
export type { CacheConfig } from './redis';

// ==================== MongoDB 文档数据库模拟 ====================
export {
  MockMongoDB,
  MockMongoCollection,
  FindCursor,
  ObjectId,
  mongodb,
  createObjectId,
  isValidObjectId,
  Transaction,
  ClientSession,
  ChangeStream,
} from './mongodb';
export type {
  Document,
  OptionalId,
  FilterQuery,
  UpdateQuery,
  FindOptions,
  InsertOneResult,
  InsertManyResult,
  UpdateResult,
  DeleteResult,
  IndexOptions,
  IndexInfo,
  TransactionState,
  TransactionOptions,
  ChangeOperationType,
  ChangeEvent,
  ChangeStreamOptions,
  ChangeStreamCallback,
  QueryPlan,
  QueryPlanStage,
  PerformanceStats,
  BulkOperation,
  BulkOperationType,
  BulkWriteResult,
} from './mongodb';

// ==================== 通用工具函数 ====================
export { delay, success, fail, BusinessError, handleService } from './common';
export type {
  // 统一响应格式（与 success()/fail() 返回值对应）
  ApiResponse,
  // 分页响应格式
  PaginatedResponse,
  // Service 层内部返回格式
  ServiceResult,
} from './common';

// ==================== 认证核心模块 ====================
// 注意：userTable 已移至 Entities/user.ts，各模块应从 Entities 层导入
export {
  getTokenFromRequest,
  getCurrentUserFromToken,
  generateToken,
  sanitizeUser,
} from './auth';

// ==================== 通用中间件 ====================
export {
  // 认证中间件
  authMiddleware,
  // 权限中间件
  adminMiddleware,
  superAdminMiddleware,
  // 参数校验中间件
  validateMiddleware,
  // 日志中间件
  logMiddleware,
  // 错误处理中间件
  errorHandlerMiddleware,
  // 中间件组合器
  compose,
  withCustomMiddleware,
  // 带配置的中间件包装器
  withMiddleware,
} from './middleware';
export type {
  Middleware,
  RequestHandler,
  MiddlewareConfig,
} from './middleware';

// ==================== 实体数据 ====================
// 实体数据已移动到 mock/Entities/，和 Core 同级
export * from '../Entities';
