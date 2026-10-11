/**
 * ObjectId 类
 * 模拟 MongoDB 的 ObjectId，生成 24 位十六进制字符串
 * 格式：时间戳(8) + 机器标识(6) + 进程ID(4) + 自增计数器(6)
 */
export class ObjectId {
  private static counter = Math.floor(Math.random() * 0xffffff);
  private readonly id: string;

  constructor(id?: string) {
    if (id) {
      this.id = id;
    } else {
      this.id = ObjectId.generate();
    }
  }

  /** 生成新的 ObjectId */
  static generate(): string {
    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const machine = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    const pid = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
    const counter = (ObjectId.counter++ % 0xffffff).toString(16).padStart(6, '0');
    return `${timestamp}${machine}${pid}${counter}`;
  }

  /** 转换为字符串 */
  toString(): string {
    return this.id;
  }

  /** 转换为 JSON */
  toJSON(): string {
    return this.id;
  }

  /** 比较两个 ObjectId 是否相等 */
  equals(other: ObjectId | string): boolean {
    return this.id === (other instanceof ObjectId ? other.id : other);
  }

  /** 获取时间戳 */
  getTimestamp(): Date {
    return new Date(parseInt(this.id.substring(0, 8), 16) * 1000);
  }
}
