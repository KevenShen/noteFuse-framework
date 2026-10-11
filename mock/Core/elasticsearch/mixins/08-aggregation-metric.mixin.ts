/**
 * L3 分析层 - 指标聚合 Mixin
 * 
 * 包含：值计数、平均值、总和、最小值、最大值、统计、扩展统计、百分位数、百分位等级、基数、中位数绝对偏差等
 */

import type { MixinConstructor } from './mixin.types';
import type { Document } from '../types';

import {
  calculateAverage,
  calculateStdDev,
  calculatePercentile,
  estimateCardinality,
} from '../utils';

/**
 * 指标聚合 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithAggregationMetric<T extends MixinConstructor>(Base: T) {
  return class AggregationMetricMixin extends Base {
    // ==================== 值计数聚合 ====================

    /**
     * 值计数聚合
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @returns 计数值
     */
    valueCountAggregation(docs: Document[], field: string): number {
      let count = 0;
      for (const doc of docs) {
        const value = this.getNestedValue(doc._source, field);
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            count += value.length;
          } else {
            count++;
          }
        }
      }
      return count;
    }

    // ==================== 平均值聚合 ====================

    /**
     * 平均值聚合
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @returns 平均值或 null
     */
    avgAggregation(docs: Document[], field: string): number | null {
      const values = this.extractNumericValues(docs, field);
      if (values.length === 0) return null;
      return calculateAverage(values);
    }

    // ==================== 总和聚合 ====================

    /**
     * 总和聚合
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @returns 总和
     */
    sumAggregation(docs: Document[], field: string): number {
      const values = this.extractNumericValues(docs, field);
      return values.reduce((sum, v) => sum + v, 0);
    }

    // ==================== 最小值聚合 ====================

    /**
     * 最小值聚合
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @returns 最小值或 null
     */
    minAggregation(docs: Document[], field: string): number | null {
      const values = this.extractNumericValues(docs, field);
      if (values.length === 0) return null;
      return Math.min(...values);
    }

    // ==================== 最大值聚合 ====================

    /**
     * 最大值聚合
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @returns 最大值或 null
     */
    maxAggregation(docs: Document[], field: string): number | null {
      const values = this.extractNumericValues(docs, field);
      if (values.length === 0) return null;
      return Math.max(...values);
    }

    // ==================== 统计聚合 ====================

    /**
     * 统计聚合（count、min、max、avg、sum）
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @returns 统计结果
     */
    statsAggregation(docs: Document[], field: string): {
      count: number;
      min: number | null;
      max: number | null;
      avg: number | null;
      sum: number;
    } {
      const values = this.extractNumericValues(docs, field);
      const count = values.length;

      return {
        count,
        min: count > 0 ? Math.min(...values) : null,
        max: count > 0 ? Math.max(...values) : null,
        avg: count > 0 ? calculateAverage(values) : null,
        sum: values.reduce((sum, v) => sum + v, 0),
      };
    }

    // ==================== 扩展统计聚合 ====================

    /**
     * 扩展统计聚合（包含方差、标准差等）
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param sigma 标准差倍数（默认2）
     * @returns 扩展统计结果
     */
    extendedStatsAggregation(
      docs: Document[],
      field: string,
      sigma: number = 2,
    ): {
      count: number;
      min: number | null;
      max: number | null;
      avg: number | null;
      sum: number;
      sum_of_squares: number | null;
      variance: number | null;
      variance_population: number | null;
      variance_sampling: number | null;
      std_deviation: number | null;
      std_deviation_population: number | null;
      std_deviation_sampling: number | null;
      std_deviation_bounds: {
        upper: number | null;
        lower: number | null;
      };
    } {
      const values = this.extractNumericValues(docs, field);
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
          variance_population: null,
          variance_sampling: null,
          std_deviation: null,
          std_deviation_population: null,
          std_deviation_sampling: null,
          std_deviation_bounds: { upper: null, lower: null },
        };
      }

      const avg = calculateAverage(values) || 0;
      const sum = values.reduce((s, v) => s + v, 0);
      const sumOfSquares = values.reduce((s, v) => s + v * v, 0);

      // 总体方差
      const variancePopulation = values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / count;
      // 样本方差
      const varianceSampling = count > 1
        ? values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / (count - 1)
        : 0;

      const stdDeviationPopulation = Math.sqrt(variancePopulation);
      const stdDeviationSampling = Math.sqrt(varianceSampling);

      return {
        count,
        min: Math.min(...values),
        max: Math.max(...values),
        avg,
        sum,
        sum_of_squares: sumOfSquares,
        variance: variancePopulation,
        variance_population: variancePopulation,
        variance_sampling: varianceSampling,
        std_deviation: stdDeviationPopulation,
        std_deviation_population: stdDeviationPopulation,
        std_deviation_sampling: stdDeviationSampling,
        std_deviation_bounds: {
          upper: avg + sigma * stdDeviationPopulation,
          lower: avg - sigma * stdDeviationPopulation,
        },
      };
    }

    // ==================== 百分位数聚合 ====================

    /**
     * 百分位数聚合
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param percents 百分位数列表（默认 [1, 5, 25, 50, 75, 95, 99]）
     * @returns 百分位数结果
     */
    percentilesAggregation(
      docs: Document[],
      field: string,
      percents: number[] = [1, 5, 25, 50, 75, 95, 99],
    ): Record<string, number | null> {
      const values = this.extractNumericValues(docs, field);
      const result: Record<string, number | null> = {};

      for (const p of percents) {
        result[String(p)] = values.length > 0 ? calculatePercentile(values, p) : null;
      }

      return result;
    }

    // ==================== 百分位等级聚合 ====================

    /**
     * 百分位等级聚合
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param values 要计算等级的值列表
     * @returns 百分位等级结果
     */
    percentileRanksAggregation(
      docs: Document[],
      field: string,
      values: number[],
    ): Record<string, number | null> {
      const fieldValues = this.extractNumericValues(docs, field).sort((a, b) => a - b);
      const result: Record<string, number | null> = {};

      for (const v of values) {
        if (fieldValues.length === 0) {
          result[String(v)] = null;
        } else {
          // 计算小于等于 v 的值的比例
          const lessOrEqual = fieldValues.filter(x => x <= v).length;
          result[String(v)] = (lessOrEqual / fieldValues.length) * 100;
        }
      }

      return result;
    }

    // ==================== 基数聚合 ====================

    /**
     * 基数聚合（去重计数）
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @param precisionThreshold 精度阈值（默认3000）
     * @returns 基数值
     */
    cardinalityAggregation(
      docs: Document[],
      field: string,
      precisionThreshold: number = 3000,
    ): number {
      const uniqueValues = new Set<string>();

      for (const doc of docs) {
        const value = this.getNestedValue(doc._source, field);
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            for (const v of value) {
              uniqueValues.add(String(v));
            }
          } else {
            uniqueValues.add(String(value));
          }
        }
      }

      // 精确计数（小数据集）
      if (uniqueValues.size <= precisionThreshold) {
        return uniqueValues.size;
      }

      // 近似计数（大数据集，使用 HyperLogLog 简化实现）
      return estimateCardinality(Array.from(uniqueValues));
    }

    // ==================== 中位数绝对偏差聚合 ====================

    /**
     * 中位数绝对偏差聚合
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @returns 中位数绝对偏差或 null
     */
    medianAbsoluteDeviationAggregation(
      docs: Document[],
      field: string,
    ): number | null {
      const values = this.extractNumericValues(docs, field);
      if (values.length === 0) return null;

      // 计算中位数
      const median = calculatePercentile(values, 50) || 0;

      // 计算绝对偏差
      const deviations = values.map(v => Math.abs(v - median));

      // 计算偏差的中位数
      return calculatePercentile(deviations, 50);
    }

    // ==================== 加权平均值聚合 ====================

    /**
     * 加权平均值聚合
     * 
     * @param docs 文档列表
     * @param field 值字段
     * @param weightField 权重字段
     * @returns 加权平均值或 null
     */
    weightedAvgAggregation(
      docs: Document[],
      field: string,
      weightField: string,
    ): {
      value: number | null;
      value_count: number;
    } {
      let weightedSum = 0;
      let weightSum = 0;
      let count = 0;

      for (const doc of docs) {
        const value = this.getNestedValue(doc._source, field);
        const weight = this.getNestedValue(doc._source, weightField);

        if (typeof value === 'number' && typeof weight === 'number') {
          weightedSum += value * weight;
          weightSum += weight;
          count++;
        }
      }

      return {
        value: weightSum > 0 ? weightedSum / weightSum : null,
        value_count: count,
      };
    }

    // ==================== 工具方法 ====================

    /**
     * 提取文档中的数值
     * 
     * @param docs 文档列表
     * @param field 字段名
     * @returns 数值数组
     */
    protected extractNumericValues(docs: Document[], field: string): number[] {
      const values: number[] = [];

      for (const doc of docs) {
        const value = this.getNestedValue(doc._source, field);
        if (typeof value === 'number') {
          values.push(value);
        } else if (Array.isArray(value)) {
          for (const v of value) {
            if (typeof v === 'number') {
              values.push(v);
            }
          }
        }
      }

      return values;
    }

    /**
     * 执行指标聚合
     * 
     * @param docs 文档列表
     * @param aggConfig 聚合配置
     * @returns 聚合结果
     */
    executeMetricAggregation(
      docs: Document[],
      aggConfig: any,
    ): any {
      if (aggConfig.value_count) {
        return { value: this.valueCountAggregation(docs, aggConfig.value_count.field) };
      }
      if (aggConfig.avg) {
        return { value: this.avgAggregation(docs, aggConfig.avg.field) };
      }
      if (aggConfig.sum) {
        return { value: this.sumAggregation(docs, aggConfig.sum.field) };
      }
      if (aggConfig.min) {
        return { value: this.minAggregation(docs, aggConfig.min.field) };
      }
      if (aggConfig.max) {
        return { value: this.maxAggregation(docs, aggConfig.max.field) };
      }
      if (aggConfig.stats) {
        return this.statsAggregation(docs, aggConfig.stats.field);
      }
      if (aggConfig.extended_stats) {
        return this.extendedStatsAggregation(
          docs,
          aggConfig.extended_stats.field,
          aggConfig.extended_stats.sigma || 2,
        );
      }
      if (aggConfig.percentiles) {
        return {
          values: this.percentilesAggregation(
            docs,
            aggConfig.percentiles.field,
            aggConfig.percentiles.percents || [1, 5, 25, 50, 75, 95, 99],
          ),
        };
      }
      if (aggConfig.percentile_ranks) {
        return {
          values: this.percentileRanksAggregation(
            docs,
            aggConfig.percentile_ranks.field,
            aggConfig.percentile_ranks.values || [],
          ),
        };
      }
      if (aggConfig.cardinality) {
        return {
          value: this.cardinalityAggregation(
            docs,
            aggConfig.cardinality.field,
            aggConfig.cardinality.precision_threshold || 3000,
          ),
        };
      }
      if (aggConfig.median_absolute_deviation) {
        return {
          value: this.medianAbsoluteDeviationAggregation(
            docs,
            aggConfig.median_absolute_deviation.field,
          ),
        };
      }
      if (aggConfig.weighted_avg) {
        return this.weightedAvgAggregation(
          docs,
          aggConfig.weighted_avg.value.field,
          aggConfig.weighted_avg.weight.field,
        );
      }

      return { value: null };
    }
  };
}
