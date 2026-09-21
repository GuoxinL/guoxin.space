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
 * Notes 取数优先级 · SOP 补测（对齐 commit 3ad18e1 的 priority + prefetch 改动）。
 * 硬约束：当前页面（/notes/）关键数据优先加载；其他页面（Toolbox 子菜单 7 项 / 更多菜单）
 * 链接 prefetch={false}，不预取、不抢占首屏。
 * 取数来自公开数据仓 GuoxinL/notes build/：用本地 fixtures 模拟 custom 主通道
 * （api.guoxin.space/gh，jsDelivr/raw 兜底），用例离线确定。
 */
// 仅匹配 Toolbox 子菜单项（csv/json/url/base64/timestamp/jwt/calendar）的 q-data.json，
// 不含父栏目 /toolbox/q-data.json（父栏目保留 hover 预取，属强相关导航，不在本约束内）。
const TB_SUBMENU_QDATA = /\/toolbox\/(csv|json|url|base64|timestamp|jwt|calendar)\/q-data\.json$/;

test.beforeEach(async ({ page }) => {
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
  await page.route('https://api.guoxin.space/gh/GuoxinL/notes/main/content/**', (route) => {
    const p = route.request().url();
    const isSvg = /\.svg(\?.*)?$/i.test(p);
    return route.fulfill({ status: 200, contentType: isSvg ? 'image/svg+xml' : 'image/png', path: isSvg ? IMG_SVG : IMG_PNG });
  });
  await page.route('https://cdn.jsdelivr.net/gh/GuoxinL/notes@main/content/**', (route) => {
    const p = route.request().url();
    const isSvg = /\.svg(\?.*)?$/i.test(p);
    return route.fulfill({ status: 200, contentType: isSvg ? 'image/svg+xml' : 'image/png', path: isSvg ? IMG_SVG : IMG_PNG });
  });
});

test('打开 /notes/：当前页数据(posts.json)被请求，且不预取 Toolbox 子菜单页面', async ({ page }) => {
  const reqs: string[] = [];
  page.on('request', (r) => reqs.push(r.url()));

  await page.goto('/notes/');
  // 当前页面关键数据取数发生（CSR 渲染列表卡片）
  await expect(page.getByTestId('notes-item').first()).toBeVisible();

  // ① 当前页面关键数据：posts.json 已被请求
  expect(reqs.some((u) => u.endsWith('/posts.json')), '当前页 notes 数据请求未发出').toBe(true);

  // ② 其他页面（Toolbox 子菜单 7 项）不应被预取 —— prefetch={false} 生效
  const leaked = reqs.filter((u) => TB_SUBMENU_QDATA.test(u));
  expect(leaked, `不应预取 Toolbox 子菜单 q-data: ${leaked.join(', ')}`).toEqual([]);
});

test('展开 Toolbox 子菜单（链接可见）后，子项仍不预取 q-data.json', async ({ page }) => {
  const reqs: string[] = [];
  page.on('request', (r) => reqs.push(r.url()));

  // 作用域限定在 /notes/：首页(/)正文区有一组 <Link> 工具卡片（Skills/Toolbox/Running），
  // 它们可见即预取自身 q-data，属首页既有行为、不在本 commit（仅 Header）范围内。
  // /notes/ 上唯一的 toolbox 链接就是 Header 子菜单（已改为 <a> + 客户端导航，无 prefetch），
  // 因此本例可精确验证「子菜单链接可见态」下 Header 修复是否生效，不被首页卡片噪声干扰。
  await page.goto('/notes/');
  // 触发 Toolbox 悬浮组展开（disclosure，不导航）
  const tbGroup = page.locator('.mc-nav-group', { hasText: 'Toolbox' });
  await tbGroup.locator(':scope > .mc-nav-item').click();
  await expect(tbGroup.locator('.mc-submenu')).toBeVisible();
  await expect(tbGroup.locator('.mc-submenu .mc-nav-item')).toHaveCount(7);

  // 子菜单链接已可见（之前用户抓包正是在可见态被预取）；等待 prefetch 窗口
  await page.waitForTimeout(800);

  // 即使链接可见，子项仍不预取 q-data.json（prefetch={false} 确定性生效）
  const leaked = reqs.filter((u) => TB_SUBMENU_QDATA.test(u));
  expect(leaked, `子菜单可见后仍不应预取: ${leaked.join(', ')}`).toEqual([]);
});
