import { test, expect } from '@playwright/test';
// 本地 fixtures（来自 GuoxinL/notes build/），内联 import 避免依赖 node 内置模块
import postsIndex from './fixtures/notes/build/posts.json';
import allDocs from './fixtures/notes/build/all.json';
import docMarkdown from './fixtures/notes/build/posts/39fb46bd.json';
import docQwik from './fixtures/notes/build/posts/a9ef50e0.json';
import seriesFixture from './fixtures/notes/build/series.json';

// 离线图片桩（1×1 PNG / SVG，真实文件，避免 Buffer body 在 worker 中序列化异常）
const IMG_PNG = 'e2e/fixtures/notes/img/1x1.png';
const IMG_SVG = 'e2e/fixtures/notes/img/1x1.svg';

/**
 * Notes 模块 E2E 冒烟（对齐 plan §9）。
 * 取数来自公开数据仓 GuoxinL/notes 的 build/ 产物：用本地 fixtures 模拟 jsDelivr 主通道（raw 为兜底），
 * 使用例离线确定（同时验证 lib/notes/source.ts 的真实 fetch 管线：posts.json / posts/<id>.json / all.json）。
 * fixtures 由 notes/build/ 复制（改数据源后需重新 `cp` 同步）。
 * 验证：① 列表卡片 > 0 ② 点击卡片 SPA 导航到中文 URL 且 H1 正确
 * ③ 直接 goto 中文深链（忽略 404 状态码）H1 仍渲染 ④ 缺失笔记显示未找到
 * ⑤ 示例文章覆盖的 md 功能节点均渲染（图/双链/代码/公式/表格/列表/脚注/Callout/任务列表）。
 * 注：Prism/KaTeX 为运行时 CDN 懒加载，本用例不强制断言 .token/.katex（避免依赖外网）。
 */
const SAMPLE = 'Markdown 全功能示例';

// 模拟主通道 cdn.jsdelivr.net/gh/GuoxinL/notes@main/build/** → 本地 fixtures（离线确定）
test.beforeEach(async ({ page }) => {
  // 逐文件显式路由（便于单测用 unroute 覆盖某一文件，如 series.json 404 场景）
  await page.route('**/posts.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(postsIndex) }),
  );
  await page.route('**/all.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(allDocs) }),
  );
  await page.route('**/posts/39fb46bd.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(docMarkdown) }),
  );
  await page.route('**/posts/a9ef50e0.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(docQwik) }),
  );
  await page.route('**/series.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(seriesFixture) }),
  );
  // 文章图片走 content/**（非 build/**），本地需桩离线图片，否则懒加载图取不到 → 0 尺寸 → 测试偶发 hidden
  // 图片地址由 rewriteRawAssetUrl 改道到主通道（jsDelivr）→ 此处桩 jsDelivr
  await page.route('https://cdn.jsdelivr.net/gh/GuoxinL/notes@main/content/**', (route) => {
    const p = route.request().url();
    const isSvg = /\.svg(\?.*)?$/i.test(p);
    return route.fulfill({ status: 200, contentType: isSvg ? 'image/svg+xml' : 'image/png', path: isSvg ? IMG_SVG : IMG_PNG });
  });
});

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

test('标签区长度恒定：点击标签后不全部展开', async ({ page }) => {
  await page.goto('/notes/');
  await expect(page.getByTestId('notes-item').first()).toBeVisible();
  const countBefore = await page.getByTestId('notes-tags').locator('button.notes-tag').count();
  // 点一个标签：筛选应生效，且标签区不应全部摊开
  await page.getByTestId('notes-tags').getByText('markdown', { exact: false }).first().click();
  await expect(page.getByTestId('notes-item')).toHaveCount(1);
  const countAfter = await page.getByTestId('notes-tags').locator('button.notes-tag').count();
  // 「全部」+ 最多 8 个标签按钮；本 fixtures 仅 5 个标签，点击前后数量应一致且 ≤ 9
  expect(countAfter).toBeLessThanOrEqual(9);
  expect(countAfter).toBe(countBefore);
  await page.getByTestId('notes-tags').getByText('全部').click();
  await expect(page.getByTestId('notes-item')).toHaveCount(2);
});

test('标签溢出分支：默认折叠前 8 个，点靠后标签提到可见区且不膨胀', async ({ page }) => {
  // 注入 13 个标签的索引（覆盖 beforeEach 的 5 标签 fixtures mock），专门覆盖 overflow(>8) 分支
  const seed = postsIndex.posts[0];
  const injected = {
    posts: Array.from({ length: 13 }, (_, i) => {
      const n = String(i + 1).padStart(2, '0');
      return {
        ...seed,
        id: 't' + n,
        slug: 'Tag ' + n + ' Post',
        title: 'Tag ' + n + ' Post',
        date: '2026-09-' + String((i % 28) + 1).padStart(2, '0'),
        tags: ['tag' + n],
      };
    }),
  };
  await page.route(
    'https://cdn.jsdelivr.net/gh/GuoxinL/notes@main/build/posts.json',
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(injected) }),
  );

  await page.goto('/notes/');
  await expect(page.getByTestId('notes-item').first()).toBeVisible();

  const tagsWrap = page.getByTestId('notes-tags');
  // 可见区：.notes-tags 直接子里的标签按钮，排除「全部」按钮（避免把弹层内 CSS 隐藏的标签一并计入）
  const visibleTags = tagsWrap.locator('> .notes-tag').filter({ hasNotText: '全部' });

  // ① 默认可见区恒定 = 8 个（不膨胀）
  await expect(visibleTags).toHaveCount(8);
  // ② 「更多」按钮存在，文案含溢出数量
  const more = tagsWrap.locator('.notes-tag--more');
  await expect(more).toBeVisible();
  await expect(more).toContainText('更多 5 个');
  // ③ 弹层含溢出标签 tag09~tag13（点击「更多」切换 .is-open 确定性显示，不依赖 CSS :hover）
  await more.click();
  const pop = tagsWrap.locator('.notes-tags-popover');
  await expect(pop).toBeVisible();
  for (const n of ['09', '10', '11', '12', '13']) {
    await expect(pop.getByText('tag' + n)).toBeVisible();
  }
  // ④ 点第 9 名标签：提到可见区、列表长度仍恒定、列表按该标签过滤
  await pop.getByText('tag09').click();
  await expect(visibleTags).toHaveCount(8); // 仍恒定，不膨胀
  await expect(visibleTags.filter({ hasText: 'tag09' })).toHaveCount(1); // 已提到可见区
  await expect(tagsWrap.locator('.notes-tag--active')).toContainText('tag09'); // 高亮选中
  await expect(page.getByTestId('notes-item')).toHaveCount(1);
  await expect(page.getByTestId('notes-item').first()).toContainText('Tag 09 Post');
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
  await expect(dv).toContainText('GuoxinL/notes');
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

test('详情页评论区已启用 Giscus（注入容器存在，不再显示未启用占位）', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const c = page.getByTestId('notes-comments');
  await expect(c).toBeVisible();
  await expect(c).toContainText('评论');
  await expect(c).not.toContainText('当前站点未启用'); // 占位消失 = 已启用
  await expect(c.locator('.notes-giscus')).toBeVisible(); // giscus 脚本注入容器存在
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

test('详情页渲染方案A 相对路径图片（被改道到当前取数通道）', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  // 段落图片（方案A）= .md-img 且非双链嵌入卡（md-embed）
  const img = page.locator('.md-img:not(.md-embed)').first();
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute(
    'src',
    /^https:\/\/cdn\.jsdelivr\.net\/gh\/GuoxinL\/notes@main\/content\//
  );
  // 第二张（svg）同样重写
  const svg = page.locator('.md-img:not(.md-embed)').nth(1);
  await expect(svg).toHaveAttribute('src', /\.svg$/);
});

test('收藏：列表星标 → 收藏视图出现，取消后消失（B）', async ({ page }) => {
  await page.goto('/notes/');
  await expect(page.getByTestId('notes-item').first()).toBeVisible();
  const firstCard = page.getByTestId('notes-item').first();
  await firstCard.locator('[data-testid="notes-fav-star"]').click();
  await expect(page.getByTestId('notes-content-toggle').getByText('收藏', { exact: true })).toBeVisible();
  await page.getByTestId('notes-content-toggle').getByText('收藏', { exact: true }).click();
  await expect(page.getByTestId('notes-item')).toHaveCount(1);
  // 取消收藏 → 收藏视图清空
  await page.getByTestId('notes-item').first().locator('[data-testid="notes-fav-star"]').click();
  await expect(page.getByTestId('notes-item')).toHaveCount(0);
  // 回到全部视图应恢复 2 篇
  await page.getByTestId('notes-content-toggle').getByText('全部', { exact: true }).click();
  await expect(page.getByTestId('notes-item')).toHaveCount(2);
});

test('标签云：进入云视图并点击标签过滤列表（D）', async ({ page }) => {
  await page.goto('/notes/');
  await expect(page.getByTestId('notes-item').first()).toBeVisible();
  await page.getByTestId('notes-content-toggle').getByText('标签云', { exact: true }).click();
  const cloud = page.getByTestId('notes-cloud');
  await expect(cloud).toBeVisible();
  await expect(cloud.locator('.notes-cloud-item')).not.toHaveCount(0);
  // 点 markdown 标签 → 回到列表视图且按该标签过滤（SAMPLE 含 markdown → 1 篇）
  await cloud.getByText('markdown', { exact: false }).click();
  await expect(page.getByTestId('notes-item')).toHaveCount(1);
  await expect(page.getByTestId('notes-item').first()).toContainText('Markdown 全功能示例');
});

test('详情页阅读设置：切字号与宽度影响正文呈现（A）', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const md = page.locator('.md-body');
  const baseFont = await md.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  // 大字
  await page.getByTestId('notes-readbar').getByText('大', { exact: true }).click();
  const bigFont = await md.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(bigFont).toBeGreaterThan(baseFont);
  // 窄宽
  await page.getByTestId('notes-readbar').getByText('窄', { exact: true }).click();
  const w = await page.getByTestId('notes-detail').evaluate((el) => el.getBoundingClientRect().width);
  expect(w).toBeLessThanOrEqual(761);
  // 恢复默认（宽 + 中），避免污染后续用例
  await page.getByTestId('notes-readbar').getByText('宽', { exact: true }).click();
  await page.getByTestId('notes-readbar').getByText('中', { exact: true }).click();
});

test('键盘导航：/ 聚焦搜索，列表态 j 高亮、Enter 打开，详情态 Esc 返回（F）', async ({ page }) => {
  await page.goto('/notes/');
  await expect(page.getByTestId('notes-item').first()).toBeVisible();
  // / 聚焦搜索框
  await page.keyboard.press('/');
  await expect(page.getByTestId('notes-search')).toBeFocused();
  await page.getByTestId('notes-search').blur();
  // j 高亮第一张
  await page.keyboard.press('j');
  await expect(page.getByTestId('notes-item').nth(0)).toHaveClass(/is-kb/);
  // Enter 打开
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  // Esc 返回列表
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('notes-list')).toBeVisible();
});

test('键盘导航：搜索框聚焦时字母键不触发卡片导航（F）', async ({ page }) => {
  await page.goto('/notes/');
  await expect(page.getByTestId('notes-item').first()).toBeVisible();
  await page.getByTestId('notes-search').focus();
  await page.keyboard.type('j');
  // 字母被输入搜索框，而非触发 j 导航（列表仍可见、未跳转详情）
  await expect(page.getByTestId('notes-search')).toHaveValue('j');
  await expect(page.getByTestId('notes-list')).toBeVisible();
  await page.getByTestId('notes-search').fill('');
});

test('列表页顶部出现专栏卡片（专栏名 + 篇数）', async ({ page }) => {
  await page.goto('/notes/');
  const card = page.getByTestId('notes-series-card').first();
  await expect(card).toBeVisible();
  await expect(card).toContainText('Markdown 实战');
  await expect(card).toContainText('共 2 篇');
});

test('点击专栏卡片 → SPA 导航到 /notes/series/<slug>/ 且渲染专栏详情', async ({ page }) => {
  await page.goto('/notes/');
  await page.getByTestId('notes-series-card').first().click();
  await expect(page).toHaveURL(/\/notes\/series\/markdown-shizhan\//);
  const detail = page.getByTestId('notes-series-detail');
  await expect(detail).toBeVisible();
  await expect(detail.locator('.notes-series-detail-title')).toHaveText('Markdown 实战');
  // 文章列表：2 篇，按 order 升序，标「第 N 篇」
  await expect(page.getByTestId('notes-series-article')).toHaveCount(2);
  await expect(page.getByTestId('notes-series-article').first()).toContainText('第 1 篇');
});

test('直接深链 /notes/series/<slug>/（404.html 接管）专栏详情仍渲染', async ({ page }) => {
  await page.goto('/notes/series/markdown-shizhan/', { waitUntil: 'domcontentloaded' });
  const detail = page.getByTestId('notes-series-detail');
  await expect(detail).toBeVisible({ timeout: 10_000 });
  await expect(detail.locator('.notes-series-detail-title')).toHaveText('Markdown 实战');
  await expect(detail.locator('.notes-series-detail-count')).toContainText('共 2 篇');
});

test('详情页系列导航含可点击专栏链接，点击回到专栏页', async ({ page }) => {
  await page.goto(`/notes/${encodeURIComponent(SAMPLE)}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-detail')).toBeVisible({ timeout: 10_000 });
  const link = page.getByTestId('notes-series-link');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/notes\/series\/markdown-shizhan\//);
  await expect(page.getByTestId('notes-series-detail')).toBeVisible();
});

test('series.json 404 → 不白屏，回退 SAMPLE 专栏卡片仍渲染（优雅降级，与文章兜底一致）', async ({ page }) => {
  await page.unroute('**/series.json');
  await page.route('**/series.json', (route) => route.fulfill({ status: 404, body: 'not found' }));
  await page.goto('/notes/');
  // 列表不白屏（文章照常渲染）
  await expect(page.getByTestId('notes-item').first()).toBeVisible();
  // 专栏数据缺失 → 回退 SAMPLE_SERIES，仍展示兜底卡片（不静默消失）
  await expect(page.getByTestId('notes-series-card').first()).toBeVisible();
  await expect(page.getByTestId('notes-series-card').first()).toContainText('Markdown 实战');
});

test('专栏页 slug 不存在 → 显示未找到空态', async ({ page }) => {
  await page.goto('/notes/series/不存在的专栏/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('notes-series-notfound')).toBeVisible({ timeout: 10_000 });
});

