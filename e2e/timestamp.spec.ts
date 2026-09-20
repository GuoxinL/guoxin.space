import { test, expect } from "@playwright/test";

/**
 * Toolbox · 时间戳 /toolbox/timestamp 页面级自动化（Playwright）
 * 纯前端、零外网依赖；覆盖：渲染、输入即解析、多格式卡片、单位锁、时区切换、
 * 相对时间、多时区对比、时段边界、区间生成、AI JSON、场景标签/历史。
 */

const cardValue = (page: import("@playwright/test").Page, label: string) =>
  page.locator(".ts-card", { hasText: label }).locator(".ts-card-value");

test.describe("Toolbox · 时间戳 /toolbox/timestamp", () => {
  test("页面渲染：标题、主面板、输入框可见", async ({ page }) => {
    await page.goto("/toolbox/timestamp");
    await expect(page).toHaveTitle(/时间戳|Toolbox/);
    await expect(page.locator(".ts-wrap")).toBeVisible();
    await expect(page.locator(".ts-input")).toBeVisible();
  });

  test("默认加载即填入当前时间，6 张转换卡可见，「现在」按钮可回填", async ({ page }) => {
    await page.goto("/toolbox/timestamp");
    // 打开即应预填当前时间戳（非空），且 6 张格式卡直接可见
    await expect(page.locator(".ts-input")).not.toHaveValue("");
    await expect(page.locator(".ts-card")).toHaveCount(6);
    await expect(page.locator(".ts-now-btn")).toBeVisible();
    // 输入其他值后点「现在」应回填当前时间
    await page.locator(".ts-input").fill("1700000000000000000");
    await page.locator(".ts-now-btn").click();
    await expect(page.locator(".ts-input")).not.toHaveValue("1700000000000000000");
  });

  test("输入纳秒时间戳 → RFC3339 / 含亚秒(ns) 卡片即时更新", async ({ page }) => {
    await page.goto("/toolbox/timestamp");
    // 等 Temporal 引擎异步加载完成（避免首屏 Date 兜底用空格分隔）
    await expect(page.locator(".tools-hint")).toContainText("已加载");
    await page.locator(".ts-input").fill("1700000000000000000");
    await page.locator("#ts-tz").fill("Asia/Shanghai");
    await expect(cardValue(page, "RFC 3339")).toContainText("2023-11-15T06:13:20+08:00");
    await expect(cardValue(page, "含亚秒(ns)")).toContainText("1700000000000000000");
  });

  test("单位锁「秒」：1700000000 → UTC ISO 2023-11-14T22:13:20Z", async ({ page }) => {
    await page.goto("/toolbox/timestamp");
    await page.locator(".ts-unit").selectOption("s");
    await page.locator(".ts-input").fill("1700000000");
    await expect(cardValue(page, "UTC ISO")).toContainText("2023-11-14T22:13:20Z");
  });

  test("时区切换 Asia/Shanghai → 偏移 +08:00", async ({ page }) => {
    await page.goto("/toolbox/timestamp");
    await page.locator(".ts-input").fill("1700000000000000000");
    await page.locator("#ts-tz").fill("Asia/Shanghai");
    await expect(cardValue(page, "偏移 / DST")).toContainText("+08:00");
  });

  test("相对时间：远未来时间戳含「后」", async ({ page }) => {
    await page.goto("/toolbox/timestamp");
    await page.locator(".ts-input").fill("1999999999000000000");
    await expect(page.locator(".ts-rel")).toContainText("后");
  });

  test("多时区对比：展开后列出多个时区行", async ({ page }) => {
    await page.goto("/toolbox/timestamp");
    await page.locator(".ts-input").fill("1700000000000000000");
    await page.locator(".ts-adv-head", { hasText: "多时区对比" }).click();
    await expect(page.locator(".ts-compare-row").first()).toBeVisible();
    await expect(page.locator(".ts-compare-row")).not.toHaveCount(0);
  });

  test("时段边界：展开后显示 7 个边界", async ({ page }) => {
    await page.goto("/toolbox/timestamp");
    await page.locator(".ts-input").fill("1700000000000000000");
    await page.locator(".ts-adv-head", { hasText: "时段边界" }).click();
    await expect(page.locator(".ts-period-row")).toHaveCount(7);
    await expect(page.locator(".ts-period-label").first()).toContainText("今天 0 点");
  });

  test("区间生成：起止 + 步长 → 显示点数", async ({ page }) => {
    await page.goto("/toolbox/timestamp");
    await page.locator(".ts-adv-head", { hasText: "区间生成" }).click();
    await page.locator(".ts-interval .ts-input").nth(0).fill("1700000000000");
    await page.locator(".ts-interval .ts-input").nth(1).fill("1700003600000");
    await page.locator(".ts-interval select.ts-unit").selectOption("1m");
    await expect(page.locator(".ts-interval-count")).toContainText("点");
  });

  test("AI JSON：展开后含 epoch_ns 字段", async ({ page }) => {
    await page.goto("/toolbox/timestamp");
    await page.locator(".ts-input").fill("1700000000000000000");
    await page.locator(".ts-adv-head", { hasText: "AI 友好 JSON" }).click();
    await expect(page.locator(".ts-aijson-pre")).toContainText("epoch_ns");
  });

  test("场景标签：点击填充输入框并写入历史", async ({ page }) => {
    await page.goto("/toolbox/timestamp");
    await page.locator(".ts-adv-head", { hasText: "场景标签" }).click();
    await page.locator(".ts-scenario-chip", { hasText: "JWT iat" }).click();
    await expect(page.locator(".ts-input")).toHaveValue("1700000000");
    await expect(page.locator(".ts-history-chip").first()).toBeVisible();
  });
});
