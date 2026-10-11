/**
 * 23 - 事件钩子 Mixin
 * 包含：triggerEvent、setHooks、on、off
 */
import type { FlatItem } from '../types/base.types';
import type { EventType, EventHook, EventHooksConfig } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithEventHook<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 触发事件 */
    protected triggerEvent(type: EventType, data: any): boolean {
      const hook = (this as any).hooksConfig[type];
      if (!hook) return true;
      let prevented = false;
      const eventData = {
        ...data,
        type,
        tableName: (this as any).getTableName(),
        preventDefault: () => { prevented = true; },
      };
      const result = hook(eventData);
      if (result === false || prevented) return false;
      return true;
    }

    /** 设置事件钩子 */
    setHooks(hooks: EventHooksConfig<any>): void {
      (this as any).hooksConfig = hooks;
    }

    /** 添加事件钩子 */
    on(event: EventType, hook: EventHook<any>): void {
      (this as any).hooksConfig[event] = hook;
    }

    /** 移除事件钩子 */
    off(event: EventType): void {
      delete (this as any).hooksConfig[event];
    }
  };
}
