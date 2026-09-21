import { test, expect, type Page, type Route } from '@playwright/test';

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

// 收藏仓库内 brainstorming 的 SKILL.md：proxy 模式占位符（含 source 指向原仓库）
// 静态注册表（Plan B）：skill-collection 仓构建的 skills.json，列表从此读取（替代 GitHub API 遍历）
const SKILLS_JSON = JSON.stringify({
  repo: 'GuoxinL/skill-collection',
  branch: 'main',
  rows: [
    {
      dir: 'brainstorming',
      name: '示例技能',
      description: '用于 IT 的示例简介',
      mode: 'proxy',
      source: 'https://github.com/Other/skills-repo/tree/main/skills/brainstorming',
      sourceOwner: 'Other',
      icon: null,
    },
    {
      dir: 'xz-credentials',
      name: 'xz-credentials',
      description: '',
      mode: null,
      source: '',
      sourceOwner: '',
      icon: null,
    },
  ],
});

const COLLECTION_SKILL_MD = [
  '---',
  'name: 示例技能',
  'description: 用于 IT 的示例简介',
  'metadata:',
  '  source: https://github.com/Other/skills-repo/tree/main/skills/brainstorming',
  '  mode: proxy',
  '  sourceOwner: Other',
  '---',
  '',
  '（占位：代理条目，详情应回源原仓库）',
].join('\n');

// 原仓库内 brainstorming 的真实 SKILL.md 正文（proxy 应回源到此）
const SOURCE_SKILL_MD = [
  '---',
  'name: 真实技能名',
  'description: 来自原仓库',
  '---',
  '',
  '# 原始技能正文',
  '这是代理条目的真实内容，不应显示占位符。',
].join('\n');

const SOURCE_TREE = [
  { path: 'skills/brainstorming/SKILL.md', type: 'blob' },
  { path: 'skills/brainstorming/references.md', type: 'blob' },
];

/** 区分收藏仓库与原仓库的双源 mock：
 *  - 收藏仓库（GuoxinL/skill-collection）的 SKILL.md 返回 proxy 占位符；
 *  - 原仓库（Other/skills-repo）的 SKILL.md 返回真实正文、文件树只含子路径文件。 */
async function mockGitHub(page: Page): Promise<void> {
  await page.route('https://api.github.com/**', async (route) => {
    const lc = route.request().url().toLowerCase();
    if (lc.includes('/git/trees/')) {
      // 原仓库树 → 仅子路径文件；收藏仓库树 → MOCK_TREE（注意默认仓库 owner 为小写 guoxinl）
      if (lc.includes('guoxinl/skill-collection')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tree: MOCK_TREE }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tree: SOURCE_TREE }) });
    }
    // commits（排序用）：返回空数组即可，fetchCommitsOrder 会降级为字典序
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  // 技能夹取数走「通道候选链」（jsDelivr 主 → raw 兜底）：两个域共用同一套桩。
  // 只桩 raw 会让主通道打真实外网（沙箱内表现为慢 / 超时，用例不稳）。
  const stubFileChannels = (route: Route) => {
    const lc = route.request().url().toLowerCase();
    // 静态注册表 skills.json（Plan B）：默认仓库根路径返回合法 JSON，列表走静态路径
    if (lc.includes('guoxinl/skill-collection') && lc.endsWith('/skills.json')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: SKILLS_JSON,
      });
    }
    // 收藏仓库 → proxy 占位符；原仓库 → 真实正文（SKILL.md 与 references.md 共用，够断言）
    const body = lc.includes('guoxinl/skill-collection') ? COLLECTION_SKILL_MD : SOURCE_SKILL_MD;
    return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body });
  };
  await page.route('https://cdn.jsdelivr.net/**', stubFileChannels);
  await page.route('https://raw.githubusercontent.com/**', stubFileChannels);
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

  test('5 · proxy 模式详情回源原仓库（非占位符）+ 文件树含原仓库子路径', async ({ page }) => {
    await page.goto('/skills/brainstorming/');
    await expect(page.locator('.sk-detail')).toBeVisible({ timeout: 20000 });
    // 正文应为原仓库真实内容，而非收藏仓库占位符
    await expect(page.locator('.sk-md')).toContainText('原始技能正文');
    await expect(page.locator('.sk-md')).not.toContainText('占位：代理条目');
    // 文件树应展示原仓库子路径下的文件
    await expect(page.locator('.file-tree')).toContainText('references.md');
    // 来源行标注（引用代理）
    await expect(page.locator('.sk-d-src')).toContainText('引用代理');
  });
});
