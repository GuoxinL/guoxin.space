# MINI 极简任务模板（小需求专用）

> 状态：生效 | 维护者：仓库维护者 | 最后更新：2026-09-19 | 适用范围：纯文案 / 纯 CSS 微调 / 单文件 ≤10 行改动
> **不是 SOP 检查清单的替代品**，而是其减重版：改动 ≤10 行、单文件、无需 UT/IT 全套、无新设计时，用本模板替代 `SOP.md` 全套流程。
> 硬约束仍以 `.harness/docs/CONSTRAINTS.md` 为准；设计仍锚定根 `.harness/docs/design.md`（不新建设计稿）；被委托 AGENT 须遵守 C-56 五道闸。

---

## 1. 目标（一句话）

> 

## 2. 改动文件清单

| 文件 | 改动类型 | 行数 | 说明 |
|------|---------|------|------|
|  | 新增 / 修改 / 删除 | ≤10 |  |

> ⚠️ **退出条件**：改动 >10 行、跨文件、或需新增 lib 逻辑（TDD）→ **放弃 MINI**，走 `SOP.md` 全套流程。

## 3. 约束自查（C 条目）

> 列出本改动触及的 C 条目（如 C-01 只改 `app/src/`、C-55 单文件 ≤600 行、C-34~C-41 设计系统）；冲突以 `CONSTRAINTS.md` 为准。

- [ ] 

## 4. 设计决策（默认沿用 .harness/docs/design.md）

- [ ] 沿用 .harness/docs/design.md（无新设计）；若涉及新视觉 / 新令牌 → 回写根 `.harness/docs/design.md`（C-34~C-41），不另立设计稿

## 5. 改动内容（diff 思路 / 关键点）

> 简述改了什么、为什么，附关键片段或行号。

## 6. 自验

- [ ] 构建：`npm run build` 通过（改 `app/src/` 时；需 `Node ≥24` + `export CODEBUDDY_SAFE_DELETE_ENABLED=0`）
- [ ] 单测 / E2E：受影响用例通过（改 `lib/` 必跑 `npm run test`；改页面 / CSS 必跑 `npm run test:e2e`）
- [ ] **本地沙箱 e2e 配方**（被委托 AGENT 必读，C-56）：同一 shell 内起服 → 跑测 → kill，避免 4321 webServer 120s 超时空转——

  ```bash
  node tools/serve-pages.mjs 4399 app/dist & SRV=$!
  sleep 3
  BASE_URL=http://127.0.0.1:4399 npx playwright test
  kill $SRV
  ```

## 7. 委托回报（若由独立 AGENT 执行，填 C-56 交回契约）

- 改动文件：
- 测试结果：
- 未覆盖行：
- 阻塞项：
- 越界声明：

## 8. 收尾

- [ ] 提交（纯 md / 文案 / CSS 可 `[skip ci]`；改代码须走 CI，勿用 `[skip ci]`）
- [ ] 推送 `main` → 触发 Pages 自动部署（部署结论查 `gh run list --workflow=deploy.yml`）

---

## 总 Checklist

- [ ] 目标一句话明确
- [ ] 改动 ≤10 行 / 单文件（否则退回 `SOP.md` 全套流程）
- [ ] 约束自查覆盖触及的 C 条目
- [ ] 设计沿用 .harness/docs/design.md（或已回写，未另立设计稿）
- [ ] 构建 / 单测 / E2E 通过（沙箱 e2e 走配方）
- [ ] 收尾提交 + 推送（CI 策略正确）
