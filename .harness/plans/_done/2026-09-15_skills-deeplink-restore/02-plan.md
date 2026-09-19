# 02. Plan

> **目的**：把「对齐 Notes 深链行为」落成可执行的改动清单与判定口径。

---

## 1. 改动文件清单

| # | 文件 | 动作 | 说明 |
|---|------|------|------|
| 1 | `app/src/lib/spa-redirect.ts` | **新增** | 共享 `SPA_REDIRECT_KEY` + `readPendingRedirect()`（读后即删、storage 不可用降级） |
| 2 | `app/src/lib/spa-redirect.test.ts` | **新增** | 单测：正常读取、读后即删、storage 抛异常 |
| 3 | `app/src/lib/skills.ts` | 改 | ① `skDirFromPath` 正则放宽尾斜杠；② 新增 `skPathFor(dir)`；③ 新增 `resolveInitialSkillDir(pathname, pending)` |
| 4 | `app/src/lib/skills.test.ts` | 改 | 补 3 组用例（尾斜杠 / `skPathFor` / `resolveInitialSkillDir`） |
| 5 | `app/src/components/skills/SkillsPage.tsx` | 改 | 读 pending → 还原 URL → 未找到兜底 UI |
| 6 | `app/src/components/notes/NotesShell.tsx` | 改 | 本地 `readPendingRedirect` 改为引用共享 lib（逻辑不变） |
| 7 | `e2e/notes-spike.spec.ts` | 改/补 | 回归 6 用例（确认 Notes 未回归） |
| 8 | `e2e/skills-deeplink.spec.ts` | **新增** | Skills 深链 3 用例 |

---

## 2. 核心设计

### 2.1 共享读取（避免两处漂移）

```ts
// app/src/lib/spa-redirect.ts
export const SPA_REDIRECT_KEY = 'spaRedirect';

/** 读取 404 引导页暂存的原始路径；读后即删（防回放）。sessionStorage 不可用时返回 null。 */
export function readPendingRedirect(): string | null {
  try {
    const v = sessionStorage.getItem(SPA_REDIRECT_KEY);
    if (v) sessionStorage.removeItem(SPA_REDIRECT_KEY);
    return v;
  } catch {
    return null;
  }
}
```

### 2.2 纯函数（可测，与 Notes 对称）

```ts
/** `/skills/<dir>` 或 `/skills/<dir>/` → dir；否则 '' */
export function skDirFromPath(pathname: string): string {
  const m = /^\/skills\/([^/]+?)\/?$/.exec(pathname || '');
  if (!m) return '';
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

export function skPathFor(dir: string): string {
  return dir ? '/skills/' + encodeURIComponent(dir) : '/skills';
}

/** 初始目录：优先用引导页暂存的原始路径（深链），否则取当前 pathname（同路由内导航/刷新）。 */
export function resolveInitialSkillDir(
  pathname: string,
  pending: string | null
): { dir: string; restoreUrl: string | null } {
  if (pending) {
    const dir = skDirFromPath(pending);
    if (dir) return { dir, restoreUrl: skPathFor(dir) };
  }
  return { dir: skDirFromPath(pathname), restoreUrl: null };
}
```

> `restoreUrl` 只在深链场景非空 —— 组件据此决定是否 `replaceState` 修正 URL。

### 2.3 SkillsPage 接线

```ts
useVisibleTask$(() => {
  reload();
  const pending = readPendingRedirect();
  const { dir, restoreUrl } = resolveInitialSkillDir(location.pathname, pending);
  selectedDir.value = dir;
  if (restoreUrl) history.replaceState({ skDetail: dir }, '', restoreUrl);
  const onPop = () => (selectedDir.value = skDirFromPath(location.pathname));
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
});
```

### 2.4 「未找到」判定（关键：异步数据）

```ts
const missing = useComputed$(() => {
  const d = selectedDir.value;
  if (!d) return false;
  if (!rows.value.length) return false;      // 加载中 / 未配置 / 失败 → 不判 404
  return !rows.value.some((r) => r.dir === d);
});
```

渲染分支优先级：`missing → 未找到` ＞ `selectedDir → SkillDetail` ＞ `列表`。

未找到 UI（无新容器样式，复用既有 `.sk-page` / `.btn ghost`）：

```tsx
<section class="sk-page">
  <div class="sk-back">
    <button type="button" class="btn ghost" onClick$={closeDetail}>← 返回列表</button>
  </div>
  <h1 class="sk-title">未找到</h1>
  <p class="sk-status">不存在名为「{selectedDir.value}」的技能。</p>
</section>
```

---

## 3. 关键决策

| # | 决策 | 理由 |
|---|------|------|
| D1 | 未找到判定**依赖列表加载完成**（`rows.length > 0`） | 否则「加载中 / 未配置仓库 / 加载失败」都会被误判成 404，比现状更糟 |
| D2 | `skDirFromPath` 放宽尾斜杠，而非在调用处 strip | 单一解析入口；引导页存的原始路径带斜杠，必须可解析 |
| D3 | 抽出共享 `lib/spa-redirect.ts` | 两处同逻辑，复制会漂移；Notes IT 提供回归保护 |
| D4 | `restoreUrl` 沿用 `openDetail` 的**无尾斜杠**形式 | 与既有 pushState 一致，避免同站两形态；引导页输入带斜杠也能解析（D2） |
| D5 | 不新增 CSS 类 | 遵守 C-21 / V2 去容器化，复用 `.sk-page`、`.sk-title`、`.sk-status`、`.btn ghost` |

---

## 4. IT 用例设计（`e2e/skills-deeplink.spec.ts`）

| # | 用例 | 断言 |
|---|------|------|
| 1 | 深链 URL 还原 | 访问 `/skills/nonexistent-xyz/` → 最终 `location.pathname` 仍为 `/skills/nonexistent-xyz`（无尾斜杠形式），且页面出现「未找到」 |
| 2 | 未知 dir 文案 + 可返回 | 文本含「不存在名为」；点「返回列表」回到 `/skills`（列表页渲染） |
| 3 | 既有详情页入口不回归 | 访问 `/skills/` → 点第一个技能 → URL 变为 `/skills/<dir>`、详情渲染 |

> 依赖：用例需 Pages 语义服务（`tools/serve-pages.mjs`，`playwright.config.ts` 已配置）。用例 1/2 依赖 GitHub API 可达（CI 可、本地可能因网络受限）—— 若列表加载失败，`rows` 为空则**不**显示未找到，属设计内降级。

---

## 5. 完成标志

- [x] 改动文件清单已定
- [x] 核心设计与判定口径已定
- [x] IT 用例设计已定
