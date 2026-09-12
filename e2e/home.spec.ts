import { test, expect } from '@playwright/test';

/**
 * 首页 / 页面级自动化（Playwright）
 * 断言：Hero 区域渲染、主图存在、导航可跳转。
 */
test.describe('首页 /', () => {
  test('Hero 区域渲染且主图存在', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1.mc-hero-h1')).toBeVisible();
    const art = page.locator('img.mc-hero-art');
    await expect(art).toBeVisible();
    await expect(art).toHaveAttribute('src', /pickaxe\.png/);
  });

  test('导航 CTA 可跳转 Skills / Running', async ({ page }) => {
    await page.goto('/');
    // 实际文案：主 CTA「进入 Skills」、次 CTA「查看跑步数据」（勿臆造文案）
    const skillsLink = page.locator('a.btn', { hasText: 'Skills' });
    await expect(skillsLink).toHaveAttribute('href', /\/skills/);
    const runningLink = page.locator('a.btn', { hasText: '跑步' });
    await expect(runningLink).toHaveAttribute('href', /\/running/);
  });
});
