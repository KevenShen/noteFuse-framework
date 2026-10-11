/**
 * L3 分析层 - 管道聚合 Mixin
 * 
 * 包含：avg_bucket、max_bucket、min_bucket、sum_bucket、stats_bucket、extended_stats_bucket、percentiles_bucket、moving_avg、cumulative_sum、bucket_script、bucket_selector、bucket_sort、derivative 等管道聚合
 */

import type { MixinConstructor } from './mixin.types';
import type { Document } from '../types';

import { calculateAverage, calculateStdDev, calculatePercentile } from '../utils';

/**
 * 管道聚合 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithAggregationPipeline<T extends MixinConstructor>(Base: T) {
  return class AggregationPipelineMixin extends Base {
    // ==================== avg_bucket 管道聚合 ====================

    /**
     * avg_bucket 管道聚合（计算桶的平均值）
     * 
     * @param bucketsPath 桶路径（如 'terms_agg>avg_agg'）
     * @param buckets 桶数据
     * @returns 平均值或 null
     */
    avgBucketAggregation(
      bucketsPath: string,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
    ): {
      value: number | null;
    } {
      const values = this.extractBucketValues(bucketsPath, buckets);
      if (values.length === 0) return { value: null };
      return { value: calculateAverage(values) };
    }

    // ==================== max_bucket 管道聚合 ====================

    /**
     * max_bucket 管道聚合（计算桶的最大值）
     * 
     * @param bucketsPath 桶路径
     * @param buckets 桶数据
     * @returns 最大值及对应的桶
     */
    maxBucketAggregation(
      bucketsPath: string,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
    ): {
      value: number | null;
      keys: Array<string | number>;
    } {
      const values = this.extractBucketValuesWithKeys(bucketsPath, buckets);
      if (values.length === 0) return { value: null, keys: [] };

      const maxValue = Math.max(...values.map(v => v.value));
      const maxKeys = values.filter(v => v.value === maxValue).map(v => v.key);

      return { value: maxValue, keys: maxKeys };
    }

    // ==================== min_bucket 管道聚合 ====================

    /**
     * min_bucket 管道聚合（计算桶的最小值）
     * 
     * @param bucketsPath 桶路径
     * @param buckets 桶数据
     * @returns 最小值及对应的桶
     */
    minBucketAggregation(
      bucketsPath: string,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
    ): {
      value: number | null;
      keys: Array<string | number>;
    } {
      const values = this.extractBucketValuesWithKeys(bucketsPath, buckets);
      if (values.length === 0) return { value: null, keys: [] };

      const minValue = Math.min(...values.map(v => v.value));
      const minKeys = values.filter(v => v.value === minValue).map(v => v.key);

      return { value: minValue, keys: minKeys };
    }

    // ==================== sum_bucket 管道聚合 ====================

    /**
     * sum_bucket 管道聚合（计算桶的总和）
     * 
     * @param bucketsPath 桶路径
     * @param buckets 桶数据
     * @returns 总和
     */
    sumBucketAggregation(
      bucketsPath: string,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
    ): {
      value: number | null;
    } {
      const values = this.extractBucketValues(bucketsPath, buckets);
      if (values.length === 0) return { value: null };
      return { value: values.reduce((sum, v) => sum + v, 0) };
    }

    // ==================== stats_bucket 管道聚合 ====================

    /**
     * stats_bucket 管道聚合（计算桶的统计信息）
     * 
     * @param bucketsPath 桶路径
     * @param buckets 桶数据
     * @returns 统计结果
     */
    statsBucketAggregation(
      bucketsPath: string,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
    ): {
      count: number;
      min: number | null;
      max: number | null;
      avg: number | null;
      sum: number;
    } {
      const values = this.extractBucketValues(bucketsPath, buckets);
      const count = values.length;

      return {
        count,
        min: count > 0 ? Math.min(...values) : null,
        max: count > 0 ? Math.max(...values) : null,
        avg: count > 0 ? calculateAverage(values) : null,
        sum: values.reduce((s, v) => s + v, 0),
      };
    }

    // ==================== extended_stats_bucket 管道聚合 ====================

    /**
     * extended_stats_bucket 管道聚合（计算桶的扩展统计信息）
     * 
     * @param bucketsPath 桶路径
     * @param buckets 桶数据
     * @param sigma 标准差倍数
     * @returns 扩展统计结果
     */
    extendedStatsBucketAggregation(
      bucketsPath: string,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
      sigma: number = 2,
    ): {
      count: number;
      min: number | null;
      max: number | null;
      avg: number | null;
      sum: number;
      sum_of_squares: number | null;
      variance: number | null;
      std_deviation: number | null;
      std_deviation_bounds: {
        upper: number | null;
        lower: number | null;
      };
    } {
      const values = this.extractBucketValues(bucketsPath, buckets);
      const count = values.length;

      if (count === 0) {
        return {
          count: 0,
          min: null,
          max: null,
          avg: null,
          sum: 0,
          sum_of_squares: null,
          variance: null,
          std_deviation: null,
          std_deviation_bounds: { upper: null, lower: null },
        };
      }

      const avg = calculateAverage(values) || 0;
      const sum = values.reduce((s, v) => s + v, 0);
      const sumOfSquares = values.reduce((s, v) => s + v * v, 0);
      const variance = values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / count;
      const stdDeviation = Math.sqrt(variance);

      return {
        count,
        min: Math.min(...values),
        max: Math.max(...values),
        avg,
        sum,
        sum_of_squares: sumOfSquares,
        variance,
        std_deviation: stdDeviation,
        std_deviation_bounds: {
          upper: avg + sigma * stdDeviation,
          lower: avg - sigma * stdDeviation,
        },
      };
    }

    // ==================== percentiles_bucket 管道聚合 ====================

    /**
     * percentiles_bucket 管道聚合（计算桶的百分位数）
     * 
     * @param bucketsPath 桶路径
     * @param buckets 桶数据
     * @param percents 百分位数列表
     * @returns 百分位数结果
     */
    percentilesBucketAggregation(
      bucketsPath: string,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
      percents: number[] = [1, 5, 25, 50, 75, 95, 99],
    ): {
      values: Record<string, number | null>;
    } {
      const values = this.extractBucketValues(bucketsPath, buckets);
      const result: Record<string, number | null> = {};

      for (const p of percents) {
        result[String(p)] = values.length > 0 ? calculatePercentile(values, p) : null;
      }

      return { values: result };
    }

    // ==================== moving_avg 管道聚合 ====================

    /**
     * moving_avg 管道聚合（移动平均）
     * 
     * @param bucketsPath 桶路径
     * @param buckets 桶数据
     * @param window 窗口大小
     * @param model 模型（simple、linear、ewma、holt、holt_winters）
     * @param minimize 是否最小化
     * @param settings 模型设置
     * @returns 移动平均结果
     */
    movingAvgAggregation(
      bucketsPath: string,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
      window: number = 5,
      model: 'simple' | 'linear' | 'ewma' | 'holt' | 'holt_winters' = 'simple',
      minimize: boolean = false,
      settings: {
        alpha?: number;
        beta?: number;
        gamma?: number;
        period?: number;
        pad?: boolean;
      } = {},
    ): Array<{
      key: string | number;
      value: number | null;
    }> {
      const values = this.extractBucketValuesWithKeys(bucketsPath, buckets);
      const result: Array<{ key: string | number; value: number | null }> = [];

      for (let i = 0; i < values.length; i++) {
        const start = Math.max(0, i - window + 1);
        const windowValues = values.slice(start, i + 1).map(v => v.value);

        let avg: number | null = null;
        if (windowValues.length > 0) {
          switch (model) {
            case 'simple':
              avg = calculateAverage(windowValues);
              break;
            case 'linear':
              // 线性加权移动平均
              let weightedSum = 0;
              let weightSum = 0;
              for (let j = 0; j < windowValues.length; j++) {
                const weight = j + 1;
                weightedSum += windowValues[j] * weight;
                weightSum += weight;
              }
              avg = weightSum > 0 ? weightedSum / weightSum : null;
              break;
            case 'ewma':
              // 指数加权移动平均
              const alpha = settings.alpha || 0.3;
              avg = windowValues[0];
              for (let j = 1; j < windowValues.length; j++) {
                avg = alpha * windowValues[j] + (1 - alpha) * (avg || 0);
              }
              break;
            default:
              avg = calculateAverage(windowValues);
          }
        }

        result.push({ key: values[i].key, value: avg });
      }

      return result;
    }

    // ==================== cumulative_sum 管道聚合 ====================

    /**
     * cumulative_sum 管道聚合（累积求和）
     * 
     * @param bucketsPath 桶路径
     * @param buckets 桶数据
     * @returns 累积求和结果
     */
    cumulativeSumAggregation(
      bucketsPath: string,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
    ): Array<{
      key: string | number;
      value: number;
    }> {
      const values = this.extractBucketValuesWithKeys(bucketsPath, buckets);
      const result: Array<{ key: string | number; value: number }> = [];
      let cumulativeSum = 0;

      for (const { key, value } of values) {
        cumulativeSum += value;
        result.push({ key, value: cumulativeSum });
      }

      return result;
    }

    // ==================== derivative 管道聚合 ====================

    /**
     * derivative 管道聚合（导数）
     * 
     * @param bucketsPath 桶路径
     * @param buckets 桶数据
     * @param unit 时间单位（用于二阶导数）
     * @returns 导数结果
     */
    derivativeAggregation(
      bucketsPath: string,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
      unit?: string,
    ): Array<{
      key: string | number;
      value: number | null;
      normalized_value?: number | null;
    }> {
      const values = this.extractBucketValuesWithKeys(bucketsPath, buckets);
      const result: Array<{ key: string | number; value: number | null; normalized_value?: number | null }> = [];

      for (let i = 0; i < values.length; i++) {
        if (i === 0) {
          result.push({ key: values[i].key, value: null });
        } else {
          const derivative = values[i].value - values[i - 1].value;
          const item: { key: string | number; value: number | null; normalized_value?: number | null } = {
            key: values[i].key,
            value: derivative,
          };

          // 归一化值（如果指定了时间单位）
          if (unit) {
            const unitMs = this.parseUnitToMs(unit);
            if (unitMs > 0) {
              const key1 = typeof values[i - 1].key === 'number' ? (values[i - 1].key as number) : 0;
              const key2 = typeof values[i].key === 'number' ? (values[i].key as number) : 0;
              const timeDiff = (key2 - key1) / unitMs;
              if (timeDiff > 0) {
                item.normalized_value = derivative / timeDiff;
              }
            }
          }

          result.push(item);
        }
      }

      return result;
    }

    // ==================== bucket_script 管道聚合 ====================

    /**
     * bucket_script 管道聚合（桶脚本）
     * 
     * @param bucketsPathMap 桶路径映射（变量名 -> 桶路径）
     * @param buckets 桶数据
     * @param script 脚本
     * @returns 脚本执行结果
     */
    bucketScriptAggregation(
      bucketsPathMap: Record<string, string>,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
      script: {
        source: string;
        lang?: string;
        params?: Record<string, any>;
      },
    ): Array<{
      key: string | number;
      value: number | null;
    }> {
      const result: Array<{ key: string | number; value: number | null }> = [];

      for (let i = 0; i < buckets.length; i++) {
        const params: Record<string, any> = { ...(script.params || {}) };

        // 提取每个变量的值
        for (const [varName, bucketsPath] of Object.entries(bucketsPathMap)) {
          const value = this.extractBucketValueAt(bucketsPath, buckets, i);
          params[varName] = value;
        }

        // 执行脚本（简化实现：只支持简单算术运算）
        const value = this.executeSimpleScript(script.source, params);
        result.push({ key: buckets[i].key, value });
      }

      return result;
    }

    // ==================== bucket_selector 管道聚合 ====================

    /**
     * bucket_selector 管道聚合（桶选择器）
     * 
     * @param bucketsPathMap 桶路径映射
     * @param buckets 桶数据
     * @param script 脚本（返回布尔值）
     * @returns 过滤后的桶
     */
    bucketSelectorAggregation(
      bucketsPathMap: Record<string, string>,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
      script: {
        source: string;
        lang?: string;
        params?: Record<string, any>;
      },
    ): Array<{ key: string | number; doc_count: number; [key: string]: any }> {
      return buckets.filter((bucket, i) => {
        const params: Record<string, any> = { ...(script.params || {}) };

        for (const [varName, bucketsPath] of Object.entries(bucketsPathMap)) {
          const value = this.extractBucketValueAt(bucketsPath, buckets, i);
          params[varName] = value;
        }

        const result = this.executeSimpleScript(script.source, params);
        return result !== 0 && result !== null;
      });
    }

    // ==================== bucket_sort 管道聚合 ====================

    /**
     * bucket_sort 管道聚合（桶排序）
     * 
     * @param buckets 桶数据
     * @param sort 排序配置
     * @param from 起始位置
     * @param size 大小
     * @returns 排序后的桶
     */
    bucketSortAggregation(
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
      sort?: Array<Record<string, { order?: 'asc' | 'desc' }>>,
      from: number = 0,
      size: number = 10,
    ): Array<{ key: string | number; doc_count: number; [key: string]: any }> {
      let result = [...buckets];

      // 排序
      if (sort && sort.length > 0) {
        result.sort((a, b) => {
          for (const sortItem of sort) {
            for (const [field, config] of Object.entries(sortItem)) {
              const order = config.order || 'asc';
              const aValue = field === '_key' ? a.key : a[field] || a.doc_count;
              const bValue = field === '_key' ? b.key : b[field] || b.doc_count;

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

      // 分页
      return result.slice(from, from + size);
    }

    // ==================== 工具方法 ====================

    /**
     * 提取桶中的数值
     * 
     * @param bucketsPath 桶路径
     * @param buckets 桶数据
     * @returns 数值数组
     */
    protected extractBucketValues(
      bucketsPath: string,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
    ): number[] {
      const values: number[] = [];
      const pathParts = bucketsPath.split('>');
      const metricName = pathParts[pathParts.length - 1];

      for (const bucket of buckets) {
        const metric = bucket[metricName];
        if (metric && typeof metric.value === 'number') {
          values.push(metric.value);
        } else if (typeof bucket[metricName] === 'number') {
          values.push(bucket[metricName]);
        }
      }

      return values;
    }

    /**
     * 提取桶中的数值及对应的键
     * 
     * @param bucketsPath 桶路径
     * @param buckets 桶数据
     * @returns 数值及键数组
     */
    protected extractBucketValuesWithKeys(
      bucketsPath: string,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
    ): Array<{ key: string | number; value: number }> {
      const values: Array<{ key: string | number; value: number }> = [];
      const pathParts = bucketsPath.split('>');
      const metricName = pathParts[pathParts.length - 1];

      for (const bucket of buckets) {
        const metric = bucket[metricName];
        if (metric && typeof metric.value === 'number') {
          values.push({ key: bucket.key, value: metric.value });
        } else if (typeof bucket[metricName] === 'number') {
          values.push({ key: bucket.key, value: bucket[metricName] });
        }
      }

      return values;
    }

    /**
     * 提取指定索引处的桶数值
     * 
     * @param bucketsPath 桶路径
     * @param buckets 桶数据
     * @param index 索引
     * @returns 数值或 null
     */
    protected extractBucketValueAt(
      bucketsPath: string,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
      index: number,
    ): number | null {
      if (index < 0 || index >= buckets.length) return null;

      const pathParts = bucketsPath.split('>');
      const metricName = pathParts[pathParts.length - 1];
      const bucket = buckets[index];

      const metric = bucket[metricName];
      if (metric && typeof metric.value === 'number') {
        return metric.value;
      } else if (typeof bucket[metricName] === 'number') {
        return bucket[metricName];
      }

      return null;
    }

    /**
     * 解析时间单位为毫秒
     * 
     * @param unit 时间单位
     * @returns 毫秒数
     */
    protected parseUnitToMs(unit: string): number {
      const units: Record<string, number> = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
        M: 30 * 24 * 60 * 60 * 1000,
        q: 90 * 24 * 60 * 60 * 1000,
        y: 365 * 24 * 60 * 60 * 1000,
      };
      return units[unit] || 0;
    }

    /**
     * 执行简单脚本
     * 
     * @param source 脚本源
     * @param params 参数
     * @returns 执行结果
     */
    protected executeSimpleScript(source: string, params: Record<string, any>): number | null {
      try {
        // 替换参数
        let expression = source;
        for (const [key, value] of Object.entries(params)) {
          expression = expression.replace(new RegExp(`\\b${key}\\b`, 'g'), JSON.stringify(value));
        }

        // 安全评估（只允许简单算术运算）
        if (/^[\d\s+\-*/().]+$/.test(expression)) {
          return eval(expression);
        }

        return null;
      } catch {
        return null;
      }
    }

    /**
     * 执行管道聚合
     * 
     * @param bucketsPath 桶路径
     * @param buckets 桶数据
     * @param aggConfig 聚合配置
     * @returns 聚合结果
     */
    executePipelineAggregation(
      bucketsPath: string,
      buckets: Array<{ key: string | number; doc_count: number; [key: string]: any }>,
      aggConfig: any,
    ): any {
      if (aggConfig.avg_bucket) {
        return this.avgBucketAggregation(aggConfig.avg_bucket.buckets_path || bucketsPath, buckets);
      }
      if (aggConfig.max_bucket) {
        return this.maxBucketAggregation(aggConfig.max_bucket.buckets_path || bucketsPath, buckets);
      }
      if (aggConfig.min_bucket) {
        return this.minBucketAggregation(aggConfig.min_bucket.buckets_path || bucketsPath, buckets);
      }
      if (aggConfig.sum_bucket) {
        return this.sumBucketAggregation(aggConfig.sum_bucket.buckets_path || bucketsPath, buckets);
      }
      if (aggConfig.stats_bucket) {
        return this.statsBucketAggregation(aggConfig.stats_bucket.buckets_path || bucketsPath, buckets);
      }
      if (aggConfig.extended_stats_bucket) {
        return this.extendedStatsBucketAggregation(
          aggConfig.extended_stats_bucket.buckets_path || bucketsPath,
          buckets,
          aggConfig.extended_stats_bucket.sigma || 2,
        );
      }
      if (aggConfig.percentiles_bucket) {
        return this.percentilesBucketAggregation(
          aggConfig.percentiles_bucket.buckets_path || bucketsPath,
          buckets,
          aggConfig.percentiles_bucket.percents || [1, 5, 25, 50, 75, 95, 99],
        );
      }
      if (aggConfig.moving_avg) {
        return {
          buckets: this.movingAvgAggregation(
            aggConfig.moving_avg.buckets_path || bucketsPath,
            buckets,
            aggConfig.moving_avg.window || 5,
            aggConfig.moving_avg.model || 'simple',
            aggConfig.moving_avg.minimize,
            aggConfig.moving_avg.settings || {},
          ),
        };
      }
      if (aggConfig.cumulative_sum) {
        return {
          buckets: this.cumulativeSumAggregation(
            aggConfig.cumulative_sum.buckets_path || bucketsPath,
            buckets,
          ),
        };
      }
      if (aggConfig.derivative) {
        return {
          buckets: this.derivativeAggregation(
            aggConfig.derivative.buckets_path || bucketsPath,
            buckets,
            aggConfig.derivative.unit,
          ),
        };
      }
      if (aggConfig.bucket_script) {
        return {
          buckets: this.bucketScriptAggregation(
            aggConfig.bucket_script.buckets_path || {},
            buckets,
            aggConfig.bucket_script.script,
          ),
        };
      }
      if (aggConfig.bucket_selector) {
        return {
          buckets: this.bucketSelectorAggregation(
            aggConfig.bucket_selector.buckets_path || {},
            buckets,
            aggConfig.bucket_selector.script,
          ),
        };
      }
      if (aggConfig.bucket_sort) {
        return {
          buckets: this.bucketSortAggregation(
            buckets,
            aggConfig.bucket_sort.sort,
            aggConfig.bucket_sort.from || 0,
            aggConfig.bucket_sort.size || 10,
          ),
        };
      }

      return { value: null };
    }
  };
}
