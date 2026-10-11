/**
 * 26 - 导入导出 Mixin
 * 包含：exportToJSON、exportToCSV、importFromJSON
 */
import type { FlatItem } from '../types/base.types';
import type { ExportOptions, ImportOptions, QueryCondition } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithImportExport<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 导出为 JSON */
    exportToJSON(options?: ExportOptions): string {
      let data = [...(this as any).data];
      if (options?.where) data = data.filter((item: any) => (this as any).matchCondition(item, options.where));
      if (options?.fields) {
        data = data.map((item: any) => {
          const result: any = {};
          for (const field of options.fields!) result[field] = item[field];
          return result;
        });
      }
      return JSON.stringify(data, null, options?.pretty ? 2 : 0);
    }

    /** 导出为 CSV */
    exportToCSV(options?: ExportOptions): string {
      let data = [...(this as any).data];
      if (options?.where) data = data.filter((item: any) => (this as any).matchCondition(item, options.where));
      if (data.length === 0) return '';
      
      const fields = options?.fields || Object.keys(data[0]);
      const header = fields.join(',');
      const rows = data.map((item: any) => 
        fields.map(field => {
          const value = item[field];
          if (value == null) return '';
          const str = String(value);
          return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')
      );
      return options?.includeHeader === false ? rows.join('\n') : [header, ...rows].join('\n');
    }

    /** 从 JSON 导入 */
    importFromJSON(json: string, options?: ImportOptions): number {
      const data = JSON.parse(json);
      if (!Array.isArray(data)) throw new Error('JSON 必须是数组格式');
      
      if (options?.overwrite) {
        (this as any).data = [];
        (this as any).nextId = 1;
      }
      
      let imported = 0;
      for (const item of data) {
        try {
          if (options?.updateOnConflict && options?.conflictFields) {
            const condition: any = {};
            for (const field of options.conflictFields) condition[field] = item[field];
            const existing = (this as any).findOne(condition);
            if (existing) (this as any).update(condition, item);
            else (this as any).create(item);
          } else {
            (this as any).create(item);
          }
          imported++;
        } catch (e) {
          if (!options?.skipValidation) throw e;
        }
      }
      return imported;
    }
  };
}
