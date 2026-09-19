import { test, expect, type Page } from "@playwright/test";

/**
 * Toolbox · Calendar /toolbox/calendar 页面级自动化（Playwright）
 * 断言：导航项、月视图网格、切月、点击看黄历、今日高亮。
 * 末尾追加「TODO 任务线跨日连续」组（mock Worker + 注入登录态，离线确定）。
 */
test.describe("Toolbox · Calendar /toolbox/calendar", () => {
  test("Toolbox 子导航含 7 个工具且当前页（日历）高亮", async ({ page }) => {
    await page.goto("/toolbox/calendar");
    await expect(page).toHaveTitle(/Calendar/);
    // 顶部主导航不再含独立 Calendar 项（已并入 Toolbox 子菜单，标签为「日历」）
    await expect(
      page.locator(".mc-nav-item", { hasText: "Calendar" }),
    ).toHaveCount(0);
    // 子导航含 7 个工具 tab（JSON/日历/Base/URL/时间戳/JWT/CSV）；
    // TODO 已上移为登录后的主导航项，不再属于 Toolbox
    await expect(page.locator(".tb-tab")).toHaveCount(7);
    await expect(page.locator(".tb-tab", { hasText: "TODO" })).toHaveCount(0);
    // 当前页 日历 tab 高亮、JSON tab 可见可跳转
    await expect(page.locator(".tb-tab", { hasText: "日历" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator(".tb-tab", { hasText: "JSON" })).toBeVisible();
  });

  test("月视图渲染 42 日格", async ({ page }) => {
    await page.goto("/toolbox/calendar");
    await expect(page.locator(".cal-body .cal-cell")).toHaveCount(42);
    await expect(page.locator(".cal-dow-cell")).toHaveCount(7);
  });

  test("上/下月切换改变标题月份", async ({ page }) => {
    await page.goto("/toolbox/calendar");
    const title = page.locator(".cal-title");
    const before = (await title.innerText()).trim();
    await page.locator("button.btn", { hasText: "下月" }).click();
    await expect(title).not.toHaveText(before);
    await page.locator("button.btn", { hasText: "上月" }).click();
    await expect(title).toHaveText(before);
  });

  test("法定假期明显标记（休/班 徽标 + 节日高亮）", async ({ page }) => {
    await page.goto("/toolbox/calendar");
    // 切到 10 月（国庆 7 天连休）
    await page.locator("button.btn", { hasText: "下月" }).click();
    await expect(page.locator(".cal-title")).toContainText("10 月");
    // 至少存在一个休息日高亮单元
    await expect(
      page.locator(".cal-body .cal-rest-cell").first(),
    ).toBeVisible();
    // 节日数字使用高亮样式
    await expect(page.locator(".cal-body .cal-num-fest").first()).toBeVisible();
    // 存在「休」徽标
    await expect(
      page.locator(".cal-body .cal-badge.cal-rest").first(),
    ).toHaveText("休");
  });

  test("今日高亮存在（客户端挂载后）", async ({ page }) => {
    await page.goto("/toolbox/calendar");
    await expect(page.locator(".cal-today")).toBeVisible();
  });

  test("查看未维护年份显示「数据待补充」提示", async ({ page }) => {
    await page.goto("/toolbox/calendar");
    const title = page.locator(".cal-title");
    // 前进直到进入 2027（国办尚未发布，最多 14 次切月）
    for (let i = 0; i < 14; i++) {
      if ((await title.innerText()).includes("2027")) break;
      await page.locator("button.btn", { hasText: "下月" }).click();
    }
    await expect(title).toContainText("2027");
    await expect(page.locator(".cal-hint")).toBeVisible();
    await expect(page.locator(".cal-hint")).toContainText("待补充");
  });
});

/* ------------------------------------------------------------------
 * TODO 任务线跨日连续（mock Worker + 注入登录态，离线确定）
 * 布局算法见 app/src/lib/calendar/todo-line.ts：按行（周）分配通道，
 * 同一行 7 格共用 lane 编号 + 固定槽位 → 同一任务的线段横向相连。
 * ------------------------------------------------------------------ */

const MOCK_WORKER = "https://mock.todo.worker/";

/** 月索引 mock：一个跨 3 天（9/15~9/17，同属 9/13 起的那一行）+ 一个同日单日任务。 */
const MONTH_INDEX = [
  {
    id: "multi",
    title: "三天任务",
    tags: [],
    startDate: "2026-09-15",
    endDate: "2026-09-17",
    progress: 50,
    completedAt: null,
  },
  {
    id: "single",
    title: "单日任务",
    tags: [],
    startDate: "2026-09-17",
    endDate: "2026-09-17",
    progress: 100,
    completedAt: null,
  },
];

function seedTodoAuth(page: Page) {
  page.addInitScript(() => {
    // Worker URL 真相源 = wb_home_sk_set（loadSkCfg().worker）
    localStorage.setItem(
      "wb_home_sk_set",
      JSON.stringify({
        repo: "guoxinl/skill-collection",
        branch: "main",
        worker: "https://mock.todo.worker/",
      }),
    );
    localStorage.setItem("wb_home_auth_token", "mock.jwt.token");
    localStorage.setItem(
      "wb_home_gh_user",
      JSON.stringify({ login: "GuoxinL" }),
    );
  });
}

function mockWorkerApi(page: Page) {
  // 静默校验（/api/auth/me）必须显式 mock 为 200：未 mock 时会走真实网络并可能返回
  // 401 → authVerify 触发 authLogout 清掉登录态，任务线/导航项随之消失（离线确定性）。
  page.route(`${MOCK_WORKER}api/auth/me`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, login: "GuoxinL" }),
    }),
  );
  page.route(`${MOCK_WORKER}api/todo/month*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, index: MONTH_INDEX }),
    }),
  );
  // 卡片内把 tag id 显示为名称，登录态下日历页会拉一次标签库
  page.route(`${MOCK_WORKER}api/todo/tags`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, tags: [{ id: "t1", name: "work" }] }),
    }),
  );
}

/** 按 aria-label 精确定位某一天的日历格（不依赖网格行偏移）。 */
function dayCell(page: Page, d: number) {
  return page.locator(`.cal-body .cal-cell[aria-label^="2026年9月${d}日"]`);
}

test.describe("Calendar · TODO 任务线跨日连续", () => {
  test("未登录：不渲染任何任务线", async ({ page }) => {
    await page.goto("/toolbox/calendar");
    await expect(page.locator(".cal-todo-line")).toHaveCount(0);
  });

  test("跨日线跨格相连：中段两端直角贴边、首/末段各只开放一侧", async ({
    page,
  }) => {
    seedTodoAuth(page);
    mockWorkerApi(page);
    await page.goto("/toolbox/calendar");

    const first = dayCell(page, 15).locator(".cal-todo-line");
    const mid = dayCell(page, 16).locator(".cal-todo-line");
    const last = dayCell(page, 17).locator(".cal-todo-line");

    await expect(first).toHaveCount(1);
    await expect(mid).toHaveCount(1);
    // 9/17 叠两条：跨日任务末段（lane0）+ 单日任务（lane1）
    await expect(last).toHaveCount(2);

    // 首段：左端圆角、右端直角贴边（继续到右邻格）
    await expect(first).toHaveClass(/cal-todo-line/);
    await expect(first).not.toHaveClass(/cal-tl-open-l/);
    await expect(first).toHaveClass(/cal-tl-open-r/);
    await expect(first).toHaveClass(/yellow/);
    // 中段：两端都直角贴边
    await expect(mid).toHaveClass(/cal-tl-open-l/);
    await expect(mid).toHaveClass(/cal-tl-open-r/);
    // 末段：左端直角贴边、右端圆角（任务在本格结束）
    await expect(last.first()).toHaveClass(/cal-tl-open-l/);
    await expect(last.first()).not.toHaveClass(/cal-tl-open-r/);
  });

  test("相邻两格线段无接缝、同一通道高度一致（几何断言）", async ({ page }) => {
    seedTodoAuth(page);
    mockWorkerApi(page);
    await page.goto("/toolbox/calendar");

    const a = await dayCell(page, 15).locator(".cal-todo-line").boundingBox();
    const b = await dayCell(page, 16).locator(".cal-todo-line").boundingBox();
    const c = await dayCell(page, 17)
      .locator(".cal-todo-line")
      .first()
      .boundingBox();
    expect(a && b && c).toBeTruthy();
    if (!a || !b || !c) return;

    // 视觉上连成一条：右端 ≥ 下一段左端（重叠 1px 覆盖接缝）
    expect(b.x).toBeLessThanOrEqual(a.x + a.width + 0.5);
    expect(c.x).toBeLessThanOrEqual(b.x + b.width + 0.5);
    // 同一 lane 在三格中的 y / 高度一致
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(b.y - c.y)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(0.5);
  });

  test("单日任务是两端圆角的独立胶囊", async ({ page }) => {
    seedTodoAuth(page);
    mockWorkerApi(page);
    await page.goto("/toolbox/calendar");

    const single = dayCell(page, 17).locator(".cal-todo-line").nth(1);
    await expect(single).toHaveClass(/green/);
    const box = await single.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        r: [
          s.borderTopLeftRadius,
          s.borderTopRightRadius,
          s.borderBottomLeftRadius,
          s.borderBottomRightRadius,
        ],
        ml: s.marginLeft,
        mr: s.marginRight,
      };
    });
    expect(box.r).toEqual(["999px", "999px", "999px", "999px"]);
    expect([box.ml, box.mr]).toEqual(["0px", "0px"]);
  });

  test("hover 态回读（C-23）：贴边格局不被同特异性后置规则覆盖", async ({
    page,
  }) => {
    seedTodoAuth(page);
    mockWorkerApi(page);
    await page.goto("/toolbox/calendar");

    const mid = dayCell(page, 16).locator(".cal-todo-line");
    await dayCell(page, 16).hover();
    const hovered = await mid.evaluate((el) => {
      const s = getComputedStyle(el);
      return [
        s.borderTopLeftRadius,
        s.borderTopRightRadius,
        s.marginLeft,
        s.marginRight,
      ];
    });
    expect(hovered).toEqual(["0px", "0px", "-8px", "-9px"]);
  });
});
