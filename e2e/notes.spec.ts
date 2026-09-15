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
  await expect(tocItems).toHaveCount(12);
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

test('标签筛选：点击标签只显示相关笔记', async ({ page }) => {
  await page.goto('/notes/');
  await expect(page.getByTestId('notes-item').first()).toBeVisible();
  await expect(page.getByTestId('notes-item')).toHaveCount(2);
  await page.getByTestId('notes-tags').getByText('markdown', { exact: false }).click();
  await expect(page.getByTestId('notes-item')).toHaveCount(1);
  await expect(page.getByTestId('notes-item').first()).toContainText('Markdown 全功能示例');
  await page.getByTestId('notes-tags').getByText('demo', { exact: false }).click();
  await expect(page.getByTestId('notes-item')).toHaveCount(2);
  await page.getByTestId('notes-tags').getByText('全部').click();
  await expect(page.getByTestId('notes-item')).toHaveCount(2);
});

test('归档视图按年月分组展示笔记', async ({ page }) => {
  await page.goto('/notes/');
  await expect(page.getByTestId('notes-item').first()).toBeVisible();
  await page.getByTestId('notes-view-toggle').getByText('归档').click();
  const archive = page.getByTestId('notes-archive');
  await expect(archive).toBeVisible();
  await expect(archive.locator('.notes-archive-year-title').first()).toContainText('2026');
  await expect(page.getByTestId('notes-archive-item')).toHaveCount(2);
});

test('系列导航：详情页展示上下篇并可跳转', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const series = page.getByTestId('notes-series');
  await expect(series).toBeVisible();
  await expect(series).toContainText('1 / 2');
  await expect(series.getByText('Qwik 与 SSR 笔记', { exact: false })).toBeVisible();
  await series.getByText('Qwik 与 SSR 笔记', { exact: false }).click();
  await expect(page).toHaveURL(new RegExp(`/notes/${encodeURIComponent('Qwik 与 SSR 笔记')}/`));
  await expect(page.locator('.notes-article-title')).toHaveText('Qwik 与 SSR 笔记');
  await expect(page.getByTestId('notes-series').getByText('Markdown 全功能示例', { exact: false })).toBeVisible();
});

test('页脚展示数据版本（来源 + 生成时间）', async ({ page }) => {
  await page.goto('/notes/');
  const dv = page.getByTestId('notes-dataver');
  await expect(dv).toBeVisible();
  await expect(dv).toContainText('demo-local');
  await expect(dv).toContainText('生成于');
});

test('全文搜索：输入关键词过滤列表并命中正确篇目（N-T20）', async ({ page }) => {
  await page.goto('/notes/');
  await expect(page.getByTestId('notes-item').first()).toBeVisible();
  const search = page.getByTestId('notes-search');
  await expect(search).toBeVisible();

  // 命中 SAMPLE2（唯一含 resumability），其余应被过滤
  await search.fill('resumability');
  await expect(page.getByTestId('notes-search-status')).toContainText('命中 1 篇');
  await expect(page.getByTestId('notes-item')).toHaveCount(1);
  await expect(page.getByTestId('notes-item').first()).toContainText('Qwik 与 SSR 笔记');

  // 命中 SAMPLE1（唯一含“基础文本样式”）
  await search.fill('基础文本样式');
  await expect(page.getByTestId('notes-search-status')).toContainText('命中 1 篇');
  await expect(page.getByTestId('notes-item')).toHaveCount(1);
  await expect(page.getByTestId('notes-item').first()).toContainText('Markdown 全功能示例');

  // 清空恢复全部
  await page.getByTestId('notes-search-clear').click();
  await expect(page.getByTestId('notes-item')).toHaveCount(2);
});

test('全文搜索：无匹配时显示空状态（N-T20）', async ({ page }) => {
  await page.goto('/notes/');
  await expect(page.getByTestId('notes-item').first()).toBeVisible();
  await page.getByTestId('notes-search').fill('绝对不存在的关键词xyz');
  await expect(page.getByTestId('notes-search-empty')).toBeVisible();
  await expect(page.getByTestId('notes-item')).toHaveCount(0);
});

test('列表页展示写作统计面板与热力图（N-T22）', async ({ page }) => {
  await page.goto('/notes/');
  await expect(page.getByTestId('notes-item').first()).toBeVisible();
  const stats = page.getByTestId('notes-stats');
  await expect(stats).toBeVisible();
  await expect(stats.getByText('篇文章')).toBeVisible();
  await expect(stats.getByText('总字数')).toBeVisible();
  // 热力图：含若干按日单元格，且至少 1 个非 lv-0（两篇示例文章落在近两周）
  const heatmap = page.getByTestId('notes-heatmap');
  await expect(heatmap).toBeVisible();
  await expect(heatmap.locator('.notes-heatmap-cell')).toHaveCount(18 * 7);
  await expect(heatmap.locator('.notes-heatmap-cell:not(.lv-0)').first()).toBeVisible();
});

test('详情页展示更新历史（N-T23）', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const hist = page.getByTestId('notes-history');
  await expect(hist).toBeVisible();
  await expect(hist.getByText('补充笔记嵌入卡片', { exact: false })).toBeVisible();
  await expect(hist.locator('time').first()).toContainText('2026-09-15');
});

test('详情页展示相关文章（N-T21：共同引用 + 标签 Jaccard）', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const rel = page.getByTestId('notes-related');
  await expect(rel).toBeVisible();
  // SAMPLE1 与 SAMPLE2 互为反链 + 共享 demo 标签 → 相关
  await expect(rel.getByTestId('notes-related-item').first()).toContainText('Qwik 与 SSR 笔记');
  await expect(rel.getByText('共同引用', { exact: false })).toBeVisible();
});

test('正文渲染笔记嵌入卡片（N-T24：![[笔记]]）', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const card = page.getByTestId('md-embed-note');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Qwik 与 SSR 笔记');
  await expect(card).toContainText('一篇演示反链');
  // 点击卡片跳转至被嵌入笔记
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/notes/${encodeURIComponent('Qwik 与 SSR 笔记')}/`));
});

test('正文渲染 Mermaid 图表（N-T26 运行时懒加载）', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const mermaid = page.getByTestId('md-mermaid');
  await expect(mermaid).toBeVisible();
  await expect(mermaid.locator('svg')).toBeVisible({ timeout: 10_000 });
});

test('列表页渲染双链图谱（N-T25 force-graph）', async ({ page }) => {
  await page.goto('/notes/');
  await expect(page.getByTestId('notes-item').first()).toBeVisible();
  const graph = page.getByTestId('notes-graph-svg');
  await expect(graph).toBeVisible();
  await expect(graph.locator('circle')).toHaveCount(2);
  await expect(graph.locator('line')).toHaveCount(1);
});

test('详情页评论区在未配置 Giscus 时显示占位（N-T27）', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const c = page.getByTestId('notes-comments');
  await expect(c).toBeVisible();
  await expect(c).toContainText('GitHub Discussions');
});

test('正文渲染 StackBlitz 交互示例嵌入（N-T29）', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const sb = page.getByTestId('md-embed-stackblitz');
  await expect(sb).toBeVisible();
  await expect(sb).toHaveAttribute('src', /stackblitz\.com/);
});

test('详情页注入 og:image meta（N-T28）', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const content = await page.evaluate(
    () => document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? ''
  );
  expect(content).toContain('/og/');
  expect(content).toContain('.svg');
});

