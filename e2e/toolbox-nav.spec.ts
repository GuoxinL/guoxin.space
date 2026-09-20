import { test, expect } from "@playwright/test";

/**
 * Toolbox 悬浮子菜单 · 页面自动化（Playwright）
 * 覆盖：桌面 hover/focus-within 展开、7 子项、点击进路由、active 态、
 * 小工具页 tab 路由切换、移动端嵌套、深链、hover 色带（C-23）。
 * 站点为纯静态预渲染，用例经 tools/serve-pages.mjs 起本地服务跑 Pages 语义。
 */

const SUBMENU_LABELS = ["JSON", "日历", "Base", "URL", "时间戳", "JWT", "CSV"];

test.describe("Toolbox 悬浮子菜单（桌面）", () => {
  // 导航含两个悬浮组（Toolbox / 更多），此处一律按 Toolbox 组的触发按钮 + 子菜单精确定位，
  // 避免与「更多」组（Skills+Running）的同级选择器冲突（strict mode violation）。
  const tbGroup = (page: import("@playwright/test").Page) =>
    page.locator(".mc-nav-group", { hasText: "Toolbox" });
  const tbTrigger = (page: import("@playwright/test").Page) =>
    tbGroup(page).locator(":scope > .mc-nav-item");
  const tbSub = (page: import("@playwright/test").Page) =>
    tbGroup(page).locator(".mc-submenu");

  test("点击 Toolbox 展开子菜单，含 7 个子项且每项含标题+描述", async ({
    page,
  }) => {
    await page.goto("/");
    const group = tbGroup(page);
    await expect(group).toBeVisible();
    // 默认隐藏（状态驱动，无 is-open）
    await expect(tbSub(page)).toBeHidden();
    await tbTrigger(page).click();
    const sub = tbSub(page);
    await expect(sub).toBeVisible();
    await expect(sub.locator(".mc-nav-item")).toHaveCount(7);
    for (const label of SUBMENU_LABELS) {
      const item = sub
        .locator(".mc-nav-item")
        .filter({ has: page.locator(".tb-menu-title", { hasText: label }) });
      await expect(item).toBeVisible();
      await expect(item.locator(".tb-menu-title")).toHaveText(label);
      await expect(item.locator(".tb-menu-desc")).toBeVisible();
    }
  });

  test("键盘 Enter 也能展开（可达性）", async ({ page }) => {
    await page.goto("/");
    await tbTrigger(page).focus();
    await page.keyboard.press("Enter");
    await expect(tbSub(page)).toBeVisible();
  });

  test("点击子菜单项进入对应独立路由，且悬浮窗自动收起", async ({ page }) => {
    await page.goto("/");
    await tbTrigger(page).click();
    await tbSub(page).locator(".mc-nav-item", { hasText: "Base" }).click();
    await expect(page).toHaveURL(/\/toolbox\/base64/);
    await expect(page.locator(".base-wrap")).toBeVisible();
    // 修复回归：点击后悬浮窗自动收起（不再因 focus-within 残留常驻）
    await expect(tbSub(page)).toBeHidden();
  });

  test("active 态：/toolbox/base64 下 Base64 子项与父栏目高亮", async ({
    page,
  }) => {
    await page.goto("/toolbox/base64");
    await expect(
      tbSub(page).locator(".mc-nav-item", { hasText: "Base" }),
    ).toHaveAttribute("aria-current", "page");
    // 父栏目 Toolbox 因 /toolbox/* 前缀也高亮
    await expect(tbTrigger(page)).toHaveAttribute("aria-current", "page");
  });

  test("C-23 hover 色带：子项 hover 背景变 violet-0（#f7f3ff）", async ({
    page,
  }) => {
    await page.goto("/");
    await tbTrigger(page).click();
    const item = tbSub(page).locator(".mc-nav-item", { hasText: "Base" });
    await expect(item).toBeVisible();
    // 静止态（子项未 hover）背景应为白
    const rest = await item.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await item.hover();
    // 等 120ms 过渡动画结束再回读 hover 态（否则读到插值中间值）
    await page.waitForTimeout(250);
    const hover = await item.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(hover).toBe("rgb(247, 243, 255)");
    expect(hover).not.toBe(rest);
  });
});

test.describe("Toolbox 子导航 + Base 编解码面板", () => {
  test("深链 /toolbox/jwt 直接打开，JWT 子项 active", async ({ page }) => {
    await page.goto("/toolbox/jwt");
    await expect(page.locator(".tools-panel")).toBeVisible();
    await expect(
      page.locator('.tb-tab[aria-current="page"]', { hasText: "JWT" }),
    ).toHaveCount(1);
  });

  test("Toolbox 子导航（tb-tab）点击切换路由（CSR 导航）", async ({ page }) => {
    await page.goto("/toolbox/base64");
    await page.locator(".tb-tab", { hasText: "URL" }).click();
    await expect(page).toHaveURL(/\/toolbox\/url/);
    await expect(page.locator(".tools-panel")).toBeVisible();
    await expect(
      page.locator('.tb-tab[aria-current="page"]', { hasText: "URL" }),
    ).toHaveCount(1);
  });

  test("Base 编码功能在独立路由页可用（默认 Base64）", async ({ page }) => {
    await page.goto("/toolbox/base64");
    await expect(page.locator(".base-wrap")).toBeVisible();
    // 默认编码格式 Base64、方向编码，输入即实时转换
    await expect(
      page.locator(".btn.codec.active", { hasText: "Base64" }),
    ).toHaveCount(1);
    await page.locator(".base-box:not([readonly])").fill("hello");
    await expect(page.locator(".base-box[readonly]")).toHaveValue("aGVsbG8=");
  });
});

test.describe("Base 编解码面板功能", () => {
  test("页头 tb-head 显示概念标头，6 个编码按钮齐全（含 Base16 (Hex)）", async ({
    page,
  }) => {
    await page.goto("/toolbox/base64");
    await expect(page.locator(".tb-head")).toBeVisible();
    await expect(page.locator(".tb-head h2")).toHaveText("Toolbox");
    await expect(page.locator(".tb-head p")).toHaveText(
      /Small tools for everyday bytes\./,
    );
    // 编码格式工具栏共有 6 个 codec 按钮
    await expect(
      page.locator(".base-toolbar").first().locator(".btn.codec"),
    ).toHaveCount(6);
    // 用户打磨要求：Base16 标签带 (Hex) 描述
    await expect(page.locator(".btn.codec", { hasText: "Base16" })).toHaveCount(
      1,
    );
  });

  test("切换 Base16 编码 hello → 68656C6C6F", async ({ page }) => {
    await page.goto("/toolbox/base64");
    await page.locator(".btn.codec", { hasText: "Base16 (Hex)" }).click();
    await expect(
      page.locator(".btn.codec.active", { hasText: "Base16 (Hex)" }),
    ).toHaveCount(1);
    await page.locator(".base-box:not([readonly])").fill("hello");
    await expect(page.locator(".base-box[readonly]")).toHaveValue("68656C6C6F");
  });

  test("切换解码方向可还原 Base64 文本", async ({ page }) => {
    await page.goto("/toolbox/base64");
    await page.locator(".btn.dir", { hasText: "← 解码" }).click();
    await page.locator(".base-box:not([readonly])").fill("aGVsbG8=");
    await expect(page.locator(".base-box[readonly]")).toHaveValue("hello");
  });
});

test.describe("Toolbox 移动端嵌套", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("汉堡菜单内 Toolbox 嵌套 7 个子项并可进入路由", async ({ page }) => {
    await page.goto("/");
    await page.locator('button[aria-label="打开菜单"]').click();
    const sub = page.locator(".mc-nav-sub");
    await expect(sub).toBeVisible();
    await expect(sub.locator(".mc-nav-item")).toHaveCount(7);
    // 移动端子项同样含标题 + 描述两行
    const first = sub.locator(".mc-nav-item").first();
    await expect(first.locator(".tb-menu-title")).toBeVisible();
    await expect(first.locator(".tb-menu-desc")).toBeVisible();
    await page.locator(".mc-nav-sub .mc-nav-item", { hasText: "CSV" }).click();
    await expect(page).toHaveURL(/\/toolbox\/csv/);
    await expect(page.locator(".tools-panel")).toBeVisible();
  });
});
