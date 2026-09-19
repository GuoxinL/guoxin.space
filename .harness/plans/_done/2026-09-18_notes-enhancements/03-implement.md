# 03. Implement

> **目的**：按 Plan 写代码，记录与 Plan 偏离的决策。
> **输入**：`02-plan.md`
> **输出**：代码改动 + 本文件（不复制代码，只记录决策与检查）
> **TDD 模式**：本阶段按 `02-plan.md §6` 的用例先写 UT 跑红（Red）→ 写最小实现转绿（Green）→ 在 UT 保持绿的前提下重构（Refactor）；UT/IT 边界与红绿循环约束详见 `04-ut.md` §0.5。

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

> 本步骤结束确认前，逐条核对以下约束；冲突以 CONSTRAINTS.md 为准。
- 架构：C-01（无后端/DB/MQ）、C-02（只改 `app/src`）、C-04（Running 走 Worker 代理）、C-43（需服务端走 Cloudflare Worker）
- 构建：C-05（Node≥24）、C-06（`CODEBUDDY_SAFE_DELETE_ENABLED=0`）、C-08（pnpm，禁 `package-lock.json`）
- 编码红线：C-21（`.btn` 基类不可改）、C-22（`.pixelated` 类限定）、C-23（改 CSS 须 hover 态回读）、C-27（换 Hero 主图同步 width/height）、C-28（禁新增 `/favicon.ico`）、C-30（禁 `any` / `run_id` 按字符串）、C-31（Qwik 原语）、C-32（错误处理/输入校验）、C-33（资源清理）
- 设计系统：C-34（去容器化）、C-35（圆角令牌 10/12/14/16/999，容器 0）、C-36（偏移实心阴影）、C-37（动效 120–160ms）、C-38（CSS 变量 / `mc-` 前缀）、C-39（版面宽度单点 `--container-w`）、C-40（PixelIcon 禁图标库）、C-41（Hero 主图 `pickaxe.png`）
- 安全：C-49（无硬编码密钥）、C-50（输入校验/输出转义）、C-51（标准库加密）

---

## 1. 实现要点

> 逐文件记录**关键**实现细节。不要复制代码；只写**为什么这么写**、**踩过什么坑**、**特殊处理**。

### 1.1 `<文件路径>`

- 关键逻辑：
- 特殊处理：
- 兼容性考虑：
- 引用 / 参考：

### 1.2 `<文件路径>`

<!-- 重复 -->

## 2. 与 Plan 的差异

> 如果实现过程中偏离了 `02-plan.md`，必须在此记录原因，并回头同步更新 Plan 文档。

| # | 偏离项 | 原因 | 已同步更新 02-plan.md |
|---|--------|------|------------------|
|  |  |  | ⬜ 是 |

## 3. 代码自检清单

> 提交前 AI / 开发者自检，打钩才能进入 UT。

### 3.1 通用 / 安全

- [ ] 无硬编码凭证 / Token / 密码（密钥只经 CI Secret 注入，不进前端 bundle）
- [ ] 外部输入（JSON 工具 / URL 参数 / fetch 响应）均有校验，输出按场景转义（禁未处理 `dangerouslySetInnerHTML`）
- [ ] 错误路径有处理或显式忽略（附理由），无静默吞；`throw` 不用于控制正常流程
- [ ] 依赖隔离：外部调用（Worker / fetch）放在 `lib/` 封装层，业务组件不直连

### 3.2 并发 / 性能（SPA 单线程）

- [ ] 共享可变状态用 `useStore`（Qwik 序列化安全），避免裸全局可变变量
- [ ] 重计算（大 JSON 解析 / 轨迹解析）保持纯函数放 `app/src/lib/*`，避免在渲染期阻塞主线程
- [ ] 外部调用（Worker）有超时 / 降级处理
- [ ] 无死循环 / 无无界递归

### 3.3 风格 / 工具（Qwik + TS）

- [ ] `npm run lint` 通过（`eslint app/src`）
- [ ] `npm run fmt` 已格式化（`prettier --write app/src`）
- [ ] `npm run type-check` 通过（`tsc --noEmit`，strict）
- [ ] 无未使用 import / 变量
- [ ] 组件用 `component$()`；状态 `useSignal`/`useStore`；副作用 `useTask$`，`useVisibleTask$` 仅必要时
- [ ] 事件监听 / 定时器 / 订阅在 task 返回的清理函数解绑

## 4. 代码检查记录

```bash
npm run lint        # ESLint
npm run fmt         # Prettier（提交前必跑）
npm run type-check  # tsc --noEmit
npm run test        # vitest（改 lib 必跑）
```

| 检查项 | 结果 | 备注 |
|--------|------|------|
| Lint | ⬜ 通过 / 失败 |  |
| Format | ⬜ 通过 / 失败 |  |
| 类型检查 | ⬜ 通过 / 失败 |  |
| 单测 | ⬜ 通过 / 失败 |  |

---

## 决策框架

1. **最小改动原则**：现有模式能满足，就不要引入新模式 / 新依赖（包管理统一 pnpm，禁引图标库）。
2. **先错误路径，后成功路径**：错误处理往往是 bug 温床，优先想清楚。
3. **依赖隔离**：外部调用（Worker / fetch）放在 `lib/` adapter 层，组件不直接 `fetch` 裸调。
4. **设计优先**：改视觉先改 `DESIGN.md` 再同步 `global.css`；违反设计令牌（圆角/阴影/动效）即不合格。

## 反例

❌ **改业务代码迎合测试** → 单测测的是现有行为。测试跑不过，要么改测试（若行为本来就错，需文档记录），要么发现了真 bug（开新任务修）。
❌ **日志只打 "error" 无上下文** → 应带关键状态（如 `console.error('json parse failed', { input, stage, err })`），想象半年后的你能否定位。
❌ **捕获异常不处理**（`catch { }`） → 要么让它抛出，要么有明确恢复逻辑 + 日志。静默吞异常是隐患。
❌ **改 CSS 只测静止态** → 同特异性后置规则会静默覆盖；必须 `getComputedStyle` 在 `:hover`/`:focus-visible` 回读。

---

## 完成标志

- [ ] 所有改动文件已实现
- [ ] 与 Plan 偏离项已记录并同步 Plan 文档
- [ ] 代码自检全部通过（§3.1~3.3）
- [ ] Lint / Format / type-check / test 工具通过
- [ ] 约束自查（§0）已逐条核对
- [ ] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [ ] 已与用户完成结束确认
