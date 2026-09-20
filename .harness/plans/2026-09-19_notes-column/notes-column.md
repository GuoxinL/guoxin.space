# 专栏（Notes Series）功能 — 计划（v2，按评审决策修订）

> 任务目录：`2026-09-19_notes-column` | SOP：单文件计划（Clarify + Plan）| 触发门禁：C-10（UT）/ C-11（E2E）/ C-54（notes 跨仓同步）
> 硬约束真源：`.harness/docs/CONSTRAINTS.md`。本计划与 CONSTRAINTS.md 冲突时以 CONSTRAINTS.md 为准。

---

## 0. 目标（一句话）

为 Notes 模块新增「专栏」概念（字段名 `series`，展示名「专栏」）：列表页顶部展示专栏卡片（封面/简介/篇数/状态/角标），点击进入独立详情页 `/notes/series/[slug]/`；专栏元数据集中在 notes 数据仓 `content/series.json`，由 `build.mjs` 构建期聚合输出 `build/series.json`（含 `count`/`recentDate`/`total`）。

---

## 1. Clarify 澄清（需求边界，按评审决策定稿）

- **字段名 `series`，展示名「专栏」**（专栏 = series 别名，不引入新契约字段）。
- **定义文件 = `series.json`**（非 columns.json）：文件名与字段名一致，避免「series 字段 vs columns.json」歧义（评审决策 2）。
- **`total` 不读取，构建期直接计算 = 文章数**（评审决策 1）：`total` 字段保留但值恒等于该系列实际文章数；不在 frontmatter 也不在 series.json 声明 planned total。详情页/卡片据此显示「共 M 篇 / 第 N 篇」，无"计划 vs 实际"进度条。
- **专栏卡片位置**：`/notes/` 列表页**上方**一行（横向滚动）。
- **点击卡片 → 独立详情路由** `/notes/series/[slug]/`（纯 CSR）。
- **`series.json` 单一真源 + 富集层**：文章按 `series.name` 分组（不论是否在 series.json 登记）；series.json 按 `name` 提供 cover/summary/status/order/slug 富集。未在 series.json 登记的系列仍产出默认卡片（name 即 slugify），不静默消失（评审决策 4：存量兼容）。
- **封面用 SVG**（data: URI 占位，零依赖，评审决策 3）。
- **存量笔记迁移 + 兼容**（评审决策 4）：审计 `content/*.md` 的 `series:` 写法，旧字符串 → `{name, order:999}`；build.mjs 对 legacy 格式做鲁棒 coerce。
- **明确不做**：series/专栏类型区分、type 字段、多专栏、RSS、专栏搜索/筛选、拖拽排序、i18n、planned-total 进度条。
- **数据源权威**：网站仓运行时只消费 `build/series.json` + `posts.json`，不做客户端聚合。

---

## 2. 影响范围 / 改动文件清单

### A. notes 数据仓（`GuoxinL/notes`）— 跨仓，触发 C-54

| 文件 | 类型 | 说明 |
|------|------|------|
| `content/series.json` | 新增 | 专栏定义（`name`/`slug`/`cover`(SVG)/`summary`/`status`/`order`） |
| `scripts/build.mjs` | 修改 | ① 读 `series.json`；② `normalizeSeries` 鲁棒 coerce（字符串→对象、缺 order→999）；③ 分组算 `count`/`recentDate`/`total(=count)`；④ 输出 `build/series.json` |
| `scripts/validate.mjs` | 修改 | 校验 `series.json` schema；校验文章 `series` 格式（对象且 name 非空）；name 在 series.json 有定义（warning，非 error） |
| `content/*.md`（存量系列文章） | 修改 | 旧字符串 `series` → `{name, order}`；缺 order 补 999 |
| `example` 分支 | 同步 | C-54：`build.mjs` / `series.json` / 示例文章变化须同步 `example` 分支 |

### B. 网站仓（`guoxin.space`）— 触发 C-10 / C-11

| 文件 | 类型 | 说明 |
|------|------|------|
| `app/src/lib/notes/types.ts` | 修改 | 新增 `SeriesInfo` 接口 |
| `app/src/lib/notes/series.ts` | 新增 | `loadSeries(cfg)` 取 `build/series.json`；失败回退 `SAMPLE_SERIES`；纯函数 `aggregateSeries(defs, docs)` |
| `app/src/lib/notes/sample.ts` | 修改 | 新增 `SAMPLE_SERIES`（与 fixture 对齐）；示例文章 series 保持 `{name, order}` |
| `app/src/components/notes/NotesShell.tsx` | 修改 | 列表页渲染 `SeriesCards`；详情页 `SeriesNav` 加专栏链接 + 「第 N 篇」 |
| `app/src/routes/notes/index.tsx` | 修改 | 挂载 `SeriesCards`（或 NotesShell 内联） |
| `app/src/routes/notes/series/[slug]/index.tsx` | 新增 | 专栏详情页 `SeriesDetail`（纯 CSR，`useVisibleTask$` 取数） |
| `app/src/global.css` | 修改 | `.notes-series-cards` / `.notes-series-card` / 详情页专栏头样式（去容器化、CSS 变量、hover 回读） |
| `e2e/fixtures/notes/build/series.json` | 新增 | 专栏 fixture（`name` 匹配 fixture 文章 series「Markdown 实战」） |
| `e2e/fixtures/notes/build/posts.json` | 修改 | 两篇 series 文章确认 `{name, order}` |
| `e2e/notes.spec.ts` | 修改 | ① route 处理 `/series.json`；② 新增专栏卡片/详情/深链用例 |

---

## 3. 设计决策

### 3.1 数据契约（`types.ts`）

```ts
export interface SeriesInfo {
  name: string;          // 显示名（= series.name 的 join key）
  slug: string;          // 路由 slug（/notes/series/[slug]/）
  cover?: string;        // 封面（data:image/svg+xml 占位）
  summary?: string;
  status?: 'active' | 'completed' | 'wip' | 'archived';
  order?: number;        // 卡片排序
  count: number;         // 实际篇数（构建期聚合）
  recentDate: string;    // 最近更新（构建期聚合）
  total: number;         // = count（构建期计算，不读；保留字段供详情 "第N/共M"）
}

// ArticleSummary.series 保持 { name; order }
// ArticleDoc.series 保持 { name; order; total; prev?; next? }，total = 系列实际篇数
```

### 3.2 `build.mjs` 聚合算法（伪码）

```js
const SERIES_DEF = safeReadJson(join(CONTENT_DIR, 'series.json')) ?? [];
const defByName = new Map(SERIES_DEF.map((c) => [c.name, c]));

// 鲁棒 coerce（评审决策 4：存量兼容）
function normalizeSeries(fm) {
  if (!fm || !fm.series) return undefined;
  const s = fm.series;
  if (typeof s === 'string') return { name: s, order: 999 };        // 旧字符串写法
  return { name: String(s.name), order: Number(s.order) || 999 };   // 缺 order → 999
}

// pass 2：每篇 doc.series = normalizeSeries(fm) （不读 total）
series: normalizeSeries(fm),

// 分组：按 series.name（不论是否在 series.json 登记）
const groups = new Map();
for (const { doc } of docs) {
  if (doc.series) (groups.get(doc.series.name) ?? groups.set(doc.series.name, []).get(doc.series.name)).push(doc);
}
for (const [, arr] of groups) {
  arr.sort((a, b) => a.series.order - b.series.order);
  const count = arr.length;
  arr.forEach((d, i) => {
    d.series.total = count;                                         // total = 文章数（评审决策 1）
    if (i > 0) d.series.prev = { slug: arr[i-1].slug, title: arr[i-1].title };
    if (i < count - 1) d.series.next = { slug: arr[i+1].slug, title: arr[i+1].title };
  });
}

// 输出 build/series.json：所有分组 + series.json 富集
const seriesOut = [...groups.keys()].map((name) => {
  const arts = groups.get(name);
  const def = defByName.get(name) ?? {};
  const dates = arts.map((d) => d.updated || d.date).filter(Boolean);
  return {
    name,
    slug: def.slug ?? slugifyHeading(name),
    cover: def.cover,
    summary: def.summary,
    status: def.status ?? 'active',
    order: def.order ?? 999,
    count: arts.length,
    recentDate: dates.length ? dates.sort().at(-1) : '',
    total: arts.length,
  };
});
writeFileSync(join(BUILD_DIR, 'series.json'), JSON.stringify(seriesOut, null, 2));
```

> `slugifyHeading` 复用 build.mjs 现有函数（与站点 `slugify.ts` 一致）。

### 3.3 路由

- 新增 `app/src/routes/notes/series/[slug]/index.tsx`（`SeriesDetail`，纯 CSR，`useVisibleTask$` 取数）。
- `/notes/[...slug]/`（详情）与 `/notes/series/[slug]/` 并存：Qwik City **静态段 `series` 优先于 catch-all `[...slug]`**，深链正常解析（实现期 grep 路由表复核）。
- SPA fallback：深链 `/notes/series/xxx/` → 404.html → `spa-redirect.ts` 还原 → CSR 路由命中。e2e 沿用中文深链范式。

### 3.4 视觉（`global.css`，遵循 C-34~C-41 去容器化）

- `.notes-series-cards`：横向滚动 flex 行，gap，跟随 `.mc-container` 宽度。
- `.notes-series-card`：去容器化卡片——封面（横幅 21:9 SVG）、名称、简介（截断）、篇数「共 M 篇」、状态角标、常驻「专栏 Column」角标；hover → `--violet-0` 色带（**回读 hover 态**）。
- 详情页专栏头：封面横幅 + 标题 + 简介 + 篇数 + 返回链接。
- 角标 `10px` 圆角；`.btn` 基类不可动。

### 3.5 专栏详情页文章列表

- 取 `posts.json`（filter `series?.name === seriesInfo.name`）→ sort order asc → 渲染（标题/日期/「第 N 篇」/链接）。
- 空专栏（`count = 0`）→ 诚实空态（"该专栏暂未发布文章"）。

---

## 4. UT（Vitest，改 lib 必跑）— 对齐 C-10

新增 `app/src/lib/notes/series.test.ts`：

- `loadSeries`：mock fetch → `build/series.json` → `SeriesInfo[]`；fetch 失败 → 回退 `SAMPLE_SERIES`。
- 纯函数 `aggregateSeries(defs, docs)` 维度：空 defs / 单系列 / 多系列 / 未登记系列（默认卡片）/ 字符串 series coerce / 缺 order→999 / Unicode·Emoji 专栏名 / 重复 name 去重 / total 恒等于 count。
- `normalizeSeries` 维度：undefined / 字符串 / 对象缺 order / 对象完整。

---

## 5. IT（Playwright，改页面必跑）— 对齐 C-11

扩展 `e2e/notes.spec.ts`（沿用 `page.route` mock `raw.githubusercontent.com/GuoxinL/notes/main/build/**`）：

- 列表页出现专栏卡片（`notes-series-card` ≥ 1）。
- 点击卡片 → SPA 导航 `/notes/series/markdown-shizhan/` 且渲染专栏 H1 + 文章列表。
- 直接深链 `/notes/series/markdown-shizhan/`（忽略 404）H1 仍渲染。
- 专栏篇数文本显示「共 2 篇」。
- 详情页 `SeriesNav` 含可点击专栏链接，点击回到专栏页。
- 异常：`series.json` 404 → 列表页无卡片但不白屏；专栏页 slug 不存在 → 空态。

---

## 6. Docs（一致性清扫）— §2.4

- `AGENTS.md`：Notes 数据流补 `build/series.json` 取数；路由表加 `/notes/series/[slug]/`。
- `.harness/docs/design.md`：新角标/视觉令牌说明（C-34~C-41）。
- C-54：notes 仓 `example` 分支同步（`build.mjs` / `series.json` / 示例文章）。

---

## 7. Deploy / Review（边界点）

- **跨仓顺序**：先合 notes 仓（`build/series.json` 上线）→ 再合网站仓消费。否则优雅降级为空卡片。
- 边界点 A：网站仓代码 commit → push `main` → Pages 自动部署（**环境副作用，执行前显式确认**）。
- 边界点 B：收尾 commit `[skip ci]`（本 plan md）。
- 生产复测 §5：`gh run list --workflow=deploy.yml` + 字节比对 + 硬刷新。

---

## 8. 评审决策（已全部拍板 ✅）

1. ✅ **`total` 不读，构建期算 = 文章数**：`total` 字段保留，值恒等于系列实际篇数；不在 frontmatter / series.json 声明 planned total。
2. ✅ **文件改名 `series.json`**（非 columns.json）：文件名 = 字段名，消除 series/column 歧义。
3. ✅ **封面用 SVG**（data: URI 占位）。
4. ✅ **存量笔记迁移 + 兼容**：审计 `content/*.md` 旧 `series:` 写法并迁移；build.mjs `normalizeSeries` 鲁棒 coerce；未登记系列仍出默认卡片。
5. （本回合）详细解释见对话回复。

---

## 9. 实施顺序（确认后执行）

1. notes 仓：盘点 `series:` 写法 → 写 `content/series.json`（含示例 `Markdown 实战` + SVG 封面）→ 改 `build.mjs`（`normalizeSeries` + 聚合 + 输出 `build/series.json`）→ 改 `validate.mjs` → 本地 `node scripts/build.mjs` + `npm run validate` 验证 `build/series.json` → 迁移存量笔记 → 同步 `example` 分支 → 推 notes `main`。
2. 网站仓：`types.ts`（`SeriesInfo`）→ `series.ts`（`aggregateSeries` + `loadSeries`）→ `sample.ts`（`SAMPLE_SERIES`）→ `NotesShell.tsx`（`SeriesCards` + `SeriesNav` 链接）→ 新路由 `series/[slug]/index.tsx` → `global.css` → fixture `series.json` + `posts.json` 确认 → `series.test.ts` → `notes.spec.ts` 扩展。
3. UT：`npm run test`。
4. Build：`npm run build`（Node ≥24 + `CODEBUDDY_SAFE_DELETE_ENABLED=0`）。
5. IT：本地沙箱配方起服 → `npx playwright test e2e/notes.spec.ts` → kill。
6. Docs + Deploy + Review。

---

## 10. 实施状态（滚动更新）

- **#5 网站 UI ✅ 完成**：`NotesShell.tsx` 列表卡 `SeriesCards` + 详情 `SeriesDetail` + `SeriesNav`（含「第 N 篇」）；`series.ts`（`aggregateSeries`+`loadSeries`）、`types.ts`（`SeriesInfo`）、`sample.ts`（`SAMPLE_SERIES`）、`slug.ts`（`noteSeriesSlugFromPath`/`seriesPathFor`）、`global.css`（`.notes-series-*` 全套）。`npm run build` 12 页无 `Code(3)`，SSG 序列化安全。
- **#6 测试 ✅ 完成**：UT `npm run test` 389 passed（含 `series.test.ts` 10）；notes E2E 41 passed（含 6 个专栏用例：列表卡 / 点击 SPA 导航 / 深链 / 详情页「查看专栏」回跳 / `series.json` 404 优雅降级 / slug 不存在空态）。
- **设计修正（评审决策 5）**：原 §3.3「新建 `series/[slug]/index.tsx` 路由」**改为 NotesShell 内部 dispatch**——`/notes/[...slug]/`（catch-all）已匹配 `/notes/series/<slug>/`，由 `NotesShell` 用 `noteSeriesSlugFromPath` 分流、无需新建 Qwik 路由组件（规避动态路由 `q-data.json` 404 中止 SPA）。§2 文件清单中 `app/src/routes/notes/series/[slug]/index.tsx` 一项**未新建**。
- **SeriesNav「查看专栏」链接修复**：详情页按钮原用 `seriesPathFor(slugifySeries(s.name))` 派生 slug，与 `series.json` 手动别名 `slug` 不一致（如 `markdown-实战` vs `markdown-shizhan`）→ 404。改为 `onOpenSeries(name)` 回调，在 `seriesList` 中按 `name` 查规范 slug 后 `openSeries(slug)`，未登记则兜底 `slugifySeries(name)`；`onOpenSeries` 经 `ArticleView` props 透传（父子组件作用域隔离）。
- **#7 Docs 进行中**：AGENTS.md 补 `build/series.json` 取数 + 路由说明；`.harness/docs/design.md` 补专栏视觉令牌（本节）。
- **#3 notes 仓（跨仓，C-54）待办**：`main` 本地改动已就绪（未 commit/push）；`example` 分支待同步 `build.mjs`/`series.json`/示例文章。push 触发数据上线 + Pages 自动部署（环境副作用），**执行前需显式确认**。
- **type-check 现状**：本功能 0 新增类型错误；仓库基线仍有 4 处 pre-existing tech-debt（`JsonWorkbench.tsx` / `lib/json/share.ts` / `favorites.test.ts`），不在本任务范围，未触碰。
