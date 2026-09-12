import { defineConfig, devices } from '@playwright/test';

/**
 * 页面自动化测试配置（guoxin.space · Qwik SSG 静态站）
 *
 * - webServer：自动用 `python3 -m http.server` 静态服务 `app/dist`
 *   （先在 build job / 本地 `npm run build` 产出）。目录路径行为与生产 GitHub Pages
 *   一致（/running → 301 → /running/ → index.html）。
 *   ⚠️ 不能用根 vite.config.ts 直接 `vite preview`——Qwik 插件会接管 preview 并要求
 *   entry.preview 构建，对全部请求回 400；vite preview 的 spa fallback 还会把
 *   /running 等无扩展名路径回退到首页 index.html。
 *   CI 下自带启动；本地若已手动起同款静态服务占住 4321，可只跑 `npm run test:e2e` 复用。
 * - baseURL：默认 `http://127.0.0.1:4321`（python 服务绑定 IPv4 回环）；设 `BASE_URL`
 *   环境变量可指向已部署站点做线上复验，例如
 *   `BASE_URL=https://guoxin.space npx playwright test`（此时不启动本地 webServer）。
 * - 用例里用 `page.goto('/')` 相对路径即可，自动拼 baseURL。
 * - 失败自动留截图 + trace（only-on-failure），便于追溯。
 *
 * 规范见 `.harness/docs/integration_test/integration_test.md`。
 */

const PORT = 4321;
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const isRemote = Boolean(process.env.BASE_URL);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // 仅本地/CI 起服务；BASE_URL 指向远程站点时不启动 webServer
  ...(isRemote
    ? {}
    : {
        webServer: {
          command: `python3 -m http.server ${PORT} --bind 127.0.0.1 --directory app/dist`,
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'ignore',
          stderr: 'pipe',
        },
      }),
});
