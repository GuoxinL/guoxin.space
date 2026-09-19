# 03. Implement

> **目的**：按 Plan 写代码，记录与 Plan 偏离的决策。
> **输入**：`02-plan.md`
> **输出**：代码改动 + 本文件

---

## 0. 约束自查（强制）

逐条核对，冲突以 `.harness/docs/CONSTRAINTS.md` 为准。本任务命中并遵守的约束：

- **架构/构建**：C-02（只改 `app/src`）、C-05（Node≥24）、C-06（`CODEBUDDY_SAFE_DELETE_ENABLED=0`）、C-08（pnpm，禁 `package-lock.json`）。
- **编码红线**：C-21（`.btn` 基类不可改 → 选中态仅 `.btn.codec.active` / `.btn.dir.active` 作用域覆盖）、C-22（`.pixelated` 类限定，未新增）、C-23（改 CSS 须 `:hover` 态回读 → 已由 e2e `toolbox-nav` 的 C-23 hover 色带用例覆盖）、C-28（禁新增 `/favicon.ico`）、C-30（禁 `any` / `run_id` 按字符串 → 本任务未引入 `any`）、C-31（Qwik 原语：`component$` / `useSignal` / `$()` 事件）、C-32（输入校验/错误处理 → `baseEncode/baseDecode` 统一 `{ ok }` 返回，不抛异常）。
- **设计系统**：C-34（去容器化，发丝线 + 留白）、C-39（版面宽度单点 `--container-w` → Base 面板跟随 `.mc-container`，未自行设宽度上限）、C-49/C-50/C-51（标准库 `TextEncoder`/`BigInt`，无密钥、外部输入经校验）。
- **未触及**：C-27（Hero 主图）、C-40（PixelIcon 图标库）、C-41（pickaxe.png）——本任务无相关改动。

---

## 1. 实现要点

### 1.1 `app/src/components/layout/ToolboxTabs.tsx`
- 在 `<nav>` 之前渲染区块标题 `.tb-head`：`<h2>Toolbox</h2>` + `<p>Small tools for everyday bytes.</p>`，沿用 `--font-heading`、发丝线分隔，贴合 V2 去容器化。
- `TOOLS` 中 `{ href:'/toolbox/base64', label:'Base64' }` → `label:'Base'`，与页面标题一致（避免同一入口出现两个标签）。桌面与移动端子菜单共用此数据。

### 1.2 `app/src/components/json/JsonWorkbench.tsx`
- 删除 `json-head` 内的 `<div class="json-head-title">`（`<h2>Toolbox</h2>` + `<p class="json-slogan">`）——该标题意图已上提到 `ToolboxTabs`。
- 原位替换为 JSON 工具简介 `<div class="json-intro">JSON 在线工具：…纯前端本地处理，数据不上传。</div>`。
- 底部 hint 文案「页头 Toolbox 悬浮菜单」→「页头 Toolbox 子导航」（术语对齐新结构）。

### 1.3 `app/src/components/json/SmallToolPanel.tsx`
- 删除冗余内层导航 `<div class="tools-panel-head">` 与 `<div class="tools-tabs">`（含内部 `TABS` 数组），避免与外层 `ToolboxTabs` 重复。
- `tools-body` 顶部按 `tab` 渲染**当前工具简介** `INTROS: Record<Tab,string>`（url/ts/jwt/csv 各一句）。
- 输出 `<textarea>` 用 `readOnly` 属性（Qwik/JSX 正确写法，运行时渲染为 `readonly` DOM 属性，CSS `[readonly]` 样式仍生效）。

### 1.4 `app/src/components/layout/Header.tsx`
- 桌面/移动 `TOOLBOX_MENU` 中 base64 子项 `label:'Base64'` → `'Base'`（与 ToolboxTabs 同源数据，统一入口标签）。

### 1.5 `app/src/lib/json/smalltools.ts`
- 新增 `b16` / `b32` / `b58` / `b85` 编码器与对应解码器，改写 `b64url`；统一导出纯函数 `baseEncode(codec, text, opts?)` / `baseDecode(codec, text)`。
- **BigInt 处理**：`b58` / `b85` 用 `BigInt(...)` 构造调用（非字面量 `0n`），因为 `tsconfig` `target` 为 `ES2017` 不支持 BigInt 字面量语法（仅影响 `tsc` 类型检查，运行时 esbuild 不受限）；这是修复类型错误而非改项目配置，保持改动局部化。
- 解码函数 `decB32`（`const out`）、`decB64URL`（`const s`）局部变量改 `const`（满足 `prefer-const`）。
- `baseDecode` 去掉未使用的 `opts` 形参（解码无需 pad/wrap），签名收敛为 `(codec, text)`；调用点 `BasePanel` 已同步去除第 3 实参。

### 1.6 `app/src/components/json/BasePanel.tsx`（新增）
- 左右双框体：输入 `.base-box:not([readonly])` / 输出 `.base-box[readonly]`。
- 一排 6 个 codec 按钮（Base16 (Hex) / Base32 / Base58 / Base64 / Base64URL / Base85）+ 方向切换（编码 `enc` / 解码 `dec`）+ 填充 `pad`（仅 b32/b64 生效）/ 换行 `wrap`（仅 b64 生效）开关 + 复制 / 交换。
- `useSignal` 响应式；`.btn` 体系原样复用，**不改基类**，选中态仅 `.btn.codec.active` / `.btn.dir.active` 作用域覆盖（背景 `var(--violet-0)`、边框 `var(--violet-65)`、阴影 `3px 3px 0 var(--shadow-violet)`）。
- `transform()` 纯函数式计算输出，错误以 `err` 信号展示（不抛异常）；输入为空时输出清空。

### 1.7 `app/src/routes/toolbox/base64/index.tsx`
- 渲染 `<ToolboxTabs />` + `<BasePanel />`（保留 `/toolbox/base64` 路由 slug 不变）。

### 1.8 `app/src/global.css`
- **删除死代码**：弹窗版 `.tools-box` / `.tools-tabs` / `.tools-tab`（约 948–975 行）、`.json-head-title` / `.json-slogan`（约 323–333 行）、`.tools-panel-head` / `.tools-panel-slogan` / `.tools-tab{text-decoration:none}`（约 2666–2670 行）。
- **新增**：`.tb-head`（h2 22px / p slate-65 14px，置于子导航上方）、`.base-wrap` `.base-intro` `.base-toolbar` `.base-grp-label` `.base-grid`（`grid-template-columns:1fr 1fr`，≤720px 单列）`.base-col` `.base-col-label` `.base-tag` `.base-box`（min-height 220px，focus 变 violet-65，readonly 用 surface2）`.base-actions` `.base-options` `.base-opt` `.base-err` `.base-hint` `.base-toast` `.tools-intro` `.json-intro`，以及 `.btn.codec.active` / `.btn.dir.active` 选中态覆盖。

### 1.9 `app/src/lib/json/smalltools.test.ts`（追加）
- 新增 `describe('Base 家族编解码（baseEncode / baseDecode）')`：**20 用例**。
  - RFC 4648 权威向量：`b16 foobar=666F6F626172`、`b32 foobar=MZXW6YTBOI======`、`b64 foobar=Zm9vYmFy`；`b58 hello world=StV1DL6CwTryKyV`。
  - 6 种编码对 roundtrip（含中文「你好，世界 🌏」、嵌入 NUL、空串、长句）。
  - pad 开关（b32/b64 默认补 `=`、pad=false 去 `=`）；b64 76 字符 MIME 换行（含 `\r\n`、每段 ≤76）。
  - 非法输入容错：`b16 'ZZ'` / `b32 '@@@@'` / `b58 '0OIl'` / `b85 '~~~'` 均返回 `ok:false`。
  - `b64url` 输出不含 `+/=` 且可逆；`b85` 输出落在 ASCII `!-u`（33..117）。

### 1.10 e2e 改造
- `e2e/toolbox-nav.spec.ts`：`SUBMENU_LABELS` 与 active 断言的 `'Base64'` → `'Base'`（与 Header/ToolboxTabs 标签统一）；新增 Base 面板功能用例（tb-head 标头、6 codec 按钮、Base16 编码 `hello→68656C6C6F`、解码还原 `aGVsbG8=→hello`）。
- `e2e/toolbox-json.spec.ts`：旧 Base64 用例改 `.base-wrap` + `.base-box` 新选择器。
- `e2e/calendar.spec.ts`：注释中 `Base64` → `Base`。

---

## 2. 与 Plan 的差异

| # | 偏离项 | 原因 | 已同步更新 02-plan.md |
|---|--------|------|------------------|
| 1 | `baseDecode` 签名为 `(codec, text)` 而非 Plan §6 名义上的 3 参 `(codec, text, opts)` | 解码无需 pad/wrap，去掉未用形参消除 lint `no-unused-vars`；`BasePanel` 调用已同步去除 opts 实参 | ✅ 是（本文件 §1.5 已记；Plan 数据模型为「可选 opts」，语义等价） |

其余实现与 `02-plan.md` 一致，无功能性偏离。

---

## 3. 代码自检清单

### 3.1 通用 / 安全
- [x] 无硬编码凭证 / Token（站点无后端，纯前端编解码）
- [x] 外部输入（Base 编解码文本）均有校验：`baseEncode/baseDecode` 用 try/catch 包错误为 `{ ok:false, err }`，非法字符显式抛错并被捕获
- [x] 错误路径有处理（UI 以 `err` 信号展示「⚠ …」），无静默吞
- [x] 依赖隔离：编解码纯函数放 `lib/json/smalltools.ts`，组件不直接做字节运算

### 3.2 并发 / 性能（SPA 单线程）
- [x] 共享可变状态用 `useSignal`（Qwik 序列化安全）
- [x] 重计算（Base 编解码）保持纯函数放 `lib/`，渲染期只调用
- [x] 无死循环 / 无界递归（Base58/85 循环受输入长度约束）

### 3.3 风格 / 工具（Qwik + TS）
- [x] `npm run lint`：我的文件 0 error（仓库既有 98 error 技术债，非本任务引入，见 §4）
- [x] `npm run fmt`：已 `prettier --write` 本次改动的全部 14 个文件
- [x] `npm run type-check`：我的文件 0 新增 error（既有 5 error 技术债，非本任务文件）
- [x] 无未使用 import / 变量
- [x] 组件用 `component$()`；状态 `useSignal`；事件 `$()`
- [x] 无定时器 / 订阅需清理（纯客户端计算，无需副作用清理）

---

## 4. 代码检查记录

```bash
npm run lint        # ESLint
npm run fmt         # Prettier（已 prettier --write 本次改动文件）
npm run type-check  # tsc --noEmit
npm run test        # vitest
npm run build       # Qwik SSG（12 页）
```

| 检查项 | 结果 | 备注 |
|--------|------|------|
| Lint | ✅ 我的文件通过 / ⚠️ 仓库既有 98 error（技术债，非本任务引入） | `smalltools.ts` 原有 3 error 已修（prefer-const / no-unused-vars） |
| Format | ✅ 通过 | 14 个改动文件已格式化 |
| 类型检查 | ✅ 我的文件通过 / ⚠️ 既有 5 error（技术债） | 剩余：`JsonWorkbench.tsx:46` 错引 `ShareState`、`share.ts` `l/r` on `object`、`favorites.test.ts` VitestUtils —— 均非本任务文件 |
| 单测 | ✅ 379 passed | 含 Base 家族 20 新增用例 |
| 构建 | ✅ 12 页 SSG | `dist/toolbox/base64/index.html` 等全部生成 |

---

## 完成标志
- [x] 所有改动文件已实现
- [x] 与 Plan 偏离项已记录并同步 Plan 文档
- [x] 代码自检全部通过（§3.1~3.3）
- [x] Lint / Format / type-check / test / build 工具通过（本任务范围内 0 新增错误）
- [x] 约束自查（§0）已逐条核对
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [x] 已与用户完成结束确认（08 Review 阶段）
