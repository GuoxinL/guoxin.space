import { test, expect } from '@playwright/test';

/**
 * Toolbox · Calendar /toolbox/calendar 页面级自动化（Playwright）
 * 断言：导航项、月视图网格、切月、点击看黄历、今日高亮。
 */
test.describe('Toolbox · Calendar /toolbox/calendar', () => {
  test('Toolbox 子导航含 JSON/Calendar 且当前页高亮', async ({ page }) => {
    await page.goto('/toolbox/calendar');
    await expect(page).toHaveTitle(/Calendar/);
    // 顶部主导航不再含独立 Calendar 项
    await expect(page.locator('.mc-nav-item', { hasText: 'Calendar' })).toHaveCount(0);
    // 子导航含两个 tab
    await expect(page.locator('.tb-tab')).toHaveCount(2);
    // 当前页 Calendar tab 高亮、JSON tab 可见可跳转
    await expect(page.locator('.tb-tab', { hasText: 'Calendar' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.locator('.tb-tab', { hasText: 'JSON' })).toBeVisible();
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

  test('查看未维护年份显示「数据待补充」提示', async ({ page }) => {
    await page.goto('/toolbox/calendar');
    const title = page.locator('.cal-title');
    // 前进直到进入 2027（国办尚未发布，最多 14 次切月）
    for (let i = 0; i < 14; i++) {
      if ((await title.innerText()).includes('2027')) break;
      await page.locator('button.btn', { hasText: '下月' }).click();
    }
    await expect(title).toContainText('2027');
    await expect(page.locator('.cal-hint')).toBeVisible();
    await expect(page.locator('.cal-hint')).toContainText('待补充');
  });
});
