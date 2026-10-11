/**
 * @file 基础插件组装 Hook
 * @description 组装 MDXEditor 基础插件集合
 */
import type { RealmPlugin } from '@mdxeditor/editor';
import { useMemo } from 'react';
import { createBasePlugins } from '../../plugins';

/**
 * 组装基础插件集合（headings/lists/quote/table/image/link/codeBlock/directives 等）
 */
export const useBasePlugins = (extraPlugins: RealmPlugin[] = []) => {
  return useMemo(
    () => createBasePlugins({ extra: extraPlugins }),
    [extraPlugins],
  );
};
