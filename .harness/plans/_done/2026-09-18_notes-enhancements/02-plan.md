# 02. Plan

> **目的**：把 Clarify 的结论转化为可落地的技术方案。
> **输入**：`01-clarify.md` 的目标与范围（用户拍板 A+B+D+F）
> **输出**：改动清单、调用链、数据结构、UT 用例、IT 用例

---

## 0. 约束自查（CONSTRAINTS.md）

| 约束 | 自查结果 |
|------|---------|
| C-01 / C-43 | 纯前端，零后端；不新增 Worker 端点，不引后端框架 ✅ |
| C-2 | 代码只进 `app/src/`；CSS 追加进 `app/src/global.css` 的 notes 段（文件末端） ✅ |
| C-4y | 文章数据仍只走运行时取数；新功能数据（收藏/设置）存浏览器 localStorage，不进数仓 ✅ |
| C-30 | 禁止 `any`；localStorage 读写用类型守卫 ✅ |
| C-31 | 状态用 `useSignal`/`useStore`；副作用 `useVisibleTask$`；监听在 cleanup 解绑 ✅ |
| C-32 | 外部输入（localStorage JSON）校验后使用；键盘监听在输入框聚焦时显式忽略 ✅ |
| C-33 | 全局 keydown 监听在 `useVisibleTask$` cleanup 解绑 ✅ |
| C-34~C-41 | 沿用 `--violet-*`/`--slate-*` 令牌；圆角只给控件；间距用发丝线；字号/宽度用 CSS 变量 ✅ |
| C-53 | 不新增硬路由；标签云点击仅改 `tagFilter` 信号，不跳 URL；深链口径不变 ✅ |
| C-54 | 不碰 `GuoxinL/notes` 数仓脚本/示例文档，无需同步 `example` 分支 ✅ |

---

## 1. 改动文件清单

| 文件 | 改动 |
|------|------|
| `app/src/lib/notes/favorites.ts` | **新增**：收藏读写（SSR 安全 localStorage 封装） |
| `app/src/lib/notes/reading.ts` | **新增**：阅读设置读写（SSR 安全 localStorage 封装） |
| `app/src/lib/notes/favorites.test.ts` | **新增**：收藏逻辑单测（Mock localStorage） |
| `app/src/lib/notes/reading.test.ts` | **新增**：阅读设置单测 |
| `app/src/components/notes/NotesShell.tsx` | 列表视图加星按钮 + `fav`/`tags` 视图切换 + 标签云渲染 + 键盘导航 |
| `app/src/components/notes/MdastRenderer.tsx` | 不变 |
| `app/src/components/notes/NotesDetail-ish` | 阅读设置在 `ArticleView` 内注入（同文件 NotesShell.tsx） |
| `app/src/global.css` | 追加 notes 段：`.notes-fav-*`（星标）、`.notes-cloud-*`（标签云）、`.notes-card.is-kb`（键盘高亮）、`.md-body.read-*` / `.notes-detail.read-*` 宽度 |
| `e2e/notes.spec.ts` | 追加：收藏、标签云、键盘导航、阅读设置 用例 |

---

## 2. 数据结构

```ts
// favorites.ts
const KEY = 'notes:fav';
// 值：JSON.stringify(string[])，slug 数组；读写均 try/catch 且 SSR 守卫
export function getFavs(): string[]
export function isFav(slug: string): boolean
export function toggleFav(slug: string): boolean   // 返回切换后状态
export function setFav(slug: string, on: boolean): void

// reading.ts
export type ReadFont = 's' | 'm' | 'l';
export type ReadWidth = 'narrow' | 'wide';
export interface ReadingCfg { fz: ReadFont; width: ReadWidth }
const KEY = 'notes:reading';
export function loadReading(): ReadingCfg        // 默认 {fz:'m', width:'wide'}
export function saveReading(cfg: ReadingCfg): void
```

> SSR 守卫：`typeof window === 'undefined' || !window.localStorage` 时返回安全默认值 / 静默 no-op（C-30/C-32）。

---

## 3. 调用链

- **收藏**：列表卡片星标 `onClick$` → `toggleFav(slug)` + `favSig.value = getFavs()` → 卡片 `is-fav` 类；详情页星标同理；`fav` 视图 `visiblePosts = allPosts.filter(p => favSig.value.includes(p.slug))`。
- **阅读设置**：`ArticleView` 顶部「阅读设置」行（字号三态 + 宽窄两态）→ 改 `readingSig` + `saveReading()`；`useVisibleTask$` 初始化时 `loadReading()` 并写回 `readingSig`；`.notes-detail` 加 `read-{width}` 类、`.md-body` 加 `read-{fz}` 类（经 `style`/class 绑定）。
- **标签云**：`viewMode='tags'` → 渲染 `tags`（已算好的 `[tag,count]` 排序数组）为云，字号按 count 线性映射到 12–22px；点击 → `tagFilter.value = t; viewMode.value='list'`。
- **键盘导航**：`NotesShell` 顶层 `useVisibleTask$` 注册 `window.addEventListener('keydown', onKey)`，cleanup 解绑。`onKey`：若 `document.activeElement` 为 INPUT/TEXTAREA 则忽略（搜索框聚焦时）；列表态 `state.slug===''`：`/`→`searchInput.focus()`、`j`/`ArrowDown`→activeIdx+1、`k`/`ArrowUp`→activeIdx-1、`Enter`→`openNote(visiblePosts[activeIdx].slug)`；详情态 `Esc`→`backToList()`。

---

## 4. SSR 安全（红线 C-30/C-32）

- 两个 lib 全部 `localStorage` 访问包在 `typeof window !== 'undefined' && window.localStorage` 守卫内；parse 失败回退默认。
- 信号初始值用默认常量，**绝不**在 store 初始化表达式里读 `window`（避免 SSG 期 `Code(3)` 序列化错误，呼应 MEMORY Qwik 坑①）。

---

## 5. UT 用例（TDD 先行）

- `favorites.test.ts`：getFavs 空 → []；toggle 往返；isFav；setFav 覆盖；非法 JSON 兜底。
- `reading.test.ts`：默认 `{fz:'m',width:'wide'}`；save→load 往返；缺字段兜底。

> localStorage 用 `vi.stubGlobal` 或最小 Mock 对象（C-15 全 Mock）。

---

## 6. IT 用例（Playwright）

- 列表卡片点星 → 切到「收藏」视图出现该卡；再点取消 → 消失。
- 「标签」视图出现云；点某标签 → 列表视图被该标签过滤。
- 列表态按 `/` 聚焦搜索框；`j` 高亮下一张、`Enter` 打开；详情态 `Esc` 回列表。
- 详情页切字号「大」→ `getComputedStyle(.md-body).fontSize` 变大；切「窄」→ `.notes-detail` 宽度小于 wide。

---

## 7. 与现有约束的兼容点

- 视图切换沿用 `viewMode` signal（已支持 list/archive），新增 `fav`/`tags` 同范式，不新增路由（C-53）。
- 标签云复用既算好的 `tags` 数组，不重复取数。
- 键盘高亮样式 `.is-kb` 用 `--violet-0` 色带 + 1px 描边（C-34/C-38），不引入新色值。
