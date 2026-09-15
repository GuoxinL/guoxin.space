import { test, expect } from '@playwright/test';

/**
 * Notes 模块 E2E 冒烟（对齐 plan §9）。
 * 不走真实数据仓：demo 阶段取数来自本地 sample（见 lib/notes/source.ts）。
 * 验证：① 列表卡片 > 0 ② 点击卡片 SPA 导航到中文 URL 且 H1 正确
 * ③ 直接 goto 中文深链（忽略 404 状态码）H1 仍渲染 ④ 缺失笔记显示未找到
 * ⑤ 示例文章覆盖的 md 功能节点均渲染（图/双链/代码/公式/表格/列表/脚注/Callout/任务列表）。
 * 注：Prism/KaTeX 为运行时 CDN 懒加载，本用例不强制断言 .token/.katex（避免依赖外网）。
 */
const SAMPLE = 'Markdown 全功能示例';

test('列表页出现至少一张笔记卡片', async ({ page }) => {
  await page.goto('/notes/');
  await expect(page.getByTestId('notes-item').first()).toBeVisible();
});

test('点击卡片 → SPA 导航到中文 URL 且渲染详情 H1', async ({ page }) => {
  await page.goto('/notes/');
  await page.getByTestId('notes-item').first().click();
  await expect(page).toHaveURL(new RegExp(`/notes/${encodeURIComponent(SAMPLE)}/`));
  await expect(page.getByTestId('notes-detail')).toBeVisible();
  await expect(page.locator('.notes-article-title')).toHaveText(SAMPLE);
});

test('直接访问中文深链（404.html 接管）H1 仍渲染', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.notes-article-title')).toHaveText(SAMPLE);
});

test('访问不存在的笔记显示未找到', async ({ page }) => {
  await page.goto('/notes/不存在的笔记/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-notfound')).toBeVisible({ timeout: 10_000 });
});

test('详情页渲染目录(TOC)且条目数匹配标题数', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const tocItems = page.locator('.notes-toc-list > li');
  await expect(tocItems).toHaveCount(11);
  await expect(tocItems.first()).toContainText('基础文本样式');
  // 锚点 slug 与渲染器 heading id 一致：点击目录项应定位到对应标题
  await expect(page.locator('.notes-detail h2#基础文本样式')).toBeVisible();
});

test('示例文章覆盖全部 md 功能节点', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('h2').first()).toBeVisible(); // 标题
  await expect(page.locator('.md-code').first()).toBeVisible(); // 代码块
  await expect(page.locator('.md-math').first()).toBeVisible(); // 公式（Tex 源码先渲染，KaTeX 后增强）
  await expect(page.locator('.md-table').first()).toBeVisible(); // 表格
  await expect(page.locator('.md-task').first()).toBeVisible(); // 任务列表
  await expect(page.locator('.md-callout').first()).toBeVisible(); // Callout
  await expect(page.locator('.md-wikilink--missing').first()).toBeVisible(); // 缺失双链
  await expect(page.locator('.md-img').first()).toBeVisible(); // 图片/嵌入
  await expect(page.locator('.md-footnote-ref').first()).toBeVisible(); // 脚注
});
