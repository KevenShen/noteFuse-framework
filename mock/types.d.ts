/**
 * Mock 目录全局类型声明
 * 
 * 【说明】
 * Mock 目录运行在 Node.js 环境中，需要使用 Buffer 等 Node.js 全局类型。
 * 由于项目未配置 @types/node（且已安装的 26.x 版本与 TS 版本不兼容），
 * 这里手动声明 Buffer 类的基本类型，仅满足 mock 目录的使用需求。
 * 
 * 【注意】
 * - 此文件仅声明 mock 目录中实际使用的 Buffer 方法
 * - 不引入完整的 @types/node，避免类型兼容性问题
 * - 如需更多 Node.js 类型，可在此文件中扩展
 */

/**
 * Buffer 类简化类型声明
 * 仅包含 mock 目录中实际使用的方法
 */
declare class Buffer {
  length: number;
  [index: number]: number;
  
  static alloc(size: number, fill?: number | string | Buffer): Buffer;
  static isBuffer(obj: any): obj is Buffer;
  static from(array: number[]): Buffer;
  static from(str: string, encoding?: string): Buffer;
  
  copy(target: Buffer, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
  toString(encoding?: string): string;
}

/** Node.js Process 对象简化声明 */
declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): void;
};
