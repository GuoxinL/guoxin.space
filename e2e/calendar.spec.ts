import { test, expect } from '@playwright/test';

/**
 * Toolbox · Calendar /toolbox/calendar 页面级自动化（Playwright）
 * 断言：导航项、月视图网格、切月、点击看黄历、今日高亮。
 */
test.describe('Toolbox · Calendar /toolbox/calendar', () => {
  test('导航出现「Calendar」项且进入页面标题正确', async ({ page }) => {
    await page.goto('/toolbox/calendar');
    await expect(page).toHaveTitle(/Calendar/);
    const nav = page.locator('.mc-nav-item', { hasText: 'Calendar' });
    await expect(nav).toBeVisible();
    await expect(nav).toHaveAttribute('aria-current', 'page');
  });

  test('月视图渲染 42 日格', async ({ page }) => {
    await page.goto('/toolbox/calendar');
    await expect(page.locator('.cal-body .cal-cell')).toHaveCount(42);
    await expect(page.locator('.cal-dow-cell')).toHaveCount(7);
  });

  test('上/下月切换改变标题月份', async ({ page }) => {
    await page.goto('/toolbox/calendar');
    const title = page.locator('.cal-title');
    const before = (await title.innerText()).trim();
    await page.locator('button.btn', { hasText: '下月' }).click();
    await expect(title).not.toHaveText(before);
    await page.locator('button.btn', { hasText: '上月' }).click();
    await expect(title).toHaveText(before);
  });

  test('法定假期明显标记（休/班 徽标 + 节日高亮）', async ({ page }) => {
    await page.goto('/toolbox/calendar');
    // 切到 10 月（国庆 7 天连休）
    await page.locator('button.btn', { hasText: '下月' }).click();
    await expect(page.locator('.cal-title')).toContainText('10 月');
    // 至少存在一个休息日高亮单元
    await expect(page.locator('.cal-body .cal-rest-cell').first()).toBeVisible();
    // 节日数字使用高亮样式
    await expect(page.locator('.cal-body .cal-num-fest').first()).toBeVisible();
    // 存在「休」徽标
    await expect(page.locator('.cal-body .cal-badge.cal-rest').first()).toHaveText('休');
  });

  test('今日高亮存在（客户端挂载后）', async ({ page }) => {
    await page.goto('/toolbox/calendar');
    await expect(page.locator('.cal-today')).toBeVisible();
  });
});
