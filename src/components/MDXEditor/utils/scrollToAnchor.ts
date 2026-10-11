/**
 * @file 滚动到指定锚点工具函数
 * @description 支持通过 ID 或标题文本查找 h1-h6 元素，并智能定位滚动容器
 */

/**
 * 通过 ID 或标题文本查找目标元素
 */
function findTargetElement(anchorId: string): HTMLElement | null {
  // 先尝试通过 ID 查找
  const byId = document.getElementById(anchorId);
  if (byId) return byId;

  // 找不到时，通过标题文本查找 h1-h6 元素
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i] as HTMLElement;
    if (heading.textContent?.trim() === anchorId.trim()) {
      return heading;
    }
  }
  return null;
}

/**
 * 查找最近的可滚动容器
 */
function findScrollContainer(target: HTMLElement): HTMLElement | null {
  // 优先查找 MDXEditor 的主区域
  const mainArea = target.closest('.mdx-editor-main-area') as HTMLElement | null;
  if (mainArea) return mainArea;

  // 向上查找可滚动容器
  let container: HTMLElement | null = target.parentElement;
  while (container) {
    const style = window.getComputedStyle(container);
    const isScrollable =
      style.overflowY === 'auto' ||
      style.overflowY === 'scroll' ||
      style.overflow === 'auto' ||
      style.overflow === 'scroll';
    if (isScrollable) break;
    container = container.parentElement;
  }
  return container;
}

/**
 * 滚动到指定锚点
 * @param anchorId 锚点 ID 或标题文本
 * @param offset 偏移量（像素）
 */
export function scrollToAnchor(anchorId: string, offset: number = 0): void {
  const target = findTargetElement(anchorId);
  if (!target) return;

  const scrollContainer = findScrollContainer(target);

  if (scrollContainer) {
    const containerRect = scrollContainer.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const scrollTop =
      targetRect.top - containerRect.top + scrollContainer.scrollTop - offset;
    scrollContainer.scrollTo({ top: scrollTop, behavior: 'smooth' });
  } else {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
