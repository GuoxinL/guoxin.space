import { test, expect } from '@playwright/test';

/**
 * Toolbox · 日历 /toolbox/calendar 页面级自动化（Playwright）
 * 断言：导航项、月视图网格、切月、点击看黄历、吉日查询、今日高亮。
 */
test.describe('Toolbox · 日历 /toolbox/calendar', () => {
  test('导航出现「日历」项且进入页面标题正确', async ({ page }) => {
    await page.goto('/toolbox/calendar');
    await expect(page).toHaveTitle(/日历/);
    const nav = page.locator('.mc-nav-item', { hasText: '日历' });
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

  test('点击某日，黄历卡片显示该日与宜忌', async ({ page }) => {
    await page.goto('/toolbox/calendar');
    const num = page
      .locator('.cal-body .cal-cell:not(.cal-out) .cal-num', { hasText: '15' })
      .first();
    await num.click();
    const almanac = page.locator('.cal-almanac');
    await expect(almanac).toBeVisible();
    await expect(almanac).toContainText('15 日');
    await expect(almanac).toContainText('宜');
    await expect(almanac).toContainText('忌');
  });

  test('吉日查询：切换事项后结果区更新', async ({ page }) => {
    await page.goto('/toolbox/calendar');
    const sub = page.locator('.cal-ausp-sub');
    await expect(sub).toContainText('宜');
    await page.locator('.cal-select').selectOption('出行');
    await expect(sub).toContainText('宜出行');
    // 结果区要么列出吉日，要么显示「本月无」
    const hasList = (await page.locator('.cal-ausp-list .cal-ausp-item').count()) > 0;
    const hasEmpty = await page.locator('.cal-empty').isVisible().catch(() => false);
    expect(hasList || hasEmpty).toBe(true);
  });

  test('今日高亮存在（客户端挂载后）', async ({ page }) => {
    await page.goto('/toolbox/calendar');
    await expect(page.locator('.cal-today')).toBeVisible();
  });
});
