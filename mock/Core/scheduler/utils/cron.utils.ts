/**
 * Cron 表达式解析器
 *
 * 支持标准 5 段式 cron 表达式：分 时 日 月 周
 * - 通配符：*
 * - 范围：1-5
 * - 列表：1,3,5
 * - 步长：每5分钟 或 1-10每2个
 */

import type { CronParsed } from '../types';

/**
 * 解析 cron 表达式
 * @param expression cron 表达式（5 段式）
 * @returns 解析结果
 */
export function parseCron(expression: string): CronParsed {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: ${expression} (expected 5 fields)`);
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  return {
    minute: parseField(minute, 0, 59),
    hour: parseField(hour, 0, 23),
    dayOfMonth: parseField(dayOfMonth, 1, 31),
    month: parseField(month, 1, 12),
    dayOfWeek: parseField(dayOfWeek, 0, 6),
  };
}

/**
 * 解析单个字段
 */
function parseField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();

  // 处理逗号分隔的列表
  const segments = field.split(',');
  for (const segment of segments) {
    parseSegment(segment, min, max, values);
  }

  return Array.from(values).sort((a, b) => a - b);
}

/**
 * 解析单个段（可能包含范围和步长）
 */
function parseSegment(segment: string, min: number, max: number, values: Set<number>): void {
  // 处理步长：*/5 或 1-10/2
  const stepMatch = segment.match(/^(.+)\/(\d+)$/);
  if (stepMatch) {
    const [, rangePart, stepStr] = stepMatch;
    const step = parseInt(stepStr, 10);
    const range = parseRange(rangePart, min, max);
    for (let i = range.start; i <= range.end; i += step) {
      if (i >= min && i <= max) {
        values.add(i);
      }
    }
    return;
  }

  // 处理范围或单个值或通配符
  const range = parseRange(segment, min, max);
  for (let i = range.start; i <= range.end; i++) {
    values.add(i);
  }
}

/**
 * 解析范围
 */
function parseRange(part: string, min: number, max: number): { start: number; end: number } {
  if (part === '*') {
    return { start: min, end: max };
  }

  const rangeMatch = part.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    return {
      start: Math.max(start, min),
      end: Math.min(end, max),
    };
  }

  // 单个值
  const value = parseInt(part, 10);
  if (isNaN(value) || value < min || value > max) {
    throw new Error(`Invalid cron field value: ${part} (expected ${min}-${max})`);
  }
  return { start: value, end: value };
}

/**
 * 计算从指定时间开始的下次执行时间
 * @param expression cron 表达式
 * @param from 起始时间（默认当前时间）
 * @returns 下次执行时间戳（毫秒），如果无法计算则返回 undefined
 */
export function getNextCronTime(expression: string, from: number = Date.now()): number | undefined {
  const parsed = parseCron(expression);

  // 从下一分钟开始检查
  let date = new Date(from);
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() + 1);

  // 最多检查 4 年（避免无限循环）
  const maxDate = new Date(from);
  maxDate.setFullYear(maxDate.getFullYear() + 4);

  while (date.getTime() <= maxDate.getTime()) {
    if (matchesCron(parsed, date)) {
      return date.getTime();
    }
    date.setMinutes(date.getMinutes() + 1);
  }

  return undefined;
}

/**
 * 检查日期是否匹配 cron 表达式
 */
function matchesCron(parsed: CronParsed, date: Date): boolean {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  return (
    parsed.minute.includes(minute) &&
    parsed.hour.includes(hour) &&
    parsed.dayOfMonth.includes(dayOfMonth) &&
    parsed.month.includes(month) &&
    parsed.dayOfWeek.includes(dayOfWeek)
  );
}

/**
 * 验证 cron 表达式是否有效
 */
export function isValidCron(expression: string): boolean {
  try {
    parseCron(expression);
    return true;
  } catch {
    return false;
  }
}
