import { component$, useSignal, useStore, useVisibleTask$, $, type QRL } from '@builder.io/qwik';
import type { ArticleDoc, ArticleSummary, PostsIndex, NotesCfg } from '../../lib/notes/types';
import { loadArticle, loadNotesIndex, loadAllArticles, defaultNotesCfg } from '../../lib/notes/source';
import { buildIndex, search, type NoteSearch } from '../../lib/notes/search';
import { computeRelated, type RelatedItem } from '../../lib/notes/related';
import { computeStats, intensityLevel } from '../../lib/notes/stats';
import { noteSlugFromPath, notePathFor, resolveInitialSlug } from '../../lib/notes/slug';
import { readPendingRedirect } from '../../lib/spa-redirect';
import { MdastRenderer } from './MdastRenderer';

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
 * 评论（N-T27）：Giscus 配置驱动。
 * 有 NotesCfg.giscus → 注入 Giscus 脚本（需目标仓库开启 GitHub Discussions 且安装 Giscus App）；
 * 无配置 → 显示占位说明，避免静默失效。
 * Giscus 加载失败时（仓库未装 App / 未开 Discussions / 配置错误）以 postMessage 通知父页，
 * 收到即隐藏原始 iframe、改显示诚实说明，避免裸露「giscus is not installed…」报错。
 */
const Comments = component$<{ cfg: NotesCfg }>(({ cfg }) => {
  const ref = useSignal<HTMLDivElement>();
  const failed = useSignal(false);
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    if (!cfg.giscus || !ref.value) return;
    const g = cfg.giscus!;
    const host = ref.value;
    const themeOf = () => (document.body.dataset.theme === 'dark' ? 'dark' : 'light');

    // 先清空：SPA 内切换文章会重新执行本任务，避免 iframe 越叠越多
    host.replaceChildren();
    const s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.setAttribute('data-repo', g.repo);
    s.setAttribute('data-repo-id', g.repoId);
    s.setAttribute('data-category', g.category);
    s.setAttribute('data-category-id', g.categoryId);
    s.setAttribute('data-mapping', g.mapping ?? 'pathname');
    s.setAttribute('data-reactions-enabled', '1');
    s.setAttribute('data-emit-metadata', '0');
    s.setAttribute('data-input-position', 'bottom');
    s.setAttribute('data-theme', themeOf());
    s.setAttribute('data-lang', 'zh-CN');
    host.appendChild(s);

    // Giscus 失败时以 postMessage 通知父页，收到即切到诚实说明（隐藏原始 iframe 报错）
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== 'https://giscus.app') return;
      const d = e.data as { giscus?: { error?: string } } | undefined;
      if (d?.giscus?.error) failed.value = true;
    };
    window.addEventListener('message', onMsg);

    // 主题跟随：站点明暗切换后通知已加载的 giscus iframe 换主题（否则评论框停在进入时的主题）
    const postTheme = () => {
      const frame = host.querySelector('iframe.giscus-frame') as HTMLIFrameElement | null;
      frame?.contentWindow?.postMessage(
        { giscus: { setConfig: { theme: themeOf() } } },
        'https://giscus.app'
      );
    };
    const mo = new MutationObserver(postTheme);
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

    cleanup(() => {
      window.removeEventListener('message', onMsg);
      mo.disconnect();
      s.remove();
    });
  });

  if (!cfg.giscus) {
    return (
      <section class="notes-comments notes-comments--off" data-testid="notes-comments" aria-label="评论">
        <h2 class="notes-section-title">评论</h2>
        <p class="notes-muted">评论功能需在 NotesCfg 中配置 GitHub Discussions（Giscus）。当前站点未启用。</p>
      </section>
    );
  }
  return (
    <section class="notes-comments" data-testid="notes-comments" aria-label="评论">
      <h2 class="notes-section-title">评论</h2>
      {failed.value ? (
        <div class="notes-giscus notes-giscus--error">
          <p class="notes-muted">
            评论（Giscus）暂时不可用：目标仓库未安装 Giscus 应用或未开启 Discussions。
            启用步骤见站点文档 <code>docs/third-party/giscus.md</code>。
          </p>
        </div>
      ) : (
        <div ref={ref} class="notes-giscus" />
      )}
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
      {stats.tagCounts.length > 0 && (
        <div class="notes-stats-tags">
          {stats.tagCounts.map((t, i) => (
            <span key={`tg-${i}`} class="notes-stat-tag">
              {t.tag} <b>{t.count}</b>
            </span>
          ))}
        </div>
      )}
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

const SeriesNav = component$<{ doc: ArticleDoc; onNav: QRL<(slug: string) => void> }>(({ doc, onNav }) => {
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
      </div>
    </nav>
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
  initialHash: string | null;
}>(({ doc, onBack, onNav, initialHash }) => {
  const toc = doc.headings.filter((h) => h.depth >= 2 && h.depth <= 3);
  const activeSlug = useSignal(toc[0]?.slug ?? '');
  const progress = useSignal(0);
  const related = useSignal<RelatedItem[]>([]);

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

  // N-T29：深链带页内锚点（#heading）时，文章挂载后滚动到对应小节。
  // 锚点 id 与 MdastRenderer 标题 id 一致；先按 id 定位，缺则按标题文本兜底。
  // 文章 DOM 可能尚未绘制，最多重试若干帧。
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (!initialHash) return;
    const h = initialHash;
    const scrollTo = (): boolean => {
      const el = document.getElementById(h) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }
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
    let tries = 0;
    const tick = () => {
      if (scrollTo() || tries++ >= 12) return;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
      <article class="notes-detail" data-testid="notes-detail">
        <button type="button" class="notes-back" onClick$={onBack}>
          ← 返回列表
        </button>
        <ArticleHeader doc={doc} />
        <SeriesNav doc={doc} onNav={onNav} />
        <MdastRenderer ast={doc.ast} />
        <ReferencesBlock doc={doc} />
        <BacklinksBlock doc={doc} />
        <HistoryBlock doc={doc} />
        <RelatedArticles items={related.value} />
        <Comments cfg={defaultNotesCfg()} />
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
  }>({ slug: '', doc: null, loading: false, err: '', index: null, indexLoading: true, initialHash: null });

  // N-T17：列表筛选（标签）与视图（列表/归档）状态
  const tagFilter = useSignal('');
  const viewMode = useSignal<'list' | 'archive'>('list');

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
    state.slug = slug;
    if (slug) await loadArticleBySlug(slug);
    else state.doc = null;
  });

  const openNote = $((slug: string) => {
    state.initialHash = null; // 应用内导航不再按深链锚点滚动
    history.pushState({ noteSlug: slug }, '', notePathFor(slug));
    void navigate(slug);
  });

  const backToList = $(() => {
    state.initialHash = null;
    if (history.state && history.state.noteSlug) history.back();
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
    const { slug, restoreUrl, hash } = resolveInitialSlug(location.pathname, pending);
    if (restoreUrl) history.replaceState({ noteSlug: slug }, '', restoreUrl);
    state.initialHash = hash;
    await loadIndex();
    await navigate(slug);

    const onPop = () => {
      void navigate(noteSlugFromPath(location.pathname));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  const allPosts = state.index?.posts ?? [];
  const tagCounts = new Map<string, number>();
  allPosts.forEach((p) => p.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));
  const tags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  // N-T20：搜索命中 → 在标签筛选基础上再收窄。索引未就绪时（query 已输入但仍在构建）暂不过滤，避免误清空。
  const searchQ = searchQuery.value.trim();
  const searchHits = searchQ && searchCache.idx ? search(searchCache.idx, searchQ) : null;
  const hitSet = searchHits ? new Set(searchHits) : null;
  const basePosts = tagFilter.value ? allPosts.filter((p) => p.tags.includes(tagFilter.value)) : allPosts;
  const visiblePosts = hitSet ? basePosts.filter((p) => hitSet.has(p.slug)) : basePosts;

  const isList = !state.slug;

  return (
    <section data-testid="notes-shell" class="notes-shell mc-container">
      {isList ? (
        <div data-testid="notes-list">
          <h1 class="notes-page-title">Notes</h1>
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
                  {tags.map(([t, c]) => (
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
                </div>
                <div class="notes-toolbar-right">
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
              {viewMode.value === 'archive' ? (
                <div class="notes-archive" data-testid="notes-archive">
                  {buildArchive(visiblePosts).map((y) => (
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
              ) : searchQ && visiblePosts.length === 0 ? (
                <p class="notes-muted" data-testid="notes-search-empty">
                  未找到与「{searchQ}」匹配的文章。
                </p>
              ) : (
                <ul class="notes-cards">
                  {visiblePosts.map((p) => (
                    <li key={p.slug}>
                      <button
                        type="button"
                        class="notes-card"
                        data-testid="notes-item"
                        data-slug={p.slug}
                        onClick$={() => openNote(p.slug)}
                      >
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
        <ArticleView key={state.doc.id} doc={state.doc} onBack={backToList} onNav={openNote} />
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
    </section>
  );
});
