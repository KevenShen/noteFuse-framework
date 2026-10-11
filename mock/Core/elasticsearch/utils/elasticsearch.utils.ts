/**
 * Elasticsearch 核心工具函数
 * 
 * 包含：UUID生成、评分计算（BM25算法）、文本相似度、日期解析、数值范围判断等
 */

import type { GeoPoint } from '../types';

// ==================== UUID 生成 ====================

/**
 * 生成 UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 生成简单 ID（时间戳 + 随机数）
 */
export function generateSimpleId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}

// ==================== BM25 评分算法 ====================

/**
 * BM25 评分算法参数
 */
export interface BM25Params {
  /** k1 参数，控制词频饱和（默认1.2） */
  k1?: number;
  /** b 参数，控制文档长度归一化（默认0.75） */
  b?: number;
  /** 平均文档长度 */
  avgdl?: number;
}

/**
 * 计算 BM25 评分
 * 
 * BM25 是 Elasticsearch 默认的相关性评分算法
 * 公式：score = IDF * (TF * (k1 + 1)) / (TF + k1 * (1 - b + b * dl / avgdl))
 * 
 * @param termFrequency 词频（词条在文档中出现的次数）
 * @param documentFrequency 文档频率（包含该词条的文档数）
 * @param totalDocuments 总文档数
 * @param documentLength 当前文档长度
 * @param params BM25 参数
 * @returns BM25 评分
 */
export function calculateBM25(
  termFrequency: number,
  documentFrequency: number,
  totalDocuments: number,
  documentLength: number,
  params: BM25Params = {},
): number {
  const { k1 = 1.2, b = 0.75, avgdl = documentLength || 1 } = params;

  if (termFrequency <= 0 || totalDocuments <= 0) {
    return 0;
  }

  // IDF（逆文档频率）
  const idf = Math.log(1 + (totalDocuments - documentFrequency + 0.5) / (documentFrequency + 0.5));

  // TF（词频归一化）
  const tf = (termFrequency * (k1 + 1)) / (termFrequency + k1 * (1 - b + (b * documentLength) / avgdl));

  return idf * tf;
}

/**
 * 计算多字段 BM25 评分（加权求和）
 */
export function calculateMultiFieldBM25(
  fieldScores: Array<{ field: string; score: number; boost?: number }>,
): number {
  let totalScore = 0;
  let totalBoost = 0;

  for (const { score, boost = 1 } of fieldScores) {
    totalScore += score * boost;
    totalBoost += boost;
  }

  return totalBoost > 0 ? totalScore / totalBoost : 0;
}

// ==================== 文本相似度 ====================

/**
 * 计算编辑距离（Levenshtein距离）
 * 
 * @param a 字符串a
 * @param b 字符串b
 * @returns 编辑距离
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 替换
          matrix[i][j - 1] + 1,     // 插入
          matrix[i - 1][j] + 1,     // 删除
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * 标准分词器
 * 
 * 将文本按非字母数字字符分割，并转换为小写
 * 
 * @param text 文本
 * @returns 词条列表
 */
export function standardTokenizer(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/)
    .filter(t => t && t.length > 0);
}

/**
 * 计算文本相似度（0-1）
 * 
 * @param a 字符串a
 * @param b 字符串b
 * @returns 相似度（0-1）
 */
export function textSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;

  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLength = Math.max(a.length, b.length);

  return maxLength > 0 ? 1 - distance / maxLength : 0;
}

/**
 * 检查文本是否匹配模糊查询
 * 
 * @param text 文本
 * @param query 查询词
 * @param fuzziness 模糊度（允许的编辑距离）
 * @returns 是否匹配
 */
export function fuzzyMatch(text: string, query: string, fuzziness: number | string = 'AUTO'): boolean {
  const maxEdits = fuzziness === 'AUTO'
    ? (query.length <= 2 ? 0 : query.length <= 5 ? 1 : 2)
    : typeof fuzziness === 'number' ? fuzziness : 2;

  return levenshteinDistance(text.toLowerCase(), query.toLowerCase()) <= maxEdits;
}

/**
 * 检查文本是否匹配通配符查询
 * 
 * @param text 文本
 * @param pattern 通配符模式（* 匹配任意字符，? 匹配单个字符）
 * @returns 是否匹配
 */
export function wildcardMatch(text: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义正则特殊字符
    .replace(/\*/g, '.*')                   // * -> .*
    .replace(/\?/g, '.');                    // ? -> .

  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(text);
}

/**
 * 检查文本是否匹配前缀查询
 */
export function prefixMatch(text: string, prefix: string): boolean {
  return text.toLowerCase().startsWith(prefix.toLowerCase());
}

/**
 * 检查文本是否匹配短语查询
 */
export function phraseMatch(text: string, phrase: string, slop: number = 0): boolean {
  const textWords = text.toLowerCase().split(/\s+/);
  const phraseWords = phrase.toLowerCase().split(/\s+/);

  if (phraseWords.length === 0) return true;
  if (textWords.length < phraseWords.length) return false;

  // 精确匹配（slop=0）
  if (slop === 0) {
    for (let i = 0; i <= textWords.length - phraseWords.length; i++) {
      let match = true;
      for (let j = 0; j < phraseWords.length; j++) {
        if (textWords[i + j] !== phraseWords[j]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    return false;
  }

  // 带 slop 的匹配（允许词序变化和间隔）
  return fuzzyPhraseMatch(textWords, phraseWords, slop);
}

/**
 * 模糊短语匹配（带 slop）
 */
function fuzzyPhraseMatch(textWords: string[], phraseWords: string[], slop: number): boolean {
  const positions: number[][] = phraseWords.map(word =>
    textWords.reduce<number[]>((acc, w, i) => (w === word ? [...acc, i] : acc), []),
  );

  if (positions.some(p => p.length === 0)) return false;

  // 使用动态规划寻找最小编辑距离
  return findPhraseMatch(positions, slop);
}

/**
 * 寻找短语匹配（简化版）
 */
function findPhraseMatch(positions: number[][], slop: number): boolean {
  // 简化实现：检查是否存在一个位置序列，其总位移不超过 slop
  const firstPositions = positions[0];

  for (const startPos of firstPositions) {
    let currentPos = startPos;
    let totalSlop = 0;
    let valid = true;

    for (let i = 1; i < positions.length; i++) {
      const nextPositions = positions[i].filter(p => p > currentPos);
      if (nextPositions.length === 0) {
        valid = false;
        break;
      }
      const nextPos = Math.min(...nextPositions);
      totalSlop += nextPos - currentPos - 1;
      currentPos = nextPos;
    }

    if (valid && totalSlop <= slop) {
      return true;
    }
  }

  return false;
}

// ==================== 日期解析 ====================

/**
 * 解析日期字符串为时间戳
 * 
 * 支持格式：
 * - ISO 8601: "2023-01-01T00:00:00Z"
 * - 日期: "2023-01-01"
 * - 时间戳: 1672531200000
 * - 相对时间: "now", "now-1d", "now+1h"
 */
export function parseDate(value: string | number): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (!value) return null;

  // 相对时间
  if (value.startsWith('now')) {
    return parseRelativeDate(value);
  }

  // 尝试解析为日期
  const timestamp = Date.parse(value);
  if (!isNaN(timestamp)) {
    return timestamp;
  }

  return null;
}

/**
 * 解析相对日期（如 "now-1d", "now+1h"）
 */
export function parseRelativeDate(value: string): number {
  const now = Date.now();

  if (value === 'now') {
    return now;
  }

  const match = value.match(/^now([+-])(\d+)([smhdwMy])$/);
  if (!match) {
    return now;
  }

  const [, sign, amountStr, unit] = match;
  const amount = parseInt(amountStr, 10);
  const multiplier = sign === '+' ? 1 : -1;

  const unitMultipliers: Record<string, number> = {
    s: 1000,           // 秒
    m: 60 * 1000,      // 分钟
    h: 60 * 60 * 1000, // 小时
    d: 24 * 60 * 60 * 1000, // 天
    w: 7 * 24 * 60 * 60 * 1000, // 周
    M: 30 * 24 * 60 * 60 * 1000, // 月（近似）
    y: 365 * 24 * 60 * 60 * 1000, // 年（近似）
  };

  return now + multiplier * amount * (unitMultipliers[unit] || 0);
}

/**
 * 格式化日期为 ISO 字符串
 */
export function formatDate(timestamp: number, format?: string): string {
  const date = new Date(timestamp);

  if (!format) {
    return date.toISOString();
  }

  return format
    .replace('YYYY', date.getFullYear().toString())
    .replace('MM', (date.getMonth() + 1).toString().padStart(2, '0'))
    .replace('DD', date.getDate().toString().padStart(2, '0'))
    .replace('HH', date.getHours().toString().padStart(2, '0'))
    .replace('mm', date.getMinutes().toString().padStart(2, '0'))
    .replace('ss', date.getSeconds().toString().padStart(2, '0'))
    .replace('SSS', date.getMilliseconds().toString().padStart(3, '0'));
}

// ==================== 数值范围判断 ====================

/**
 * 检查值是否在范围内
 */
export function inRange(value: number | string, range: {
  gt?: number | string;
  gte?: number | string;
  lt?: number | string;
  lte?: number | string;
}): boolean {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    // 字符串比较
    if (range.gt !== undefined && value <= range.gt) return false;
    if (range.gte !== undefined && value < range.gte) return false;
    if (range.lt !== undefined && value >= range.lt) return false;
    if (range.lte !== undefined && value > range.lte) return false;
    return true;
  }

  const gt = range.gt !== undefined ? (typeof range.gt === 'string' ? parseFloat(range.gt) : range.gt) : undefined;
  const gte = range.gte !== undefined ? (typeof range.gte === 'string' ? parseFloat(range.gte) : range.gte) : undefined;
  const lt = range.lt !== undefined ? (typeof range.lt === 'string' ? parseFloat(range.lt) : range.lt) : undefined;
  const lte = range.lte !== undefined ? (typeof range.lte === 'string' ? parseFloat(range.lte) : range.lte) : undefined;

  if (gt !== undefined && numValue <= gt) return false;
  if (gte !== undefined && numValue < gte) return false;
  if (lt !== undefined && numValue >= lt) return false;
  if (lte !== undefined && numValue > lte) return false;

  return true;
}

// ==================== 地理位置计算 ====================

/**
 * 计算两个地理坐标点之间的距离（Haversine公式）
 * 
 * @param point1 坐标点1
 * @param point2 坐标点2
 * @param unit 单位（m/km/mi/ft/nmi）
 * @returns 距离
 */
export function calculateGeoDistance(
  point1: GeoPoint,
  point2: GeoPoint,
  unit: 'm' | 'km' | 'mi' | 'ft' | 'nmi' = 'm',
): number {
  const R = {
    m: 6371000,
    km: 6371,
    mi: 3959,
    ft: 20902231,
    nmi: 3440,
  };

  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lon - point1.lon);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R[unit] * c;
}

/**
 * 角度转弧度
 */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * 检查点是否在边界框内
 */
export function pointInBoundingBox(
  point: GeoPoint,
  topLeft: GeoPoint,
  bottomRight: GeoPoint,
): boolean {
  return (
    point.lat <= topLeft.lat &&
    point.lat >= bottomRight.lat &&
    point.lon >= topLeft.lon &&
    point.lon <= bottomRight.lon
  );
}

/**
 * 检查点是否在多边形内（射线法）
 */
export function pointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
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

// ==================== 统计计算 ====================

/**
 * 计算平均值
 */
export function calculateAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * 计算标准差
 */
export function calculateStdDev(values: number[], population: boolean = false): number | null {
  if (values.length === 0) return null;

  const avg = calculateAverage(values)!;
  const squaredDiffs = values.map(v => (v - avg) ** 2);
  const variance = population
    ? squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length
    : squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

/**
 * 计算百分位数
 */
export function calculatePercentile(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  if (percentile < 0 || percentile > 100) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * 计算基数估计（HyperLogLog 简化版）
 */
export function estimateCardinality(values: any[], precision: number = 4096): number {
  const set = new Set(values.map(v => JSON.stringify(v)));
  return set.size;
}

// ==================== 调试日志 ====================

/**
 * 调试日志
 */
export function debugLog(enabled: boolean, message: string, ...args: any[]): void {
  if (enabled) {
    console.log(`[Elasticsearch Mock] ${message}`, ...args);
  }
}

// ==================== 深拷贝 ====================

/**
 * 深拷贝对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Map) {
    return new Map(Array.from(obj.entries()).map(([k, v]) => [k, deepClone(v)])) as unknown as T;
  }

  if (obj instanceof Set) {
    return new Set(Array.from(obj.values()).map(v => deepClone(v))) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }

  const cloned: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone((obj as Record<string, any>)[key]);
    }
  }

  return cloned as T;
}

// ==================== 字段值提取 ====================

/**
 * 从对象中提取嵌套字段值
 * 
 * @param obj 对象
 * @param path 字段路径（如 "a.b.c"）
 * @returns 字段值
 */
export function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      // 数组：尝试所有元素
      const values = current
        .map(item => getNestedValue(item, parts.slice(parts.indexOf(part)).join('.')))
        .filter(v => v !== undefined);
      return values.length > 0 ? values.flat() : undefined;
    }

    current = current[part];
  }

  return current;
}

/**
 * 设置嵌套字段值
 */
export function setNestedValue(obj: any, path: string, value: any): void {
  if (!obj || !path) return;

  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

// ==================== 安全 JSON 解析 ====================

/**
 * 安全解析 JSON
 */
export function safeJsonParse<T = any>(str: string, defaultValue: T | null = null): T | null {
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 安全字符串化 JSON
 */
export function safeJsonStringify(obj: any, defaultValue: string = ''): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return defaultValue;
  }
}
