# 代码 Review 指南

> AI 与人类 Reviewer 共同遵守的检查清单。
> **项目适配（guoxin.space）**：Qwik SSG 静态站——无后端 / DB / MQ，服务端能力走 Cloudflare Worker（`worker.js`，独立部署）。原通用模板中的 SQL / 事务 / trace_id / 监控告警等检查项已按静态站等价物替换。

---

## 分类与优先级

| 严重度 | 说明 | 处理 |
|--------|------|------|
| 🔴 高（阻塞） | 安全漏洞、XSS、密钥泄露、数据丢失风险、部署链路破坏、性能明显回归 | 必须修复才能合入 |
| 🟡 中 | 可测性差、边界漏判、错误处理缺失、命名混乱 | 需修复或明确记录 |
| 🟢 低 | 风格建议、重构空间、文档补全 | 可选 |

---

## 必查项（高严重度）

### 安全
- [ ] 无硬编码密钥、Token、密码、内部 IP；敏感配置只经 CI / Worker Secret 注入，不进前端 bundle（`app/dist`）
- [ ] 输入校验覆盖所有外部来源（JSON 工具输入、URL 参数、Worker fetch 响应），有兜底不裸崩
- [ ] 输出按场景转义：Markdown/HTML 渲染（`marked` 等）确认消毒，**禁止未处理的 `dangerouslySetInnerHTML`**
- [ ] 加密 / 签名用标准库（Web Crypto），禁止自研算法；`Math.random()` 不用于安全场景（用 `crypto.getRandomValues`）
- [ ] 第三方脚本 / 资源引用走可信来源，无 `eval` / 远程代码注入风险

### 正确性
- [ ] 边界条件覆盖（空、单元素、超长、非法 JSON、嵌套异常、列表为空）
- [ ] Qwik 心智正确：组件 `component$()`、状态 `useSignal`/`useStore`、副作用 `useTask$`（`useVisibleTask$` 仅真 DOM 需要时），无 React 写法
- [ ] 事件监听 / 定时器 / 订阅在 task 清理函数中解绑，无内存泄漏（全局缓存 / 闭包引用）
- [ ] Worker / 外部调用有超时与降级（不可达时给用户可读提示，页面不白屏）
- [ ] 数字 ID（如 `run_id`）按字符串处理，无 `Number()` 精度转换

### 可观测性（静态站等价物）
- [ ] 浏览器控制台零报错、零异常 404（favicon / 资源路径）
- [ ] 关键交互有 Playwright e2e 断言（DOM / 交互态），改 CSS 用 `getComputedStyle` 在 `:hover`/`:focus-visible` 回读
- [ ] 外部依赖（Worker / running-private）不可达时页面有降级提示，不静默空白

---

## 常规检查项（中严重度）

### 可测性
- [ ] 新逻辑有对应 UT（`app/src/lib/` + 组件测试，当前 9 文件 / 136 用例）
- [ ] 断言有效（非仅判断字符串存在 / 状态码）；用例独立、全 Mock 外部依赖
- [ ] 无隐藏的全局可变状态（共享状态走 `useStore`）

### 可维护性
- [ ] 命名清晰，避免缩写歧义
- [ ] 函数短、职责单一；相同逻辑出现 3 次以上必须抽象
- [ ] 样式走设计令牌（CSS 变量 + `mc-` 前缀），不写死色值；未改全局 `.btn` 基类

### 兼容性
- [ ] Worker URL / API 契约变更向后兼容（新增字段可选，旧客户端不炸）
- [ ] 依赖版本与 `package.json` / `pnpm-lock.yaml` 一致；无 lock 外新增包
- [ ] 旧路由跳转（`/json` → `/toolbox/json` 元刷新）不被破坏

---

## 建议项（低严重度）

- [ ] 注释说明「为什么」而非「是什么」
- [ ] 文档同步更新（`AGENTS.md` / `DESIGN.md` / `.harness/docs/` 对应文件 / plans 产物）
- [ ] 测试数据逼真；新图标进 `PixelIcon` 的 `ICONS`（不引图标库）

---

## Review 反馈模板

```
[严重度] [文件:行号] 问题简述

详细说明：

建议修改：

```
