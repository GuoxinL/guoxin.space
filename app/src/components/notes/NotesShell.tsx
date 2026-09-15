import { component$, useSignal, useStore, useVisibleTask$, $, type QRL } from '@builder.io/qwik';
import type { ArticleDoc, ArticleSummary, PostsIndex } from '../../lib/notes/types';
import { loadArticle, loadNotesIndex } from '../../lib/notes/source';
import { noteSlugFromPath, notePathFor, resolveInitialSlug } from '../../lib/notes/slug';
import { readPendingRedirect } from '../../lib/spa-redirect';
import { MdastRenderer } from './MdastRenderer';

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
 * 反链区块（N-T15）：渲染 doc.backlinks（被其他笔记引用的来源）。
 * demo 阶段由 sample 数据提供；真实数据源由数仓 graph.json 聚合后注入。
 */
const BacklinksBlock = component$<{ doc: ArticleDoc }>(({ doc }) => {
  const links = doc.backlinks ?? [];
  if (!links.length) return null;
  return (
    <section class="notes-backlinks" data-testid="notes-backlinks" aria-label="反链">
      <h2 class="notes-section-title">被以下笔记引用</h2>
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
 * 详情视图（N-T13 TOC 悬浮目录 + 滚动高亮；N-T14 阅读进度条）。
 * - TOC 由 doc.headings 生成，锚点 slug 与 MdastRenderer 的 heading id 完全一致（数据层注入 headingId）。
 * - IntersectionObserver 跟踪当前可见区块高亮对应目录项；scroll 监听计算进度条宽度。
 * - 切换文章时用 key={doc.id} 强制重挂载，observer/listener 随卸载清理（C-33）。
 */
const ArticleView = component$<{ doc: ArticleDoc; onBack: QRL<() => void>; onNav: QRL<(slug: string) => void> }>(
  ({ doc, onBack, onNav }) => {
  const toc = doc.headings.filter((h) => h.depth >= 2 && h.depth <= 3);
  const activeSlug = useSignal(toc[0]?.slug ?? '');
  const progress = useSignal(0);

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
      <article class="notes-detail" data-testid="notes-detail">
        <button type="button" class="notes-back" onClick$={onBack}>
          ← 返回列表
        </button>
        <ArticleHeader doc={doc} />
        <SeriesNav doc={doc} onNav={onNav} />
        <MdastRenderer ast={doc.ast} />
        <ReferencesBlock doc={doc} />
        <BacklinksBlock doc={doc} />
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
  }>({ slug: '', doc: null, loading: false, err: '', index: null, indexLoading: true });

  // N-T17：列表筛选（标签）与视图（列表/归档）状态
  const tagFilter = useSignal('');
  const viewMode = useSignal<'list' | 'archive'>('list');

  const loadArticleBySlug = $(async (slug: string) => {
    state.loading = true;
    state.err = '';
    try {
      const doc = await loadArticle(slug);
      state.doc = doc;
      if (!doc) state.err = '未找到该笔记';
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
    history.pushState({ noteSlug: slug }, '', notePathFor(slug));
    void navigate(slug);
  });

  const backToList = $(() => {
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
    const { slug, restoreUrl } = resolveInitialSlug(location.pathname, pending);
    if (restoreUrl) history.replaceState({ noteSlug: slug }, '', restoreUrl);
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
  const visiblePosts = tagFilter.value ? allPosts.filter((p) => p.tags.includes(tagFilter.value)) : allPosts;

  const isList = !state.slug;

  return (
    <section data-testid="notes-shell" class="notes-shell mc-container">
      {isList ? (
        <div data-testid="notes-list">
          <h1 class="notes-page-title">笔记</h1>
          {state.indexLoading ? (
            <p class="notes-muted">加载中…</p>
          ) : allPosts.length ? (
            <>
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
            </>
          ) : state.err ? (
            <div class="notes-error" data-testid="notes-error">
              <p>加载失败：{state.err}</p>
              <button type="button" class="btn" onClick$={retry}>
                重试
              </button>
            </div>
          ) : (
            <p class="notes-muted">暂无笔记。</p>
          )}
        </div>
      ) : state.loading ? (
        <p class="notes-muted">加载中…</p>
      ) : state.doc ? (
        <ArticleView key={state.doc.id} doc={state.doc} onBack={backToList} onNav={openNote} />
      ) : (
        <div data-testid="notes-notfound" class="notes-notfound">
          <h1>{state.err || '未找到'}</h1>
          <p>不存在标题为「{state.slug}」的笔记。</p>
          <button type="button" class="btn" onClick$={backToList}>
            返回列表
          </button>
        </div>
      )}
    </section>
  );
});
