/**
 * L4 消息/扩展 - 地理空间 Mixin
 * 包含：geoadd/geopos/geodist/geohash/georadius/calculateDistance/encodeGeohash
 */
import type { MixinConstructor } from './mixin.types';
import type { GeoLocation, GeoRadiusResult } from '../types';

export function WithGeo<T extends MixinConstructor>(Base: T) {
  return class GeoMixin extends Base {
    /**
     * 添加地理位置
     * 返回添加的新元素数量
     */
    geoadd(key: string, ...locations: Array<{ longitude: number; latitude: number; member: string }>): number {
      const geoData = this.get<Map<string, GeoLocation>>(key) ?? new Map<string, GeoLocation>();
      let added = 0;

      for (const loc of locations) {
        if (!geoData.has(loc.member)) {
          added++;
        }
        geoData.set(loc.member, loc);
      }

      this.set(key, geoData);
      return added;
    }

    /**
     * 获取成员的地理位置
     */
    geopos(key: string, ...members: string[]): Array<{ longitude: number; latitude: number } | null> {
      const geoData = this.get<Map<string, GeoLocation>>(key);
      if (!geoData) return members.map(() => null);

      return members.map(member => {
        const loc = geoData.get(member);
        return loc ? { longitude: loc.longitude, latitude: loc.latitude } : null;
      });
    }

    /**
     * 计算两个成员之间的距离（默认米）
     */
    geodist(key: string, member1: string, member2: string, unit: 'm' | 'km' | 'mi' | 'ft' = 'm'): number | null {
      const geoData = this.get<Map<string, GeoLocation>>(key);
      if (!geoData) return null;

      const loc1 = geoData.get(member1);
      const loc2 = geoData.get(member2);
      if (!loc1 || !loc2) return null;

      const distanceMeters = this.calculateDistance(
        loc1.latitude, loc1.longitude,
        loc2.latitude, loc2.longitude
      );

      switch (unit) {
        case 'km': return distanceMeters / 1000;
        case 'mi': return distanceMeters / 1609.344;
        case 'ft': return distanceMeters / 0.3048;
        default: return distanceMeters;
      }
    }

    /**
     * 获取成员的 geohash
     */
    geohash(key: string, ...members: string[]): string[] {
      const geoData = this.get<Map<string, GeoLocation>>(key);
      if (!geoData) return members.map(() => '');

      return members.map(member => {
        const loc = geoData.get(member);
        if (!loc) return '';
        return this.encodeGeohash(loc.latitude, loc.longitude, 11);
      });
    }

    /**
     * 查找指定范围内的成员
     */
    georadius(
      key: string,
      longitude: number,
      latitude: number,
      radius: number,
      unit: 'm' | 'km' | 'mi' | 'ft' = 'm',
      options?: {
        withCoord?: boolean;
        withDist?: boolean;
        withHash?: boolean;
        count?: number;
        sort?: 'ASC' | 'DESC';
      }
    ): GeoRadiusResult[] {
      const geoData = this.get<Map<string, GeoLocation>>(key);
      if (!geoData) return [];

      // 转换半径为米
      let radiusMeters = radius;
      switch (unit) {
        case 'km': radiusMeters = radius * 1000; break;
        case 'mi': radiusMeters = radius * 1609.344; break;
        case 'ft': radiusMeters = radius * 0.3048; break;
      }

      const results: GeoRadiusResult[] = [];

      for (const [member, loc] of geoData) {
        const distance = this.calculateDistance(latitude, longitude, loc.latitude, loc.longitude);
        
        if (distance <= radiusMeters) {
          const result: GeoRadiusResult = { member };
          
          if (options?.withDist) {
            let dist = distance;
            switch (unit) {
              case 'km': dist = distance / 1000; break;
              case 'mi': dist = distance / 1609.344; break;
              case 'ft': dist = distance / 0.3048; break;
            }
            result.distance = dist;
          }
          
          if (options?.withCoord) {
            result.location = { longitude: loc.longitude, latitude: loc.latitude };
          }
          
          if (options?.withHash) {
            result.geohash = this.encodeGeohash(loc.latitude, loc.longitude, 11);
          }
          
          results.push(result);
        }
      }

      // 排序
      if (options?.sort === 'ASC') {
        results.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      } else if (options?.sort === 'DESC') {
        results.sort((a, b) => (b.distance || 0) - (a.distance || 0));
      }

      // 限制数量
      if (options?.count) {
        return results.slice(0, options.count);
      }

      return results;
    }

    /**
     * 计算两点之间的距离（Haversine 公式，单位：米）
     */
    calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
      const R = 6371000; // 地球半径（米）
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    /**
     * 编码 Geohash（简化版）
     */
    encodeGeohash(latitude: number, longitude: number, precision: number): string {
      const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
      let bits = 0;
      let bitValue = 0;
      let geohash = '';
      let isEven = true;
      let latMin = -90, latMax = 90;
      let lonMin = -180, lonMax = 180;

      while (geohash.length < precision) {
        if (isEven) {
          const lonMid = (lonMin + lonMax) / 2;
          if (longitude >= lonMid) {
            bitValue = bitValue * 2 + 1;
            lonMin = lonMid;
          } else {
            bitValue = bitValue * 2;
            lonMax = lonMid;
          }
        } else {
          const latMid = (latMin + latMax) / 2;
          if (latitude >= latMid) {
            bitValue = bitValue * 2 + 1;
            latMin = latMid;
          } else {
            bitValue = bitValue * 2;
            latMax = latMid;
          }
        }

        isEven = !isEven;
        bits++;

        if (bits === 5) {
          geohash += base32[bitValue];
          bits = 0;
          bitValue = 0;
        }
      }

      return geohash;
    }
  };
}
