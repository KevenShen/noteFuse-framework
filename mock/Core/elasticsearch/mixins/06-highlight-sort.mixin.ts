/**
 * L2 搜索层 - 高亮排序 Mixin
 * 
 * 包含：高亮配置、高亮生成、排序配置、多字段排序、地理距离排序、脚本排序等
 */

import type { MixinConstructor } from './mixin.types';
import type {
  Document,
  SearchHit,
} from '../types';

import { highlightDocument } from '../utils';

/**
 * 高亮排序 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithHighlightSort<T extends MixinConstructor>(Base: T) {
  return class HighlightSortMixin extends Base {
    // ==================== 高亮功能 ====================

    /**
     * 生成高亮结果
     * 
     * @param doc 文档
     * @param queryText 查询文本
     * @param highlightConfig 高亮配置
     * @returns 高亮结果
     */
    generateHighlight(
      doc: Document,
      queryText: string,
      highlightConfig: any,
    ): any {
      return highlightDocument(doc, highlightConfig as any, queryText);
    }

    /**
     * 为多个文档生成高亮
     * 
     * @param docs 文档列表
     * @param queryText 查询文本
     * @param highlightConfig 高亮配置
     * @returns 高亮结果映射（文档ID -> 高亮结果）
     */
    generateHighlights(
      docs: Document[],
      queryText: string,
      highlightConfig: any,
    ): Record<string, any> {
      const result: Record<string, any> = {};
      for (const doc of docs) {
        result[doc._id] = this.generateHighlight(doc, queryText, highlightConfig);
      }
      return result;
    }

    /**
     * 为搜索命中添加高亮
     * 
     * @param hits 搜索命中列表
     * @param queryText 查询文本
     * @param highlightConfig 高亮配置
     * @returns 带高亮的搜索命中列表
     */
    addHighlightsToHits(
      hits: SearchHit[],
      queryText: string,
      highlightConfig: any,
    ): SearchHit[] {
      return hits.map(hit => {
        const doc = { _source: hit._source } as Document;
        const highlight = this.generateHighlight(doc, queryText, highlightConfig);
        return {
          ...hit,
          highlight,
        };
      });
    }

    /**
     * 提取高亮片段
     * 
     * @param text 原始文本
     * @param queryText 查询文本
     * @param options 选项
     * @returns 高亮片段列表
     */
    extractHighlightFragments(
      text: string,
      queryText: string,
      options: {
        fragment_size?: number;
        number_of_fragments?: number;
        pre_tags?: string[];
        post_tags?: string[];
        no_match_size?: number;
        fragmenter?: 'simple' | 'span';
        order?: 'score' | 'none';
      } = {},
    ): string[] {
      const {
        fragment_size = 100,
        number_of_fragments = 5,
        pre_tags = ['<em>'],
        post_tags = ['</em>'],
        no_match_size = 150,
        order = 'score',
      } = options;

      if (!text || !queryText) return [];

      const lowerText = text.toLowerCase();
      const lowerQuery = queryText.toLowerCase();
      const terms = lowerQuery.split(/\s+/).filter(t => t);

      // 找到所有匹配位置
      const matches: Array<{ start: number; end: number; term: string }> = [];
      for (const term of terms) {
        let pos = lowerText.indexOf(term);
        while (pos !== -1) {
          matches.push({ start: pos, end: pos + term.length, term });
          pos = lowerText.indexOf(term, pos + term.length);
        }
      }

      if (matches.length === 0) {
        // 没有匹配，返回前 no_match_size 个字符
        return [text.substring(0, no_match_size)];
      }

      // 按位置排序
      matches.sort((a, b) => a.start - b.start);

      // 生成片段
      const fragments: string[] = [];
      const usedPositions = new Set<number>();

      for (const match of matches) {
        if (fragments.length >= number_of_fragments) break;

        // 计算片段起始位置
        let fragmentStart = Math.max(0, match.start - fragment_size / 2);
        let fragmentEnd = Math.min(text.length, fragmentStart + fragment_size);

        // 调整起始位置，确保片段包含匹配
        if (fragmentEnd < match.end) {
          fragmentEnd = Math.min(text.length, match.end + 10);
          fragmentStart = Math.max(0, fragmentEnd - fragment_size);
        }

        // 检查是否与已有片段重叠
        const fragmentKey = Math.floor(fragmentStart / (fragment_size / 2));
        if (usedPositions.has(fragmentKey)) continue;
        usedPositions.add(fragmentKey);

        // 提取片段并添加高亮标签
        let fragment = text.substring(fragmentStart, fragmentEnd);

        // 在片段中添加高亮标签
        const relativeMatches = matches
          .filter(m => m.start >= fragmentStart && m.end <= fragmentEnd)
          .map(m => ({
            start: m.start - fragmentStart,
            end: m.end - fragmentStart,
          }))
          .sort((a, b) => b.start - a.start); // 从后往前替换，避免位置偏移

        for (const rm of relativeMatches) {
          fragment =
            fragment.substring(0, rm.start) +
            pre_tags[0] +
            fragment.substring(rm.start, rm.end) +
            post_tags[0] +
            fragment.substring(rm.end);
        }

        // 添加省略号
        if (fragmentStart > 0) fragment = '...' + fragment;
        if (fragmentEnd < text.length) fragment = fragment + '...';

        fragments.push(fragment);
      }

      // 按分数排序（简化实现：按匹配数量排序）
      if (order === 'score') {
        fragments.sort((a, b) => {
          const aCount = (a.match(new RegExp(pre_tags[0], 'g')) || []).length;
          const bCount = (b.match(new RegExp(pre_tags[0], 'g')) || []).length;
          return bCount - aCount;
        });
      }

      return fragments.slice(0, number_of_fragments);
    }

    // ==================== 排序功能 ====================

    /**
     * 多字段排序
     * 
     * @param docs 文档列表
     * @param sortConfig 排序配置
     * @returns 排序后的文档列表
     */
    multiFieldSort(
      docs: Document[],
      sortConfig: Array<Record<string, {
        order?: 'asc' | 'desc';
        mode?: 'min' | 'max' | 'sum' | 'avg' | 'median';
        missing?: '_first' | '_last' | any;
        unmapped_type?: string;
        nested?: any;
      }>>,
    ): Document[] {
      if (!sortConfig || sortConfig.length === 0) {
        return docs;
      }

      return [...docs].sort((a, b) => {
        for (const sortItem of sortConfig) {
          for (const [field, config] of Object.entries(sortItem)) {
            const order = config.order || 'asc';
            const aValue = this.getSortValue(a, field, config);
            const bValue = this.getSortValue(b, field, config);

            // 处理缺失值
            if (aValue === undefined && bValue === undefined) continue;
            if (aValue === undefined) {
              return config.missing === '_first' ? -1 : 1;
            }
            if (bValue === undefined) {
              return config.missing === '_first' ? 1 : -1;
            }

            // 比较值
            let comparison = 0;
            if (typeof aValue === 'number' && typeof bValue === 'number') {
              comparison = aValue - bValue;
            } else {
              comparison = String(aValue).localeCompare(String(bValue));
            }

            if (comparison !== 0) {
              return order === 'desc' ? -comparison : comparison;
            }
          }
        }
        return 0;
      });
    }

    /**
     * 获取排序值（处理数组和嵌套字段）
     * 
     * @param doc 文档
     * @param field 字段名
     * @param config 排序配置
     * @returns 排序值
     */
    protected getSortValue(
      doc: Document,
      field: string,
      config: {
        mode?: 'min' | 'max' | 'sum' | 'avg' | 'median';
      },
    ): any {
      const value = this.getNestedValue(doc._source, field);

      if (value === undefined) return undefined;

      // 处理数组值
      if (Array.isArray(value)) {
        const mode = config.mode || 'avg';
        switch (mode) {
          case 'min':
            return Math.min(...value.filter(v => typeof v === 'number'));
          case 'max':
            return Math.max(...value.filter(v => typeof v === 'number'));
          case 'sum':
            return value.filter(v => typeof v === 'number').reduce((a, b) => a + b, 0);
          case 'avg': {
            const nums = value.filter(v => typeof v === 'number');
            return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined;
          }
          case 'median': {
            const nums = value.filter(v => typeof v === 'number').sort((a, b) => a - b);
            const mid = Math.floor(nums.length / 2);
            return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
          }
          default:
            return value[0];
        }
      }

      return value;
    }

    /**
     * 地理距离排序
     * 
     * @param docs 文档列表
     * @param field 地理字段
     * @param location 目标位置
     * @param order 排序方向
     * @param unit 距离单位
     * @returns 排序后的文档列表
     */
    geoDistanceSort(
      docs: Document[],
      field: string,
      location: { lat: number; lon: number },
      order: 'asc' | 'desc' = 'asc',
      unit: 'km' | 'm' | 'mi' = 'km',
    ): Document[] {
      return [...docs]
        .map(doc => {
          const docLocation = this.getNestedValue(doc._source, field);
          if (!docLocation) return { doc, distance: Infinity };

          const distance = this.calculateGeoDistance(location, docLocation, unit);
          return { doc, distance };
        })
        .sort((a, b) => {
          return order === 'asc' ? a.distance - b.distance : b.distance - a.distance;
        })
        .map(item => item.doc);
    }

    /**
     * 计算地理距离
     * 
     * @param loc1 位置1
     * @param loc2 位置2
     * @param unit 距离单位
     * @returns 距离
     */
    calculateGeoDistance(
      loc1: { lat: number; lon: number },
      loc2: { lat: number; lon: number } | [number, number] | string,
      unit: 'km' | 'm' | 'mi',
    ): number {
      // 解析位置2
      let lat2: number, lon2: number;
      if (Array.isArray(loc2)) {
        lat2 = loc2[0];
        lon2 = loc2[1];
      } else if (typeof loc2 === 'string') {
        const parts = loc2.split(',').map(Number);
        lat2 = parts[0];
        lon2 = parts[1];
      } else {
        lat2 = loc2.lat;
        lon2 = loc2.lon;
      }

      // Haversine 公式
      const R = unit === 'km' ? 6371 : unit === 'm' ? 6371000 : 3959; // 地球半径
      const dLat = this.toRadians(lat2 - loc1.lat);
      const dLon = this.toRadians(lon2 - loc1.lon);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.toRadians(loc1.lat)) * Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c;
    }

    /**
     * 角度转弧度
     * 
     * @param degrees 角度
     * @returns 弧度
     */
    protected toRadians(degrees: number): number {
      return degrees * (Math.PI / 180);
    }

    /**
     * 脚本排序（简化实现）
     * 
     * @param docs 文档列表
     * @param script 脚本配置
     * @param order 排序方向
     * @returns 排序后的文档列表
     */
    scriptSort(
      docs: Document[],
      script: {
        source: string;
        lang?: string;
        params?: Record<string, any>;
      },
      order: 'asc' | 'desc' = 'asc',
    ): Document[] {
      // 简化实现：支持简单的字段访问和算术运算
      return [...docs]
        .map(doc => {
          const value = this.evaluateScript(doc, script);
          return { doc, value };
        })
        .sort((a, b) => {
          if (typeof a.value === 'number' && typeof b.value === 'number') {
            return order === 'asc' ? a.value - b.value : b.value - a.value;
          }
          return order === 'asc'
            ? String(a.value).localeCompare(String(b.value))
            : String(b.value).localeCompare(String(a.value));
        })
        .map(item => item.doc);
    }

    /**
     * 评估脚本（简化实现）
     * 
     * @param doc 文档
     * @param script 脚本配置
     * @returns 脚本结果
     */
    protected evaluateScript(
      doc: Document,
      script: {
        source: string;
        params?: Record<string, any>;
      },
    ): any {
      try {
        // 简化实现：支持 doc['field'].value 语法
        let expression = script.source;

        // 替换 doc['field'].value 为字段值
        expression = expression.replace(/doc\['([^']+)'\]\.value/g, (match, field) => {
          const value = this.getNestedValue(doc._source, field);
          return JSON.stringify(value);
        });

        // 替换 params.param 为参数值
        if (script.params) {
          for (const [key, value] of Object.entries(script.params)) {
            expression = expression.replace(new RegExp(`params\\.${key}`, 'g'), JSON.stringify(value));
          }
        }

        // 安全评估表达式（只允许简单的算术运算）
        if (/^[\d\s+\-*/().]+$/.test(expression)) {
          return eval(expression);
        }

        return undefined;
      } catch {
        return undefined;
      }
    }
  };
}
