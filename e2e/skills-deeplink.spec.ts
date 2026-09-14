import { test, expect, type Page } from '@playwright/test';

/**
 * Skills 深链还原 IT：验证 `/skills/<dir>/` 与 `/notes/<slug>/` 行为一致 ——
 * ① URL 还原为深链形态；② 未知 dir 显示「未找到」；③ 已知 dir 与列表点击不回归。
 *
 * GitHub API 用请求拦截 mock（不依赖外网，本地 / CI 结果一致）。
 */

const MOCK_TREE = [
  { path: 'brainstorming', type: 'tree' },
  { path: 'xz-credentials', type: 'tree' },
  { path: 'README.md', type: 'blob' },
];

const MOCK_SKILL_MD = [
  '---',
  'name: 示例技能',
  'description: 用于 IT 的示例简介',
  '---',
  '',
  '# 示例正文',
].join('\n');

async function mockGitHub(page: Page): Promise<void> {
  await page.route('https://api.github.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/git/trees/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tree: MOCK_TREE }),
      });
    }
    // commits（排序用）：返回空数组即可，fetchCommitsOrder 会降级为字典序
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('https://raw.githubusercontent.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: MOCK_SKILL_MD,
    }),
  );
}

test.describe('Skills · 深链还原（与 Notes 对齐）', () => {
  test.beforeEach(async ({ page }) => {
    await mockGitHub(page);
  });

  test('1 · 未知 dir 深链：URL 还原 + 显示未找到', async ({ page }) => {
    await page.goto('/skills/nonexistent-xyz/');
    const notfound = page.getByTestId('skills-notfound');
    await expect(notfound).toBeVisible({ timeout: 20000 });
    await expect(notfound).toContainText('不存在名为');
    await expect(notfound).toContainText('nonexistent-xyz');
    expect(new URL(page.url()).pathname).toBe('/skills/nonexistent-xyz');
  });

  test('2 · 未找到页可返回列表', async ({ page }) => {
    await page.goto('/skills/nonexistent-xyz/');
    await expect(page.getByTestId('skills-notfound')).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: /返回列表/ }).click();
    await expect(page.locator('.sk-grid')).toBeVisible({ timeout: 10000 });
    expect(new URL(page.url()).pathname).toBe('/skills');
  });

  test('3 · 已知 dir 深链不误判未找到', async ({ page }) => {
    await page.goto('/skills/brainstorming/');
    await expect(page.locator('.sk-detail')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('skills-notfound')).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe('/skills/brainstorming');
  });

  test('4 · 列表点击进详情不回归', async ({ page }) => {
    await page.goto('/skills/');
    const first = page.locator('.sk-card').first();
    await expect(first).toBeVisible({ timeout: 20000 });
    await first.click();
    await expect(page.locator('.sk-detail')).toBeVisible({ timeout: 20000 });
    expect(new URL(page.url()).pathname).toMatch(/^\/skills\/.+/);
  });
});
