import { test, expect } from '@playwright/test';

/**
 * Running /running 页面级自动化（Playwright）
 * 断言：页面骨架、年度热力图区块渲染。
 * 数据源（Cloudflare Worker）无论可达与否，页面骨架都应渲染：
 *   - 可达 → 活动列表（#rk-actlist）
 *   - 不可达 → 降级提示（.rk-empty）
 * 两者其一可见即通过。
 */
test.describe('Running /running', () => {
  test('页面骨架与年度热力图区块渲染', async ({ page }) => {
    await page.goto('/running');
    await expect(page.locator('.rk-page')).toBeVisible();
    await expect(
      page.locator('.rk-section-h', { hasText: '年度热力图' }),
    ).toBeVisible();
    const listOrEmpty = page.locator('#rk-actlist, .rk-empty');
    await expect(listOrEmpty.first()).toBeVisible();
  });
});
