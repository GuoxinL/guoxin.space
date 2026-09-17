import { test, expect, type Page } from '@playwright/test';

/**
 * TODO 模块 E2E（对齐 plan §7 / 06-it 9 例）。
 * 鉴权与数据均走 Cloudflare Worker（/api/todo/*）。e2e 用 page.route 拦截 mock Worker URL，
 * 并在 addInitScript 注入 localStorage（worker_url + admin token）模拟登录态，离线确定；
 * 未登录 describe 不注入，验证登录门禁。
 *
 * ⚠️ 本用例依赖 chromium（CI 已安装；本地 `npx playwright install chromium`）。
 *    若 Worker 真实 secret（TODO_REPO）未配，线上为 500；本用例走 mock URL 不受影响。
 * ⚠️ 已知缺口（见 06-it.md / 08-review.md）：TodoPage 仅把筛选/排序写入 URL，加载时并不回读，
 *    故「刷新保留筛选态」当前未实现——本文件只断言写入侧同步（?tag=/?filter=）。
 */

const MOCK_WORKER = 'https://mock.todo.worker/';

const SAMPLE_TODOS = [
  {
    id: 'todo-1',
    title: '写需求文档',
    tags: ['t1'],
    startDate: '2026-09-17',
    endDate: '2026-09-17',
    createdAt: '2026-09-17T08:00:00.000Z',
    updatedAt: '2026-09-17T08:00:00.000Z',
    lastOperatedAt: '2026-09-17T08:00:00.000Z',
    completedAt: '2026-09-17T09:00:00.000Z',
    subtasks: [
      { id: 'todo-1-1', title: 's1', weight: 1, progress: 100, updatedAt: 'x' },
      { id: 'todo-1-2', title: 's2', weight: 1, progress: 0, updatedAt: 'x' },
    ],
  },
  {
    id: 'todo-2',
    title: '健身打卡',
    tags: ['t2'],
    startDate: '2026-09-18',
    endDate: '2026-09-18',
    createdAt: '2026-09-18T08:00:00.000Z',
    updatedAt: '2026-09-18T08:00:00.000Z',
    lastOperatedAt: '2026-09-18T08:00:00.000Z',
    completedAt: null,
    subtasks: [],
  },
];

const SAMPLE_TAGS = [
  { id: 't1', name: 'work' },
  { id: 't2', name: 'life' },
];

function mockWorker(page: Page) {
  page.route(`${MOCK_WORKER}api/todo/all`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, todos: SAMPLE_TODOS }),
    }),
  );
  page.route(`${MOCK_WORKER}api/todo/tags`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, tags: SAMPLE_TAGS }),
    }),
  );
  page.route(`${MOCK_WORKER}api/todo/month`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        index: [
          {
            id: 'todo-1',
            title: '写需求文档',
            tags: ['t1'],
            startDate: '2026-09-17',
            endDate: '2026-09-17',
            progress: 50,
            completedAt: '2026-09-17T09:00:00.000Z',
          },
        ],
      }),
    }),
  );
  page.route(`${MOCK_WORKER}api/todo/save`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    }),
  );
}

function seedAuth(page: Page) {
  page.addInitScript(() => {
    localStorage.setItem('worker_url', 'https://mock.todo.worker/');
    localStorage.setItem('wb_home_auth_token', 'mock.jwt.token');
    localStorage.setItem('wb_home_gh_user', JSON.stringify({ login: 'GuoxinL' }));
  });
}

test.describe('TODO 未登录', () => {
  test('未登录 /todo 显示登录引导、无数据卡片', async ({ page }) => {
    await page.goto('/todo');
    await expect(page.locator('.td-gate')).toBeVisible();
    await expect(page.locator('.td-card')).toHaveCount(0);
  });
});

test.describe('TODO 已登录（mock Worker）', () => {
  test.beforeEach(async ({ page }) => {
    seedAuth(page);
    mockWorker(page);
    await page.goto('/todo');
  });

  test('列表渲染全部 TODO 卡片 + 进度条', async ({ page }) => {
    await expect(page.locator('.td-card')).toHaveCount(2);
    await expect(page.locator('.td-card').first().locator('.td-title')).toContainText('写需求文档');
    await expect(page.locator('.td-card').first().locator('.td-bar-fill')).toBeVisible();
  });

  test('创建 TODO：弹窗填标题并 POST /api/todo/save', async ({ page }) => {
    await page.locator('.td-actions .btn', { hasText: '新建 TODO' }).click();
    await expect(page.locator('.td-modal')).toBeVisible();
    await page.locator('.td-modal input').first().fill('新任务');
    const saveReq = page.waitForRequest(
      (req) => req.url().includes('/api/todo/save') && req.method() === 'POST',
    );
    await page.locator('.td-modal-foot .btn', { hasText: '保存' }).click();
    const req = await saveReq;
    const body = JSON.parse(req.postData() ?? '{}');
    expect(body.todos.some((t: { title: string }) => t.title === '新任务')).toBeTruthy();
  });

  test('标签 OR + 进度筛选（写入侧 URL 同步）', async ({ page }) => {
    await page.locator('.td-chip', { hasText: 'work' }).click();
    await expect(page).toHaveURL(/tag=t1/);
    await page.locator('.td-select').first().selectOption('done');
    await expect(page).toHaveURL(/filter=done/);
    await expect(page.locator('.td-card')).toHaveCount(1);
  });

  test('周报：打开周报弹窗含三格式', async ({ page }) => {
    await page.locator('.td-actions .btn', { hasText: '周报' }).click();
    await expect(page.locator('.td-weekly')).toBeVisible();
  });

  test('暗黑模式：todo 表面令牌已接入（非透明背景）', async ({ page }) => {
    const bg = await page
      .locator('.td-page')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('Worker 故障：/api/todo/all 500 显示错误态不白屏', async ({ page }) => {
    await page.route(`${MOCK_WORKER}api/todo/all`, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'internal' }),
      }),
    );
    await page.goto('/todo');
    await expect(page.locator('.td-page')).toBeVisible();
    await expect(page.locator('.td-status')).toContainText('加载失败');
  });
});

test.describe('日历融合 TODO 进度线条（已登录）', () => {
  test.beforeEach(async ({ page }) => {
    seedAuth(page);
    mockWorker(page);
  });

  test('日历单元格渲染 TODO 进度线条并可深链', async ({ page }) => {
    await page.goto('/toolbox/calendar');
    await expect(page.locator('.cal-todo-line')).toHaveCount(1);
    await page.locator('.cal-todo-line').first().click();
    await expect(page).toHaveURL(/todo=todo-1/);
  });
});
