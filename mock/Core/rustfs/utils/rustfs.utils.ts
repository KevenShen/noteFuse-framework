/**
 * RustFS 核心工具函数
 * 
 * 包含MIME类型识别、路径处理、哈希计算、大小格式化等工具函数
 */

import type { StorageClass } from '../types';

// ==================== MIME类型识别 ====================

/**
 * MIME类型映射表
 */
export const MIME_TYPE_MAP: Record<string, string> = {
  // 图片
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.raw': 'image/raw',

  // 视频
  '.mp4': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/x-m4v',
  '.3gp': 'video/3gpp',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',

  // 音频
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.wma': 'audio/x-ms-wma',
  '.m4a': 'audio/x-m4a',
  '.opus': 'audio/opus',
  '.amr': 'audio/amr',
  '.mid': 'audio/midi',
  '.midi': 'audio/midi',

  // 文档
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.rtf': 'application/rtf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.yaml': 'application/x-yaml',
  '.yml': 'application/x-yaml',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.ts': 'application/typescript',
  '.jsx': 'text/jsx',
  '.tsx': 'text/tsx',
  '.vue': 'text/vue',
  '.py': 'text/x-python',
  '.java': 'text/x-java-source',
  '.c': 'text/x-c',
  '.cpp': 'text/x-c++',
  '.h': 'text/x-c',
  '.hpp': 'text/x-c++',
  '.go': 'text/x-go',
  '.rs': 'text/x-rust',
  '.rb': 'text/x-ruby',
  '.php': 'application/x-httpd-php',
  '.sh': 'application/x-sh',
  '.bash': 'application/x-bash',
  '.zsh': 'application/x-zsh',
  '.sql': 'application/sql',
  '.graphql': 'application/graphql',
  '.proto': 'application/x-protobuf',
  '.dockerfile': 'text/x-dockerfile',
  '.makefile': 'text/x-makefile',

  // 压缩包
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.bz2': 'application/x-bzip2',
  '.xz': 'application/x-xz',
  '.tgz': 'application/gzip',
  '.tbz2': 'application/x-bzip2',

  // 字体
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.eot': 'application/vnd.ms-fontobject',

  // 其他
  '.exe': 'application/x-msdownload',
  '.dll': 'application/x-msdownload',
  '.so': 'application/x-sharedlib',
  '.dylib': 'application/x-mach-binary',
  '.apk': 'application/vnd.android.package-archive',
  '.ipa': 'application/octet-stream',
  '.deb': 'application/x-debian-package',
  '.rpm': 'application/x-rpm',
  '.dmg': 'application/x-apple-diskimage',
  '.iso': 'application/x-iso9660-image',
  '.bin': 'application/octet-stream',
  '.dat': 'application/octet-stream',
  '.db': 'application/octet-stream',
  '.sqlite': 'application/x-sqlite3',
  '.sqlite3': 'application/x-sqlite3',
  '.log': 'text/plain',
  '.conf': 'text/plain',
  '.config': 'text/plain',
  '.ini': 'text/plain',
  '.env': 'text/plain',
  '.gitignore': 'text/plain',
  '.gitattributes': 'text/plain',
  '.npmignore': 'text/plain',
  '.eslintrc': 'application/json',
  '.prettierrc': 'application/json',
  '.babelrc': 'application/json',
  '.editorconfig': 'text/plain',
  '.readme': 'text/plain',
  '.changelog': 'text/plain',
  '.license': 'text/plain',
  '.copying': 'text/plain',
  '.authors': 'text/plain',
  '.contributors': 'text/plain',
  '.todo': 'text/plain',
  '.notes': 'text/plain',
};

/**
 * 根据文件扩展名获取MIME类型
 * 
 * @param filename 文件名
 * @returns MIME类型
 */
export function getMimeType(filename: string): string {
  const ext = getFileExtension(filename).toLowerCase();
  return MIME_TYPE_MAP[ext] || 'application/octet-stream';
}

/**
 * 根据MIME类型获取文件扩展名
 * 
 * @param mimeType MIME类型
 * @returns 文件扩展名（包含点）
 */
export function getExtensionFromMimeType(mimeType: string): string {
  for (const [ext, mime] of Object.entries(MIME_TYPE_MAP)) {
    if (mime === mimeType) {
      return ext;
    }
  }
  return '';
}

/**
 * 判断是否为图片类型
 * 
 * @param mimeType MIME类型
 * @returns 是否为图片
 */
export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * 判断是否为视频类型
 * 
 * @param mimeType MIME类型
 * @returns 是否为视频
 */
export function isVideo(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

/**
 * 判断是否为音频类型
 * 
 * @param mimeType MIME类型
 * @returns 是否为音频
 */
export function isAudio(mimeType: string): boolean {
  return mimeType.startsWith('audio/');
}

/**
 * 判断是否为文档类型
 * 
 * @param mimeType MIME类型
 * @returns 是否为文档
 */
export function isDocument(mimeType: string): boolean {
  const documentMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/xml',
    'text/html',
  ];
  return documentMimeTypes.includes(mimeType);
}

/**
 * 判断是否为压缩包类型
 * 
 * @param mimeType MIME类型
 * @returns 是否为压缩包
 */
export function isArchive(mimeType: string): boolean {
  const archiveMimeTypes = [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip',
    'application/x-bzip2',
    'application/x-xz',
  ];
  return archiveMimeTypes.includes(mimeType);
}

// ==================== 路径处理 ====================

/**
 * 获取文件扩展名（包含点）
 * 
 * @param filename 文件名
 * @returns 文件扩展名（包含点）
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return '';
  }
  return filename.substring(lastDotIndex);
}

/**
 * 获取文件名（不含扩展名）
 * 
 * @param filename 文件名
 * @returns 文件名（不含扩展名）
 */
export function getFileNameWithoutExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return filename;
  }
  return filename.substring(0, lastDotIndex);
}

/**
 * 获取路径中的文件名
 * 
 * @param path 路径
 * @returns 文件名
 */
export function getFileName(path: string): string {
  const normalizedPath = normalizePath(path);
  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  if (lastSlashIndex === -1) {
    return normalizedPath;
  }
  return normalizedPath.substring(lastSlashIndex + 1);
}

/**
 * 获取路径中的目录部分
 * 
 * @param path 路径
 * @returns 目录路径
 */
export function getDirectoryPath(path: string): string {
  const normalizedPath = normalizePath(path);
  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  if (lastSlashIndex === -1) {
    return '';
  }
  return normalizedPath.substring(0, lastSlashIndex);
}

/**
 * 规范化路径（统一使用正斜杠，去除多余斜杠）
 * 
 * @param path 路径
 * @returns 规范化后的路径
 */
export function normalizePath(path: string): string {
  // 替换反斜杠为正斜杠
  let normalized = path.replace(/\\/g, '/');
  // 去除多余的连续斜杠
  normalized = normalized.replace(/\/+/g, '/');
  // 去除开头的斜杠（对象存储键不以斜杠开头）
  normalized = normalized.replace(/^\/+/, '');
  // 去除结尾的斜杠（除非是根目录）
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, '');
  }
  return normalized;
}

/**
 * 连接路径
 * 
 * @param paths 路径片段
 * @returns 连接后的路径
 */
export function joinPath(...paths: string[]): string {
  const filteredPaths = paths.filter(p => p && p.length > 0);
  if (filteredPaths.length === 0) {
    return '';
  }
  return normalizePath(filteredPaths.join('/'));
}

/**
 * 判断路径是否为目录（以斜杠结尾）
 * 
 * @param path 路径
 * @returns 是否为目录
 */
export function isDirectoryPath(path: string): boolean {
  return path.endsWith('/');
}

/**
 * 获取路径的前缀（用于目录列表）
 * 
 * @param path 路径
 * @returns 前缀
 */
export function getPathPrefix(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === '') {
    return '';
  }
  if (normalized.endsWith('/')) {
    return normalized;
  }
  return normalized + '/';
}

/**
 * 判断路径是否匹配前缀
 * 
 * @param path 路径
 * @param prefix 前缀
 * @returns 是否匹配
 */
export function matchesPrefix(path: string, prefix: string): boolean {
  if (!prefix) {
    return true;
  }
  const normalizedPath = normalizePath(path);
  const normalizedPrefix = normalizePath(prefix);
  return normalizedPath.startsWith(normalizedPrefix);
}

/**
 * 获取路径的深度（斜杠数量）
 * 
 * @param path 路径
 * @returns 深度
 */
export function getPathDepth(path: string): number {
  const normalized = normalizePath(path);
  if (normalized === '') {
    return 0;
  }
  return normalized.split('/').length;
}

// ==================== 哈希计算 ====================

/**
 * 计算字符串的MD5哈希（简化版，Mock环境使用）
 * 
 * @param data 数据
 * @returns MD5哈希
 */
export function calculateMD5(data: string | Buffer): string {
  const str = typeof data === 'string' ? data : data.toString('utf8');
  // 简化版MD5（Mock环境使用，实际环境应使用crypto库）
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  // 转换为十六进制字符串，并填充到32位
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  // 重复4次以达到32位
  return (hex + hex + hex + hex).substring(0, 32);
}

/**
 * 计算字符串的SHA256哈希（简化版，Mock环境使用）
 * 
 * @param data 数据
 * @returns SHA256哈希
 */
export function calculateSHA256(data: string | Buffer): string {
  const str = typeof data === 'string' ? data : data.toString('utf8');
  // 简化版SHA256（Mock环境使用）
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1) + char;
    hash1 = hash1 & hash1;
    hash2 = ((hash2 << 3) - hash2) + char + i;
    hash2 = hash2 & hash2;
  }
  const hex1 = Math.abs(hash1).toString(16).padStart(8, '0');
  const hex2 = Math.abs(hash2).toString(16).padStart(8, '0');
  // 重复8次以达到64位
  return (hex1 + hex2 + hex1 + hex2 + hex1 + hex2 + hex1 + hex2).substring(0, 64);
}

/**
 * 计算ETag（MD5哈希）
 * 
 * @param data 数据
 * @returns ETag
 */
export function calculateETag(data: string | Buffer): string {
  return calculateMD5(data);
}

/**
 * 生成分片上传的ETag（各分片MD5的MD5 + 分片数量）
 * 
 * @param partETags 各分片的ETag列表
 * @returns 组合ETag
 */
export function calculateMultipartETag(partETags: string[]): string {
  const combined = partETags.join('');
  const md5 = calculateMD5(combined);
  return `${md5}-${partETags.length}`;
}

/**
 * 生成唯一ID
 * 
 * @param prefix 前缀
 * @returns 唯一ID
 */
export function generateUniqueId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}${timestamp}${random}`;
}

/**
 * 生成UUID
 * 
 * @returns UUID
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ==================== 大小格式化 ====================

/**
 * 格式化文件大小
 * 
 * @param bytes 字节数
 * @param decimals 小数位数
 * @returns 格式化后的大小字符串
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  if (bytes < 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(decimals)} ${sizes[i]}`;
}

/**
 * 解析文件大小字符串为字节数
 * 
 * @param sizeString 大小字符串（如 "10MB", "5GB", "1024B"）
 * @returns 字节数
 */
export function parseFileSize(sizeString: string): number {
  const match = sizeString.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB|PB|EB|ZB|YB)?$/i);
  if (!match) {
    return 0;
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();

  const units: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 ** 2,
    'GB': 1024 ** 3,
    'TB': 1024 ** 4,
    'PB': 1024 ** 5,
    'EB': 1024 ** 6,
    'ZB': 1024 ** 7,
    'YB': 1024 ** 8,
  };

  return Math.floor(value * (units[unit] || 1));
}

/**
 * 获取文件大小分布区间
 * 
 * @param size 字节数
 * @returns 区间名称
 */
export function getFileSizeRange(size: number): string {
  if (size < 1024) return '0-1KB';
  if (size < 10 * 1024) return '1KB-10KB';
  if (size < 100 * 1024) return '10KB-100KB';
  if (size < 1024 * 1024) return '100KB-1MB';
  if (size < 10 * 1024 * 1024) return '1MB-10MB';
  if (size < 100 * 1024 * 1024) return '10MB-100MB';
  if (size < 1024 * 1024 * 1024) return '100MB-1GB';
  if (size < 10 * 1024 * 1024 * 1024) return '1GB-10GB';
  return '10GB+';
}

// ==================== 存储类工具 ====================

/**
 * 存储类描述映射
 */
export const STORAGE_CLASS_DESCRIPTIONS: Record<StorageClass, string> = {
  'STANDARD': '标准存储（高频访问）',
  'STANDARD_IA': '低频访问存储',
  'ARCHIVE': '归档存储',
  'DEEP_ARCHIVE': '深度归档存储',
  'INTELLIGENT_TIERING': '智能分层存储',
  'REDUCED_REDUNDANCY': '低冗余存储',
  'GLACIER': '冰川存储',
  'COLD': '冷存储',
};

/**
 * 存储类成本系数（相对于标准存储）
 */
export const STORAGE_CLASS_COST_FACTORS: Record<StorageClass, number> = {
  'STANDARD': 1.0,
  'STANDARD_IA': 0.5,
  'ARCHIVE': 0.2,
  'DEEP_ARCHIVE': 0.1,
  'INTELLIGENT_TIERING': 1.0,
  'REDUCED_REDUNDANCY': 0.8,
  'GLACIER': 0.15,
  'COLD': 0.25,
};

/**
 * 存储类最小存储天数
 */
export const STORAGE_CLASS_MIN_DAYS: Record<StorageClass, number> = {
  'STANDARD': 0,
  'STANDARD_IA': 30,
  'ARCHIVE': 90,
  'DEEP_ARCHIVE': 180,
  'INTELLIGENT_TIERING': 0,
  'REDUCED_REDUNDANCY': 0,
  'GLACIER': 90,
  'COLD': 30,
};

/**
 * 获取存储类描述
 * 
 * @param storageClass 存储类
 * @returns 描述
 */
export function getStorageClassDescription(storageClass: StorageClass): string {
  return STORAGE_CLASS_DESCRIPTIONS[storageClass] || storageClass;
}

/**
 * 计算存储成本
 * 
 * @param size 大小（字节）
 * @param storageClass 存储类
 * @param days 存储天数
 * @returns 成本（相对于标准存储）
 */
export function calculateStorageCost(size: number, storageClass: StorageClass, days: number): number {
  const costFactor = STORAGE_CLASS_COST_FACTORS[storageClass] || 1.0;
  const sizeGB = size / (1024 ** 3);
  return sizeGB * costFactor * (days / 30);
}

// ==================== 时间工具 ====================

/**
 * 格式化时间戳为ISO字符串
 * 
 * @param timestamp 时间戳（毫秒）
 * @returns ISO字符串
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * 获取当前时间的ISO字符串
 * 
 * @returns ISO字符串
 */
export function getCurrentTime(): string {
  return new Date().toISOString();
}

/**
 * 计算两个时间之间的天数差
 * 
 * @param date1 日期1
 * @param date2 日期2
 * @returns 天数差
 */
export function calculateDaysDifference(date1: string | Date, date2: string | Date): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 添加天数到日期
 * 
 * @param date 日期
 * @param days 天数
 * @returns 新日期
 */
export function addDaysToDate(date: string | Date, days: number): string {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * 格式化持续时间
 * 
 * @param milliseconds 毫秒数
 * @returns 格式化后的持续时间
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  if (milliseconds < 60 * 1000) {
    return `${(milliseconds / 1000).toFixed(2)}s`;
  }
  if (milliseconds < 60 * 60 * 1000) {
    const minutes = Math.floor(milliseconds / (60 * 1000));
    const seconds = Math.floor((milliseconds % (60 * 1000)) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(milliseconds / (60 * 60 * 1000));
  const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m`;
}

// ==================== 验证工具 ====================

/**
 * 验证桶名是否合法
 * 
 * @param bucketName 桶名
 * @returns 是否合法
 */
export function isValidBucketName(bucketName: string): boolean {
  // 桶名长度3-63个字符
  if (bucketName.length < 3 || bucketName.length > 63) {
    return false;
  }
  // 只能包含小写字母、数字、点和连字符
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(bucketName)) {
    return false;
  }
  // 不能包含连续的点
  if (bucketName.includes('..')) {
    return false;
  }
  // 不能以点或连字符开头或结尾
  if (bucketName.startsWith('.') || bucketName.startsWith('-') ||
      bucketName.endsWith('.') || bucketName.endsWith('-')) {
    return false;
  }
  // 不能是IP地址格式
  if (/^\d+\.\d+\.\d+\.\d+$/.test(bucketName)) {
    return false;
  }
  return true;
}

/**
 * 验证对象键是否合法
 * 
 * @param key 对象键
 * @returns 是否合法
 */
export function isValidObjectKey(key: string): boolean {
  if (!key || key.length === 0) {
    return false;
  }
  // 对象键长度不能超过1024个字符
  if (key.length > 1024) {
    return false;
  }
  // 不能包含某些特殊字符
  if (key.includes('\\') || key.includes('\0')) {
    return false;
  }
  return true;
}

/**
 * 验证存储类是否合法
 * 
 * @param storageClass 存储类
 * @returns 是否合法
 */
export function isValidStorageClass(storageClass: string): storageClass is StorageClass {
  const validClasses: StorageClass[] = [
    'STANDARD', 'STANDARD_IA', 'ARCHIVE', 'DEEP_ARCHIVE',
    'INTELLIGENT_TIERING', 'REDUCED_REDUNDANCY', 'GLACIER', 'COLD',
  ];
  return validClasses.includes(storageClass as StorageClass);
}

/**
 * 验证ACL是否合法
 * 
 * @param acl ACL
 * @returns 是否合法
 */
export function isValidACL(acl: string): boolean {
  const validACLs = [
    'private', 'public-read', 'public-read-write',
    'authenticated-read', 'bucket-owner-read',
    'bucket-owner-full-control', 'log-delivery-write',
  ];
  return validACLs.includes(acl);
}

// ==================== 其他工具 ====================

/**
 * 安全的JSON解析
 * 
 * @param str JSON字符串
 * @param defaultValue 默认值
 * @returns 解析结果
 */
export function safeJSONParse<T = any>(str: string, defaultValue?: T): T | undefined {
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 安全的JSON字符串化
 * 
 * @param obj 对象
 * @param pretty 是否格式化
 * @returns JSON字符串
 */
export function safeJSONStringify(obj: any, pretty: boolean = false): string {
  try {
    return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
  } catch {
    return '';
  }
}

/**
 * 深度克隆对象
 * 
 * @param obj 对象
 * @returns 克隆后的对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as any;
  }
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      (cloned as any)[key] = deepClone((obj as any)[key]);
    }
  }
  return cloned;
}

/**
 * 分页计算
 * 
 * @param total 总数
 * @param page 页码（从1开始）
 * @param pageSize 每页数量
 * @returns 分页信息
 */
export function calculatePagination(total: number, page: number, pageSize: number) {
  const totalPages = Math.ceil(total / pageSize);
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  return {
    total,
    page: currentPage,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    hasNextPage,
    hasPrevPage,
  };
}

/**
 * 限制数值范围
 * 
 * @param value 数值
 * @param min 最小值
 * @param max 最大值
 * @returns 限制后的数值
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 延迟执行
 * 
 * @param ms 毫秒数
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
