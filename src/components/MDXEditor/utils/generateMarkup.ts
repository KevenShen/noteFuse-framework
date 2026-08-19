/**
 * 纯文本生成工具（无 UI、无 hooks 依赖）
 * 生成视频/音频嵌入 HTML、附件 Markdown、Tabs 指令 Markdown
 */

/** 根据视频链接生成嵌入 HTML（支持 B站/YouTube/直链） */
export const generateVideoEmbedHtml = (url: string): string => {
  const bv = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/);
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);

  if (bv) {
    return `<iframe src="//player.bilibili.com/player.html?bvid=${bv[1]}&page=1&high_quality=1&danmaku=0" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" style="width:100%;height:420px;border-radius:8px;border:none;"></iframe>`;
  }
  if (yt) {
    return `<iframe src="https://www.youtube.com/embed/${yt[1]}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:420px;border-radius:8px;border:none;"></iframe>`;
  }
  return `<video src="${url}" controls controlsList="nodownload" style="width:100%;border-radius:8px;"></video>`;
};

/** 生成 audio 标签 HTML */
export const generateAudioEmbedHtml = (url: string): string => {
  return `<audio src="${url}" controls controlsList="nodownload" style="width:100%;">`;
};

/** 生成附件 Markdown 链接 */
export const generateAttachmentMarkdown = (name: string, url: string): string => {
  return `[📎 ${name}](${url})`;
};

/** 根据标签标题数组生成 :::tabs 指令 Markdown */
export const generateTabsDirectiveMd = (labels: string[]): string => {
  let md = '\n::::tabs\n';
  labels.forEach((label) => {
    md += `:::tab{label="${label}"}\n在此输入内容\n:::\n`;
  });
  md += '::::\n';
  return md;
};
