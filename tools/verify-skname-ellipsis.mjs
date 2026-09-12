// 实机校验 .sk-name-text 单行省略号是否生效（Qwik SSG 产物 + Playwright chromium）
// 迁移自 puppeteer-core 版本：统一使用 Playwright（@playwright/test 导出的 chromium）。
// 用法：npx playwright install chromium 后，`node tools/verify-skname-ellipsis.mjs`
//       （VERIFY_URL 可指向本地 dist 服务或已部署站点）
import { chromium } from '@playwright/test';

const URL = process.env.VERIFY_URL || 'http://127.0.0.1:4321/skills/';
const LONG =
  '超长技能名称测试用来验证单行省略号是否生效的超长文本超长技能名称测试用来验证单行省略号是否生效的超长文本';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.sk-name-text', { timeout: 10000 }).catch(() => {});

const result = await page.evaluate((LONG) => {
  let el = document.querySelector('.sk-name-text');
  const created = !el;
  if (!el) {
    // 页面无真实卡片时，动态构造附属正确 class 的结构以验证 CSS 规则生效
    const wrap = document.createElement('div');
    wrap.className = 'sk-card';
    wrap.style.width = '320px';
    wrap.style.maxWidth = '320px';
    const body = document.createElement('div');
    body.className = 'sk-body';
    const name = document.createElement('div');
    name.className = 'sk-name';
    el = document.createElement('span');
    el.className = 'sk-name-text';
    name.appendChild(el);
    body.appendChild(name);
    wrap.appendChild(body);
    document.body.appendChild(wrap);
  }
  el.textContent = LONG;
  const cs = getComputedStyle(el);
  const overflowing = el.scrollWidth > el.clientWidth + 1;
  const lineH = parseFloat(cs.lineHeight) || 24;
  const singleLine = el.getBoundingClientRect().height <= lineH + 2;
  return {
    created,
    textOverflow: cs.textOverflow,
    whiteSpace: cs.whiteSpace,
    overflow: cs.overflow,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    overflowing,
    singleLine,
    rectHeight: Math.round(el.getBoundingClientRect().height),
  };
}, LONG);

await page.screenshot({
  path: '/Users/guoxin/code/github/guoxin.space/docs/skname-verify.png',
  fullPage: false,
});
await browser.close();

// 判定：省略号样式生效 + 超长文本确实被截断 + 不换行
const ok =
  result.textOverflow === 'ellipsis' &&
  result.whiteSpace === 'nowrap' &&
  result.overflow === 'hidden' &&
  result.overflowing &&
  result.singleLine;
console.log(JSON.stringify({ ok, result, errors }, null, 2));
process.exit(ok ? 0 : 2);
