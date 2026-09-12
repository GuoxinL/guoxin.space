# 代码 Review 规范（团队人工 Review）

> 状态：草稿 | 维护者：guoxin | 最后更新：2026-09-12

## 边界与定位

本文件是 **团队人工 Review 流程**，与 AI 自动审查清单分工明确：

- **AI 代码审查清单**在 `.harness/review.md`（高/中/低严重度检查项、反馈模板）。该清单由 AI 工具在每次改动时生成，**请勿复制其内容到本文件**——本文件只在第 6 节给出链接与引用方式。
- 本文件只规定「人如何做人工评审」：提交方约束、提交方自查、Reviewer 清单、合入门槛。
- 本文件不定义 TAPD / MR 状态机。本项目是 GitHub 个人仓库，**无 TAPD、无强制 MR**。

## 范围

所有合入 `main` 的改动都建议经过人工 Review；AI 生成代码同样适用（且更需复查，见第 3 节「AI 幻觉专项」）。

本项目发布模型（证据 `deploy.yml`）：

- `push` 到 `main` 即自动构建并发布到 GitHub Pages，**无手动闸门**，push 即上线。
- 因此「Code Review」在本项目就是：**在 push main 之前自查**，或**开一个 GitHub PR 由他人做人工评审**后再合入 main。
- 推荐做法：非 trivial 改动开 PR（哪怕自己 merge），把 PR 链接/描述当作 Review 载体；紧急直推 main 后务必补说明。

## 1. 提交方约束

- ❌ 未自查（第 2 节清单未逐项过）就 push `main`
- ❌ 单次改动过大未拆分（建议按模块/页面拆，单 PR 改动尽量 < 500 行；SSG 站点尤其避免「顺手改一堆无关文件」）
- ❌ AI 代码未经理解就提交（提交者必须能回答："这段代码做了什么？为什么这样写？"）
- ❌ 删除已有测试（除非有明确理由并在 PR 描述中说明）
- ❌ 引入新依赖但 commit message 未说明理由
- ❌ 提交密钥/凭证/编译产物（`.env`、`*.key`、`*.pem`、`credentials.json`、`app/dist/`、`node_modules/`）
- ✅ PR 描述（或 push 前的自检说明）包含：背景、改动点、影响面、测试方式、回滚方案

> 回滚提示：本站点支持在 GitHub Pages Source 切回 `deploy` 分支秒级恢复旧站（见 `deploy.yml` 注释）；改坏时优先走此回滚，而非紧急反向 push。

## 2. 提交方自查清单（pre-commit / pre-push）

前置环境（证据 `deploy.yml` + `AGENTS.md`）：

```bash
export CODEBUDDY_SAFE_DELETE_ENABLED=0   # 否则 vite 清空 app/dist/ 被 safe-delete guard 拦截
# 并确保 Node ≥ 24
```

- [ ] `npm run build` 通过（Qwik SSG：client 构建 + SSR 预渲染）
- [ ] `npm run lint` 通过（`eslint app/src`，`.ts/.tsx`）
- [ ] `npm run fmt` 已格式化（`prettier --write app/src`）
- [ ] `npm run type-check` 通过（`tsc --noEmit`）
- [ ] `npm run test` 通过（`vitest run`，`app/src/lib` 约 110 个用例）
- [ ] 覆盖率：当前**无强制阈值**（TODO：后续建议接入 `vitest` coverage 并设最低线，如 PR 下降低于阈值即阻断）。新逻辑至少补对应用例，不靠「整体仍绿」掩盖回归。
- [ ] 无 `.env` / `*.key` / `credentials.json` / `app/dist/` / `node_modules/` 等被提交
- [ ] commit message 符合 Conventional Commits 格式（见第 3 节下方说明）
- [ ] 我**完全理解**这段代码做了什么（不是 AI 生成后未读直接提交）
- [ ] 引入/升级依赖已在 commit message 或 PR 描述说明理由，且 `package.json` 与 `pnpm-lock.yaml` 一致

### Commit Message 规范（真实约束）

由 `scripts/commit_msg_check.sh`（`commit-msg` git hook）校验。**需手动安装钩子**：

```bash
ln -sf ../../scripts/commit_msg_check.sh .git/hooks/commit-msg
```

格式：`<type>[optional scope]: <description>`

- 允许的 type：`feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `build` / `ci` / `chore` / `revert`（脚本另留 `other` 兜底，但优先用上述标准 type）
- scope 可选，建议带上模块，如 `style(hero):`、`ci(deploy):`
- 示例：`feat(hero): add AI-friendly badge` / `fix(parser): handle escaped quotes` / `ci(deploy): bump node to 24`

⚠️ **commit-msg 校验**：`scripts/commit_msg_check.sh`（经 `.git/hooks/commit-msg` 软链生效）仅校验 Conventional Commits 格式，**不要求** TAPD / 其他外部单号脚注；本地提交直接 `git commit` 即可，无需环境变量开关。

## 3. Reviewer 检查清单

> 这是人工评审视角。AI 自动审查的详细清单见 `.harness/review.md`，其产物作为**参考输入**，不替代本清单。

### P0（必查 / 阻断合入）

#### 业务正确性（面向 SSG 静态站）
- [ ] 改动符合需求，无范围蔓延
- [ ] 边界条件：空值、超长输入、未定义字段、列表为空、嵌套层级异常
- [ ] 渲染链路正确：组件 props / store 数据流符合实际（不臆想不存在的字段）
- [ ] 错误处理完整，无静默吞错（catch 后至少日志或兜底 UI）

#### 安全（前端相关）
- [ ] 无 XSS：用 `marked` 等渲染 Markdown/HTML 时确认输出已做转义/消毒，禁止未经处理的 `dangerouslySetInnerHTML`
- [ ] 无硬编码密钥、Token、密码、内部域名（构建期/运行期均不可）
- [ ] 若涉及外部输入（表单、URL 参数、fetch 响应），有基本校验与兜底
- [ ] 第三方脚本/资源引用走可信来源，无随意 `eval` / 远程代码注入风险

#### 资源与产物安全
- [ ] 无未释放的订阅 / 定时器 / 事件监听（Qwik 用 `useVisibleTask$` 等需成对清理）
- [ ] 无内存泄漏（全局缓存、闭包引用）
- [ ] 构建产物不含敏感文件，`app/dist/` 未被误提交

#### 测试
- [ ] 新代码有测试覆盖（正常 + 边界 + 异常），集中在 `app/src/lib`
- [ ] 断言有效（非仅判断字符串存在）
- [ ] 修改逻辑必须同步调整对应单元测试

### P1（推荐 / 强烈建议）

- [ ] 命名一致、注释解释 Why 而非 What
- [ ] 函数职责单一、嵌套不过深、行长合理（遵循 Prettier/ESLint 配置）
- [ ] 无明显坏味道（重复逻辑、过长参数、上帝组件）
- [ ] 性能与体积：避免不必要的大依赖引入、注意 bundle 体积与 SSG 预渲染成本
- [ ] 可访问性 / SEO：关键页面有语义化标签、meta、alt 文本
- [ ] Qwik 规范：信号/状态用 Qwik 原语（`useSignal$` / `useStore$` / `component$`），避免破坏细粒度响应式
- [ ] 依赖版本与 `package.json` / `pnpm-lock.yaml` 一致

### AI 幻觉专项（本项目重点）

> AI 生成代码占比高，必须额外检查：

- [ ] 引用的 Qwik / Qwik City API（`component$`、`routeLoader$`、`useVisibleTask$` 等）**真实存在**且版本匹配 `@builder.io/qwik ~1.20.0`
- [ ] 第三方库用法与 `package.json` 依赖版本一致（如 `marked@9`、`js-yaml@5`、`jsonpath-plus@10`）
- [ ] 没有"看起来对但实际不存在"的导入或字段
- [ ] 业务逻辑符合实际数据流（不是 AI 想象的页面结构）
- [ ] 关键魔术值（超时、限制、重试次数）有依据，非凭空填的"合理数字"
- [ ] 若引用类型/常量，确认来自 `app/src` 内真实定义

### 可选（按场景）

- [ ] 国际化：硬编码文案是否应提取
- [ ] 兼容性：依赖升级、构建产物对旧浏览器影响
- [ ] 文档：`AGENTS.md` / `docs/` / `README` 是否同步更新

## 4. Review 回复礼仪

- 区分严重程度：
  - `must-fix`（阻断）
  - `should-fix`（强烈建议）
  - `nice-to-have`（可选改进）
  - `nit`（鸡毛蒜皮，不阻塞合入）
  - `question`（澄清，提交者必须回应）
- 给出**具体修改建议**而非"这写得不好"
- 提交者：每条评论必须回应（采纳 / 解释 / 暂缓 + 跟进 issue）
- 评论无回应、无修改不能合入

## 5. 合入门槛

- 关键改动建议 ≥ **1** 名 Reviewer 批准（本项目多为单人维护，可由作者开 PR 自审 + 备注，或邀请协作者评审）
- 本地四项全绿：`build` / `lint` / `type-check` / `test`（CI 中 `build` 由 `deploy.yml` 在 push main 后跑；push 前务必本地先过）
- 所有 `must-fix` 已解决
- 无未回复的 `question`
- 无安全告警（XSS / 密钥泄露 / 依赖漏洞）
- **合入即上线**：合入 `main` 后 `deploy.yml` 自动发布，确认预览无误再视为完成

## 6. AI 辅助 Review

- AI 审查清单与反馈模板见 [`.harness/review.md`](../review.md)，可作每次改动的初步审查输入。
- AI 报告作为**参考输入**，**不替代**人工 Review。
- 人工 Review 必须由非提交者（或开 PR 后的第二人）进行，作者不应只靠 AI 报告自认通过。

## 7. 紧急合入流程（hotfix）

- 仅限：线上站点损坏、安全漏洞、强制下线
- 允许直推 `main`（因 push 即上线），但必须：
  - 事后在 PR 描述 / commit message 补「背景 + 改动 + 回归验证」
  - 若影响范围大，24 小时内补回归说明
  - 严重事故记录到 [failures.md](failures.md)（如存在）

## 参考

- AI 代码审查清单（人类与 AI 共用）：[`../review.md`](../review.md)
- 构建/发布流水线：`.github/workflows/deploy.yml`
- commit message 校验脚本：`scripts/commit_msg_check.sh`
- 项目说明与本地构建踩坑：`AGENTS.md`
