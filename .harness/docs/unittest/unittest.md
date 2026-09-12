# 单元测试规范（TypeScript / Qwik / Vitest 环境 · 生成 · 运行调试）

> 让任意成员（或 AI Agent）能在本地把单元测试**装得起、写得对、跑得通、出错查得到**。
> 三段式结构：① 环境搭建 / ② 生成规范 / ③ 运行调试。
>
> 本项目是 Qwik SSG 静态站，测试运行器为 **Vitest**（非 Go `go test`）。原 Go 模板不适用，已按 TS/Qwik 适配。

> Source: `package.json`（scripts.test / devDependencies.vitest）、`vite.config.ts`（test.include）、`app/src/lib/*`
> Last-verified: 2026-09-12

---

## 一、环境搭建与依赖安装

### 0. 技术选型（TypeScript / Qwik）

| 类别 | 推荐 | 备注 |
|------|------|------|
| 测试 runner | **`vitest`**（Vite 原生，零额外配置）| `package.json` `test: "vitest run"` |
| 断言 | **Vitest 内置 `expect`**（基于 Chai） | 无需额外断言库 |
| Mock | **`vi.fn()` / `vi.mock()`**（Vitest 内置） | 模块级 `vi.mock` 自动提升 |
| 覆盖率 | **`vitest --coverage`**（v8 `:@vitest/coverage-v8`）| 当前**未设强制阈值**（标 TODO） |
| 类型 | TypeScript 5.5，strict | `tsc --noEmit` 另跑 |

### 1. 前置依赖检查清单

```bash
# (1) Node 版本（本地与 CI 一致，必须 ≥24；本机 nvm default=24）
node -v

# (2) 依赖是否已装
test -d node_modules/vitest && echo "vitest OK" || echo "需要 pnpm install"

# (3) 测试文件是否存在
ls app/src/lib/*.test.ts 2>/dev/null && echo "tests OK" || echo "暂无单测"
```

### 2. 安装（通常只需一次）

```bash
# 本地无全局 pnpm 时：
pnpm install          # 或 npm install（不生成 lock，见 AGENTS.md 红线）
```

### 3. 环境变量

| 变量 | 用途 | 示例 |
|------|------|------|
| `CODEBUDDY_SAFE_DELETE_ENABLED` | 构建相关，测试一般不需；但 CI build 前置 | `0` |
| `NODE_ENV` | 控制测试环境分支 | `test` |

---

## 二、单元测试生成规范

### 1. 通用强制条款（红线）

| # | 红线 |
|---|------|
| 1 | 不修改被测业务代码以让测试通过 |
| 2 | 不调用真实外部服务 / 真实网络；用 `vi.mock` 桩掉（`jsonpath-plus`、fetch、Worker 等） |
| 3 | 不在测试间共享可变状态 / 不依赖执行顺序；每个用例独立 |
| 4 | 不删除已有测试，只追加 |
| 5 | 不硬编码环境信息（域名 / 路径 / 凭证） |

### 2. 测试类型与适用

| 类型 | 适用 | 位置 | 风格 |
|------|------|------|------|
| 纯函数单测 | `app/src/lib/` 下工具（json.* / auth / skills / running） | 同目录 `*.test.ts` | `describe` + `it` + `expect` |
| 组件单测 | Qwik 组件渲染（如需） | `*.test.tsx` + `@builder.io/qwik` 测试工具 | 见 Qwik 文档 |
| 模糊 / 边界 | 解析类输入不可信路径 | 表驱动 `it.each` | 覆盖空 / nil / 极值 / 非法 |

### 3. 文件命名与组织

- 测试文件与被测文件**同目录同包**，`*.test.ts` 后缀（Vitest 默认 `include: app/src/**/*.{test,spec}.{ts,tsx}`）。
- 一个被测模块的多个场景统一放进同一 `*.test.ts`；新增 → 追加 `it`，不新建并列文件。
- 表驱动：`it.each(cases)(...)` 覆盖多用例。
- Mock：依赖外部模块用 `vi.mock('module')`；函数用 `vi.fn()`。

### 4. Mock 策略

| 类别 | 默认策略 |
|------|---------|
| 项目内纯函数（utils / 校验器） | 允许真实调用（不 mock） |
| 外部依赖（fetch / Worker / `jsonpath-plus` 等） | 必须 `vi.mock` 桩掉 |
| 时间 / 随机 | `vi.useFakeTimers()` / 注入固定值 |

### 5. 用例设计自检

> 每个用例至少覆盖：正常路径、边界值（空 / 零 / 最大）、错误路径（依赖抛错时上层处理）、幂等性。

---

## 三、运行与调试

### 1. 标准执行命令

```bash
# 全量（CI 用）
npm run test                 # = vitest run

# 监听模式（本地开发）
npm run test.watch           # = vitest

# 指定文件 / 用例
npx vitest run app/src/lib/json.diff.test.ts
npx vitest run -t "format"

# 带覆盖率
npx vitest run --coverage
```

> 本地命令必须与 CI 一致（CI 已在 `deploy.yml` build job 跑 `pnpm test` 作为门禁；本地改动 `lib/` 后必跑）。

### 2. 调试套路

| 现象 | 优先排查 |
|------|---------|
| 全量失败 | 依赖未装 / Node 版本不符（本地与 CI 一致，需 ≥24）|
| 单文件失败 | 隔离复现 `vitest run <file>` |
| Mock 未生效 | `vi.mock` 是否提升到文件顶、路径是否匹配 |
| 覆盖率不达标 | `vitest run --coverage` 看未覆盖行 |

### 3. 不要 / 慎用

| 项 | 原因 |
|----|------|
| `vi.mock` 写在用例内部且依赖提升顺序 | 模块 mock 必须文件顶层 |
| 测试依赖真实网络 / Worker | 慢、不稳定、CI 无法复现；一律 mock |
| `console.log` 大量调试 | 用 `expect` 断言替代 |

### 4. 测试产物

| 产物 | 路径 | 用途 |
|------|------|------|
| 覆盖率 | `coverage/` | `vitest run --coverage` 输出 |
| 终端摘要 | stdout | 通过 / 失败 / 耗时 |

### 5. CI 集成

- 已在 `deploy.yml` 的 build job 落地 `npm run test` 强制门禁（CI 双门禁之一；另一道为 `npm run test:e2e`，见 `integration_test.md` §5）。改 `app/src/lib/` 后本地必跑。
- 失败必须阻塞合入（push main 即上线，单测是最后防线）。
- 覆盖率门槛：当前无强制阈值，建议后续加（标 TODO）。
