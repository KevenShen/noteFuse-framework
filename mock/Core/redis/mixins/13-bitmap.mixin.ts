/**
 * L4 消息/扩展 - 位图 Mixin
 * 包含：setbit/getbit/bitcount/bitop/bitpos
 */
import type { MixinConstructor } from './mixin.types';

export function WithBitmap<T extends MixinConstructor>(Base: T) {
  return class BitmapMixin extends Base {
    /**
     * 设置位
     * 返回原来的位值（0 或 1）
     */
    setbit(key: string, offset: number, value: 0 | 1): 0 | 1 {
      // 使用类型断言避免 Mixin 组合模式下的泛型类型推断问题，同时保留 Buffer 类型安全
      let bitmap = this.get(key) as Buffer | null;
      if (!bitmap) {
        // 创建足够大的 Buffer
        const byteLength = Math.ceil((offset + 1) / 8);
        bitmap = Buffer.alloc(byteLength);
      } else if (!Buffer.isBuffer(bitmap)) {
        // 兼容旧格式（数组）
        const arr = bitmap as unknown as number[];
        const byteLength = Math.max(arr.length, Math.ceil((offset + 1) / 8));
        const newBuffer = Buffer.alloc(byteLength);
        for (let i = 0; i < arr.length; i++) {
          newBuffer[i] = arr[i];
        }
        bitmap = newBuffer;
      }

      // 确保 Buffer 足够大
      const neededBytes = Math.ceil((offset + 1) / 8);
      if (bitmap.length < neededBytes) {
        const newBuffer = Buffer.alloc(neededBytes);
        bitmap.copy(newBuffer);
        bitmap = newBuffer;
      }

      const byteIndex = Math.floor(offset / 8);
      const bitIndex = 7 - (offset % 8);
      const oldValue = (bitmap[byteIndex] >> bitIndex) & 1;

      if (value === 1) {
        bitmap[byteIndex] |= (1 << bitIndex);
      } else {
        bitmap[byteIndex] &= ~(1 << bitIndex);
      }

      this.set(key, bitmap);
      return oldValue as 0 | 1;
    }

    /**
     * 获取位
     */
    getbit(key: string, offset: number): 0 | 1 {
      const bitmap = this.get(key) as Buffer | null;
      if (!bitmap) return 0;

      const byteIndex = Math.floor(offset / 8);
      if (byteIndex >= bitmap.length) return 0;

      const bitIndex = 7 - (offset % 8);
      return ((bitmap[byteIndex] >> bitIndex) & 1) as 0 | 1;
    }

    /**
     * 统计位为 1 的数量
     */
    bitcount(key: string, start?: number, end?: number): number {
      const bitmap = this.get(key) as Buffer | null;
      if (!bitmap) return 0;

      let byteStart = 0;
      let byteEnd = bitmap.length - 1;

      if (start !== undefined && end !== undefined) {
        // 支持负数索引
        byteStart = start < 0 ? Math.max(0, bitmap.length + start) : Math.min(start, bitmap.length - 1);
        byteEnd = end < 0 ? Math.max(-1, bitmap.length + end) : Math.min(end, bitmap.length - 1);
      }

      let count = 0;
      for (let i = byteStart; i <= byteEnd; i++) {
        const byte = bitmap[i];
        // 统计字节中 1 的数量
        let b = byte;
        while (b > 0) {
          count += b & 1;
          b >>= 1;
        }
      }

      return count;
    }

    /**
     * 位运算（AND/OR/XOR/NOT）
     * 返回结果存储到 destKey，返回结果的字节长度
     */
    bitop(operation: 'AND' | 'OR' | 'XOR' | 'NOT', destKey: string, ...srcKeys: string[]): number {
      if (srcKeys.length === 0) return 0;

      const buffers = srcKeys
        .map(key => this.get(key) as Buffer | null)
        .filter((buf): buf is Buffer => buf !== null && Buffer.isBuffer(buf));

      if (buffers.length === 0) {
        this.set(destKey, Buffer.alloc(0));
        return 0;
      }

      const maxLength = Math.max(...buffers.map(buf => buf.length));
      const result = Buffer.alloc(maxLength);

      if (operation === 'NOT') {
        const src = buffers[0];
        for (let i = 0; i < maxLength; i++) {
          result[i] = ~src[i] & 0xff;
        }
      } else {
        for (let i = 0; i < maxLength; i++) {
          let value = buffers[0][i] || 0;
          for (let j = 1; j < buffers.length; j++) {
            const byte = buffers[j][i] || 0;
            switch (operation) {
              case 'AND': value &= byte; break;
              case 'OR': value |= byte; break;
              case 'XOR': value ^= byte; break;
            }
          }
          result[i] = value & 0xff;
        }
      }

      this.set(destKey, result);
      return result.length;
    }

    /**
     * 查找第一个 0 或 1 的位置
     */
    bitpos(key: string, bit: 0 | 1, start?: number, end?: number): number {
      const bitmap = this.get(key) as Buffer | null;
      if (!bitmap) return bit === 0 ? 0 : -1;

      let byteStart = 0;
      let byteEnd = bitmap.length - 1;

      if (start !== undefined) {
        byteStart = start < 0 ? Math.max(0, bitmap.length + start) : Math.min(start, bitmap.length - 1);
      }
      if (end !== undefined) {
        byteEnd = end < 0 ? Math.max(-1, bitmap.length + end) : Math.min(end, bitmap.length - 1);
      }

      for (let byteIndex = byteStart; byteIndex <= byteEnd; byteIndex++) {
        const byte = bitmap[byteIndex];
        for (let bitIndex = 7; bitIndex >= 0; bitIndex--) {
          const currentBit = (byte >> bitIndex) & 1;
          if (currentBit === bit) {
            return byteIndex * 8 + (7 - bitIndex);
          }
        }
      }

      return -1;
    }
  };
}
