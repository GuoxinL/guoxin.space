import { test, expect } from '@playwright/test';

/**
 * Toolbox · JSON /toolbox/json 页面级自动化（Playwright）
 * 断言：页面标题、工作台渲染、格式化按钮可点击（交互态就绪）。
 */
test.describe('Toolbox · JSON /toolbox/json', () => {
  test('页面标题与 JSON 工作台渲染', async ({ page }) => {
    await page.goto('/toolbox/json');
    await expect(page).toHaveTitle(/Toolbox/);
    await expect(page.locator('.json-col').first()).toBeVisible();
  });

  test('格式化按钮存在且可点击（交互态就绪）', async ({ page }) => {
    await page.goto('/toolbox/json');
    const fmt = page.locator('button.btn.primary', { hasText: '格式化' }).first();
    await expect(fmt).toBeVisible();
    await fmt.click(); // 断言点击不抛错（编辑器已挂载）
    await expect(page.locator('.editor-wrap').first()).toBeVisible();
  });
});
