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

test('详情页底部引用列表按内链/外链/脚注分组', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const refs = page.getByTestId('notes-refs');
  await expect(refs).toBeVisible();
  await expect(refs.getByText('内部链接', { exact: true })).toBeVisible();
  await expect(refs.getByText('外部链接', { exact: true })).toBeVisible();
  await expect(refs.getByText('脚注', { exact: true })).toBeVisible();
  // 内部链接分组：存在的双链 + 缺失双链（虚线样式）
  await expect(refs.getByText('本文自身', { exact: false })).toBeVisible();
  await expect(refs.getByText('缺失双链', { exact: false })).toBeVisible();
  await expect(refs.locator('.notes-ref-link--missing').first()).toBeVisible();
  // 外部链接分组含 Qwik 官网
  await expect(refs.getByText('Qwik 官网', { exact: false })).toBeVisible();
});

test('详情页反链区块展示引用来源', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const bl = page.getByTestId('notes-backlinks');
  await expect(bl).toBeVisible();
  await expect(bl.getByText('Qwik 与 SSR 笔记', { exact: false })).toBeVisible();
});

test('点击引用列表中的脚注条目跳转到正文脚注定义', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const fnLink = page.getByTestId('notes-refs').locator('a[href="#fn-1"]');
  await expect(fnLink).toBeVisible();
  await fnLink.click();
  await expect(page.locator('#fn-1')).toBeVisible();
});

test('Callout 6 型均渲染且带中文标签', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  for (const t of ['note', 'tip', 'info', 'warning', 'danger', 'quote']) {
    await expect(page.locator(`.md-callout--${t}`).first()).toBeVisible();
  }
  await expect(page.locator('.md-callout--tip .md-callout__label')).toHaveText('提示');
  await expect(page.locator('.md-callout--danger .md-callout__label')).toHaveText('危险');
});

test('脚注定义区返回链接可跳回正文引用（双向跳转）', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const back = page.locator('#fn-1 a[href="#ref-fn-1"]');
  await expect(back).toBeVisible();
  await back.click();
  await expect(page.locator('#ref-fn-1')).toBeVisible();
});

test('代码块 Prism 主题随站点明暗切换', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const code = page.locator('.md-code').first();
  await expect(code).toBeVisible();
  const link = page.locator('#prism-theme');
  await expect(link).toHaveCount(1);
  // 明亮主题 → 默认 prism 主题
  await page.evaluate(() => { document.body.dataset.theme = 'light'; });
  await expect(link).toHaveAttribute('href', /prism\.min\.css/);
  // 暗色主题 → prism-tomorrow
  await page.evaluate(() => { document.body.dataset.theme = 'dark'; });
  await expect(link).toHaveAttribute('href', /prism-tomorrow\.min\.css/);
});
