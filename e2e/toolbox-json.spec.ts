import { test, expect } from '@playwright/test';

/**
 * Toolbox · JSON /toolbox/json 页面级自动化（Playwright）
 * 覆盖：页面渲染、格式化、语言互转、修复传 lang、JSONPath 高亮、历史、分享、提取、小工具、结构对比。
 */

const L_COL = page => page.locator('.json-col').first();
const R_COL = page => page.locator('.json-col').nth(1);

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
    await fmt.click();
    await expect(page.locator('.editor-wrap').first()).toBeVisible();
  });

  test('语言互转：切到 YAML 后内容被重新序列化', async ({ page }) => {
    await page.goto('/toolbox/json');
    const ta = L_COL(page).locator('textarea');
    await ta.fill('{"name":"guoxin","age":18}');
    await L_COL(page).locator('select.lang-sel').selectOption('yaml');
    // YAML 输出不含花括号，且保留键值
    await expect(ta).toHaveValue(/name: guoxin/);
    await expect(ta).not.toHaveValue(/{/);
  });

  test('修复传 lang：单引号 JSON 经修复后变合法', async ({ page }) => {
    await page.goto('/toolbox/json');
    const ta = L_COL(page).locator('textarea');
    await ta.fill("{'a':1,'b':[2,3]}");
    await page.locator('.json-head .toolbar button', { hasText: '修复' }).click();
    await expect(L_COL(page).locator('.vbar')).toContainText('合法');
  });

  test('JSONPath 高亮：命中键在原文叠加黄色底纹', async ({ page }) => {
    await page.goto('/toolbox/json');
    const ta = L_COL(page).locator('textarea');
    await ta.fill('{"name":"guoxin","role":"admin"}');
    await L_COL(page).locator('.jp-input').fill('name');
    await L_COL(page).locator('button.jp-run').click();
    await expect(L_COL(page).locator('.jp-overlay .jp-hl').first()).toBeVisible();
  });

  test('历史：操作后可在历史弹窗看到记录', async ({ page }) => {
    await page.goto('/toolbox/json');
    const ta = L_COL(page).locator('textarea');
    await ta.fill('{"x":1}');
    await L_COL(page).locator('button.btn.primary', { hasText: '格式化' }).click();
    await page.locator('.json-head .toolbar button', { hasText: '历史' }).click();
    await expect(page.locator('.modal .hist-item').first()).toBeVisible();
  });

  test('分享：生成带 # 的分享链接并写入地址栏', async ({ page }) => {
    await page.goto('/toolbox/json');
    await page.locator('.json-head .toolbar button', { hasText: '分享' }).click();
    await expect(page).toHaveURL(/#/);
  });

  test('提取：JSONPath 命中结果写入对侧编辑区', async ({ page }) => {
    await page.goto('/toolbox/json');
    const ta = L_COL(page).locator('textarea');
    await ta.fill('{"items":[{"id":1},{"id":2}]}');
    await L_COL(page).locator('.jp-input').fill('items');
    await L_COL(page).locator('button.jp-run').click();
    await L_COL(page).locator('button.jp-extract').click();
    await expect(R_COL(page).locator('textarea')).toHaveValue(/"id"/);
  });

  test('小工具已迁为独立路由：/toolbox/base64 可独立打开并编码', async ({ page }) => {
    // JSON 页不再有「小工具」弹窗按钮；小工具经页头 Toolbox 悬浮子菜单或独立路由进入
    await page.goto('/toolbox/json');
    await expect(page.locator('.json-head .toolbar button', { hasText: '小工具' })).toHaveCount(0);
    // 经独立路由打开 Base64 小工具
    await page.goto('/toolbox/base64');
    await expect(page.locator('.tools-panel')).toBeVisible();
    await page.locator('.tools-in').fill('hello');
    await page.locator('.tools-pane button', { hasText: '编码' }).click();
    await expect(page.locator('.tools-out')).toHaveValue('aGVsbG8=');
  });

  test('结构对比：两侧差异以 key-path 列出', async ({ page }) => {
    await page.goto('/toolbox/json');
    await L_COL(page).locator('textarea').fill('{"a":1}');
    await R_COL(page).locator('textarea').fill('{"a":2,"b":3}');
    await page.locator('.json-head .toolbar button', { hasText: '结构' }).click();
    await expect(page.locator('.struct-diff').first()).toBeVisible();
    await expect(page.locator('.sd-line.sd-changed')).toContainText('$.a');
    await expect(page.locator('.sd-line.sd-added')).toContainText('$.b');
  });
});
