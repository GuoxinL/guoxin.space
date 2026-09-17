import { test, expect } from '@playwright/test';

/**
 * Toolbox 悬浮子菜单 · 页面自动化（Playwright）
 * 覆盖：桌面 hover/focus-within 展开、7 子项、点击进路由、active 态、
 * 小工具页 tab 路由切换、移动端嵌套、深链、hover 色带（C-23）。
 * 站点为纯静态预渲染，用例经 tools/serve-pages.mjs 起本地服务跑 Pages 语义。
 */

const SUBMENU_LABELS = ['JSON', '日历', 'Base64', 'URL', '时间戳', 'JWT', 'CSV'];

test.describe('Toolbox 悬浮子菜单（桌面）', () => {
  test('悬浮 Toolbox 展开子菜单，含 7 个子项', async ({ page }) => {
    await page.goto('/');
    const group = page.locator('.mc-nav-group');
    await expect(group).toBeVisible();
    // 默认隐藏
    await expect(page.locator('.mc-submenu')).toBeHidden();
    await group.hover();
    const sub = page.locator('.mc-submenu');
    await expect(sub).toBeVisible();
    await expect(sub.locator('.mc-nav-item')).toHaveCount(7);
    for (const label of SUBMENU_LABELS) {
      await expect(sub.locator('.mc-nav-item', { hasText: label })).toBeVisible();
    }
  });

  test('键盘 focus-within 也能展开（可达性）', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mc-nav-group > .mc-nav-item').focus();
    await expect(page.locator('.mc-submenu')).toBeVisible();
  });

  test('点击子菜单项进入对应独立路由', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mc-nav-group').hover();
    await page.locator('.mc-submenu .mc-nav-item', { hasText: 'Base64' }).click();
    await expect(page).toHaveURL(/\/toolbox\/base64/);
    await expect(page.locator('.tools-panel')).toBeVisible();
  });

  test('active 态：/toolbox/base64 下 Base64 子项与父栏目高亮', async ({ page }) => {
    await page.goto('/toolbox/base64');
    await expect(
      page.locator('.mc-submenu .mc-nav-item', { hasText: 'Base64' })
    ).toHaveAttribute('aria-current', 'page');
    // 父栏目 Toolbox 因 /toolbox/* 前缀也高亮
    await expect(page.locator('.mc-nav-group > .mc-nav-item')).toHaveAttribute('aria-current', 'page');
  });

  test('C-23 hover 色带：子项 hover 背景变 violet-0（#f7f3ff）', async ({ page }) => {
    await page.goto('/');
    const item = page.locator('.mc-submenu .mc-nav-item', { hasText: 'Base64' });
    await page.locator('.mc-nav-group').hover();
    // 静止态（子项未 hover）背景应为白
    const rest = await item.evaluate((el) => getComputedStyle(el).backgroundColor);
    await item.hover();
    // 等 120ms 过渡动画结束再回读 hover 态（否则读到插值中间值）
    await page.waitForTimeout(250);
    const hover = await item.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(hover).toBe('rgb(247, 243, 255)');
    expect(hover).not.toBe(rest);
  });
});

test.describe('小工具独立路由页', () => {
  test('深链 /toolbox/jwt 直接打开且 JWT tab 激活', async ({ page }) => {
    await page.goto('/toolbox/jwt');
    await expect(page.locator('.tools-panel')).toBeVisible();
    await expect(page.locator('.tools-tab.active', { hasText: 'JWT' })).toHaveCount(1);
  });

  test('小工具页 tab 用 Link 切换路由（CSR 导航）', async ({ page }) => {
    await page.goto('/toolbox/base64');
    await page.locator('.tools-tab', { hasText: 'URL' }).click();
    await expect(page).toHaveURL(/\/toolbox\/url/);
    await expect(page.locator('.tools-panel')).toBeVisible();
    await expect(page.locator('.tools-tab.active', { hasText: 'URL' })).toHaveCount(1);
  });

  test('Base64 编码功能在独立路由页可用', async ({ page }) => {
    await page.goto('/toolbox/base64');
    await page.locator('.tools-in').fill('hello');
    await page.locator('.tools-pane button', { hasText: '编码' }).click();
    await expect(page.locator('.tools-out')).toHaveValue('aGVsbG8=');
  });
});

test.describe('Toolbox 移动端嵌套', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('汉堡菜单内 Toolbox 嵌套 7 个子项并可进入路由', async ({ page }) => {
    await page.goto('/');
    await page.locator('button[aria-label="打开菜单"]').click();
    const sub = page.locator('.mc-nav-sub');
    await expect(sub).toBeVisible();
    await expect(sub.locator('.mc-nav-item')).toHaveCount(7);
    await page.locator('.mc-nav-sub .mc-nav-item', { hasText: 'CSV' }).click();
    await expect(page).toHaveURL(/\/toolbox\/csv/);
    await expect(page.locator('.tools-panel')).toBeVisible();
  });
});
