# 03. Implement

> **目的**：记录实现细节、与 Plan 的差异、检查结果。

---

## 1. 改动清单（实际）

| # | 文件 | 动作 | 内容 |
|---|------|------|------|
| 1 | `app/src/lib/spa-redirect.ts` | 新增 | `SPA_REDIRECT_KEY = 'spaRedirect'` + `readPendingRedirect()`（读后即删、异常降级 null） |
| 2 | `app/src/lib/spa-redirect.test.ts` | 新增 | 4 用例 |
| 3 | `app/src/lib/skills.ts` | 改 | `skDirFromPath` 正则 `/^\/skills\/([^/]+?)\/?$/`（兼容尾斜杠 + `decodeURIComponent` 容错）；新增 `skPathFor(dir)`、`resolveInitialSkillDir(pathname, pending)` |
| 4 | `app/src/lib/skills.test.ts` | 改 | 新增 11 用例（尾斜杠 4 / `skPathFor` 3 / `resolveInitialSkillDir` 4） |
| 5 | `app/src/components/skills/SkillsPage.tsx` | 改 | 读 pending → `replaceState` 还原 URL；`useComputed$` 判定 `missing`；新增 `backToList`；未找到兜底 UI |
| 6 | `app/src/components/notes/NotesShell.tsx` | 改 | 删除本地 `readPendingRedirect`，改为 import 共享 lib（逻辑零变化） |
| 7 | `e2e/skills-deeplink.spec.ts` | 新增 | 4 用例（GitHub API 用 `page.route` mock，不依赖外网） |

## 2. 关键实现

### 2.1 未找到判定（异步数据专用口径）

```ts
const missing = useComputed$(() => {
  const d = selectedDir.value;
  if (!d) return false;
  if (!rows.value.length) return false;   // 加载中 / 未配置 / 失败 → 不判 404
  return !rows.value.some((r) => r.dir === d);
});
```

### 2.2 深链还原

```ts
const pending = readPendingRedirect();
const { dir, restoreUrl } = resolveInitialSkillDir(location.pathname, pending);
selectedDir.value = dir;
if (restoreUrl) history.replaceState({ skDetail: dir }, '', restoreUrl);
```

### 2.3 渲染分支优先级

`missing（未找到）` ＞ `selectedDir（详情）` ＞ `列表`。

未找到 UI 复用既有 `.sk-page` / `.sk-back` / `.sk-title` / `.sk-status` / `.btn ghost`，**未新增任何 CSS**（遵守 C-21 / V2 去容器化）。

## 3. 与 Plan 的差异

| 项 | Plan | 实际 | 原因 |
|---|------|------|------|
| 返回按钮 | 复用 `closeDetail` | 新增 `backToList` | `closeDetail` 走 `history.back()`；深链场景 history 栈里上一项可能是站外（引导页已 `replace`），后退会**退出站点**。故兜底页单独用 `pushState('/skills')` |
| `skDirFromPath` 容错 | 未提 | 加 `try/catch` 包 `decodeURIComponent` | 畸形 `%zz` 会抛 URIError；与 Notes `safeDecode` 口径对齐 |
| IT mock | 3 用例 | 4 用例 | 补「列表点击进详情不回归」，防止 `skDirFromPath` 正则放宽影响既有导航 |

## 4. 检查结果

| 项 | 命令 | 结果 |
|---|------|------|
| 单测 | `npx vitest run` | ✅ **11 文件 186 用例全绿**（改动前 171，新增 15） |
| 构建 | `npm run build` | ✅ 5 页 + `make-404-fallback` 生成 SPA fallback |
| Lint | `npm run lint` | ✅ **86 errors** —— 与基线一致，**零新增**（`spa-redirect.ts`、新增 skills 函数均干净；SkillsPage 报的 `any` 为既有 `catch (e: any)`） |
| IT | `npx playwright test` | ✅ **15/15 全绿**（含新增 4 + Notes 回归 6 + running 等） |

> 附带发现：`running.spec.ts` 此前本地必挂的 1 个用例**现已通过** —— 印证其根因同样是系统代理（见 00-overview 风险速览 / 用户级记忆），不是「本地访问不了 Worker」。

---

## 完成标志

- [x] 所有改动文件已实现
- [x] lint 零新增错误
- [x] 单测全绿
- [x] 构建通过
- [x] IT 全绿（含 Notes 回归）
