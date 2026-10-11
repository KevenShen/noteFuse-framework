/**
 * L4 扩展功能 - 布隆过滤器 Mixin
 * 包含：bfReserve / bfAdd / bfExists / bfMAdd / bfMExists / bfInfo
 *
 * 【布隆过滤器原理】
 * - 使用一个位数组，初始所有位都是 0
 * - 添加元素时，使用 k 个哈希函数计算元素的哈希值，将对应位置设为 1
 * - 检查元素时，使用相同的 k 个哈希函数计算哈希值
 *   - 如果所有对应位都是 1，则元素"可能存在"（有误判率）
 *   - 如果有任何一位是 0，则元素"一定不存在"
 *
 * 【适用场景】
 * - 唯一性校验（如用户名、邮箱是否已存在）
 * - 缓存穿透防护（判断数据是否存在，避免查询数据库）
 * - 高效的集合存在性判断（空间效率极高）
 *
 * 【特点】
 * - 空间效率高：1 亿个元素只需约 100MB 内存（0.1% 误判率）
 * - 查询速度快：O(k)，k 为哈希函数数量，通常为 3-10
 * - 有误判率：可能将不存在的元素误判为存在，但不会将存在的元素误判为不存在
 * - 不支持删除：标准布隆过滤器不支持删除元素
 */

import type { MixinConstructor } from './mixin.types';

/**
 * 布隆过滤器实例
 */
class BloomFilter {
  /** 位数组 */
  private bitArray: Uint8Array;
  /** 位数组大小（位数） */
  private size: number;
  /** 哈希函数数量 */
  private hashCount: number;
  /** 期望容量 */
  private capacity: number;
  /** 期望误判率 */
  private errorRate: number;
  /** 已添加元素数量 */
  private count: number;

  constructor(capacity: number, errorRate: number) {
    this.capacity = capacity;
    this.errorRate = errorRate;
    this.count = 0;

    // 计算最优位数组大小：m = -n * ln(p) / (ln(2))^2
    // n = capacity, p = errorRate
    this.size = Math.ceil(
      (-capacity * Math.log(errorRate)) / (Math.log(2) * Math.log(2)),
    );

    // 计算最优哈希函数数量：k = (m/n) * ln(2)
    this.hashCount = Math.max(
      1,
      Math.round((this.size / capacity) * Math.log(2)),
    );

    // 创建位数组（使用 Uint8Array，每个元素 8 位）
    this.bitArray = new Uint8Array(Math.ceil(this.size / 8));
  }

  /**
   * 计算多个哈希值
   * 使用双重哈希技术：h(i) = h1 + i * h2
   * @param item 元素
   * @returns 哈希值数组（已取模到位数组大小）
   */
  private getHashes(item: string): number[] {
    const hashes: number[] = [];
    // 两个基础哈希值
    const h1 = this.hash1(item);
    const h2 = this.hash2(item);

    for (let i = 0; i < this.hashCount; i++) {
      // 双重哈希：h(i) = (h1 + i * h2) mod size
      const hash = (h1 + i * h2) % this.size;
      hashes.push(hash);
    }

    return hashes;
  }

  /** 第一个哈希函数（FNV-1a） */
  private hash1(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
  }

  /** 第二个哈希函数（DJB2） */
  private hash2(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) + hash + str.charCodeAt(i);
    }
    return Math.abs(hash);
  }

  /**
   * 添加元素
   * @param item 元素
   * @returns true（标准布隆过滤器总是返回 true）
   */
  add(item: string): boolean {
    const hashes = this.getHashes(item);
    for (const hash of hashes) {
      const byteIndex = Math.floor(hash / 8);
      const bitIndex = hash % 8;
      this.bitArray[byteIndex] |= 1 << bitIndex;
    }
    this.count++;
    return true;
  }

  /**
   * 检查元素是否存在
   * @param item 元素
   * @returns true=可能存在，false=一定不存在
   */
  exists(item: string): boolean {
    const hashes = this.getHashes(item);
    for (const hash of hashes) {
      const byteIndex = Math.floor(hash / 8);
      const bitIndex = hash % 8;
      if ((this.bitArray[byteIndex] & (1 << bitIndex)) === 0) {
        return false; // 有任何一位是 0，一定不存在
      }
    }
    return true; // 所有位都是 1，可能存在
  }

  /**
   * 批量添加元素
   * @param items 元素数组
   * @returns 结果数组（每个元素对应 true）
   */
  madd(items: string[]): boolean[] {
    return items.map((item) => this.add(item));
  }

  /**
   * 批量检查元素是否存在
   * @param items 元素数组
   * @returns 结果数组（true=可能存在，false=一定不存在）
   */
  mexists(items: string[]): boolean[] {
    return items.map((item) => this.exists(item));
  }

  /**
   * 获取布隆过滤器信息
   */
  info(): {
    capacity: number;
    size: number;
    hashCount: number;
    count: number;
    errorRate: number;
    memoryUsage: string;
  } {
    return {
      capacity: this.capacity,
      size: this.size,
      hashCount: this.hashCount,
      count: this.count,
      errorRate: this.errorRate,
      memoryUsage: `${(this.bitArray.length / 1024).toFixed(2)} KB`,
    };
  }
}

/**
 * 布隆过滤器 Mixin
 */
export function WithBloomFilter<T extends MixinConstructor>(Base: T) {
  return class BloomFilterMixin extends Base {
    /** 布隆过滤器存储（key -> BloomFilter 实例） */
    private _bloomFilters: Map<string, BloomFilter> = new Map();

    /**
     * 创建布隆过滤器
     * @param key 键名
     * @param errorRate 期望误判率（如 0.01 表示 1%）
     * @param capacity 期望容量
     */
    bfReserve(key: string, errorRate: number, capacity: number): boolean {
      if (this._bloomFilters.has(key)) {
        throw new Error(`Bloom filter "${key}" already exists`);
      }
      const filter = new BloomFilter(capacity, errorRate);
      this._bloomFilters.set(key, filter);
      return true;
    }

    /**
     * 添加元素到布隆过滤器
     * @param key 键名
     * @param item 元素
     * @returns true
     */
    bfAdd(key: string, item: string): boolean {
      const filter = this._getOrCreateFilter(key);
      return filter.add(item);
    }

    /**
     * 检查元素是否存在于布隆过滤器
     * @param key 键名
     * @param item 元素
     * @returns true=可能存在，false=一定不存在
     */
    bfExists(key: string, item: string): boolean {
      const filter = this._getOrCreateFilter(key);
      return filter.exists(item);
    }

    /**
     * 批量添加元素到布隆过滤器
     * @param key 键名
     * @param items 元素数组
     * @returns 结果数组
     */
    bfMAdd(key: string, items: string[]): boolean[] {
      const filter = this._getOrCreateFilter(key);
      return filter.madd(items);
    }

    /**
     * 批量检查元素是否存在于布隆过滤器
     * @param key 键名
     * @param items 元素数组
     * @returns 结果数组（true=可能存在，false=一定不存在）
     */
    bfMExists(key: string, items: string[]): boolean[] {
      const filter = this._getOrCreateFilter(key);
      return filter.mexists(items);
    }

    /**
     * 获取布隆过滤器信息
     * @param key 键名
     * @returns 布隆过滤器信息
     */
    bfInfo(key: string): {
      capacity: number;
      size: number;
      hashCount: number;
      count: number;
      errorRate: number;
      memoryUsage: string;
    } {
      const filter = this._getOrCreateFilter(key);
      return filter.info();
    }

    /**
     * 获取或创建布隆过滤器（内部方法）
     * 如果布隆过滤器不存在，使用默认参数创建
     */
    private _getOrCreateFilter(key: string): BloomFilter {
      let filter = this._bloomFilters.get(key);
      if (!filter) {
        // 默认参数：1% 误判率，10000 容量
        filter = new BloomFilter(10000, 0.01);
        this._bloomFilters.set(key, filter);
      }
      return filter;
    }
  };
}
