/**
 * L4 高级功能层 - 分词器 Mixin
 * 
 * 包含：内置分词器、自定义分词器、分词测试、字符过滤器、分词过滤器等
 */

import type { MixinConstructor } from './mixin.types';

/**
 * 分词器 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithAnalyzer<T extends MixinConstructor>(Base: T) {
  return class AnalyzerMixin extends Base {
    // ==================== 分词测试 ====================

    /**
     * 测试分词器（完整版本）
     * 
     * @param text 文本
     * @param analyzer 分词器名称或配置
     * @param indexName 索引名（可选，用于获取索引的分词器配置）
     * @returns 分词结果
     */
    analyzeFull(
      text: string,
      analyzer: string | {
        type?: string;
        tokenizer?: string;
        filter?: string[];
        char_filter?: string[];
      } = 'standard',
      indexName?: string,
    ): {
      tokens: Array<{
        token: string;
        start_offset: number;
        end_offset: number;
        type: string;
        position: number;
      }>;
    } {
      // 获取分词器配置
      const analyzerConfig = this.resolveAnalyzer(analyzer, indexName);

      // 1. 字符过滤
      let processedText = text;
      if (analyzerConfig.char_filter) {
        for (const charFilter of analyzerConfig.char_filter) {
          processedText = this.applyCharFilter(processedText, charFilter);
        }
      }

      // 2. 分词
      const rawTokens = this.tokenize(processedText, analyzerConfig.tokenizer || 'standard');

      // 3. 分词过滤
      let filteredTokens = rawTokens;
      if (analyzerConfig.filter) {
        for (const filter of analyzerConfig.filter) {
          filteredTokens = this.applyTokenFilterFull(filteredTokens, filter);
        }
      }

      return { tokens: filteredTokens };
    }

    // ==================== 内置分词器 ====================

    /**
     * standard 分词器
     * 
     * @param text 文本
     * @returns 分词结果
     */
    standardAnalyzer(text: string): Array<{
      token: string;
      start_offset: number;
      end_offset: number;
      type: string;
      position: number;
    }> {
      return this.tokenize(text, 'standard');
    }

    /**
     * simple 分词器
     * 
     * @param text 文本
     * @returns 分词结果
     */
    simpleAnalyzer(text: string): Array<{
      token: string;
      start_offset: number;
      end_offset: number;
      type: string;
      position: number;
    }> {
      return this.tokenize(text, 'simple');
    }

    /**
     * whitespace 分词器
     * 
     * @param text 文本
     * @returns 分词结果
     */
    whitespaceAnalyzer(text: string): Array<{
      token: string;
      start_offset: number;
      end_offset: number;
      type: string;
      position: number;
    }> {
      return this.tokenize(text, 'whitespace');
    }

    /**
     * keyword 分词器（不分词，整个文本作为一个词）
     * 
     * @param text 文本
     * @returns 分词结果
     */
    keywordAnalyzer(text: string): Array<{
      token: string;
      start_offset: number;
      end_offset: number;
      type: string;
      position: number;
    }> {
      return [{
        token: text,
        start_offset: 0,
        end_offset: text.length,
        type: 'word',
        position: 0,
      }];
    }

    /**
     * pattern 分词器（正则表达式分词）
     * 
     * @param text 文本
     * @param pattern 正则表达式
     * @returns 分词结果
     */
    patternAnalyzer(text: string, pattern: string = '\\W+'): Array<{
      token: string;
      start_offset: number;
      end_offset: number;
      type: string;
      position: number;
    }> {
      const tokens: Array<{
        token: string;
        start_offset: number;
        end_offset: number;
        type: string;
        position: number;
      }> = [];

      try {
        const regex = new RegExp(pattern, 'g');
        let match: RegExpExecArray | null;
        let lastIndex = 0;
        let position = 0;

        while ((match = regex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            const token = text.substring(lastIndex, match.index);
            tokens.push({
              token,
              start_offset: lastIndex,
              end_offset: match.index,
              type: 'word',
              position: position++,
            });
          }
          lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
          const token = text.substring(lastIndex);
          tokens.push({
            token,
            start_offset: lastIndex,
            end_offset: text.length,
            type: 'word',
            position: position++,
          });
        }
      } catch {
        // 无效的正则表达式，返回原文
        return this.keywordAnalyzer(text);
      }

      return tokens;
    }

    // ==================== 分词器管理 ====================

    /**
     * 获取索引的分词器配置
     * 
     * @param indexName 索引名
     * @returns 分词器配置
     */
    getAnalyzers(indexName: string): Record<string, any> | null {
      const index = (this as any).indices.get(indexName);
      if (!index) return null;
      return index.settings?.analysis?.analyzer || null;
    }

    /**
     * 设置索引的分词器配置
     * 
     * @param indexName 索引名
     * @param analyzers 分词器配置
     * @returns 是否成功
     */
    setAnalyzers(indexName: string, analyzers: Record<string, any>): boolean {
      const index = (this as any).indices.get(indexName);
      if (!index) return false;

      if (!index.settings) {
        index.settings = {};
      }
      if (!index.settings.analysis) {
        index.settings.analysis = {};
      }
      index.settings.analysis.analyzer = analyzers;
      return true;
    }

    /**
     * 添加自定义分词器
     * 
     * @param indexName 索引名
     * @param analyzerName 分词器名称
     * @param analyzerConfig 分词器配置
     * @returns 是否成功
     */
    addAnalyzer(
      indexName: string,
      analyzerName: string,
      analyzerConfig: {
        type?: string;
        tokenizer?: string;
        filter?: string[];
        char_filter?: string[];
      },
    ): boolean {
      const analyzers = this.getAnalyzers(indexName) || {};
      analyzers[analyzerName] = analyzerConfig;
      return this.setAnalyzers(indexName, analyzers);
    }

    // ==================== 工具方法 ====================

    /**
     * 解析分词器配置
     * 
     * @param analyzer 分词器名称或配置
     * @param indexName 索引名
     * @returns 分词器配置
     */
    protected resolveAnalyzer(
      analyzer: string | {
        type?: string;
        tokenizer?: string;
        filter?: string[];
        char_filter?: string[];
      },
      indexName?: string,
    ): {
      tokenizer?: string;
      filter?: string[];
      char_filter?: string[];
    } {
      if (typeof analyzer === 'object') {
        return analyzer;
      }

      // 内置分词器
      const builtInAnalyzers: Record<string, any> = {
        standard: { tokenizer: 'standard', filter: ['lowercase'] },
        simple: { tokenizer: 'simple', filter: ['lowercase'] },
        whitespace: { tokenizer: 'whitespace' },
        keyword: { tokenizer: 'keyword' },
        pattern: { tokenizer: 'pattern' },
        stop: { tokenizer: 'standard', filter: ['lowercase', 'stop'] },
        snowball: { tokenizer: 'standard', filter: ['lowercase', 'snowball'] },
      };

      if (builtInAnalyzers[analyzer]) {
        return builtInAnalyzers[analyzer];
      }

      // 从索引配置中查找
      if (indexName) {
        const analyzers = this.getAnalyzers(indexName);
        if (analyzers && analyzers[analyzer]) {
          return analyzers[analyzer];
        }
      }

      // 默认使用 standard
      return builtInAnalyzers.standard;
    }

    /**
     * 分词
     * 
     * @param text 文本
     * @param tokenizer 分词器类型
     * @returns 分词结果
     */
    protected tokenize(
      text: string,
      tokenizer: string,
    ): Array<{
      token: string;
      start_offset: number;
      end_offset: number;
      type: string;
      position: number;
    }> {
      switch (tokenizer) {
        case 'standard':
          return this.standardTokenizer(text);
        case 'simple':
          return this.simpleTokenizer(text);
        case 'whitespace':
          return this.whitespaceTokenizer(text);
        case 'keyword':
          return this.keywordAnalyzer(text);
        case 'pattern':
          return this.patternAnalyzer(text);
        default:
          return this.standardTokenizer(text);
      }
    }

    /**
     * standard 分词器实现
     * 
     * @param text 文本
     * @returns 分词结果
     */
    protected standardTokenizer(text: string): Array<{
      token: string;
      start_offset: number;
      end_offset: number;
      type: string;
      position: number;
    }> {
      const tokens: Array<{
        token: string;
        start_offset: number;
        end_offset: number;
        type: string;
        position: number;
      }> = [];

      // 使用 Unicode 文本分割算法（简化实现）
      const regex = /[\p{L}\p{N}]+/gu;
      let match: RegExpExecArray | null;
      let position = 0;

      while ((match = regex.exec(text)) !== null) {
        tokens.push({
          token: match[0],
          start_offset: match.index,
          end_offset: match.index + match[0].length,
          type: '<ALPHANUM>',
          position: position++,
        });
      }

      return tokens;
    }

    /**
     * simple 分词器实现
     * 
     * @param text 文本
     * @returns 分词结果
     */
    protected simpleTokenizer(text: string): Array<{
      token: string;
      start_offset: number;
      end_offset: number;
      type: string;
      position: number;
    }> {
      const tokens: Array<{
        token: string;
        start_offset: number;
        end_offset: number;
        type: string;
        position: number;
      }> = [];

      const regex = /[a-zA-Z]+/g;
      let match: RegExpExecArray | null;
      let position = 0;

      while ((match = regex.exec(text)) !== null) {
        tokens.push({
          token: match[0],
          start_offset: match.index,
          end_offset: match.index + match[0].length,
          type: 'word',
          position: position++,
        });
      }

      return tokens;
    }

    /**
     * whitespace 分词器实现
     * 
     * @param text 文本
     * @returns 分词结果
     */
    protected whitespaceTokenizer(text: string): Array<{
      token: string;
      start_offset: number;
      end_offset: number;
      type: string;
      position: number;
    }> {
      const tokens: Array<{
        token: string;
        start_offset: number;
        end_offset: number;
        type: string;
        position: number;
      }> = [];

      const regex = /\S+/g;
      let match: RegExpExecArray | null;
      let position = 0;

      while ((match = regex.exec(text)) !== null) {
        tokens.push({
          token: match[0],
          start_offset: match.index,
          end_offset: match.index + match[0].length,
          type: 'word',
          position: position++,
        });
      }

      return tokens;
    }

    /**
     * 应用字符过滤器
     * 
     * @param text 文本
     * @param charFilter 字符过滤器名称或配置
     * @returns 过滤后的文本
     */
    applyCharFilter(text: string, charFilter: string | any): string {
      if (typeof charFilter === 'string') {
        switch (charFilter) {
          case 'html_strip':
            return this.htmlStripCharFilter(text);
          case 'mapping':
            return text; // 需要配置
          case 'pattern_replace':
            return text; // 需要配置
          default:
            return text;
        }
      }

      // 配置式字符过滤器
      if (charFilter.type === 'mapping' && charFilter.mappings) {
        let result = text;
        for (const mapping of charFilter.mappings) {
          const [from, to] = mapping.split('=>');
          if (from && to) {
            result = result.split(from.trim()).join(to.trim());
          }
        }
        return result;
      }

      if (charFilter.type === 'pattern_replace' && charFilter.pattern && charFilter.replacement !== undefined) {
        try {
          return text.replace(new RegExp(charFilter.pattern, 'g'), charFilter.replacement);
        } catch {
          return text;
        }
      }

      return text;
    }

    /**
     * HTML 标签去除字符过滤器
     * 
     * @param text 文本
     * @returns 去除HTML标签后的文本
     */
    protected htmlStripCharFilter(text: string): string {
      return text.replace(/<[^>]*>/g, '');
    }

    /**
     * 应用分词过滤器（完整版本）
     * 
     * @param tokens 分词结果
     * @param filter 过滤器名称或配置
     * @returns 过滤后的分词结果
     */
    applyTokenFilterFull(
      tokens: Array<{
        token: string;
        start_offset: number;
        end_offset: number;
        type: string;
        position: number;
      }>,
      filter: string | any,
    ): Array<{
      token: string;
      start_offset: number;
      end_offset: number;
      type: string;
      position: number;
    }> {
      if (typeof filter === 'string') {
        switch (filter) {
          case 'lowercase':
            return this.lowercaseTokenFilter(tokens);
          case 'uppercase':
            return this.uppercaseTokenFilter(tokens);
          case 'stop':
            return this.stopTokenFilter(tokens);
          case 'trim':
            return this.trimTokenFilter(tokens);
          case 'length':
            return this.lengthTokenFilter(tokens);
          case 'reverse':
            return this.reverseTokenFilter(tokens);
          case 'snowball':
            return this.snowballTokenFilter(tokens);
          default:
            return tokens;
        }
      }

      // 配置式过滤器
      if (filter.type === 'stop' && filter.stopwords) {
        return this.customStopTokenFilter(tokens, filter.stopwords);
      }

      if (filter.type === 'length' && (filter.min !== undefined || filter.max !== undefined)) {
        return this.customLengthTokenFilter(tokens, filter.min, filter.max);
      }

      if (filter.type === 'lowercase') {
        return this.lowercaseTokenFilter(tokens);
      }

      return tokens;
    }

    /**
     * 小写过滤器
     */
    protected lowercaseTokenFilter(tokens: any[]): any[] {
      return tokens.map(t => ({ ...t, token: t.token.toLowerCase() }));
    }

    /**
     * 大写过滤器
     */
    protected uppercaseTokenFilter(tokens: any[]): any[] {
      return tokens.map(t => ({ ...t, token: t.token.toUpperCase() }));
    }

    /**
     * 停用词过滤器
     */
    protected stopTokenFilter(tokens: any[]): any[] {
      const stopwords = new Set([
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
        'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
        'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      ]);
      return tokens.filter(t => !stopwords.has(t.token.toLowerCase()));
    }

    /**
     * 自定义停用词过滤器
     */
    protected customStopTokenFilter(tokens: any[], stopwords: string[]): any[] {
      const stopwordSet = new Set(stopwords.map(w => w.toLowerCase()));
      return tokens.filter(t => !stopwordSet.has(t.token.toLowerCase()));
    }

    /**
     * 修剪过滤器
     */
    protected trimTokenFilter(tokens: any[]): any[] {
      return tokens.map(t => ({ ...t, token: t.token.trim() }));
    }

    /**
     * 长度过滤器
     */
    protected lengthTokenFilter(tokens: any[]): any[] {
      return tokens.filter(t => t.token.length >= 0 && t.token.length <= 255);
    }

    /**
     * 自定义长度过滤器
     */
    protected customLengthTokenFilter(tokens: any[], min: number = 0, max: number = 255): any[] {
      return tokens.filter(t => t.token.length >= min && t.token.length <= max);
    }

    /**
     * 反转过滤器
     */
    protected reverseTokenFilter(tokens: any[]): any[] {
      return tokens.map(t => ({ ...t, token: t.token.split('').reverse().join('') }));
    }

    /**
     * Snowball 词干提取过滤器（简化实现）
     */
    protected snowballTokenFilter(tokens: any[]): any[] {
      // 简化的词干提取
      return tokens.map(t => {
        let token = t.token.toLowerCase();
        // 去除常见后缀
        if (token.endsWith('ing') && token.length > 4) {
          token = token.substring(0, token.length - 3);
        } else if (token.endsWith('ed') && token.length > 3) {
          token = token.substring(0, token.length - 2);
        } else if (token.endsWith('es') && token.length > 3) {
          token = token.substring(0, token.length - 2);
        } else if (token.endsWith('s') && token.length > 2) {
          token = token.substring(0, token.length - 1);
        }
        return { ...t, token };
      });
    }
  };
}
