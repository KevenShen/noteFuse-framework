/**
 * 便捷工具函数
 * 包含：createObjectId、isValidObjectId
 */
import { ObjectId } from '../ObjectId';

/**
 * 创建 ObjectId
 * 便捷函数，避免每次都 new ObjectId()
 */
export const createObjectId = (): ObjectId => new ObjectId();

/**
 * 校验是否为有效的 ObjectId 字符串
 */
export const isValidObjectId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};
