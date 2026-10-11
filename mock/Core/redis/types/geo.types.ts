/**
 * 地理空间类型定义
 * 包含：GeoLocation、GeoRadiusResult
 */

/** 地理位置 */
export interface GeoLocation {
  /** 经度 */
  longitude: number;
  /** 纬度 */
  latitude: number;
  /** 成员名 */
  member: string;
}

/** GeoRadius 结果 */
export interface GeoRadiusResult {
  /** 成员名 */
  member: string;
  /** 距离 */
  distance?: number;
  /** 地理位置 */
  location?: { longitude: number; latitude: number };
  /** geohash */
  geohash?: string;
}
