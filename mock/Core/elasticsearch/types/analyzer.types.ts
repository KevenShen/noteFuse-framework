/**
 * Elasticsearch 分词器类型定义
 * 
 * 包含：分析器、分词器、分词过滤器、字符过滤器等类型定义
 */

// ==================== 分析器类型 ====================

/** 内置分析器类型 */
export type BuiltInAnalyzerType =
  | 'standard'
  | 'simple'
  | 'whitespace'
  | 'stop'
  | 'keyword'
  | 'pattern'
  | 'language'
  | 'fingerprint'
  | 'custom';

/** 语言分析器类型 */
export type LanguageAnalyzerType =
  | 'arabic'
  | 'armenian'
  | 'basque'
  | 'bengali'
  | 'brazilian'
  | 'bulgarian'
  | 'catalan'
  | 'cjk'
  | 'czech'
  | 'danish'
  | 'dutch'
  | 'english'
  | 'estonian'
  | 'finnish'
  | 'french'
  | 'galician'
  | 'german'
  | 'greek'
  | 'hindi'
  | 'hungarian'
  | 'indonesian'
  | 'irish'
  | 'italian'
  | 'latvian'
  | 'lithuanian'
  | 'norwegian'
  | 'persian'
  | 'portuguese'
  | 'romanian'
  | 'russian'
  | 'sorani'
  | 'spanish'
  | 'swedish'
  | 'turkish'
  | 'thai';

/** 分析器类型 */
export type AnalyzerType = BuiltInAnalyzerType | LanguageAnalyzerType | string;

/** 分析器配置 */
export interface AnalyzerConfig {
  /** 分析器类型 */
  type?: AnalyzerType;
  /** 分词器 */
  tokenizer?: string;
  /** 分词过滤器 */
  filter?: string[];
  /** 字符过滤器 */
  char_filter?: string[];
  /** 位置增量缺口 */
  position_increment_gap?: number;
  /** 停用词 */
  stopwords?: string | string[];
  /** 停用词路径 */
  stopwords_path?: string;
  /** 模式 */
  pattern?: string;
  /** 标志 */
  flags?: string;
  /** 小写 */
  lowercase?: boolean;
  /** 语言 */
  language?: LanguageAnalyzerType;
  /** 最大输出大小 */
  max_output_size?: number;
  /** 分隔符 */
  separator?: string;
  /** 其他配置 */
  [key: string]: any;
}

/** 分析器定义 */
export interface AnalyzerDefinition {
  /** 分析器名 */
  name: string;
  /** 分析器配置 */
  config: AnalyzerConfig;
}

// ==================== 分词器类型 ====================

/** 内置分词器类型 */
export type BuiltInTokenizerType =
  | 'standard'
  | 'letter'
  | 'lowercase'
  | 'whitespace'
  | 'uax_url_email'
  | 'classic'
  | 'thai'
  | 'ngram'
  | 'edge_ngram'
  | 'keyword'
  | 'pattern'
  | 'simple_pattern'
  | 'simple_pattern_split'
  | 'path_hierarchy'
  | 'char_group'
  | 'icu_tokenizer';

/** 分词器类型 */
export type TokenizerType = BuiltInTokenizerType | string;

/** 分词器配置 */
export interface TokenizerConfig {
  /** 分词器类型 */
  type?: TokenizerType;
  /** 最大令牌长度 */
  max_token_length?: number;
  /** 最小字符数 */
  min_gram?: number;
  /** 最大字符数 */
  max_gram?: number;
  /** 令牌字符 */
  token_chars?: Array<'letter' | 'digit' | 'whitespace' | 'punctuation' | 'symbol' | 'custom'>;
  /** 自定义令牌字符 */
  custom_token_chars?: string;
  /** 模式 */
  pattern?: string;
  /** 标志 */
  flags?: string;
  /** 分组 */
  group?: number;
  /** 分隔符 */
  separator?: string;
  /** 替换 */
  replacement?: string;
  /** 反向 */
  reverse?: boolean;
  /** 跳过 */
  skip?: number;
  /** 其他配置 */
  [key: string]: any;
}

/** 分词器定义 */
export interface TokenizerDefinition {
  /** 分词器名 */
  name: string;
  /** 分词器配置 */
  config: TokenizerConfig;
}

// ==================== 分词过滤器类型 ====================

/** 内置分词过滤器类型 */
export type BuiltInTokenFilterType =
  | 'standard'
  | 'asciifolding'
  | 'length'
  | 'lowercase'
  | 'uppercase'
  | 'stop'
  | 'word_delimiter'
  | 'word_delimiter_graph'
  | 'stemmer'
  | 'stemmer_override'
  | 'keyword_marker'
  | 'keyword_repeat'
  | 'shingle'
  | 'unique'
  | 'trim'
  | 'truncate'
  | 'limit'
  | 'count'
  | 'reverse'
  | 'elision'
  | 'normalization'
  | 'cjk_width'
  | 'cjk_bigram'
  | 'decimal_digit'
  | 'fingerprint'
  | 'min_hash'
  | 'pattern_capture'
  | 'pattern_replace'
  | 'type'
  | 'snowball'
  | 'synonym'
  | 'synonym_graph'
  | 'hunspell'
  | 'common_grams'
  | 'common_grams_query'
  | 'collation'
  | 'bigram'
  | 'multiplexer'
  | 'remove_duplicates'
  | 'keep'
  | 'keep_types'
  | 'conditional'
  | 'script'
  | 'icu_normalizer'
  | 'icu_folding'
  | 'icu_transform'
  | 'icu_collation'
  | 'kuromoji_baseform'
  | 'kuromoji_part_of_speech'
  | 'kuromoji_readingform'
  | 'kuromoji_stemmer'
  | 'smartcn_stop'
  | 'smartcn_word'
  | 'stconvert'
  | 'jieba'
  | 'hanlp'
  | 'pinyin'
  | 'analysis-ik'
  | 'ik_max_word'
  | 'ik_smart';

/** 分词过滤器类型 */
export type TokenFilterType = BuiltInTokenFilterType | string;

/** 分词过滤器配置 */
export interface TokenFilterConfig {
  /** 过滤器类型 */
  type?: TokenFilterType;
  /** 最小长度 */
  min?: number;
  /** 最大长度 */
  max?: number;
  /** 保留字 */
  preserve_original?: boolean;
  /** 停用词 */
  stopwords?: string | string[];
  /** 停用词路径 */
  stopwords_path?: string;
  /** 忽略大小写 */
  ignore_case?: boolean;
  /** 语言 */
  language?: string;
  /** 词干语言 */
  stemmer_language?: string;
  /** 最小词形长度 */
  min_word_size?: number;
  /** 最大词形长度 */
  max_word_size?: number;
  /** 最小词干长度 */
  min_stem_length?: number;
  /** 生成词元 */
  generate_word_parts?: boolean;
  /** 生成数字部分 */
  generate_number_parts?: boolean;
  /** 生成原始词 */
  generate_original?: boolean;
  /** 分割大小写变化 */
  split_on_case_change?: boolean;
  /** 分割数字 */
  split_on_numerics?: boolean;
  /** 词干词 */
  stem_english_possessive?: boolean;
  /** 最小分片大小 */
  min_shingle_size?: number;
  /** 最大分片大小 */
  max_shingle_size?: boolean;
  /** 输出每词元 */
  output_per_unigrams?: boolean;
  /** 输出每词元如果没有分片 */
  output_per_unigrams_if_no_shingles?: boolean;
  /** 令牌分隔符 */
  token_separator?: string;
  /** 填充字符串 */
  filler_token?: string;
  /** 仅在相同位置 */
  only_same_position?: boolean;
  /** 模式 */
  pattern?: string;
  /** 替换 */
  replacement?: string;
  /** 全部替换 */
  all?: boolean;
  /** 同义词 */
  synonyms?: string[];
  /** 同义词路径 */
  synonyms_path?: string;
  /** 同义词集 */
  synonym_set?: string;
  /** 可扩展 */
  expand?: boolean;
  /** 可扁平化 */
  flatten?: boolean;
  /** 可规范化 */
  normalize?: boolean;
  /** 可小写 */
  lowercase?: boolean;
  /** 最大输出大小 */
  max_output_size?: number;
  /** 限制 */
  max_token_count?: number;
  /** 消费 */
  consume_all_tokens?: boolean;
  /** 哈希大小 */
  hash_set_size?: number;
  /** 哈希数 */
  hash_count?: number;
  /** 带位置 */
  with_rotation?: boolean;
  /** 保留字 */
  keep_words?: string[];
  /** 保留字路径 */
  keep_words_path?: string;
  /** 保留字大小写 */
  keep_words_case?: boolean;
  /** 类型 */
  types?: string[];
  /** 模式 */
  mode?: 'include' | 'exclude';
  /** 过滤器 */
  filter?: string[];
  /** 脚本 */
  script?: {
    source: string;
    lang?: string;
    params?: Record<string, any>;
  };
  /** 其他配置 */
  [key: string]: any;
}

/** 分词过滤器定义 */
export interface TokenFilterDefinition {
  /** 过滤器名 */
  name: string;
  /** 过滤器配置 */
  config: TokenFilterConfig;
}

// ==================== 字符过滤器类型 ====================

/** 内置字符过滤器类型 */
export type BuiltInCharFilterType =
  | 'html_strip'
  | 'mapping'
  | 'pattern_replace'
  | 'icu_normalizer'
  | 'kuromoji_iteration_mark'
  | 'stconvert';

/** 字符过滤器类型 */
export type CharFilterType = BuiltInCharFilterType | string;

/** 字符过滤器配置 */
export interface CharFilterConfig {
  /** 过滤器类型 */
  type?: CharFilterType;
  /** 转义标签 */
  escaped_tags?: string[];
  /** 映射 */
  mappings?: string[];
  /** 映射路径 */
  mappings_path?: string;
  /** 模式 */
  pattern?: string;
  /** 替换 */
  replacement?: string;
  /** 标志 */
  flags?: string;
  /** 名称 */
  name?: string;
  /** 模式 */
  mode?: 'replace' | 'append';
  /** 规范化 */
  normalize?: boolean;
  /** 其他配置 */
  [key: string]: any;
}

/** 字符过滤器定义 */
export interface CharFilterDefinition {
  /** 过滤器名 */
  name: string;
  /** 过滤器配置 */
  config: CharFilterConfig;
}

// ==================== 分析请求/响应类型 ====================

/** 分析请求 */
export interface AnalyzeRequest {
  /** 分析器 */
  analyzer?: string;
  /** 字段 */
  field?: string;
  /** 分词器 */
  tokenizer?: string | TokenizerConfig;
  /** 分词过滤器 */
  filter?: Array<string | TokenFilterConfig>;
  /** 字符过滤器 */
  char_filter?: Array<string | CharFilterConfig>;
  /** 文本 */
  text: string | string[];
  /** 解释 */
  explain?: boolean;
  /** 属性 */
  attributes?: string[];
  /** 正常化 */
  normalizer?: string;
}

/** 分析令牌 */
export interface AnalyzeToken {
  /** 令牌 */
  token: string;
  /** 起始偏移 */
  start_offset: number;
  /** 结束偏移 */
  end_offset: number;
  /** 类型 */
  type: string;
  /** 位置 */
  position: number;
  /** 位置长度 */
  positionLength?: number;
  /** 术语频率 */
  termFrequency?: number;
}

/** 分析响应 */
export interface AnalyzeResponse {
  /** 令牌列表 */
  tokens: AnalyzeToken[];
  /** 详细信息（explain=true时） */
  detail?: {
    /** 自定义分析器 */
    custom_analyzer?: boolean;
    /** 分析器 */
    analyzer?: {
      name?: string;
      tokenizer?: {
        name?: string;
        tokens?: AnalyzeToken[];
      };
      filters?: Array<{
        name?: string;
        tokens?: AnalyzeToken[];
      }>;
      charfilters?: Array<{
        name?: string;
        filtered_text?: string[];
      }>;
    };
  };
}

// ==================== 正常化器类型 ====================

/** 正常化器配置 */
export interface NormalizerConfig {
  /** 类型 */
  type?: 'custom';
  /** 字符过滤器 */
  char_filter?: string[];
  /** 分词过滤器 */
  filter?: string[];
}

/** 正常化器定义 */
export interface NormalizerDefinition {
  /** 正常化器名 */
  name: string;
  /** 正常化器配置 */
  config: NormalizerConfig;
}

// ==================== 同义词类型 ====================

/** 同义词配置 */
export interface SynonymConfig {
  /** 同义词列表 */
  synonyms?: string[];
  /** 同义词路径 */
  synonyms_path?: string;
  /** 同义词集 */
  synonym_set?: string;
  /** 可扩展 */
  expand?: boolean;
  /** 可扁平化 */
  flatten?: boolean;
  /** 可规范化 */
  normalize?: boolean;
  /** 可小写 */
  lowercase?: boolean;
  /** 令牌分隔符 */
  tokenizer?: string;
  /** 可更新 */
  updateable?: boolean;
  /** 格式 */
  format?: 'solr' | 'wordnet';
  /** 其他配置 */
  [key: string]: any;
}

/** 同义词定义 */
export interface SynonymDefinition {
  /** 同义词名 */
  name: string;
  /** 同义词配置 */
  config: SynonymConfig;
}

// ==================== 停用词类型 ====================

/** 停用词配置 */
export interface StopwordsConfig {
  /** 停用词列表 */
  stopwords?: string | string[];
  /** 停用词路径 */
  stopwords_path?: string;
  /** 忽略大小写 */
  ignore_case?: boolean;
  /** 移除尾随 */
  remove_trailing?: boolean;
}

/** 停用词定义 */
export interface StopwordsDefinition {
  /** 停用词名 */
  name: string;
  /** 停用词配置 */
  config: StopwordsConfig;
}

// ==================== 分析设置类型 ====================

/** 分析设置 */
export interface AnalysisSettings {
  /** 分析器 */
  analyzer?: Record<string, AnalyzerConfig>;
  /** 分词器 */
  tokenizer?: Record<string, TokenizerConfig>;
  /** 分词过滤器 */
  filter?: Record<string, TokenFilterConfig>;
  /** 字符过滤器 */
  char_filter?: Record<string, CharFilterConfig>;
  /** 正常化器 */
  normalizer?: Record<string, NormalizerConfig>;
}
