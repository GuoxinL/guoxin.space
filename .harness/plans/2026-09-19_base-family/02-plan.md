# 02. Plan — 方案设计

## 改动文件清单

### A. Toolbox 页头重排
- `app/src/components/layout/ToolboxTabs.tsx`
  - 在 `<nav>` 之前渲染区块标题：`<h2>Toolbox</h2>` + `<p>Small tools for everyday bytes.</p>`（新增 `.tb-head` 样式，沿用 `--font-heading`、发丝线分隔，贴合 V2 去容器化）。
- `app/src/components/json/JsonWorkbench.tsx`
  - 删除 `json-head` 内的 `<h2>Toolbox</h2>` + `<p class="json-slogan">…</p>`（行 694-697）。
  - 原位替换为 JSON 工具简介（如 `<p class="json-intro">JSON 在线工具：格式化、压缩、转义、修复、树形浏览、左右对比与 JSONPath 查询，纯前端本地处理，数据不上传。</p>`）。
- `app/src/global.css`
  - 删除 `.json-head-title` / `.json-slogan` 相关；新增 `.tb-head` 区块标题样式。

### B. 删除 tools-panel-head / tools-tabs
- `app/src/components/json/SmallToolPanel.tsx`
  - 删除 `<div class="tools-panel-head">…</div>`（行 131-133）与 `<div class="tools-tabs">…</div>`（行 136-142，含内部 `TABS` 数组）。
  - 在 `tools-body` 顶部按 `tab` 渲染**当前工具简介**（新增 `INTROS: Record<Tab,string>`）。
- `app/src/global.css`
  - 删除 `.tools-panel-head` / `.tools-tabs` / `.tools-tab` / `.tools-tab:hover` / `.tools-tab.active` 无用样式（行 2665-2670 区间）。

### C. 定稿 Base 家族
- `app/src/lib/json/smalltools.ts`
  - 新增纯函数：`baseEnc(codec, text, opts)` / `baseDec(codec, text, opts)` 或直接导出 `b16/b32/b58/b64/b64url/b85` 的 encode/decode；b58/b85 用 BigInt。
  - 沿用现有 `{ ok }` 返回形态，不抛异常。
- `app/src/components/json/BasePanel.tsx`（新增）
  - 左右两框（输入 / 输出）+ 一排 codec 按钮（Base16(Hex)/32/58/64/64URL/85）+ 方向切换（编码 / 解码）+ 填充 / 换行选项 + 复制 / 交换。
  - Qwik `useSignal` 响应式；`.btn` 体系；V2 视觉（发丝线、`.mc-container` 内）。
- `app/src/routes/toolbox/base64/index.tsx`
  - 改渲染 `<BasePanel />`（保留 `<ToolboxTabs />`）。
- `app/src/components/layout/ToolboxTabs.tsx`
  - `TOOLS` 中 `{ href:'/toolbox/base64', label:'Base64', icon:'base64' }` → `label:'Base'`。
- `app/src/lib/json/smalltools.test.ts`
  - 补 RFC 向量 + 往返用例（Base32 RFC4648 附录 B；Base85 中文往返；Base58 往返）。

## 调用链
- `/toolbox/base64` → `BasePanel` → `lib/json/smalltools.ts` 的 codec 纯函数（无 DOM 依赖，SSG 安全）。
- 其余 toolbox 页（`url/ts/jwt/csv`）维持 `SmallToolPage` → `SmallToolPanel`，仅去掉内层导航、补简介。

## 数据模型
- `type BaseCodec = 'b16'|'b32'|'b58'|'b64'|'b64url'|'b85'`
- `interface BaseOpts { pad: boolean; wrap: boolean }`（wrap 仅 b64 生效；pad 仅 b32/b64 生效）
- 纯函数：`(text:string, opts) => { ok:true; text:string } | { ok:false; err:string }`

## IT（集成测试）用例
- Playwright：访问 `/toolbox/base64`，点击 Base32 按钮 + 编码，断言输出含 `MZXW6YTBOI======`（foobar）；切换解码断言还原。
- 访问 `/toolbox/json`、`/toolbox/url` 等，断言页面顶部出现 "Toolbox" 标题、子导航在下方、内容区有工具简介。
- 断言 `tools-panel-head` / `tools-tabs` 相关 DOM 已不存在。
