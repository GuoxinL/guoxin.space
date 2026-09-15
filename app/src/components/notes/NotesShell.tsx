import { component$, useSignal, useStore, useVisibleTask$, $ } from '@builder.io/qwik';
import type { ArticleDoc, PostsIndex } from '../../lib/notes/types';
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

export const NotesShell = component$(() => {
  const state = useStore<{
    slug: string;
    doc: ArticleDoc | null;
    loading: boolean;
    err: string;
    index: PostsIndex | null;
    indexLoading: boolean;
  }>({ slug: '', doc: null, loading: false, err: '', index: null, indexLoading: true });

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

  const isList = !state.slug;

  return (
    <section data-testid="notes-shell" class="notes-shell mc-container">
      {isList ? (
        <div data-testid="notes-list">
          <h1 class="notes-page-title">笔记</h1>
          {state.indexLoading ? (
            <p class="notes-muted">加载中…</p>
          ) : state.index && state.index.posts.length ? (
            <ul class="notes-cards">
              {state.index.posts.map((p) => (
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
        <article data-testid="notes-detail" class="notes-detail">
          <button type="button" class="notes-back" onClick$={backToList}>
            ← 返回列表
          </button>
          <ArticleHeader doc={state.doc} />
          <MdastRenderer ast={state.doc.ast} />
        </article>
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
