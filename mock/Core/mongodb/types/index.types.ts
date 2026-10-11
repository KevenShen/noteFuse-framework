/**
 * 索引类型定义
 * 包含：IndexOptions、IndexInfo
 */

/** 索引选项 */
export interface IndexOptions {
  unique?: boolean;
  sparse?: boolean;
  name?: string;
  expireAfterSeconds?: number;
}

/** 索引信息 */
export interface IndexInfo {
  name: string;
  keys: { [key: string]: 1 | -1 };
  options: IndexOptions;
}
