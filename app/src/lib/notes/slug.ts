/**
 * Notes 模块 slug 解析（纯函数，构建期与客户端共用）
 *
 * 约定（红线 C-4w）：slug ≡ 数据仓 vault `.md` 文件名 basename（可含中文），
 * URL 直接显示中文标题，canonical 路径为 `/notes/<basename>/`。
 *
 * 导航模式沿用 `SkillsPage` 已验证方案：`location.pathname` 透传 +
 * `history.pushState`，**不走** Qwik City 路由参数 —— GitHub Pages 对动态路由的
 * `q-data.json` 返回 404 会中止 SPA 导航（见 SkillsPage 注释）。
 */

/**
 * 安全解码：畸形百分号编码（如 `%zz`）会让 `decodeURIComponent` 抛 `URIError`，
 * 此处降级为返回原样片段，避免整页崩溃。**只解一次**，不递归解码
 * （双重编码属异常输入，递归解码会放大问题）。
 */
function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** 从 pathname 提取 slug；非 `/notes/` 下、或无 slug 时返回 `''`（表示列表页）。
 *
 * 必须剥离片段（#anchor）与查询（?x）：深链经 404 引导页时，`sessionStorage` 暂存的是
 * `pathname + search + hash`（`tools/make-404-fallback.mjs`），其中 `#…` 是页内锚点，
 * 若一并吃进 slug 会让 `Markdown 全功能示例/#图片与嵌入` 查不到文章。
 */
export function noteSlugFromPath(pathname: string): string {
  const m = /^\/notes\/(.+)$/.exec(pathname || '');
  if (!m) return '';
  const raw = m[1].split('#')[0].split('?')[0].replace(/\/+$/, '');
  return safeDecode(raw);
}

/** 生成 `pushState` 目标路径（slug 已编码，带尾斜杠）；空 slug → 列表页。 */
export function notePathFor(slug: string): string {
  return slug ? `/notes/${encodeURIComponent(slug)}/` : '/notes/';
}

export interface ResolvedSlug {
  slug: string;
  /** 需要 `replaceState` 修正回的目标 URL；`null` 表示无需修正。 */
  restoreUrl: string | null;
}

/**
 * 决定初始 slug，以及是否需要用 `replaceState` 把 URL 修正回用户真正访问的路径。
 *
 * `pending` 为 404 引导页暂存的原始路径（见 `tools/make-404-fallback.mjs`）：
 * Pages 对未知路径返回引导页 → 引导页跳到 `/notes/` → 本页应用据此还原详情并修正 URL。
 * `pending` 为 `null` 表示普通访问，按当前 pathname 解析即可。
 */
export function resolveInitialSlug(pathname: string, pending: string | null): ResolvedSlug {
  if (pending) {
    const slug = noteSlugFromPath(pending);
    if (slug) return { slug, restoreUrl: notePathFor(slug) };
  }
  return { slug: noteSlugFromPath(pathname), restoreUrl: null };
}
