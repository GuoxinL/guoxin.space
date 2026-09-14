import { test, expect } from '@playwright/test';

/**
 * N-T00 spike：中文 slug 在纯 CSR + GitHub Pages 语义下的路由验证
 *
 * ⚠️ 运行前提：必须用 **Pages 模拟服务器**（未知路径回 404.html 且状态码 404），
 *    不能用默认的 `python3 -m http.server`（无 404 fallback，无法验证深链接管）：
 *
 *      node tools/serve-pages.mjs 4322 app/dist &
 *      BASE_URL=http://127.0.0.1:4322 npx playwright test e2e/notes-spike.spec.ts
 *
 * 前提：`app/dist/404.html` 须是 **SPA 引导页**（由 `npm run build` 末尾的
 *       `tools/make-404-fallback.mjs` 生成），否则深链用例必然失败。
 * 断言口径：首屏仍是 404 状态码（方案 A 已接受的代价），
 *       故只断言「URL 修正回中文路径」+「内容正确渲染」。
 */
const TITLE = '测试笔记';
const deepLink = '/notes/' + encodeURIComponent(TITLE) + '/';

test.describe('Notes · 中文 CSR 路由（N-T00 spike）', () => {
  test('1 · 列表页渲染出中文样例', async ({ page }) => {
    await page.goto('/notes/');
    await expect(page.getByTestId('notes-list')).toBeVisible();
    await expect(page.getByTestId('notes-item')).toHaveCount(2);
    await expect(page.getByTestId('notes-item').first()).toHaveText(TITLE);
  });

  test('2 · 点击进入详情（pushState，无整页刷新）', async ({ page }) => {
    await page.goto('/notes/');
    // 打标记：若发生整页刷新，该标记会丢失
    await page.evaluate(() => {
      (window as unknown as { __spaMarker: boolean }).__spaMarker = true;
    });

    await page.getByTestId('notes-item').first().click();

    await expect(page.getByTestId('notes-detail')).toBeVisible();
    await expect(page.getByTestId('notes-title')).toHaveText(TITLE);
    expect(new URL(page.url()).pathname).toBe(deepLink);
    // pushState 导航未触发整页刷新
    const marker = await page.evaluate(
      () => (window as unknown as { __spaMarker?: boolean }).__spaMarker
    );
    expect(marker).toBe(true);
  });

  test('3 · 中文深链经 404 引导页恢复（关键）', async ({ page }) => {
    await page.goto(deepLink);
    // 方案 A 链路：Pages 返回引导页 → 跳到 /notes/ → 应用读取 sessionStorage 渲染详情，
    // 并用 replaceState 把 URL 修正回原路径。
    // 代价：首屏响应仍是 404 状态码（已接受），故此处不断言 status，
    //       只断言「最终 URL 回到中文路径」且「内容正确渲染」。
    await expect(page.getByTestId('notes-shell')).toBeVisible();
    await expect(page.getByTestId('notes-detail')).toBeVisible();
    await expect(page.getByTestId('notes-title')).toHaveText(TITLE);
    expect(new URL(page.url()).pathname).toBe(deepLink);
    // 标题必须是解码后的中文，不能有 %XX 残留
    await expect(page.getByTestId('notes-title')).not.toContainText('%');
  });

  test('4 · 未知 slug 显示「未找到」，不崩溃', async ({ page }) => {
    await page.goto('/notes/' + encodeURIComponent('不存在的笔记') + '/');
    await expect(page.getByTestId('notes-notfound')).toBeVisible();
    await expect(page.getByTestId('notes-shell')).toBeVisible();
  });

  test('5 · 浏览器后退回到列表（popstate）', async ({ page }) => {
    await page.goto('/notes/');
    await page.getByTestId('notes-item').first().click();
    await expect(page.getByTestId('notes-detail')).toBeVisible();

    await page.goBack();

    await expect(page.getByTestId('notes-list')).toBeVisible();
    await expect(page.getByTestId('notes-item')).toHaveCount(2);
  });

  test('6 · 反复进退结果一致（幂等）', async ({ page }) => {
    await page.goto('/notes/');
    for (let i = 0; i < 2; i++) {
      await page.getByTestId('notes-item').first().click();
      await expect(page.getByTestId('notes-title')).toHaveText(TITLE);
      await page.goBack();
      await expect(page.getByTestId('notes-list')).toBeVisible();
      await expect(page.getByTestId('notes-item')).toHaveCount(2);
    }
  });
});
