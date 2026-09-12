# 编码规范

> 状态：生效 | 维护者：仓库维护者 | 最后更新：2026-09-12
> 适用范围：guoxin.space 个人主页（Qwik ~1.20 + Qwik City SSG 静态站）。代码只进 `app/src/`。

本文件只覆盖 TypeScript / Qwik 约定。安全基线、CI 检测命令矩阵见 [AGENTS.md](../../AGENTS.md) 第三、四章（以要点引用，不重复大段）。旧站 `js/`、`css/`、`index.html` 已在 Qwik 重构中删除，回滚基线走 git 历史。

## 1. 强制规范（违反 = 阻断合入）

| # | 项 | 阈值 / 命令 | 来源与例外 |
|---|----|-------------|-----------|
| 1 | 格式化 | `npm run fmt`（`prettier --write app/src`）通过 | 仓库无 `.prettierrc`，走 prettier 默认（2 空格缩进、printWidth 80）；提交前必跑 |
| 2 | 静态检查 | `npm run lint`（`eslint app/src --ext .ts,.tsx`）通过 | 配置 `.eslintrc.cjs`：`eslint:recommended` + `plugin:@typescript-eslint/recommended` + `plugin:qwik/recommended`；禁用需 `// eslint-disable-next-line` + 理由 |
| 3 | 类型检查 | `npm run type-check`（`tsc --noEmit`）通过 | `tsconfig.json` `strict: true`（TS 5.5） |
| 4 | 行长度 | 团队目标 ~100 列；以 `npm run fmt` 实际折行为准 | 仓库无 `.prettierrc`，prettier 默认 printWidth=80，超长由 fmt 自动折行 |
| 5 | 缩进 | 2 空格；**禁止**空格与制表符混用 | prettier 默认 |
| 6 | 未使用 import | 禁止 | `@typescript-eslint/no-unused-vars`（`recommended` 集） |
| 7 | 文件编码 | UTF-8；允许中文注释 | 团队默认语言 |
| 8 | 文件长度 | ≤800 行（测试 ≤1600 行） | 非工具强制，建议拆分 |
| 9 | 函数长度 | ≤80 行（测试 ≤160 行） | 非工具强制，建议拆分 |
| 10 | 嵌套深度 | ≤4 层 | 非工具强制，建议早返回 |

> 第 8–10 项为人工审查建议，不阻塞 CI；第 1–3 项为提交门禁（CI + 本地 `pre-commit` 钩子按 AGENTS.md 描述会 `prettier --check`，但本仓库工作区未检出 husky/lint-staged 配置，以 `npm run fmt` 为准）。

## 2. 语言专项：TypeScript / Qwik

### 2.1 组件与状态（Qwik 心智，非 React）

- **组件必须用 `component$()` 包裹**，导出 P 组件（如 `PixelIcon` 在 `app/src/components/pixel/PixelIcon.tsx`）。
- **状态**：用 `useSignal` / `useStore`，禁止 React 的 `useState` / `useEffect`（`tsconfig` 已设 `jsxImportSource: "@builder.io/qwik"`，React 心智写法 TypeScript 层即报错）。
- **副作用**：
  - 用 `useTask$`（服务端/客户端均可运行、可追踪依赖）代替 `useEffect`。
  - `useVisibleTask$` 仅在必须访问真实 DOM/浏览器 API 时使用，且受 `qwik/no-use-visible-task` 规则约束（`plugin:qwik/recommended` 内置，warning 级）；能用 `useTask$` 就不开可见任务。
- **禁止**把同步渲染逻辑塞进 `useVisibleTask$` 制造水合负担（破坏 Qwik 的「可恢复」优势）。

### 2.2 样式（Tailwind + 设计系统）

- 工具类：Tailwind 3.4（`tailwind.config.js` content 指向 `app/src/**/*.{ts,tsx,html}`）+ `app/src/global.css` 设计系统。
- **设计真源 = 根目录 `DESIGN.md`**（9 章）：改视觉先改它，再同步 `global.css` 与组件类。
- 设计令牌用 CSS 变量（`--violet-*` / `--sky-*` / `--slate-*` / `--shadow-*`），组件不写死色值。
- 圆角只取 `10 / 12 / 14 / 16 / 999`；阴影一律偏移实心 `Npx Npx 0`（N∈1/2/3/4/6/8，禁模糊半径）；动效 `120–160ms ease-out`。
- 类前缀 `mc-*`（如 `.mc-container` / `.mc-card` / `.mc-nav` / `.mc-term`）。
- 全局 `.btn` 基类（Skills/JSON/Running 三页共用）**不得改动**；首页差异样式只在 `.mc-hero-cta .btn` 作用域内覆盖。

### 2.3 图标（PixelIcon 基因集）

- 像素图标统一用 `app/src/components/pixel/PixelIcon.tsx`：16×16 viewBox、纯 1×1 矩形 `path`、`shape-rendering="crispEdges"`、`fill="currentColor"`。
- 新增图标往 `ICONS`（`Record<PixelIconName, {d:string;o?:number}[]>`）加一项并扩展 `PixelIconName` 联合类型，**禁止引图标库**。
- 放大按 4 的倍数；`image-rendering: pixelated` 只给显式 `.pixelated` 类（Hero 水晶镐 `pickaxe.png` 不加，源图本身为像素方块风格）。

### 2.4 路径别名

- `tsconfig` `paths`: `~/*` → `src/*`；import 用 `~/` 别名，禁止凌乱相对路径穿越。

## 3. 命名规范

### 通用原则
- 名称语义清晰，避免无义简写（行业通用缩写除外：URL、ID、API、UUID、JSON）。
- **禁止**包/目录名：`common`、`util`、`misc`、`global`（多级如 `components/json/` 允许）。

### TypeScript / Qwik 约定
- 文件名：`kebab-case.ts(x)`（如 `pixel-icon.tsx`）。
- 函数 / 变量 / 信号：`camelCase`（`useSignal('x')` 的变量名亦同）。
- 组件 / 类型 / 接口：`PascalCase`（`PixelIcon`、`PixelIconName`）。
- 常量（含设计令牌键、枚举值）：`SCREAMING_SNAKE`（`ICONS`、`MAX_SAFE_INTEGER` 类语义）。
- 导出符号必须有文档注释（JSDoc `/** */`），说明 **Why** 而非 What；关键业务逻辑用中文注释。

## 4. Import 规范

- 顺序（空行分隔）：Node 内置 / 第三方（`@builder.io/qwik` 等）→ 本地（`~/` 别名）。
- **禁止**未使用 import（`@typescript-eslint/no-unused-vars`）。
- 别名仅用于命名冲突；Qwik 运行时符号一律来自 `@builder.io/qwik` / `@builder.io/qwik-city`。

## 5. 错误处理

- 错误必须处理或显式忽略（TS 中用 `void` / `_` 接收并附理由注释），**禁止**静默吞掉。
- **禁止**用 `throw` 控制正常业务流程；异常仅用于不变量断言/不可恢复错误。
- 外部输入（JSON 工具、URL 参数）必须校验后使用，输出按场景转义（HTML 编码等）。
- Qwik 路由/加载器层的错误走框架 error boundary，不在组件内裸 `try/catch` 吞错。

## 6. 资源管理（清理与订阅）

- 在 `useTask$` / `useVisibleTask$` 中注册的事件监听、定时器、订阅，**必须在返回的清理函数里解绑**（Qwik 的 task 返回值即 cleanup），避免泄漏。
- 文件、连接、Worker 消息通道等必须配对释放；无后端运行时依赖（静态站），需服务端逻辑走 Cloudflare Worker（独立仓库 `running-private`，见 `relationship.md`）。

## 7. 并发与副作用

- 共享可变状态用 `useStore`（Qwik 序列化安全），避免裸全局可变变量。
- **禁止** React 心智：`useEffect` / `useState` / `useRef` 替代方案即 `useTask$` / `useSignal` / `useStore`。
- `useVisibleTask$` 仅在确须真实 DOM 时使用；其存在会触发客户端水合，须评估必要性（`qwik/no-use-visible-task` 已设为 warning）。
- 闭包捕获循环变量用参数/局部变量传递，避免经典引用错位。

## 8. 类型与零值（strict 模式）

- `tsconfig` 已开 `strict: true`；**禁止** `any`（必要时用 `unknown` + 类型守卫）。
- 空值：优先 `undefined` 语义；可选属性用 `?`；禁止用 `null` 与 `undefined` 混用不统一。
- 字符串拼接循环内避免 `+` 长链；数字 ID（如 Running `run_id`）按**字符串**精确处理，禁止 `Number()` 转换（源数据超 `MAX_SAFE_INTEGER`）。
- 浮点比较用 epsilon，禁止 `==` 直比。

## 9. 代码风格

- 参数 ≤5 个，超出用对象封装。
- **优先早返回**（early return）减少嵌套；if-else 链 >3 段考虑 switch / 策略。
- 变量就近声明，第一次使用前定义。
- 倾向不可变：用 `const`，可变信号才用 `useSignal`；禁止无谓重新赋值。

## 10. 安全编码（语言层）

> 接口层/鉴权/SSRF 等见 [AGENTS.md](../../AGENTS.md) 第三章「安全基线」。静态站零后端运行时依赖。

- **【禁止】** 硬编码 AK/SK、密码、Token、内部 IP；敏感配置经 CI Secret 注入。
- **【必须】** 外部输入白名单校验（类型、长度、范围、格式）；HTML 输出对第三方数据编码。
- **【禁止】** `Math.random()` 用于安全场景；需用 CSPRNG（`crypto.getRandomValues`）。
- **【必须】** 加密/签名用标准库（Web Crypto），禁止自研算法。

## 11. 工具链（真实配置）

| 工具 | 命令 | 用途 | 触发时机 |
|------|------|------|----------|
| Prettier 3.3 | `npm run fmt` → `prettier --write app/src` | 自动格式化 | 保存 / 提交前（`pre-commit` 按 AGENTS.md 会 `--check`） |
| ESLint 8.57 + `eslint-plugin-qwik` ~1.20 + `@typescript-eslint` 6.21 | `npm run lint` → `eslint app/src --ext .ts,.tsx` | 静态检查 | pre-commit / CI；配置 `.eslintrc.cjs` |
| TypeScript 5.5（`tsc`） | `npm run type-check` → `tsc --noEmit` | 类型检查（strict） | 提交前 / CI |
| Vitest 1.6 | `npm run test` → `vitest run` | 单元测试（`app/src/lib/`） | 改逻辑后 |
| Vite 5.3 / Qwik build | `npm run build` | SSG 预渲染 4 页 | 发布前（需 Node ≥24 + `CODEBUDDY_SAFE_DELETE_ENABLED=0`） |

> 包管理：pnpm 9.15.0（禁用 npm / yarn，禁止提交 `package-lock.json`；本地无全局 pnpm 时用 `npm run build` 代替，不生成 lock）。

## 12. 禁止红线（引 AGENTS.md 第四章，以要点）

| # | 红线 | 后果 |
|---|------|------|
| 1 | 禁止 AI 主动读/参考其他 `.harness/plans/<其他任务>/` 的 md（任务隔离） | 单一真相源被污染 |
| 2 | 禁止改全局 `.btn` 基类（三页 28 处共用） | 按钮视觉一致性破坏 |
| 3 | 禁止全局 `img, canvas { image-rendering: pixelated }`，只给 `.pixelated` 类 | 精绘素材/缩略图锯齿 |
| 4 | 改 CSS 必须 `getComputedStyle` 在 `:hover`/`:focus-visible` 态回读（防同特异性后置覆盖） | 发版后才发现样式回退 |
| 5 | 本地构建必须 Node ≥24 + `CODEBUDDY_SAFE_DELETE_ENABLED=0`；CI 两 workflow 用 Node 24 且不写死 pnpm version | build 失败 / `ERR_PNPM_BAD_PM_VERSION` |
| 6 | 部署全自动：push `main` 即 Actions 构建上线（切流期例外：手动 `gh workflow run deploy.yml`） | 双轨冲突 / 线上不更新 |
| 7 | 禁止提交 `package-lock.json` / 用 npm 安装 | 与 `packageManager: pnpm@9.15.0` 冲突 |
| 8 | 换 Hero 主图必须同步 `index.tsx` 的 `width/height`（CLS 占位匹配宽高比） | 布局抖动 |
| 9 | 禁止新增 `/favicon.ico`（用 `app/public/favicon.svg`） | 404 控制台报错 |
| 10 | 改 Running 数据链路改 `running-private` 仓库，非本仓库 | 数据生产链路错位 |

## 13. 例外与豁免流程

如有充分理由违反上述规范：
1. 代码处加 `// eslint-disable-next-line <rule> -- 理由`（仅限 lint 类）。
2. 在 PR 描述说明影响面与缓解措施。
3. Reviewer 二次确认；红线（§12）级豁免须显式记录决策。

## 参考

- 仓库操作指南与红线全集：[AGENTS.md](../../AGENTS.md)（二/三/四章）
- 设计真源（视觉令牌、组件样式、Do/Don't）：[DESIGN.md](../../DESIGN.md)
- 测试断言规范：[unittest/unittest.md](unittest/unittest.md)
- Code Review 检查清单：[code-review.md](code-review.md)
- Qwik 官方文档（设计参考基准）：next.qwik.dev
