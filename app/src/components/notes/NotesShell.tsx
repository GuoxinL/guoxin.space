import { component$, useSignal, useStore, useVisibleTask$, $, type QRL } from '@builder.io/qwik';
import type { ArticleDoc, ArticleSummary, PostsIndex, NotesCfg, SeriesInfo } from '../../lib/notes/types';
import { loadArticle, loadNotesIndex, loadAllArticles, defaultNotesCfg } from '../../lib/notes/source';
import { loadSeries, slugifySeries } from '../../lib/notes/series';
import { buildIndex, search, type NoteSearch } from '../../lib/notes/search';
import { computeRelated, type RelatedItem } from '../../lib/notes/related';
import { computeStats, intensityLevel } from '../../lib/notes/stats';
import { noteSlugFromPath, notePathFor, resolveInitialSlug, noteSeriesSlugFromPath, seriesPathFor } from '../../lib/notes/slug';
import { readPendingRedirect } from '../../lib/spa-redirect';
import { getFavs, toggleFav } from '../../lib/notes/favorites';
import { loadReading, saveReading, DEFAULT_READING, type ReadingCfg, type ReadFont, type ReadWidth } from '../../lib/notes/reading';
import { MdastRenderer } from './MdastRenderer';
import { authWorkerUrl, getAuthToken, authLogin } from '../../lib/auth';

/**
 * N-T20：全文搜索索引（模块级缓存）。
 * 用对象持有、仅修改其属性，避免 Qwik optimizer 把模块级 `let` 当作 QRL 闭包的导入绑定而禁止重赋值；
 * 且索引实例不放入 store/signal，避免参与 SSR 序列化。仅在浏览器运行时懒构建，配合 `searchReady` 触发重渲染。
 */
const searchCache: { idx: NoteSearch | null } = { idx: null };

/**
 * Notes 模块外壳（纯 CSR，对齐 plan §5.3）。
 *
 * - 列表 → 详情走 `history.pushState` 透传 URL；popstate / 初始 pathname 负责后退与深链恢复。
 * - 不走 Qwik City 路由参数（GitHub Pages 对动态路由 q-data 返回 404 会中止 SPA 导航）。
 * - 404 引导页把原始路径暂存到 sessionStorage，此处 `resolveInitialSlug` 还原详情并 `replaceState` 修正 URL（C-53）。
 * - 取数失败显示「加载失败 + 重试」卡片，不白屏、不静默（plan R-3）。
 */
const ArticleHeader = component$<{ doc: ArticleDoc }>(({ doc }) => (
  <header class="notes-article-head">
    <h1 class="notes-article-title">{doc.title}</h1>
    {doc.description && <p class="notes-article-desc">{doc.description}</p>}
    <div class="notes-article-meta">
      <span>{doc.date}</span>
      <span aria-hidden="true">·</span>
      <span>{doc.readingTime.minutes} 分钟阅读</span>
      <span aria-hidden="true">·</span>
      <span>{doc.tags.join(' / ')}</span>
    </div>
  </header>
));

/**
 * 底部引用列表（N-T15）：按 内部链接 / 外部链接 / 脚注 分组渲染 doc.references。
 * 内链走 notePathFor；外链新窗口打开；脚注锚点指向正文 footnoteDefinition 的 id（fn-*）。
 */
const ReferencesBlock = component$<{ doc: ArticleDoc }>(({ doc }) => {
  const refs = doc.references ?? [];
  const internal = refs.filter((r) => r.kind === 'internal');
  const external = refs.filter((r) => r.kind === 'external');
  const footnotes = refs.filter((r) => r.kind === 'footnote');
  if (!refs.length) return null;
  return (
    <section class="notes-refs" data-testid="notes-refs" aria-label="引用">
      <h2 class="notes-section-title">引用</h2>
      {internal.length > 0 && (
        <div class="notes-ref-group">
          <div class="notes-ref-group-title">内部链接</div>
          <ul class="notes-ref-list">
            {internal.map((r, i) => (
              <li key={`i-${i}`} class="notes-ref-item">
                <a
                  class={{ 'notes-ref-link': true, 'notes-ref-link--missing': !r.exists }}
                  href={notePathFor(r.target ?? '')}
                  title={r.exists ? undefined : '尚未创建'}
                >
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {external.length > 0 && (
        <div class="notes-ref-group">
          <div class="notes-ref-group-title">外部链接</div>
          <ul class="notes-ref-list">
            {external.map((r, i) => (
              <li key={`e-${i}`} class="notes-ref-item">
                <a class="notes-ref-link" href={r.href} target="_blank" rel="noopener noreferrer">
                  {r.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {footnotes.length > 0 && (
        <div class="notes-ref-group">
          <div class="notes-ref-group-title">脚注</div>
          <ul class="notes-ref-list">
            {footnotes.map((r, i) => (
              <li key={`f-${i}`} class="notes-ref-item">
                <a class="notes-ref-link" href={`#${r.footnoteId}`}>
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
});

/**
 * 反链区块（N-T15）：渲染 doc.backlinks（被其他文章引用的来源）。
 * demo 阶段由 sample 数据提供；真实数据源由数仓 graph.json 聚合后注入。
 */
const BacklinksBlock = component$<{ doc: ArticleDoc }>(({ doc }) => {
  const links = doc.backlinks ?? [];
  if (!links.length) return null;
  return (
    <section class="notes-backlinks" data-testid="notes-backlinks" aria-label="反链">
      <h2 class="notes-section-title">被以下文章引用</h2>
      <ul class="notes-backlink-list">
        {links.map((b, i) => (
          <li key={`b-${i}`} class="notes-backlink-item">
            <a class="notes-ref-link" href={notePathFor(b.slug)}>
              {b.title}
            </a>
            {b.context && <p class="notes-backlink-ctx">{b.context}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
});

/**
 * 系列导航（N-T17）：详情页展示所属系列名称与序号，并提供上一篇/下一篇跳转（SPA 内导航）。
 * 系列信息由 doc.series 提供；首篇无 prev、末篇无 next 时显示禁用态。
 */
/**
 * 更新历史（N-T23）：渲染 doc.history（date + message 时间线）。
 * demo 由 sample 提供；生产需接 git log（见 N-T06 数仓管线）注入 history 字段。
 */
const HistoryBlock = component$<{ doc: ArticleDoc }>(({ doc }) => {
  const items = doc.history ?? [];
  if (!items.length) return null;
  return (
    <section class="notes-history" data-testid="notes-history" aria-label="更新历史">
      <h2 class="notes-section-title">更新历史</h2>
      <ul class="notes-history-list">
        {items.map((h, i) => (
          <li key={`h-${i}`} class="notes-history-item">
            <time class="notes-history-date">{h.date}</time>
            <span class="notes-history-msg">{h.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
});

/**
 * 相关文章（N-T21）：渲染 computeRelated 计算出的候选列表（共同引用 + 标签 Jaccard 综合分）。
 * 每个条目为可跳转卡片（href 指向文章深链，全量重载进入详情；与现有 content 内链一致）。
 */
const RelatedArticles = component$<{ items: RelatedItem[] }>(({ items }) => {
  if (!items.length) return null;
  return (
    <section class="notes-related" data-testid="notes-related" aria-label="相关文章">
      <h2 class="notes-section-title">相关文章</h2>
      <ul class="notes-related-list">
        {items.map((r, i) => (
          <li key={`r-${i}`} class="notes-related-item">
            <a class="notes-related-link" href={notePathFor(r.slug)} data-testid="notes-related-item">
              <span class="notes-related-title">{r.title}</span>
              {r.description && <span class="notes-related-desc">{r.description}</span>}
              <span class="notes-related-reason">{r.reason}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
});

/**
 * 评论区（Phase 4：本站 GitHub 身份自建评论，Issue 存储）。
 * - 游客匿名读：GET <worker>/api/comments?slug=<slug>
 * - 已登录读者发评：POST <worker>/api/comments（Bearer = 本站 HMAC 令牌，含读者本人 gh_token，由 Worker 以读者身份发布到 Issue）
 * - 评论体为 GitHub 返回的纯文本，按 white-space:pre-wrap 安全渲染（Qwik 文本默认转义，无 XSS）；Markdown 富渲染留待后续
 * 组件仅 CSR 渲染（NotesShell 详情为纯客户端取数），故此处读 localStorage / fetch 均安全。
 */
type CommentItem = {
  id: number | string;
  login?: string;
  avatar?: string;
  htmlUrl?: string;
  body: string;
  createdAt?: string;
};

const Comments = component$<{ slug: string }>(({ slug }) => {
  const list = useSignal<CommentItem[]>([]);
  const loading = useSignal(true);
  const loadError = useSignal('');
  const draft = useSignal('');
  const submitting = useSignal(false);
  const postError = useSignal('');

  const load = $(async () => {
    loading.value = true;
    loadError.value = '';
    try {
      const base = (authWorkerUrl() || '').replace(/\/+$/, '');
      if (!base) {
        loadError.value = '未配置 Worker（Skills「通道设置」填写 Worker URL 后可用评论）';
        list.value = [];
        return;
      }
      const r = await fetch(`${base}/api/comments?slug=${encodeURIComponent(slug)}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data || !data.ok) {
        loadError.value = (data && data.error) || '评论加载失败';
        list.value = [];
      } else {
        list.value = Array.isArray(data.comments) ? data.comments : [];
      }
    } catch {
      loadError.value = '评论加载失败（网络）';
      list.value = [];
    } finally {
      loading.value = false;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    load();
  });

  const submit = $(async () => {
    const text = draft.value.trim();
    if (!text) {
      postError.value = '评论内容为空';
      return;
    }
    const token = getAuthToken();
    if (!token) {
      authLogin();
      return;
    }
    submitting.value = true;
    postError.value = '';
    try {
      const base = (authWorkerUrl() || '').replace(/\/+$/, '');
      const r = await fetch(`${base}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ slug, body: text }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data || !data.ok) {
        postError.value = (data && data.error) || '发布失败';
      } else {
        draft.value = '';
        await load();
      }
    } catch {
      postError.value = '发布失败（网络）';
    } finally {
      submitting.value = false;
    }
  });

  return (
    <section class="notes-comments" data-testid="notes-comments" aria-label="评论">
      <h2 class="notes-section-title">评论</h2>

      {loading.value && <p class="notes-muted">评论加载中…</p>}
      {loadError.value && <p class="notes-muted notes-comments-err">{loadError.value}</p>}
      {!loading.value && !loadError.value && list.value.length === 0 && (
        <p class="notes-muted">还没有评论，来抢沙发。</p>
      )}

      {list.value.length > 0 && (
        <ul class="notes-comments-list">
          {list.value.map((c) => (
            <li key={String(c.id)} class="notes-comment">
              {c.avatar ? (
                <img class="notes-comment-avatar" src={c.avatar} alt={c.login || '匿名'} width={32} height={32} loading="lazy" />
              ) : null}
              <div class="notes-comment-main">
                <div class="notes-comment-meta">
                  <span class="notes-comment-login">{c.login || '匿名'}</span>
                  {c.htmlUrl ? (
                    <a class="notes-comment-link" href={c.htmlUrl} target="_blank" rel="noopener noreferrer">
                      在 GitHub 查看
                    </a>
                  ) : null}
                  {c.createdAt ? <time class="notes-comment-time">{c.createdAt}</time> : null}
                </div>
                <div class="notes-comment-body">{c.body}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div class="notes-comment-editor">
        {getAuthToken() ? (
          <div class="notes-comment-form">
            <textarea
              class="notes-comment-input"
              data-testid="notes-comment-input"
              rows={4}
              placeholder="写下你的评论（纯 GitHub 身份，公开可见）"
              bind:value={draft}
            />
            <div class="notes-comment-actions">
              <button
                type="button"
                class="btn"
                data-testid="notes-comment-submit"
                disabled={submitting.value}
                onClick$={submit}
              >
                {submitting.value ? '发布中…' : '发表评论'}
              </button>
              {postError.value && <span class="notes-comments-err">{postError.value}</span>}
            </div>
          </div>
        ) : (
          <button type="button" class="btn" data-testid="notes-comment-login" onClick$={() => authLogin()}>
            登录 GitHub 后参与评论
          </button>
        )}
      </div>
    </section>
  );
});

/** 写作统计与热力图（N-T22）：总数/字数/标签分布 + GitHub 风格按日热力图。 */
const NotesStatsPanel = component$<{ posts: ArticleSummary[] }>(({ posts }) => {
  const stats = computeStats(posts);
  return (
    <details class="notes-stats" data-testid="notes-stats" open>
      <summary class="notes-stats-summary">写作统计</summary>
      <div class="notes-stats-grid">
        <div class="notes-stat">
          <span class="notes-stat-num">{stats.total}</span>
          <span class="notes-stat-label">篇文章</span>
        </div>
        <div class="notes-stat">
          <span class="notes-stat-num">{stats.totalWords}</span>
          <span class="notes-stat-label">总字数</span>
        </div>
        <div class="notes-stat">
          <span class="notes-stat-num">{stats.monthsActive}</span>
          <span class="notes-stat-label">活跃月份</span>
        </div>
      </div>
      <div class="notes-heatmap" data-testid="notes-heatmap" aria-label="发文热力图">
        {stats.heatmap.map((col, w) => (
          <div key={`w-${w}`} class="notes-heatmap-week">
            {col.map((cell, r) => (
              <span
                key={`c-${w}-${r}`}
                class={`notes-heatmap-cell lv-${intensityLevel(cell.count, stats.maxDay)}`}
                title={`${cell.date}：${cell.count} 篇`}
              />
            ))}
          </div>
        ))}
      </div>
    </details>
  );
});

/** 双链图谱（N-T25）：d3-force 计算力导向布局，渲染文章节点 + 引用/反链边。 */
const NotesGraph = component$(() => {
  const graph = useSignal<{
    nodes: { id: string; title: string; x: number; y: number }[];
    links: { x1: number; y1: number; x2: number; y2: number }[];
  } | null>(null);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      const { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } = await import('d3-force');
      const docs = await loadAllArticles();
      const W = 320;
      const H = 200;
      const nodes = docs.map((d) => ({ id: d.slug, title: d.title, x: 0, y: 0 }));
      const idset = new Set(nodes.map((n) => n.id));
      const links: { source: string; target: string }[] = [];
      const seen = new Set<string>();
      const addLink = (a: string, b: string) => {
        if (a === b) return; // 跳过自引用（如文章引用自身）
        const key = [a, b].sort().join('|');
        if (!seen.has(key)) {
          seen.add(key);
          links.push({ source: a, target: b });
        }
      };
      for (const d of docs) {
        for (const r of d.references ?? [])
          if (r.kind === 'internal' && r.target && idset.has(r.target)) addLink(d.slug, r.target);
        for (const b of d.backlinks ?? []) if (idset.has(b.slug)) addLink(d.slug, b.slug);
      }
      if (nodes.length === 0) return;
      const sim = forceSimulation(nodes as never)
        .force('link', forceLink(links as never).id((d: never) => (d as { id: string }).id))
        .force('charge', forceManyBody().strength(-160))
        .force('center', forceCenter(W / 2, H / 2))
        .force('collide', forceCollide(30))
        .stop();
      for (let i = 0; i < 300; i += 1) sim.tick();
      const linksOut = (links as unknown as { source: { x: number; y: number }; target: { x: number; y: number } }[]).map(
        (l) => ({ x1: l.source.x, y1: l.source.y, x2: l.target.x, y2: l.target.y })
      );
      graph.value = {
        nodes: nodes.map((n) => ({ id: n.id, title: n.title, x: n.x, y: n.y })),
        links: linksOut,
      };
    } catch {
      graph.value = null;
    }
  });

  return (
    <details class="notes-graph" data-testid="notes-graph" open>
      <summary class="notes-graph-summary">双链图谱</summary>
      <svg class="notes-graph-svg" data-testid="notes-graph-svg" viewBox="0 0 320 200">
        {graph.value && (
          <>
            {graph.value.links.map((l, i) => (
              <line key={`l-${i}`} class="notes-graph-edge" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
            ))}
            {graph.value.nodes.map((n, i) => (
              <g key={`n-${i}`} class="notes-graph-node-g" transform={`translate(${n.x},${n.y})`}>
                <circle class="notes-graph-node" r={8} />
                <text class="notes-graph-label" x={12} y={4}>
                  {n.title}
                </text>
              </g>
            ))}
          </>
        )}
      </svg>
    </details>
  );
});

const SeriesNav = component$<{
  doc: ArticleDoc;
  onNav: QRL<(slug: string) => void>;
  onOpenSeries: QRL<(name: string) => void>;
}>(({ doc, onNav, onOpenSeries }) => {
  const s = doc.series;
  if (!s) return null;
  return (
    <nav class="notes-series" data-testid="notes-series" aria-label="系列导航">
      <div class="notes-series-head">
        <span class="notes-series-name">{s.name}</span>
        <span class="notes-series-order">
          {s.order} / {s.total}
        </span>
      </div>
      <div class="notes-series-nav">
        {s.prev ? (
          <button type="button" class="notes-series-link" onClick$={() => onNav(s.prev!.slug)}>
            ← {s.prev.title}
          </button>
        ) : (
          <span class="notes-series-link notes-series-link--disabled">← 上一篇</span>
        )}
        {s.next ? (
          <button type="button" class="notes-series-link" onClick$={() => onNav(s.next!.slug)}>
            {s.next.title} →
          </button>
        ) : (
          <span class="notes-series-link notes-series-link--disabled">下一篇 →</span>
        )}
        <button
          type="button"
          class="notes-series-link notes-series-link--series"
          onClick$={() => onOpenSeries(s.name)}
          data-testid="notes-series-link"
        >
          查看专栏 →
        </button>
      </div>
    </nav>
  );
});

/** 专栏状态 → 中文角标文案。 */
function seriesStatusLabel(status?: SeriesInfo['status']): string {
  switch (status) {
    case 'completed':
      return '已完结';
    case 'wip':
      return '撰写中';
    case 'archived':
      return '已归档';
    default:
      return ''; // 不再展示「连载中」
  }
}

/** 专栏卡片行（列表页顶部，横向滚动）；点击 → 专栏详情（SPA pushState）。 */
const SeriesCards = component$<{ series: SeriesInfo[]; onOpen: QRL<(slug: string) => void> }>(
  ({ series, onOpen }) => {
    if (!series.length) return null;
    return (
      <section class="notes-series-cards" data-testid="notes-series-cards" aria-label="专栏">
        <div class="notes-series-cards-row">
          {series.map((s) => {
            const statusLabel = s.status ? seriesStatusLabel(s.status) : '';
            return (
            <button
              type="button"
              key={s.slug}
              class="notes-series-card"
              data-testid="notes-series-card"
              onClick$={() => onOpen(s.slug)}
            >
              {s.cover && <img class="notes-series-card-cover" src={s.cover} alt="" aria-hidden="true" />}
              <span class="notes-series-card-badge">专栏</span>
              {statusLabel && (
                <span class={`notes-series-card-status notes-series-card-status--${s.status}`}>
                  {statusLabel}
                </span>
              )}
              <span class="notes-series-card-name">{s.name}</span>
              {s.summary && <span class="notes-series-card-summary">{s.summary}</span>}
              <span class="notes-series-card-count">共 {s.count} 篇</span>
            </button>
            );
          })}
        </div>
      </section>
    );
  }
);

/** 专栏详情视图（纯 CSR）：封面 + 标题 + 简介 + 篇数 + 文章列表（按 order 升序，标「第 N 篇」）。 */
const SeriesDetail = component$<{
  info: SeriesInfo;
  articles: ArticleSummary[];
  onBack: QRL<() => void>;
  onOpenArticle: QRL<(slug: string) => void>;
}>(({ info, articles, onBack, onOpenArticle }) => {
  const statusLabel = info.status ? seriesStatusLabel(info.status) : '';
  return (
  <div class="notes-series-detail" data-testid="notes-series-detail">
    <button type="button" class="notes-back" onClick$={onBack}>
      ← 返回列表
    </button>
    <header class="notes-series-detail-head">
      {info.cover && <img class="notes-series-detail-cover" src={info.cover} alt="" aria-hidden="true" />}
      <div class="notes-series-detail-meta">
        <span class="notes-series-card-badge">专栏</span>
        {statusLabel && (
          <span class={`notes-series-card-status notes-series-card-status--${info.status}`}>
            {statusLabel}
          </span>
        )}
        <h1 class="notes-series-detail-title">{info.name}</h1>
        {info.summary && <p class="notes-series-detail-summary">{info.summary}</p>}
        <p class="notes-series-detail-count">共 {info.count} 篇</p>
      </div>
    </header>
    {articles.length ? (
      <ol class="notes-series-list">
        {articles.map((a) => (
          <li key={a.slug} class="notes-series-list-item">
            <button
              type="button"
              class="notes-series-list-link"
              data-testid="notes-series-article"
              onClick$={() => onOpenArticle(a.slug)}
            >
              <span class="notes-series-list-order">第 {a.series?.order ?? '?'} 篇</span>
              <span class="notes-series-list-title">{a.title}</span>
              <span class="notes-series-list-date">{a.date}</span>
            </button>
          </li>
        ))}
      </ol>
    ) : (
      <p class="notes-muted">该专栏暂未发布文章。</p>
    )}
  </div>
  );
});

/**
 * 数据版本页脚（N-T19）：展示数据来源（sourceRef）与生成时间（generatedAt）。
 * 与列表/详情共用，置于 NotesShell 底部，data 来自 PostsIndex。
 */
const NotesDataVersion = component$<{ index: PostsIndex | null }>(({ index }) => {
  if (!index) return null;
  const dt = new Date(index.generatedAt);
  const fmt = isNaN(dt.getTime())
    ? index.generatedAt
    : dt.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
  return (
    <footer class="notes-dataver" data-testid="notes-dataver">
      <span>数据来源：{index.sourceRef}</span>
      <span aria-hidden="true">·</span>
      <span>生成于 {fmt}</span>
    </footer>
  );
});

/**
 * 详情视图（N-T13 TOC 悬浮目录 + 滚动高亮；N-T14 阅读进度条）。
 * - TOC 由 doc.headings 生成，锚点 slug 与 MdastRenderer 的 heading id 完全一致（数据层注入 headingId）。
 * - IntersectionObserver 跟踪当前可见区块高亮对应目录项；scroll 监听计算进度条宽度。
 * - 切换文章时用 key={doc.id} 强制重挂载，observer/listener 随卸载清理（C-33）。
 */
const ArticleView = component$<{
  doc: ArticleDoc;
  onBack: QRL<() => void>;
  onNav: QRL<(slug: string) => void>;
  onOpenSeries: QRL<(name: string) => void>;
}>(({ doc, onBack, onNav, onOpenSeries }) => {
  const toc = doc.headings.filter((h) => h.depth >= 2 && h.depth <= 3);
  const activeSlug = useSignal(toc[0]?.slug ?? '');
  const progress = useSignal(0);
  const related = useSignal<RelatedItem[]>([]);

  // 新增 A：阅读设置（字号/宽窄）与详情页收藏星标（SSR 默认安全值，客户端初始化时读 localStorage）
  const readingSig = useSignal<ReadingCfg>(DEFAULT_READING);
  const favDetail = useSignal<string[]>([]);
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    readingSig.value = loadReading();
    favDetail.value = getFavs();
  });

  // N-T21：懒加载全量文章并基于「共同引用 + 标签 Jaccard」计算相关文章
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      const all = await loadAllArticles();
      related.value = computeRelated(doc, all);
    } catch {
      related.value = [];
    }
  });

  // N-T28：运行时注入 og:image（构建期由 tools/gen-og.mjs 生成 SVG）。
  // 注意：纯 CSR 站点爬虫不执行 JS，故真实 OG 抓取需回到 per-route SSG（见计划 R-1 / §12.4）。
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const fileName = doc.slug.replace(/ /g, '_');
    let el = document.head.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', 'og:image');
      document.head.appendChild(el);
    }
    el.setAttribute('content', `/og/${fileName}.svg`);
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const headings = Array.from(
      document.querySelectorAll('.md-body h2[id], .md-body h3[id], .md-body h4[id]')
    ) as HTMLElement[];
    const visible = new Set<string>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).id;
          if (e.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const top = headings.find((h) => visible.has(h.id));
        if (top) activeSlug.value = top.id;
      },
      { rootMargin: '0px 0px -70% 0px', threshold: [0, 1] }
    );
    headings.forEach((h) => obs.observe(h));
    cleanup(() => obs.disconnect());

    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      progress.value = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    cleanup(() => window.removeEventListener('scroll', onScroll));
  });

  return (
    <div class="notes-detail-wrap">
      <div class="notes-progress" style={{ width: `${progress.value * 100}%` }} aria-hidden="true" />
      <aside class="notes-toc" aria-label="目录">
        <div class="notes-toc-title">目录</div>
        <ul class="notes-toc-list">
          {toc.map((h) => (
            <li key={h.slug} class={`notes-toc-item notes-toc-item--d${h.depth}`}>
              <a
                href={`#${h.slug}`}
                class={{ 'is-active': activeSlug.value === h.slug }}
                onClick$={(ev) => {
                  ev.preventDefault();
                  const t = document.getElementById(h.slug);
                  if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  activeSlug.value = h.slug;
                  history.replaceState(null, '', `#${h.slug}`);
                }}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </aside>
      <article
        class={{
          'notes-detail': true,
          'read-fz-s': readingSig.value.fz === 's',
          'read-fz-m': readingSig.value.fz === 'm',
          'read-fz-l': readingSig.value.fz === 'l',
          'read-width-narrow': readingSig.value.width === 'narrow',
          'read-width-wide': readingSig.value.width === 'wide',
        }}
        data-testid="notes-detail"
      >
        <button type="button" class="notes-back" onClick$={onBack}>
          ← 返回列表
        </button>
        <div class="notes-readbar" data-testid="notes-readbar">
          <div class="notes-readbar-group" role="group" aria-label="字号">
            <span class="notes-readbar-label">字号</span>
            {(['s', 'm', 'l'] as ReadFont[]).map((f) => (
              <button
                type="button"
                key={f}
                class={{ 'notes-readbar-btn': true, 'is-active': readingSig.value.fz === f }}
                onClick$={() => {
                  readingSig.value = { ...readingSig.value, fz: f };
                  saveReading(readingSig.value);
                }}
              >
                {f === 's' ? '小' : f === 'm' ? '中' : '大'}
              </button>
            ))}
          </div>
          <div class="notes-readbar-group" role="group" aria-label="宽度">
            <span class="notes-readbar-label">宽度</span>
            {(['narrow', 'wide'] as ReadWidth[]).map((w) => (
              <button
                type="button"
                key={w}
                class={{ 'notes-readbar-btn': true, 'is-active': readingSig.value.width === w }}
                onClick$={() => {
                  readingSig.value = { ...readingSig.value, width: w };
                  saveReading(readingSig.value);
                }}
              >
                {w === 'narrow' ? '窄' : '宽'}
              </button>
            ))}
          </div>
          <button
            type="button"
            class={{ 'notes-readbar-fav': true, 'is-fav': favDetail.value.includes(doc.slug) }}
            data-testid="notes-detail-fav"
            aria-label={favDetail.value.includes(doc.slug) ? '取消收藏' : '收藏'}
            onClick$={() => {
              toggleFav(doc.slug);
              favDetail.value = getFavs();
            }}
          >
            {favDetail.value.includes(doc.slug) ? '★ 已收藏' : '☆ 收藏'}
          </button>
        </div>
        <ArticleHeader doc={doc} />
        <SeriesNav doc={doc} onNav={onNav} onOpenSeries={onOpenSeries} />
        <MdastRenderer ast={doc.ast} />
        <ReferencesBlock doc={doc} />
        <BacklinksBlock doc={doc} />
        <HistoryBlock doc={doc} />
        <RelatedArticles items={related.value} />
        <Comments slug={doc.slug} />
      </article>
    </div>
  );
});

/** 按 年 → 月 对文章分组，供归档视图使用（N-T17）。 */
function buildArchive(posts: ArticleSummary[]): { year: string; months: { key: string; label: string; posts: ArticleSummary[] }[] }[] {
  const byYear = new Map<string, Map<string, ArticleSummary[]>>();
  for (const p of posts) {
    const d = new Date(p.date);
    const year = String(d.getFullYear());
    const month = String(d.getMonth() + 1).padStart(2, '0');
    if (!byYear.has(year)) byYear.set(year, new Map());
    const ym = byYear.get(year)!;
    if (!ym.has(month)) ym.set(month, []);
    ym.get(month)!.push(p);
  }
  return Array.from(byYear.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, mons]) => ({
      year,
      months: Array.from(mons.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([m, ps]) => ({ key: `${year}-${m}`, label: `${Number(m)} 月`, posts: ps })),
    }));
}

export const NotesShell = component$(() => {
  const state = useStore<{
    slug: string;
    doc: ArticleDoc | null;
    loading: boolean;
    err: string;
    index: PostsIndex | null;
    indexLoading: boolean;
    initialHash: string | null;
    seriesSlug: string;
  }>({ slug: '', doc: null, loading: false, err: '', index: null, indexLoading: true, initialHash: null, seriesSlug: '' });

  // 专栏列表（运行时取 build/series.json）；seriesSlug 非空表示当前处于专栏详情视图
  const seriesList = useSignal<SeriesInfo[]>([]);
  const seriesLoaded = useSignal(false);

  // N-T17：列表筛选（标签）与视图（列表/归档）状态
  const tagFilter = useSignal('');
  const viewMode = useSignal<'list' | 'archive'>('list');
  const tagPopoverOpen = useSignal(false);

  // 新增：内容视图（全部 / 收藏 / 标签云）、收藏列表、键盘导航高亮索引、回到顶端显隐
  const contentMode = useSignal<'all' | 'fav' | 'tags'>('all');
  const favSig = useSignal<string[]>([]);
  const kbIdx = useSignal(-1);
  const backTopVisible = useSignal(false);
  // 搜索框 ref（键盘 `/` 聚焦用）；注意 input 仍由 signal 受控（Qwik 坑④不适用，此处非动态挂载）
  const searchRef = useSignal<HTMLInputElement>();
  // 键盘导航可用文章序列（slug）：仅在筛选/搜索/视图/收藏/索引变化时重算，避免每次渲染写 store 触发无限重渲染
  const kbList = useSignal<string[]>([]);

  // N-T20：全文搜索（FlexSearch 懒加载 2-gram）。索引构建在浏览器运行时，配合 searchReady 触发重渲染。
  const searchQuery = useSignal('');
  const searchReady = useSignal(false);
  const searchBuilding = useSignal(false);
  const ensureSearchIndex = $(async () => {
    if (searchCache.idx) {
      if (!searchReady.value) searchReady.value = true;
      return;
    }
    if (searchBuilding.value) return;
    searchBuilding.value = true;
    try {
      const docs = await loadAllArticles();
      searchCache.idx = await buildIndex(docs);
      searchReady.value = true;
    } finally {
      searchBuilding.value = false;
    }
  });

  const loadArticleBySlug = $(async (slug: string) => {
    state.loading = true;
    state.err = '';
    try {
      const doc = await loadArticle(slug);
      state.doc = doc;
      if (!doc) state.err = '未找到该文章';
    } catch (e) {
      state.err = '加载失败：' + (e instanceof Error ? e.message : String(e));
    } finally {
      state.loading = false;
    }
  });

  const loadIndex = $(async () => {
    state.indexLoading = true;
    try {
      state.index = await loadNotesIndex();
    } finally {
      state.indexLoading = false;
    }
  });

  const navigate = $(async (slug: string) => {
    state.seriesSlug = ''; // 切换到文章/列表视图时清空专栏态
    state.slug = slug;
    if (slug) await loadArticleBySlug(slug);
    else state.doc = null;
  });

  const openNote = $((slug: string) => {
    state.initialHash = null; // 应用内导航不再按深链锚点滚动
    state.seriesSlug = '';
    history.pushState({ noteSlug: slug }, '', notePathFor(slug));
    void navigate(slug);
  });

  // 进入专栏详情视图（纯 CSR，文章列表来自已加载的 index，无需额外取数）
  const openSeries = $((ss: string) => {
    state.initialHash = null;
    state.slug = '';
    state.doc = null;
    state.seriesSlug = ss;
    history.pushState({ seriesSlug: ss }, '', seriesPathFor(ss));
  });

  // 详情页「查看专栏」：按系列 name 在已加载的 seriesList 中取规范 slug（series.json 手动别名），
  // 未登记系列兜底用 slugifySeries(name) 派生，避免 slug 别名与派生 slug 不一致导致 404。
  const openSeriesByName = $((name: string) => {
    const info = seriesList.value.find((s) => s.name === name);
    openSeries(info ? info.slug : slugifySeries(name));
  });

  const backToList = $(() => {
    state.initialHash = null;
    state.seriesSlug = ''; // 从专栏/文章返回列表均清空专栏态
    favSig.value = getFavs(); // 从详情返回列表时刷新收藏（详情页可能改过收藏态）
    const hs = history.state as { noteSlug?: string; seriesSlug?: string } | null;
    if (hs && (hs.noteSlug || hs.seriesSlug)) history.back();
    else {
      history.pushState(null, '', notePathFor(''));
      void navigate('');
    }
  });

  const retry = $(() => {
    if (state.slug) void loadArticleBySlug(state.slug);
    else void loadIndex();
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    const pending = readPendingRedirect();
    // 专栏页：/notes/series/<slug>/ —— 与文章共用 catch-all，此处优先分流
    const seriesSlug = noteSeriesSlugFromPath(pending ?? location.pathname);
    const resolved = seriesSlug
      ? { slug: '', restoreUrl: seriesPathFor(seriesSlug), hash: null as string | null }
      : resolveInitialSlug(location.pathname, pending);
    if (resolved.restoreUrl)
      history.replaceState(seriesSlug ? { seriesSlug } : { noteSlug: resolved.slug }, '', resolved.restoreUrl);
    state.seriesSlug = seriesSlug;
    state.initialHash = resolved.hash;
    await loadIndex();
    seriesList.value = await loadSeries(defaultNotesCfg());
    seriesLoaded.value = true;
    if (!seriesSlug) await navigate(resolved.slug);
    favSig.value = getFavs(); // 初始化收藏列表（SSR 守卫在 lib 内）

    const onPop = () => {
      const ss = noteSeriesSlugFromPath(location.pathname);
      if (ss) {
        state.slug = '';
        state.doc = null;
        state.seriesSlug = ss;
      } else {
        void navigate(noteSlugFromPath(location.pathname));
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  // 键盘导航可用列表：依赖（标签/搜索/视图/收藏/索引）变化时重算一次（不在渲染期写 store，避免无限重渲染）
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => tagFilter.value);
    track(() => searchQuery.value);
    track(() => contentMode.value);
    track(() => viewMode.value);
    track(() => favSig.value);
    track(() => state.index);
    const all = state.index?.posts ?? [];
    const q = searchQuery.value.trim();
    const hits = q && searchCache.idx ? search(searchCache.idx, q) : null;
    const hitSet = hits ? new Set(hits) : null;
    const base = tagFilter.value ? all.filter((p) => p.tags.includes(tagFilter.value)) : all;
    const visible = hitSet ? base.filter((p) => hitSet.has(p.slug)) : base;
    const shown = contentMode.value === 'fav' ? visible.filter((p) => favSig.value.includes(p.slug)) : visible;
    kbList.value = shown.map((p) => p.slug);
  });

  // 键盘导航（列表态 j/k/Enter、详情态 Esc）+ 回到顶端滚动监听（新增功能 F / 回到顶端）
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement;
      const typing = !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
      if (state.slug) {
        // 详情态：Esc 返回列表
        if (e.key === 'Escape' && !typing) {
          e.preventDefault();
          void backToList();
        }
        return;
      }
      if (typing) return; // 搜索框聚焦时不拦截字母/方向键
      if (e.key === '/') {
        e.preventDefault();
        searchRef.value?.focus();
        return;
      }
      // 仅在卡片列表态（contentMode!=='tags' 且 viewMode==='list'）响应 j/k/Enter
      const inList = contentMode.value !== 'tags' && viewMode.value === 'list';
      const n = kbList.value.length;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        if (!inList || n === 0) return;
        e.preventDefault();
        kbIdx.value = Math.min(n - 1, kbIdx.value + 1);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        if (!inList || n === 0) return;
        e.preventDefault();
        kbIdx.value = Math.max(0, kbIdx.value - 1);
      } else if (e.key === 'Enter') {
        if (!inList || kbIdx.value < 0 || kbIdx.value >= n) return;
        e.preventDefault();
        const slug = kbList.value[kbIdx.value];
        if (slug) openNote(slug);
      }
    };
    window.addEventListener('keydown', onKey);
    const onScroll = () => {
      backTopVisible.value = window.scrollY > 400;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    cleanup(() => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    });
  });

  // N-T29：深链带页内锚点（#heading）时，文章加载后滚动到对应小节。
  // 锚点 id 与 MdastRenderer 标题 id 一致；先按 id 定位，缺则按标题文本兜底。
  // 文章 DOM 可能尚未绘制，最多重试若干帧。
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => state.doc);
    const h = state.initialHash;
    if (!state.doc || !h) return;
    const scrollTo = (): boolean => {
      const el = document.getElementById(h) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }
      // 兜底：标题 id 缺失（如生成规则不一致）时按标题文本定位
      const heads = Array.from(
        document.querySelectorAll('.md-body h2[id], .md-body h3[id], .md-body h4[id]')
      ) as HTMLElement[];
      const byText = heads.find((e) => (e.textContent ?? '').trim() === h);
      if (byText) {
        byText.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }
      return false;
    };
    // 文章 DOM 可能尚未绘制（同一帧内 doc 先置位、Markdown 渲染稍后），最多重试若干帧。
    let tries = 0;
    const tick = () => {
      if (scrollTo() || tries++ >= 24) return;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const allPosts = state.index?.posts ?? [];
  const tagCounts = new Map<string, number>();
  allPosts.forEach((p) => p.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));
  const tags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const MAX_TAGS = 8;
  // 纯切片（不读信号，安全）：前 8 与剩余。信号判断全部留在 JSX 行内，保证索引加载后每次渲染都取最新值
  const tagsBase = tags.slice(0, MAX_TAGS);
  const tagsRest = tags.slice(MAX_TAGS);

  // N-T20：搜索命中 → 在标签筛选基础上再收窄。索引未就绪时（query 已输入但仍在构建）暂不过滤，避免误清空。
  const searchQ = searchQuery.value.trim();
  const searchHits = searchQ && searchCache.idx ? search(searchCache.idx, searchQ) : null;
  const hitSet = searchHits ? new Set(searchHits) : null;
  const basePosts = tagFilter.value ? allPosts.filter((p) => p.tags.includes(tagFilter.value)) : allPosts;
  const visiblePosts = hitSet ? basePosts.filter((p) => hitSet.has(p.slug)) : basePosts;
  // 收藏视图：在标签/搜索筛选基础上再收窄（contentMode 为普通信号读取，普通语句内安全）
  const shownPosts =
    contentMode.value === 'fav' ? visiblePosts.filter((p) => favSig.value.includes(p.slug)) : visiblePosts;

  const isList = !state.slug;

  return (
    <section data-testid="notes-shell" class="notes-shell mc-container">
      {state.seriesSlug ? (
        (() => {
          const info = seriesList.value.find((s) => s.slug === state.seriesSlug);
          if (!info) {
            if (!seriesLoaded.value) return <p class="notes-muted">加载中…</p>;
            return (
              <div data-testid="notes-series-notfound" class="notes-notfound">
                <h1>未找到该专栏</h1>
                <p>不存在 slug 为「{state.seriesSlug}」的专栏。</p>
                <button type="button" class="btn" onClick$={backToList}>
                  返回列表
                </button>
              </div>
            );
          }
          const arts = allPosts
            .filter((p) => p.series?.name === info.name)
            .sort((a, b) => (a.series?.order ?? 999) - (b.series?.order ?? 999));
          return (
            <SeriesDetail info={info} articles={arts} onBack={backToList} onOpenArticle={openNote} />
          );
        })()
      ) : isList ? (
        <div data-testid="notes-list">
          <h1 class="notes-page-title">Notes</h1>
          <SeriesCards series={seriesList.value} onOpen={openSeries} />
          {state.indexLoading ? (
            <p class="notes-muted">加载中…</p>
          ) : allPosts.length ? (
            <>
              <div class="notes-search-wrap">
                <input
                  type="search"
                  class="notes-search"
                  placeholder="搜索标题、正文、标签…"
                  data-testid="notes-search"
                  ref={searchRef}
                  value={searchQuery.value}
                  onFocus$={() => ensureSearchIndex()}
                  onInput$={(_, el) => {
                    searchQuery.value = (el as HTMLInputElement).value;
                    void ensureSearchIndex();
                  }}
                />
                {searchQ && (
                  <button
                    type="button"
                    class="notes-search-clear"
                    data-testid="notes-search-clear"
                    onClick$={() => (searchQuery.value = '')}
                    aria-label="清除搜索"
                  >
                    ×
                  </button>
                )}
                {searchQ && (
                  <span class="notes-search-status" data-testid="notes-search-status">
                    {searchBuilding.value && !searchReady.value
                      ? '索引构建中…'
                      : `命中 ${visiblePosts.length} 篇`}
                  </span>
                )}
              </div>
              <div class="notes-toolbar">
                <div class="notes-tags" data-testid="notes-tags">
                  <button
                    type="button"
                    class={{ 'notes-tag': true, 'notes-tag--active': tagFilter.value === '' }}
                    onClick$={() => (tagFilter.value = '')}
                  >
                    全部
                  </button>
                  {(() => {
                    const sel = tagFilter.value;
                    if (sel && !tagsBase.some(([t]) => t === sel)) {
                      const entry = tags.find(([t]) => t === sel);
                      if (entry) return [...tagsBase.slice(0, MAX_TAGS - 1), entry];
                    }
                    return tagsBase;
                  })().map(([t, c]) => (
                    <button
                      key={t}
                      type="button"
                      class={{ 'notes-tag': true, 'notes-tag--active': tagFilter.value === t }}
                      onClick$={() => (tagFilter.value = tagFilter.value === t ? '' : t)}
                    >
                      {t}
                      <span class="notes-tag-count">{c}</span>
                    </button>
                  ))}
                  {tagsRest.filter(([t]) => t !== tagFilter.value).length > 0 && (
                    <div class={{ 'notes-tags-more-wrap': true, 'is-open': tagPopoverOpen.value }}>
                      <button
                        type="button"
                        class="notes-tag notes-tag--more"
                        data-testid="notes-tag-more"
                        aria-haspopup="true"
                        aria-expanded={tagPopoverOpen.value}
                        onClick$={() => (tagPopoverOpen.value = !tagPopoverOpen.value)}
                      >
                        更多 {tagsRest.filter(([t]) => t !== tagFilter.value).length} 个 ▾
                      </button>
                      <div class="notes-tags-popover" role="menu">
                        {tagsRest.filter(([t]) => t !== tagFilter.value).map(([t, c]) => (
                          <button
                            key={t}
                            type="button"
                            class={{ 'notes-tag': true, 'notes-tag--pop': true, 'notes-tag--active': tagFilter.value === t }}
                            role="menuitem"
                            onClick$={() => {
                              tagFilter.value = t;
                              tagPopoverOpen.value = false;
                            }}
                          >
                            {t}
                            <span class="notes-tag-count">{c}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div class="notes-toolbar-right">
                  <div class="notes-view-toggle" data-testid="notes-content-toggle" role="group" aria-label="内容视图">
                    <button
                      type="button"
                      class={{ 'notes-view-btn': true, 'is-active': contentMode.value === 'all' }}
                      onClick$={() => { contentMode.value = 'all'; kbIdx.value = -1; }}
                    >
                      全部
                    </button>
                    <button
                      type="button"
                      class={{ 'notes-view-btn': true, 'is-active': contentMode.value === 'fav' }}
                      onClick$={() => { contentMode.value = 'fav'; kbIdx.value = -1; }}
                    >
                      收藏
                    </button>
                    <button
                      type="button"
                      class={{ 'notes-view-btn': true, 'is-active': contentMode.value === 'tags' }}
                      onClick$={() => { contentMode.value = 'tags'; kbIdx.value = -1; }}
                    >
                      标签云
                    </button>
                  </div>
                  <div class="notes-view-toggle" data-testid="notes-view-toggle">
                    <button
                      type="button"
                      class={{ 'notes-view-btn': true, 'is-active': viewMode.value === 'list' }}
                      onClick$={() => (viewMode.value = 'list')}
                    >
                      列表
                    </button>
                    <button
                      type="button"
                      class={{ 'notes-view-btn': true, 'is-active': viewMode.value === 'archive' }}
                      onClick$={() => (viewMode.value = 'archive')}
                    >
                      归档
                    </button>
                  </div>
                </div>
              </div>
              {contentMode.value === 'tags' ? (
                <div class="notes-cloud" data-testid="notes-cloud">
                  <p class="notes-cloud-hint">点击标签查看相关文章</p>
                  <div class="notes-cloud-items">
                    {tags.map(([t, c]) => {
                      const max = tags[0]?.[1] || 1;
                      const min = tags[tags.length - 1]?.[1] || 1;
                      const size = 12 + Math.round(((c - min) / Math.max(1, max - min)) * 10);
                      return (
                        <button
                          type="button"
                          key={t}
                          class={{ 'notes-cloud-item': true, 'is-active': tagFilter.value === t }}
                          style={{ fontSize: `${size}px` }}
                          onClick$={() => {
                            tagFilter.value = t;
                            contentMode.value = 'all';
                            viewMode.value = 'list';
                            kbIdx.value = -1;
                          }}
                        >
                          {t}
                          <span class="notes-cloud-count">{c}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : viewMode.value === 'archive' ? (
                <div class="notes-archive" data-testid="notes-archive">
                  {buildArchive(shownPosts).map((y) => (
                    <section key={y.year} class="notes-archive-year">
                      <h3 class="notes-archive-year-title">{y.year}</h3>
                      {y.months.map((m) => (
                        <div key={m.key} class="notes-archive-month">
                          <h4 class="notes-archive-month-title">{m.label}</h4>
                          <ul class="notes-archive-list">
                            {m.posts.map((p) => (
                              <li key={p.slug}>
                                <button
                                  type="button"
                                  class="notes-archive-item"
                                  data-testid="notes-archive-item"
                                  onClick$={() => openNote(p.slug)}
                                >
                                  <span class="notes-archive-item-title">{p.title}</span>
                                  <span class="notes-archive-item-date">{p.date}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              ) : searchQ && shownPosts.length === 0 ? (
                <p class="notes-muted" data-testid="notes-search-empty">
                  未找到与「{searchQ}」匹配的文章。
                </p>
              ) : (
                <ul class="notes-cards">
                  {shownPosts.map((p, i) => (
                    <li key={p.slug}>
                      <button
                        type="button"
                        class={{ 'notes-card': true, 'is-fav': favSig.value.includes(p.slug), 'is-kb': kbIdx.value === i }}
                        data-testid="notes-item"
                        data-slug={p.slug}
                        data-idx={i}
                        onClick$={() => openNote(p.slug)}
                      >
                        <span
                          class="notes-card-fav"
                          data-testid="notes-fav-star"
                          role="button"
                          aria-label={favSig.value.includes(p.slug) ? '取消收藏' : '收藏'}
                          onClick$={(ev) => {
                            ev.stopPropagation();
                            toggleFav(p.slug);
                            favSig.value = getFavs();
                          }}
                        >
                          {favSig.value.includes(p.slug) ? '★' : '☆'}
                        </span>
                        <span class="notes-card-title">{p.title}</span>
                        {p.description && <span class="notes-card-desc">{p.description}</span>}
                        <span class="notes-card-meta">
                          {p.date} · {p.readingTime.minutes} 分钟 · {p.tags.join(' / ')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <NotesStatsPanel posts={allPosts} />
              <NotesGraph />
            </>
          ) : state.err ? (
            <div class="notes-error" data-testid="notes-error">
              <p>加载失败：{state.err}</p>
              <button type="button" class="btn" onClick$={retry}>
                重试
              </button>
            </div>
          ) : (
            <p class="notes-muted">暂无文章。</p>
          )}
        </div>
      ) : state.loading ? (
        <p class="notes-muted">加载中…</p>
      ) : state.doc ? (
        <ArticleView key={state.doc.id} doc={state.doc} onBack={backToList} onNav={openNote} onOpenSeries={openSeriesByName} />
      ) : (
        <div data-testid="notes-notfound" class="notes-notfound">
          <h1>{state.err || '未找到'}</h1>
          <p>不存在标题为「{state.slug}」的文章。</p>
          <button type="button" class="btn" onClick$={backToList}>
            返回列表
          </button>
        </div>
      )}
      <NotesDataVersion index={state.index} />
      <button
        type="button"
        class={{ 'notes-backtop': true, 'is-show': backTopVisible.value }}
        data-testid="notes-backtop"
        aria-label="回到顶端"
        onClick$={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        ↑
      </button>
    </section>
  );
});
