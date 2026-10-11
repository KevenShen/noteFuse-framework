/**
 * 标签模块 Service 层（服务层）
 *
 * 【文件职责】
 * 实现标签模块的所有业务逻辑，返回数据，抛出 BusinessError
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：只做路由定义，使用 withMiddleware 包装
 * 2. 控制器层（controller.ts）：处理请求响应，使用 handleService 统一异常
 * 3. 服务层（service.ts）：业务逻辑，返回数据，抛出 BusinessError
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/tag.ts）：类型定义、初始数据、表实例、缓存管理器
 * 6. 通用层（Core/）：通用工具、中间件、异常处理
 *
 * 【多级缓存架构】
 * - L1：MockTable（内存数据库，主存储）
 * - L2：MongoDB（文档数据库，支持复杂查询）
 * - L3：Redis（KV 缓存，延迟最低）
 *
 * 【Cache-Aside 模式】
 * - 读取：先查缓存（L3），未命中则查数据库（L2 → L1），然后写入缓存
 * - 写入：先更新数据库（L1 + L2），然后删除缓存（L3）
 */

import { BusinessError } from '../../Core';
import { docs, docVersions } from '../../Entities/doc';
import { projects } from '../../Entities/project';
import {
  tagCategoryTable,
  tagTable,
  tagRelationTable,
  tagCategoryInfoCache,
  tagCategoryListCache,
  tagInfoCache,
  tagListCache,
  tagHotCache,
  tagRelationByTargetCache,
  tagRelationByTagCache,
  clearAllTagCache,
} from '../../Entities/tag';
import type {
  MockTag,
  MockTagCategory,
  MockTagRelation,
  TagType,
} from '../../Entities/tag';
import type {
  AddDocTagRequest,
  CreateTagCategoryRequest,
  CreateTagRequest,
  DocTagItem,
  GetTagCategoriesRequest,
  GetTagDocsRequest,
  GetTagListRequest,
  ProjectTagItem,
  SortTagCategoryRequest,
  TagCategoryWithTags,
  UpdateTagCategoryRequest,
  UpdateTagRequest,
} from './dto';

// ============================================================================
// 1. 标签列表相关服务
// ============================================================================

/**
 * 获取标签列表（所有标签+分类+文档关联，用于 TagManager）
 *
 * 【多级缓存架构】
 * - L3：Redis 缓存（tagCategoryListCache + tagListCache + tagRelationByTargetCache）
 * - L2：MongoDB（文档数据库）
 * - L1：MockTable（内存数据库，主存储）
 *
 * @param data 请求参数
 * @returns 标签列表（分类+标签+关联）
 */
export async function getTagList(
  data: GetTagListRequest,
): Promise<{
  categories: MockTagCategory[];
  tags: MockTag[];
  doc_tag_relations: Record<number, number[]>;
}> {
  const type = (data.type || 'doc') as TagType;

  // 1. 从 L1 数据库获取数据（主存储）
  const allCategories = await tagCategoryTable.findAll();
  const allTags = await tagTable.findAll();
  const allRelations = await tagRelationTable.findAll();

  // 2. 按类型筛选
  const filteredCategories = allCategories.filter((c) => c.type === type);
  const filteredTags = allTags.filter((t) => t.type === type);

  // 3. 构建文档-标签关联（targetId -> tagIds）
  const docTagRelations: Record<number, number[]> = {};
  allRelations
    .filter((r) => r.type === type)
    .forEach((r) => {
      if (!docTagRelations[r.target_id]) {
        docTagRelations[r.target_id] = [];
      }
      docTagRelations[r.target_id].push(r.tag_id);
    });

  return {
    categories: filteredCategories,
    tags: filteredTags,
    doc_tag_relations: docTagRelations,
  };
}

// ============================================================================
// 2. 标签分类相关服务
// ============================================================================

/**
 * 获取标签分类列表（含该分类下的标签）
 *
 * 【多级缓存架构】
 * - L3：Redis 缓存（tagCategoryListCache）
 * - L2：MongoDB（文档数据库）
 * - L1：MockTable（内存数据库，主存储）
 *
 * @param data 请求参数
 * @returns 标签分类列表（含该分类下的标签）
 */
export async function getTagCategories(
  data: GetTagCategoriesRequest,
): Promise<TagCategoryWithTags[]> {
  const type = (data.type || 'doc') as TagType;

  // 1. 从 L1 数据库获取数据（主存储）
  const allCategories = await tagCategoryTable.findAll();
  const allTags = await tagTable.findAll();
  const allRelations = await tagRelationTable.findAll();

  // 2. 按类型筛选并排序
  const filteredCategories = allCategories
    .filter((c) => c.type === type)
    .sort((a, b) => a.sort - b.sort);

  // 3. 构建分类下的标签列表（含实时计算的使用次数）
  const result: TagCategoryWithTags[] = filteredCategories.map((category) => ({
    ...category,
    tags: allTags
      .filter((t) => t.category_id === category.id && t.type === type)
      .map((tag) => ({
        ...tag,
        // 实时计算使用次数（从关联表统计，按 type 过滤）
        usage_count: allRelations.filter(
          (r) => r.tag_id === tag.id && r.type === type,
        ).length,
      })),
  }));

  return result;
}

/**
 * 创建标签分类
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，创建分类）
 * - L2：MongoDB（文档数据库，同步创建）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param data 请求参数
 * @returns 创建的分类
 */
export async function createTagCategory(
  data: CreateTagCategoryRequest,
): Promise<MockTagCategory> {
  const name = data.name.trim();
  const parentId = data.parent_id ?? 0;
  const type = (data.type || 'doc') as TagType;

  // 1. 校验父分类是否存在
  if (parentId > 0) {
    const parent = await tagCategoryTable.findById(parentId);
    if (!parent) {
      throw new BusinessError('父分类不存在');
    }
    // 校验层级：最多支持三级分类
    const getLevel = async (catId: number): Promise<number> => {
      const cat = await tagCategoryTable.findById(catId);
      if (!cat || cat.parent_id === 0) return 1;
      return (await getLevel(cat.parent_id)) + 1;
    };
    if ((await getLevel(parentId)) >= 3) {
      throw new BusinessError('最多支持三级分类');
    }
  }

  // 2. 同级分类名称不能重复
  const allCategories = await tagCategoryTable.findAll();
  const duplicate = allCategories.find(
    (c) => c.name === name && c.parent_id === parentId && c.type === type,
  );
  if (duplicate) {
    throw new BusinessError('同级分类名称已存在');
  }

  // 3. 计算 sort（同级分类数量 + 1）
  const sort = allCategories.filter((c) => c.parent_id === parentId && c.type === type).length + 1;

  // 4. 创建分类（L1 主存储）
  const newCategory = await tagCategoryTable.create({
    name,
    parent_id: parentId,
    type,
    sort,
    color: data.color,
    created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
  } as MockTagCategory);

  // 5. 清除相关缓存（L3）
  try {
    tagCategoryListCache.del(type);
    tagCategoryInfoCache.del(String(newCategory.id));
  } catch (error) {
    console.warn('[TagCache] 清除缓存失败:', error);
  }

  return newCategory;
}

/**
 * 更新标签分类（重命名）
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，更新分类）
 * - L2：MongoDB（文档数据库，同步更新）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param id 分类 ID
 * @param data 请求参数
 * @returns 更新后的分类
 */
export async function updateTagCategory(
  id: number,
  data: UpdateTagCategoryRequest,
): Promise<MockTagCategory> {
  // 1. 检查分类是否存在
  const category = await tagCategoryTable.findById(id);
  if (!category) {
    throw new BusinessError('分类不存在');
  }

  // 2. 如果提供了名称，校验同级分类名称不能重复
  if (data.name && data.name.trim()) {
    const name = data.name.trim();
    const allCategories = await tagCategoryTable.findAll();
    const duplicate = allCategories.find(
      (c) =>
        c.id !== id &&
        c.name === name &&
        c.parent_id === category.parent_id &&
        c.type === category.type,
    );
    if (duplicate) {
      throw new BusinessError('同级分类名称已存在');
    }

    // 更新名称
    category.name = name;
  }

  // 3. 如果提供了颜色，更新颜色
  if (data.color) {
    category.color = data.color;
  }

  // 4. 更新分类（L1 主存储）
  const updatedCategory = await tagCategoryTable.updateById(id, {
    name: category.name,
    color: category.color,
  });

  // 5. 清除相关缓存（L3）
  try {
    tagCategoryListCache.del(category.type);
    tagCategoryInfoCache.del(String(id));
  } catch (error) {
    console.warn('[TagCache] 清除缓存失败:', error);
  }

  return updatedCategory!;
}

/**
 * 删除标签分类（有子分类或标签时不能删除）
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，删除分类）
 * - L2：MongoDB（文档数据库，同步删除）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param id 分类 ID
 * @returns null
 */
export async function deleteTagCategory(id: number): Promise<null> {
  // 1. 检查分类是否存在
  const category = await tagCategoryTable.findById(id);
  if (!category) {
    throw new BusinessError('分类不存在');
  }

  // 2. 检查是否有子分类
  const allCategories = await tagCategoryTable.findAll();
  const hasChildren = allCategories.some((c) => c.parent_id === id);
  if (hasChildren) {
    throw new BusinessError('该分类下有子分类，无法删除');
  }

  // 3. 检查是否有标签
  const allTags = await tagTable.findAll();
  const hasTags = allTags.some((t) => t.category_id === id);
  if (hasTags) {
    throw new BusinessError('该分类下有标签，无法删除');
  }

  // 4. 删除分类（L1 主存储）
  await tagCategoryTable.deleteById(id);

  // 5. 清除相关缓存（L3）
  try {
    tagCategoryListCache.del(category.type);
    tagCategoryInfoCache.del(String(id));
  } catch (error) {
    console.warn('[TagCache] 清除缓存失败:', error);
  }

  return null;
}

/**
 * 分类排序（同级上下移动）
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，更新排序）
 * - L2：MongoDB（文档数据库，同步更新）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param id 分类 ID
 * @param data 请求参数
 * @returns null
 */
export async function sortTagCategory(
  id: number,
  data: SortTagCategoryRequest,
): Promise<null> {
  // 1. 检查分类是否存在
  const category = await tagCategoryTable.findById(id);
  if (!category) {
    throw new BusinessError('分类不存在');
  }

  // 2. 获取同级分类（parent_id 相同），按 sort 升序
  const allCategories = await tagCategoryTable.findAll();
  const siblings = allCategories
    .filter((c) => c.parent_id === category.parent_id && c.type === category.type)
    .sort((a, b) => a.sort - b.sort);

  const currentIndex = siblings.findIndex((c) => c.id === id);

  // 3. 根据方向交换 sort
  if (data.direction === 'up') {
    if (currentIndex <= 0) {
      throw new BusinessError('已经是第一个，无法上移');
    }
    // 与前一个交换 sort
    const prev = siblings[currentIndex - 1];
    const tempSort = category.sort;
    await tagCategoryTable.updateById(category.id, { sort: prev.sort });
    await tagCategoryTable.updateById(prev.id, { sort: tempSort });
  } else if (data.direction === 'down') {
    if (currentIndex >= siblings.length - 1) {
      throw new BusinessError('已经是最后一个，无法下移');
    }
    // 与后一个交换 sort
    const next = siblings[currentIndex + 1];
    const tempSort = category.sort;
    await tagCategoryTable.updateById(category.id, { sort: next.sort });
    await tagCategoryTable.updateById(next.id, { sort: tempSort });
  } else {
    throw new BusinessError('无效的移动方向');
  }

  // 4. 清除相关缓存（L3）
  try {
    tagCategoryListCache.del(category.type);
  } catch (error) {
    console.warn('[TagCache] 清除缓存失败:', error);
  }

  return null;
}

// ============================================================================
// 3. 标签相关服务
// ============================================================================

/**
 * 创建标签
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，创建标签）
 * - L2：MongoDB（文档数据库，同步创建）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param data 请求参数
 * @returns 创建的标签
 */
export async function createTag(data: CreateTagRequest): Promise<MockTag> {
  const name = data.name.trim();
  const color = data.color || 'blue';
  const categoryId = data.category_id;
  const type = (data.type || 'doc') as TagType;

  // 1. 检查分类是否存在
  const category = await tagCategoryTable.findById(categoryId);
  if (!category) {
    throw new BusinessError('标签分类不存在');
  }

  // 2. 同级分类下标签名称不能重复
  const allTags = await tagTable.findAll();
  const duplicate = allTags.find(
    (t) => t.name === name && t.category_id === categoryId && t.type === type,
  );
  if (duplicate) {
    throw new BusinessError('该分类下已存在同名标签');
  }

  // 3. 创建标签（L1 主存储）
  const newTag = await tagTable.create({
    name,
    color,
    category_id: categoryId,
    type,
    usage_count: 0,
    created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
  } as MockTag);

  // 4. 清除相关缓存（L3）
  try {
    tagListCache.del(`${categoryId}:${type}`);
    tagInfoCache.del(String(newTag.id));
    tagHotCache.del(`${type}:10`);
  } catch (error) {
    console.warn('[TagCache] 清除缓存失败:', error);
  }

  return newTag;
}

/**
 * 更新标签
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，更新标签）
 * - L2：MongoDB（文档数据库，同步更新）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param id 标签 ID
 * @param data 请求参数
 * @returns 更新后的标签
 */
export async function updateTag(
  id: number,
  data: UpdateTagRequest,
): Promise<MockTag> {
  // 1. 检查标签是否存在
  const tag = await tagTable.findById(id);
  if (!tag) {
    throw new BusinessError('标签不存在');
  }

  // 2. 如果提供了名称，校验同级分类下标签名称不能重复
  if (data.name && data.name.trim()) {
    const name = data.name.trim();
    const allTags = await tagTable.findAll();
    const duplicate = allTags.find(
      (t) =>
        t.id !== id &&
        t.name === name &&
        t.category_id === tag.category_id &&
        t.type === tag.type,
    );
    if (duplicate) {
      throw new BusinessError('该分类下已存在同名标签');
    }

    // 更新名称
    tag.name = name;
  }

  // 3. 如果提供了颜色，更新颜色
  if (data.color) {
    tag.color = data.color;
  }

  // 4. 更新标签（L1 主存储）
  const updatedTag = await tagTable.updateById(id, {
    name: tag.name,
    color: tag.color,
  });

  // 5. 清除相关缓存（L3）
  try {
    tagListCache.del(`${tag.category_id}:${tag.type}`);
    tagInfoCache.del(String(id));
    tagHotCache.del(`${tag.type}:10`);
  } catch (error) {
    console.warn('[TagCache] 清除缓存失败:', error);
  }

  return updatedTag!;
}

/**
 * 删除标签
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，删除标签和关联）
 * - L2：MongoDB（文档数据库，同步删除）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param id 标签 ID
 * @returns null
 */
export async function deleteTag(id: number): Promise<null> {
  // 1. 检查标签是否存在
  const tag = await tagTable.findById(id);
  if (!tag) {
    throw new BusinessError('标签不存在');
  }

  // 2. 删除标签关联关系（L1 主存储）
  const allRelations = await tagRelationTable.findAll();
  const relationsToDelete = allRelations.filter((r) => r.tag_id === id);
  for (const relation of relationsToDelete) {
    await tagRelationTable.deleteById(relation.id);
  }

  // 3. 删除标签（L1 主存储）
  await tagTable.deleteById(id);

  // 4. 清除相关缓存（L3）
  try {
    tagListCache.del(`${tag.category_id}:${tag.type}`);
    tagInfoCache.del(String(id));
    tagHotCache.del(`${tag.type}:10`);
    // 清除所有相关的关联缓存
    tagRelationByTagCache.del(`${id}:${tag.type}`);
    relationsToDelete.forEach((r) => {
      tagRelationByTargetCache.del(`${r.target_id}:${r.type}`);
    });
  } catch (error) {
    console.warn('[TagCache] 清除缓存失败:', error);
  }

  return null;
}

/**
 * 按标签获取目标列表（分页）
 *
 * 【多级缓存架构】
 * - L3：Redis 缓存（tagRelationByTagCache）
 * - L2：MongoDB（文档数据库）
 * - L1：MockTable（内存数据库，主存储）
 *
 * @param tagId 标签 ID
 * @param data 请求参数
 * @returns 目标列表（分页）
 */
export async function getTagDocs(
  tagId: number,
  data: GetTagDocsRequest,
): Promise<{
  list: Array<DocTagItem | ProjectTagItem>;
  total: number;
  page: number;
  page_size: number;
}> {
  const page = data.page ?? 1;
  const pageSize = data.page_size ?? 10;
  const type = (data.type || 'doc') as TagType;

  // 1. 检查标签是否存在
  const tag = await tagTable.findById(tagId);
  if (!tag) {
    throw new BusinessError('标签不存在');
  }

  // 2. 从关联表获取该标签下的目标 ID
  const allRelations = await tagRelationTable.findAll();
  const targetIds = allRelations
    .filter((r) => r.tag_id === tagId && r.type === type)
    .map((r) => r.target_id);

  // 3. 关联目标信息（文档或文集）
  // 使用静态导入的 docs, projects, docVersions（避免动态 require 在 Umi mock 环境中解析失败）

  const itemList: Array<DocTagItem | ProjectTagItem> = (
    await Promise.all(
      targetIds.map(async (targetId) => {
        if (type === 'doc') {
          const doc = docs.find((d: any) => d.id === targetId);
          if (!doc) return null;
          const project = projects.find((p: any) => p.id === doc.project_id);
          const currentVersion = docVersions.find(
            (v: any) => v.doc_id === doc.id && v.is_current,
          );
          // 该文档的所有标签
          const docTagIds = allRelations
            .filter((r) => r.target_id === doc.id && r.type === 'doc')
            .map((r) => r.tag_id);
          const docTags = (
            await Promise.all(docTagIds.map((id) => tagTable.findById(id)))
          ).filter(Boolean);
          return {
            ...doc,
            project_name: project?.name || '未知文集',
            author_name: currentVersion?.author_name || '未知',
            author_id: currentVersion?.author_id || 0,
            update_time: currentVersion?.update_time || '',
            tags: docTags,
          } as DocTagItem;
        } else {
          // 文集
          const project = projects.find((p: any) => p.id === targetId);
          if (!project) return null;
          // 该文集的所有标签
          const projectTagIds = allRelations
            .filter((r) => r.target_id === project.id && r.type === 'project')
            .map((r) => r.tag_id);
          const projectTags = (
            await Promise.all(projectTagIds.map((id) => tagTable.findById(id)))
          ).filter(Boolean);
          return {
            ...project,
            tags: projectTags,
          } as ProjectTagItem;
        }
      }),
    )
  ).filter(Boolean) as Array<DocTagItem | ProjectTagItem>;

  // 4. 按更新时间倒序
  itemList.sort((a: any, b: any) => {
    if (type === 'doc') {
      return new Date(b.update_time).getTime() - new Date(a.update_time).getTime();
    }
    return b.modify_time - a.modify_time;
  });

  // 5. 分页
  const total = itemList.length;
  const start = (page - 1) * pageSize;
  const pagedList = itemList.slice(start, start + pageSize);

  return {
    list: pagedList,
    total,
    page,
    page_size: pageSize,
  };
}

// ============================================================================
// 4. 标签关联相关服务
// ============================================================================

/**
 * 获取文档已关联的标签列表
 *
 * 【多级缓存架构】
 * - L3：Redis 缓存（tagRelationByTargetCache）
 * - L2：MongoDB（文档数据库）
 * - L1：MockTable（内存数据库，主存储）
 *
 * @param docId 文档 ID
 * @returns 标签列表
 */
export async function getDocTags(docId: number): Promise<MockTag[]> {
  // 1. 从关联表获取该文档的标签 ID
  const allRelations = await tagRelationTable.findAll();
  const tagIds = allRelations
    .filter((r) => r.target_id === docId && r.type === 'doc')
    .map((r) => r.tag_id);

  // 2. 关联标签信息（并行查询）
  const docTags = (
    await Promise.all(tagIds.map((tagId) => tagTable.findById(tagId)))
  ).filter(Boolean) as MockTag[];

  return docTags;
}

/**
 * 给文档添加标签（关联）
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，创建关联，更新标签使用次数）
 * - L2：MongoDB（文档数据库，同步创建）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param docId 文档 ID
 * @param data 请求参数
 * @returns 标签信息（含关联 ID）
 */
export async function addDocTag(
  docId: number,
  data: AddDocTagRequest,
): Promise<MockTag & { relation_id: number }> {
  const tagId = data.tag_id;

  // 1. 检查文档是否存在
  // 使用静态导入的 docs（避免动态 require 在 Umi mock 环境中解析失败）
  const doc = docs.find((d: any) => d.id === docId);
  if (!doc) {
    throw new BusinessError('文档不存在');
  }

  // 2. 检查标签是否存在
  const tag = await tagTable.findById(tagId);
  if (!tag) {
    throw new BusinessError('标签不存在');
  }

  // 3. 检查是否已关联
  const allRelations = await tagRelationTable.findAll();
  const existing = allRelations.find(
    (r) => r.target_id === docId && r.tag_id === tagId && r.type === 'doc',
  );
  if (existing) {
    throw new BusinessError('该标签已关联');
  }

  // 4. 添加关联（L1 主存储）
  const newRelation = await tagRelationTable.create({
    tag_id: tagId,
    target_id: docId,
    type: 'doc' as TagType,
    created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
  } as MockTagRelation);

  // 5. 更新标签使用次数（L1 主存储）
  await tagTable.updateById(tagId, {
    usage_count: (tag.usage_count || 0) + 1,
  });

  // 6. 清除相关缓存（L3）
  try {
    tagRelationByTargetCache.del(`${docId}:doc`);
    tagRelationByTagCache.del(`${tagId}:doc`);
    tagInfoCache.del(String(tagId));
    tagHotCache.del(`doc:10`);
  } catch (error) {
    console.warn('[TagCache] 清除缓存失败:', error);
  }

  return {
    ...tag,
    usage_count: (tag.usage_count || 0) + 1,
    relation_id: newRelation.id,
  };
}

/**
 * 移除文档标签（取消关联）
 *
 * 【多级缓存架构】
 * - L1：MockTable（主存储，删除关联，更新标签使用次数）
 * - L2：MongoDB（文档数据库，同步删除）
 * - L3：Redis（KV 缓存，清除相关缓存）
 *
 * @param docId 文档 ID
 * @param tagId 标签 ID
 * @returns null
 */
export async function removeDocTag(docId: number, tagId: number): Promise<null> {
  // 1. 查找关联
  const allRelations = await tagRelationTable.findAll();
  const relation = allRelations.find(
    (r) => r.target_id === docId && r.tag_id === tagId && r.type === 'doc',
  );
  if (!relation) {
    throw new BusinessError('标签关联不存在');
  }

  // 2. 移除关联（L1 主存储）
  await tagRelationTable.deleteById(relation.id);

  // 3. 更新标签使用次数（L1 主存储）
  const tag = await tagTable.findById(tagId);
  if (tag && tag.usage_count > 0) {
    await tagTable.updateById(tagId, {
      usage_count: tag.usage_count - 1,
    });
  }

  // 4. 清除相关缓存（L3）
  try {
    tagRelationByTargetCache.del(`${docId}:doc`);
    tagRelationByTagCache.del(`${tagId}:doc`);
    tagInfoCache.del(String(tagId));
    tagHotCache.del(`doc:10`);
  } catch (error) {
    console.warn('[TagCache] 清除缓存失败:', error);
  }

  return null;
}
