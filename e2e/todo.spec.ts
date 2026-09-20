import { test, expect, type Page, type Request } from '@playwright/test';

/**
 * TODO 模块 E2E（行式列表 + 原地编辑 + 标签浮层 + 末尾新增行 + 日历弹卡）。
 * 鉴权与数据均走 Cloudflare Worker（/api/todo/*）。e2e 用 page.route 拦截 mock Worker URL，
 * 并在 addInitScript 注入 localStorage（worker_url + admin token）模拟登录态，离线确定；
 * 未登录 describe 不注入，验证登录门禁。
 *
 * ⚠️ 本用例依赖 chromium（CI 已安装；本地 `npx playwright install chromium`）。
 * ⚠️ 已知口径：
 *    - 深链 `?todo=<id>`：加载时由 TodoPage.reload() 读 location.search 回填 highlightId →
 *      该行高亮 + 自动展开（**不再打开弹窗**，弹窗已随 TodoModal 移除）。
 *    - 写盘合并（debounce 400ms + 串行 + 尾写）属 lib 层逻辑，由
 *      app/src/lib/todo/write-queue.test.ts 单测覆盖；本文件只断言「编辑会触发 POST /api/todo/save」。
 *    - 跨路由深链保 query：Qwik City 1.20 仅同路径导航保留 query（lib/index.qwik.mjs:916-918），
 *      故日历卡片内的「在 TODO 页打开」走真实导航（location.href）。
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

interface SaveBody {
  day: string;
  todos: Array<{
    id: string;
    title: string;
    tags: string[];
    startDate: string;
    endDate: string | null;
    completedAt: string | null;
    subtasks: Array<{ id: string; progress: number }>;
  }>;
}

function mockWorker(page: Page) {
  // 静默校验必须显式 mock 为 200，否则会走真实网络（可能返回 401）→ authLogout
  // 把登录态清掉，Header 的 TODO 项与 /todo 列表随之消失（离线确定性）。
  page.route(`${MOCK_WORKER}api/auth/me`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, login: 'GuoxinL' }),
    }),
  );
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
  page.route(`${MOCK_WORKER}api/todo/month*`, (route) =>
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
    // Worker URL 真相源 = wb_home_sk_set（loadSkCfg().worker）；值须为 JSON 且含 worker 字段
    localStorage.setItem(
      'wb_home_sk_set',
      JSON.stringify({
        repo: 'guoxinl/skill-collection',
        branch: 'main',
        worker: 'https://mock.todo.worker/',
      }),
    );
    localStorage.setItem('wb_home_auth_token', 'mock.jwt.token');
    localStorage.setItem('wb_home_gh_user', JSON.stringify({ login: 'GuoxinL' }));
  });
}

/** 定位某条 TODO 的行（TodoRow 带 data-todo-id）。 */
function row(page: Page, id: string) {
  return page.locator(`.td-r[data-todo-id="${id}"]`);
}

/** 等待「包含指定 TODO id」的写盘请求（一次保存会按天分多个请求，需按内容挑）。 */
async function waitSaveWith(page: Page, todoId: string): Promise<Request> {
  return page.waitForRequest((r) => {
    if (!(r.url().includes('/api/todo/save') && r.method() === 'POST')) return false;
    return (r.postData() ?? '').includes(`"${todoId}"`);
  });
}

function bodyOf(req: Request): SaveBody {
  return JSON.parse(req.postData() ?? '{}') as SaveBody;
}

test.describe('TODO 未登录', () => {
  test('未登录 /todo 显示登录引导、无任务行', async ({ page }) => {
    await page.goto('/todo');
    await expect(page.locator('.td-gate')).toBeVisible();
    await expect(page.locator('.td-r')).toHaveCount(0);
  });
});

test.describe('TODO 已登录（mock Worker）', () => {
  test.beforeEach(async ({ page }) => {
    seedAuth(page);
    mockWorker(page);
    await page.goto('/todo');
  });

  test('列表渲染为行式（无卡片网格）+ 进度条', async ({ page }) => {
    await expect(page.locator('.td-r')).toHaveCount(2);
    // 旧的卡片网格已彻底退场
    await expect(page.locator('.td-card')).toHaveCount(0);
    await expect(page.locator('.td-list')).toHaveCount(0);
    await expect(row(page, 'todo-1').locator('.td-r-title')).toHaveText('写需求文档');
    // 写需求文档子任务均值 50% → 进度条可见
    await expect(row(page, 'todo-1').locator('.td-bar-fill')).toBeVisible();
  });

  test('原地编辑标题：点标题 → 输入 → Enter → POST /api/todo/save', async ({ page }) => {
    const r = row(page, 'todo-2');
    await r.locator('.td-r-title').click();
    const input = r.locator('.td-r-title-input');
    await expect(input).toBeVisible();

    const saveReq = waitSaveWith(page, 'todo-2');
    await input.fill('新的健身计划');
    await input.press('Enter');
    const body = bodyOf(await saveReq);

    const t = body.todos.find((x) => x.id === 'todo-2');
    expect(t?.title).toBe('新的健身计划');
    // 行内不再有弹窗
    await expect(page.locator('.td-modal')).toHaveCount(0);
    await expect(r.locator('.td-r-title')).toHaveText('新的健身计划');
  });

  test('标题清空 + blur：还原原值且不写盘', async ({ page }) => {
    const r = row(page, 'todo-2');
    let saved = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/todo/save') && req.method() === 'POST') saved = true;
    });

    await r.locator('.td-r-title').click();
    const input = r.locator('.td-r-title-input');
    await input.fill('');
    await input.press('Tab');

    await expect(r.locator('.td-r-title')).toHaveText('健身打卡');
    expect(saved).toBe(false);
  });

  test('行头 +/− 展开收起子任务编辑区（不写盘）', async ({ page }) => {
    const r = row(page, 'todo-1');
    let saved = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/todo/save') && req.method() === 'POST') saved = true;
    });

    await expect(r.locator('.td-sub-editor')).toHaveCount(0);
    await r.locator('.td-r-toggle').click();
    await expect(r.locator('.td-sub-editor')).toBeVisible();
    await expect(r.locator('.td-sub-edit')).toHaveCount(2);
    await expect(r.locator('.td-r-toggle')).toHaveAttribute('aria-expanded', 'true');

    await r.locator('.td-r-toggle').click();
    await expect(r.locator('.td-sub-editor')).toHaveCount(0);
    expect(saved).toBe(false);
  });

  test('完成勾选：关闭时子任务全记 100%，重新打开时只清完成时间', async ({ page }) => {
    const r = row(page, 'todo-1');
    await expect(r.locator('.td-r-check')).toHaveAttribute('aria-checked', 'true');

    // ① 重新打开：completedAt 清空，子任务进度保持（[100, 0] 不清零）
    const reopenReq = waitSaveWith(page, 'todo-1');
    await r.locator('.td-r-check').click();
    const reopened = bodyOf(await reopenReq).todos.find((x) => x.id === 'todo-1');
    expect(reopened?.completedAt).toBeNull();
    expect(reopened?.subtasks.map((s) => s.progress)).toEqual([100, 0]);
    await expect(r.locator('.td-r-check')).toHaveAttribute('aria-checked', 'false');

    // ② 关闭：写 completedAt，且所有子任务进度置 100
    const closeReq = waitSaveWith(page, 'todo-1');
    await r.locator('.td-r-check').click();
    const closed = bodyOf(await closeReq).todos.find((x) => x.id === 'todo-1');
    expect(closed?.completedAt).not.toBeNull();
    expect(closed?.subtasks.map((s) => s.progress)).toEqual([100, 100]);
    await expect(r.locator('.td-r-check')).toHaveAttribute('aria-checked', 'true');
  });

  test('删除某天最后一条 TODO：显式写空数组清掉日文件（防刷新复现）', async ({ page }) => {
    // todo-1 是 2026-09-17 唯一一条；删光后该天应被清空（todos: []），
    // 否则旧 YYYY-MM-DD.json 残留、刷新后 todoAll 仍读回、已删 todo「复活」（修复点）。
    const saveEmpty = page.waitForRequest(
      (req) =>
        req.url().includes('/api/todo/save') &&
        req.method() === 'POST' &&
        (req.postData() ?? '').includes('"day":"2026-09-17"') &&
        (req.postData() ?? '').includes('"todos":[]'),
    );
    await row(page, 'todo-1').locator('.td-r-del').click();
    await row(page, 'todo-1').locator('.td-r-confirm .btn.danger').click();
    await expect(row(page, 'todo-1')).toHaveCount(0);

    const body = bodyOf(await saveEmpty);
    expect(body.day).toBe('2026-09-17');
    expect(body.todos).toEqual([]);
  });

  test('标签浮层：点标签弹出已有标签，勾选即写盘', async ({ page }) => {
    const r = row(page, 'todo-2');
    await r.locator('.td-r-tagbtn').click();

    const picker = page.locator('.td-picker');
    await expect(picker).toBeVisible();
    await expect(picker.locator('.td-picker-item')).toHaveCount(2);
    // 当前已选 life 处于勾选态
    await expect(
      picker.locator('.td-picker-item', { hasText: 'life' }),
    ).toHaveAttribute('aria-selected', 'true');

    const saveReq = waitSaveWith(page, 'todo-2');
    await picker.locator('.td-picker-item', { hasText: 'work' }).click();
    const t = bodyOf(await saveReq).todos.find((x) => x.id === 'todo-2');
    expect(t?.tags).toEqual(['t2', 't1']);
  });

  test('标签浮层：输入名称回车即创建标签并勾上', async ({ page }) => {
    const r = row(page, 'todo-2');
    await r.locator('.td-r-tagbtn').click();

    const tagReq = page.waitForRequest(
      (req) => req.url().includes('/api/todo/tags') && req.method() === 'POST',
    );
    const saveReq = waitSaveWith(page, 'todo-2');

    await page.locator('.td-picker-add input').fill('新标签');
    await page.locator('.td-picker-add input').press('Enter');

    // ① 标签库先落盘
    const tagBody = JSON.parse((await tagReq).postData() ?? '{}') as {
      tags: Array<{ id: string; name: string }>;
    };
    expect(tagBody.tags.some((t) => t.name === '新标签')).toBe(true);

    // ② 再把新标签勾到该 TODO
    const t = bodyOf(await saveReq).todos.find((x) => x.id === 'todo-2');
    expect(t?.tags.length).toBe(2);
    await expect(
      page.locator('.td-picker-item', { hasText: '新标签' }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  test('列表末尾「＋ 添加 TODO」：填标题回车落盘', async ({ page }) => {
    await page.locator('.td-r-add').click();
    const draft = page.locator('.td-r.draft');
    await expect(draft).toBeVisible();

    const saveReq = page.waitForRequest(
      (req) =>
        req.url().includes('/api/todo/save') &&
        req.method() === 'POST' &&
        (req.postData() ?? '').includes('新任务'),
    );
    await draft.locator('.td-r-title-input').fill('新任务');
    await draft.locator('.td-r-title-input').press('Enter');

    const body = bodyOf(await saveReq);
    const created = body.todos.find((t) => t.title === '新任务');
    expect(created).toBeTruthy();
    // startDate 用本地日期（修复原 UTC 口径）
    expect(created?.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // 创建后草稿行退场
    await expect(page.locator('.td-r.draft')).toHaveCount(0);
    await expect(page.locator('.td-r')).toHaveCount(3);
  });

  test('草稿行空标题回车/丢弃：不产生记录', async ({ page }) => {
    await page.locator('.td-r-add').click();
    const draft = page.locator('.td-r.draft');
    await expect(draft).toBeVisible();

    let saved = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/todo/save') && req.method() === 'POST') saved = true;
    });

    await draft.locator('.td-r-title-input').press('Enter');
    await expect(page.locator('.td-r.draft')).toHaveCount(0);
    expect(saved).toBe(false);

    // 丢弃按钮同样不写盘
    await page.locator('.td-r-add').click();
    await expect(page.locator('.td-r.draft')).toBeVisible();
    await page.locator('.td-r.draft .td-r-del').click();
    await expect(page.locator('.td-r.draft')).toHaveCount(0);
    expect(saved).toBe(false);
  });

  test('标签 OR + 进度筛选（写入侧 URL 同步）', async ({ page }) => {
    await page.locator('.td-chip', { hasText: 'work' }).click();
    await expect(page).toHaveURL(/tag=t1/);
    // 进度档按 calcProgress：todo-1 子任务均值 50% → 'doing'
    await page.locator('.td-select').first().selectOption('doing');
    await expect(page).toHaveURL(/filter=doing/);
    await expect(page.locator('.td-r')).toHaveCount(1);
  });

  test('周报：打开周报弹窗含三格式', async ({ page }) => {
    await page.locator('.td-actions .btn', { hasText: '周报' }).click();
    await expect(page.locator('.td-weekly')).toBeVisible();
  });

  test('深链 ?todo=<id>：定位高亮 + 自动展开（不再弹窗）', async ({ page }) => {
    await page.goto('/todo?todo=todo-1');
    const r = row(page, 'todo-1');
    await expect(r).toHaveClass(/hl/);
    await expect(r.locator('.td-sub-editor')).toBeVisible();
    await expect(page.locator('.td-modal')).toHaveCount(0);
  });

  test('行表面与 hover 态令牌（getComputedStyle 回读）', async ({ page }) => {
    const r = row(page, 'todo-2');
    const base = await r.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(base).toBe('rgba(0, 0, 0, 0)');

    await r.hover();
    // transition 120ms 结束后再回读，否则读到插值中途值（C-23 时序坑）
    await page.waitForTimeout(250);
    const hovered = await r.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(hovered).toBe('rgb(247, 243, 255)');
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

test.describe('TODO 行 · 窄屏布局', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('窄屏：行内字段折行为多行且不横向溢出', async ({ page }) => {
    seedAuth(page);
    mockWorker(page);
    await page.goto('/todo');

    const r = row(page, 'todo-1');
    await expect(r).toBeVisible();
    const wrap = await r
      .locator('.td-r-main')
      .evaluate((el) => getComputedStyle(el).flexWrap);
    expect(wrap).toBe('wrap');

    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    expect(m.sw).toBeLessThanOrEqual(m.cw + 1);
  });
});

test.describe('日历融合 TODO（已登录）', () => {
  test.beforeEach(async ({ page }) => {
    seedAuth(page);
    mockWorker(page);
  });

  test('点击有 TODO 的格子弹出只读卡片（不整页跳转）', async ({ page }) => {
    await page.goto('/toolbox/calendar');
    await expect(page.locator('.cal-todo-line')).toHaveCount(1);

    await page.locator('.cal-todo-line').first().click();
    const card = page.locator('.td-cal-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('写需求文档');
    // 仍在日历页（不再 location.href 整页跳走）
    await expect(page).toHaveURL(/\/toolbox\/calendar/);
  });

  test('卡片内「在 TODO 页打开」带 ?todo= 深链跳转并高亮该行', async ({ page }) => {
    await page.goto('/toolbox/calendar');
    await page.locator('.cal-todo-line').first().click();
    await page.locator('.td-cal-card .btn', { hasText: '在 TODO 页打开' }).click();

    await expect(page).toHaveURL(/todo=todo-1/);
    await expect(row(page, 'todo-1')).toHaveClass(/hl/);
  });
});

test.describe('主导航 TODO 项（登录门控）', () => {
  test('未登录：主导航不出现 TODO 入口', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.mc-nav-item', { hasText: 'TODO' })).toHaveCount(0);
  });

  test('已登录：主导航出现 TODO 入口，点击进入 /todo', async ({ page }) => {
    seedAuth(page);
    mockWorker(page);
    await page.goto('/');
    const item = page.locator('.mc-nav-item', { hasText: 'TODO' });
    await expect(item).toHaveCount(1);
    await item.click();
    // Qwik City 目的地可能带尾斜杠（/todo/），两种都接受
    await expect(page).toHaveURL(/\/todo\/?$/);
  });

  test('静默登出后导航项即时移除（无刷新，验证登录态订阅）', async ({ page }) => {
    seedAuth(page);
    mockWorker(page);
    // 用「手动放行」的 mock 控制静默校验时点（不用 sleep，避免时序竞态）：
    // 先让页面稳定处于登录态（TODO 项已渲染），再放行 401 →
    // authLogout → authNotify → Header 的 authSubscribe 回调把它即时移除（期间未导航）。
    let release401: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release401 = resolve;
    });
    page.route(`${MOCK_WORKER}api/auth/me`, async (route) => {
      await gate;
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'expired' }),
      });
    });
    await page.goto('/');
    const item = page.locator('.mc-nav-item', { hasText: 'TODO' });
    await expect(item).toHaveCount(1);
    release401();
    await expect(item).toHaveCount(0);
  });
});
