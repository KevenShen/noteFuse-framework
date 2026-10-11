/**
 * L4 高级功能层 - 地理空间 Mixin
 * 
 * 包含：地理点查询、地理边界框查询、地理距离查询、地理多边形查询、地理形状查询、地理距离排序、地理聚合等
 */

import type { MixinConstructor } from './mixin.types';
import type { Document } from '../types';

/**
 * 地理空间 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithGeo<T extends MixinConstructor>(Base: T) {
  return class GeoMixin extends Base {
    // ==================== 地理点查询 ====================

    /**
     * geo_bounding_box 查询（地理边界框查询）
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param boundingBox 边界框（top_left 和 bottom_right）
     * @returns 匹配的文档
     */
    geoBoundingBoxQuery(
      docs: Document[],
      field: string,
      boundingBox: {
        top_left: { lat: number; lon: number } | [number, number] | string;
        bottom_right: { lat: number; lon: number } | [number, number] | string;
      },
    ): Document[] {
      const topLeft = this.parseGeoPoint(boundingBox.top_left);
      const bottomRight = this.parseGeoPoint(boundingBox.bottom_right);

      if (!topLeft || !bottomRight) return [];

      return docs.filter(doc => {
        const point = this.getGeoPoint(doc, field);
        if (!point) return false;

        return (
          point.lat <= topLeft.lat &&
          point.lat >= bottomRight.lat &&
          point.lon >= topLeft.lon &&
          point.lon <= bottomRight.lon
        );
      });
    }

    /**
     * geo_distance 查询（地理距离查询）
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param origin 原点
     * @param distance 距离（如 "100km"）
     * @param distanceType 距离计算方式（arc 或 plane）
     * @returns 匹配的文档
     */
    geoDistanceQuery(
      docs: Document[],
      field: string,
      origin: { lat: number; lon: number } | [number, number] | string,
      distance: string,
      distanceType: 'arc' | 'plane' = 'arc',
    ): Document[] {
      const originPoint = this.parseGeoPoint(origin);
      const distanceMeters = this.parseDistance(distance);

      if (!originPoint || distanceMeters <= 0) return [];

      return docs.filter(doc => {
        const point = this.getGeoPoint(doc, field);
        if (!point) return false;

        const dist = this.calculateGeoDistance(originPoint, point, distanceType);
        return dist <= distanceMeters;
      });
    }

    /**
     * geo_polygon 查询（地理多边形查询）
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param points 多边形顶点列表
     * @returns 匹配的文档
     */
    geoPolygonQuery(
      docs: Document[],
      field: string,
      points: Array<{ lat: number; lon: number } | [number, number] | string>,
    ): Document[] {
      const polygon = points.map(p => this.parseGeoPoint(p)).filter(Boolean) as Array<{ lat: number; lon: number }>;

      if (polygon.length < 3) return [];

      return docs.filter(doc => {
        const point = this.getGeoPoint(doc, field);
        if (!point) return false;
        return this.isPointInPolygon(point, polygon);
      });
    }

    // ==================== 地理距离排序 ====================

    /**
     * 按地理距离排序
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param origin 原点
     * @param order 排序方向（asc 或 desc）
     * @param unit 距离单位（m、km、mi、yd、ft、in、cm、mm）
     * @param distanceType 距离计算方式
     * @returns 排序后的文档（附带距离）
     */
    geoDistanceSort(
      docs: Document[],
      field: string,
      origin: { lat: number; lon: number } | [number, number] | string,
      order: 'asc' | 'desc' = 'asc',
      unit: string = 'm',
      distanceType: 'arc' | 'plane' = 'arc',
    ): Array<{
      doc: Document;
      distance: number;
    }> {
      const originPoint = this.parseGeoPoint(origin);
      if (!originPoint) return [];

      const unitMultiplier = this.getDistanceUnitMultiplier(unit);

      const results = docs
        .map(doc => {
          const point = this.getGeoPoint(doc, field);
          if (!point) return null;
          const distance = this.calculateGeoDistance(originPoint, point, distanceType) * unitMultiplier;
          return { doc, distance };
        })
        .filter(Boolean) as Array<{ doc: Document; distance: number }>;

      results.sort((a, b) => {
        return order === 'asc' ? a.distance - b.distance : b.distance - a.distance;
      });

      return results;
    }

    // ==================== 地理聚合 ====================

    /**
     * geo_distance 聚合（按距离范围分桶）
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param origin 原点
     * @param ranges 距离范围列表
     * @param unit 距离单位
     * @returns 聚合结果
     */
    geoDistanceAggregation(
      docs: Document[],
      field: string,
      origin: { lat: number; lon: number } | [number, number] | string,
      ranges: Array<{ key?: string; from?: number; to?: number }>,
      unit: string = 'm',
    ): Array<{
      key: string;
      from?: number;
      to?: number;
      doc_count: number;
    }> {
      const originPoint = this.parseGeoPoint(origin);
      if (!originPoint) return [];

      const unitMultiplier = this.getDistanceUnitMultiplier(unit);

      // 计算每个文档的距离
      const distances = docs
        .map(doc => {
          const point = this.getGeoPoint(doc, field);
          if (!point) return null;
          return this.calculateGeoDistance(originPoint, point) * unitMultiplier;
        })
        .filter(d => d !== null) as number[];

      // 按范围分桶
      return ranges.map((range, index) => {
        const key = range.key || (
          range.from !== undefined && range.to !== undefined
            ? `${range.from}-${range.to}`
            : range.from !== undefined
              ? `${range.from}-*`
              : `*-${range.to}`
        );

        const doc_count = distances.filter(d => {
          const inRange =
            (range.from === undefined || d >= range.from) &&
            (range.to === undefined || d < range.to);
          return inRange;
        }).length;

        return {
          key,
          from: range.from,
          to: range.to,
          doc_count,
        };
      });
    }

    /**
     * geohash_grid 聚合（按 geohash 网格分桶）
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param precision 精度（1-12）
     * @param size 返回数量
     * @returns 聚合结果
     */
    geohashGridAggregation(
      docs: Document[],
      field: string,
      precision: number = 5,
      size: number = 10000,
    ): Array<{
      key: string;
      doc_count: number;
    }> {
      const geohashCounts = new Map<string, number>();

      for (const doc of docs) {
        const point = this.getGeoPoint(doc, field);
        if (!point) continue;

        const geohash = this.encodeGeohash(point.lat, point.lon, precision);
        geohashCounts.set(geohash, (geohashCounts.get(geohash) || 0) + 1);
      }

      // 按文档数排序，限制返回数量
      return Array.from(geohashCounts.entries())
        .map(([key, doc_count]) => ({ key, doc_count }))
        .sort((a, b) => b.doc_count - a.doc_count)
        .slice(0, size);
    }

    /**
     * geo_centroid 聚合（计算地理中心点）
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @returns 中心点
     */
    geoCentroidAggregation(
      docs: Document[],
      field: string,
    ): {
      location: {
        lat: number;
        lon: number;
      };
      count: number;
    } | null {
      let sumLat = 0;
      let sumLon = 0;
      let count = 0;

      for (const doc of docs) {
        const point = this.getGeoPoint(doc, field);
        if (!point) continue;
        sumLat += point.lat;
        sumLon += point.lon;
        count++;
      }

      if (count === 0) return null;

      return {
        location: {
          lat: sumLat / count,
          lon: sumLon / count,
        },
        count,
      };
    }

    // ==================== 工具方法 ====================

    /**
     * 解析地理点
     * 
     * @param point 地理点（对象、数组、字符串）
     * @returns 解析后的地理点或 null
     */
    protected parseGeoPoint(
      point: { lat: number; lon: number } | [number, number] | string,
    ): { lat: number; lon: number } | null {
      if (typeof point === 'object' && !Array.isArray(point)) {
        if (typeof point.lat === 'number' && typeof point.lon === 'number') {
          return { lat: point.lat, lon: point.lon };
        }
        return null;
      }

      if (Array.isArray(point) && point.length >= 2) {
        // GeoJSON 格式：[lon, lat]
        if (typeof point[0] === 'number' && typeof point[1] === 'number') {
          return { lat: point[1], lon: point[0] };
        }
        return null;
      }

      if (typeof point === 'string') {
        // "lat,lon" 格式
        const parts = point.split(',');
        if (parts.length === 2) {
          const lat = parseFloat(parts[0].trim());
          const lon = parseFloat(parts[1].trim());
          if (!isNaN(lat) && !isNaN(lon)) {
            return { lat, lon };
          }
        }
        return null;
      }

      return null;
    }

    /**
     * 从文档中获取地理点
     * 
     * @param doc 文档
     * @param field 字段名
     * @returns 地理点或 null
     */
    protected getGeoPoint(doc: Document, field: string): { lat: number; lon: number } | null {
      const value = (this as any).getNestedValue(doc._source, field);
      if (!value) return null;
      return this.parseGeoPoint(value);
    }

    /**
     * 计算两个地理点之间的距离
     * 
     * @param point1 点1
     * @param point2 点2
     * @param type 距离计算方式（arc 或 plane）
     * @returns 距离（米）
     */
    calculateGeoDistance(
      point1: { lat: number; lon: number },
      point2: { lat: number; lon: number },
      type: 'arc' | 'plane' = 'arc',
    ): number {
      if (type === 'plane') {
        // 平面距离计算（简化，适用于小范围）
        const latDiff = (point2.lat - point1.lat) * 111320; // 纬度每度约111320米
        const lonDiff = (point2.lon - point1.lon) * 111320 * Math.cos((point1.lat * Math.PI) / 180);
        return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
      }

      // Haversine 公式（球面距离）
      const R = 6371000; // 地球半径（米）
      const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
      const dLon = ((point2.lon - point1.lon) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((point1.lat * Math.PI) / 180) *
          Math.cos((point2.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    /**
     * 解析距离字符串
     * 
     * @param distance 距离字符串（如 "100km"、"50m"）
     * @returns 距离（米）
     */
    protected parseDistance(distance: string): number {
      const match = distance.match(/^(\d+(?:\.\d+)?)\s*(km|m|mi|yd|ft|in|cm|mm)?$/i);
      if (!match) return 0;

      const value = parseFloat(match[1]);
      const unit = (match[2] || 'm').toLowerCase();

      const multipliers: Record<string, number> = {
        km: 1000,
        m: 1,
        mi: 1609.34,
        yd: 0.9144,
        ft: 0.3048,
        in: 0.0254,
        cm: 0.01,
        mm: 0.001,
      };

      return value * (multipliers[unit] || 1);
    }

    /**
     * 获取距离单位乘数
     * 
     * @param unit 单位
     * @returns 乘数（相对于米）
     */
    protected getDistanceUnitMultiplier(unit: string): number {
      const multipliers: Record<string, number> = {
        km: 0.001,
        m: 1,
        mi: 0.000621371,
        yd: 1.09361,
        ft: 3.28084,
        in: 39.3701,
        cm: 100,
        mm: 1000,
      };
      return multipliers[unit.toLowerCase()] || 1;
    }

    /**
     * 判断点是否在多边形内
     * 
     * @param point 点
     * @param polygon 多边形顶点
     * @returns 是否在多边形内
     */
    protected isPointInPolygon(
      point: { lat: number; lon: number },
      polygon: Array<{ lat: number; lon: number }>,
    ): boolean {
      let inside = false;
      const n = polygon.length;

      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i].lat;
        const yi = polygon[i].lon;
        const xj = polygon[j].lat;
        const yj = polygon[j].lon;

        const intersect =
          yi > point.lon !== yj > point.lon &&
          point.lat < ((xj - xi) * (point.lon - yi)) / (yj - yi) + xi;

        if (intersect) inside = !inside;
      }

      return inside;
    }

    /**
     * 编码 geohash
     * 
     * @param latitude 纬度
     * @param longitude 经度
     * @param precision 精度（1-12）
     * @returns geohash 字符串
     */
    protected encodeGeohash(latitude: number, longitude: number, precision: number = 5): string {
      const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
      let latRange = [-90, 90];
      let lonRange = [-180, 180];
      let geohash = '';
      let bit = 0;
      let ch = 0;
      let even = true;

      while (geohash.length < precision) {
        if (even) {
          const mid = (lonRange[0] + lonRange[1]) / 2;
          if (longitude > mid) {
            ch |= 1 << (4 - bit);
            lonRange[0] = mid;
          } else {
            lonRange[1] = mid;
          }
        } else {
          const mid = (latRange[0] + latRange[1]) / 2;
          if (latitude > mid) {
            ch |= 1 << (4 - bit);
            latRange[0] = mid;
          } else {
            latRange[1] = mid;
          }
        }

        even = !even;
        if (bit < 4) {
          bit++;
        } else {
          geohash += base32[ch];
          bit = 0;
          ch = 0;
        }
      }

      return geohash;
    }
  };
}
