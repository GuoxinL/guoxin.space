import { component$, useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import { noteSlugFromPath, notePathFor, resolveInitialSlug } from '../../lib/notes/slug';
import { readPendingRedirect } from '../../lib/spa-redirect';

/**
 * N-T00 spike 外壳：只验证「中文 slug 在纯 CSR 下能否正确路由与解析」。
 *
 * 导航模式沿用 SkillsPage 已验证方案（见其注释）：
 * 组件状态 + history.pushState 透传 URL，popstate / 初始 pathname 负责后退与深链恢复；
 * **不走** Qwik City 路由参数 —— Pages 对动态路由 q-data 返回 404 会中止 SPA 导航。
 *
 * 本 spike 不接数据仓（GuoxinL/notes 尚未创建），用 MOCK_NOTES 渲染；
 * 真实取数与渲染器分别属于 N-T06 / N-T08。
 */

interface NoteSpikeItem {
  slug: string;
  summary: string;
}

const MOCK_NOTES: NoteSpikeItem[] = [
  { slug: '测试笔记', summary: '第一条中文样例，用于验证深链与解码。' },
  { slug: 'Go 笔记', summary: '第二条样例，标题含空格与英文。' },
];

export const NotesShell = component$(() => {
  // SSG 阶段无 location，初始 ''；客户端在 useVisibleTask$ 从 pathname 恢复
  const selected = useSignal('');

  const openNote = $((slug: string) => {
    selected.value = slug;
    history.pushState({ noteSlug: slug }, '', notePathFor(slug));
  });

  const closeNote = $(() => {
    if (history.state && history.state.noteSlug) {
      history.back(); // popstate 统一处理回列表
    } else {
      history.pushState(null, '', notePathFor(''));
      selected.value = '';
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    // 深链恢复：404 引导页把原始路径暂存在 sessionStorage，此处还原详情并把 URL 修正回原路径。
    // 无暂存时按当前 pathname 解析（普通访问 / 已预渲染页面直接打开）。
    const pending = readPendingRedirect();
    const { slug, restoreUrl } = resolveInitialSlug(location.pathname, pending);
    selected.value = slug;
    if (restoreUrl) history.replaceState({ noteSlug: slug }, '', restoreUrl);

    // popstate 同步后退 / 前进
    const onPop = () => (selected.value = noteSlugFromPath(location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  const current = selected.value
    ? MOCK_NOTES.find((n) => n.slug === selected.value) || null
    : null;

  return (
    <section data-testid="notes-shell">
      {selected.value ? (
        <div data-testid="notes-detail">
          {current ? (
            <>
              <h1 data-testid="notes-title">{current.slug}</h1>
              <p>{current.summary}</p>
            </>
          ) : (
            <div data-testid="notes-notfound">
              <h1>未找到</h1>
              <p>不存在标题为「{selected.value}」的笔记。</p>
            </div>
          )}
          <button type="button" data-testid="notes-back" onClick$={closeNote}>
            返回列表
          </button>
        </div>
      ) : (
        <div data-testid="notes-list">
          <h1>Notes（spike）</h1>
          <ul>
            {MOCK_NOTES.map((n) => (
              <li key={n.slug}>
                <button
                  type="button"
                  data-testid="notes-item"
                  data-slug={n.slug}
                  onClick$={() => openNote(n.slug)}
                >
                  {n.slug}
                </button>
                <span> — {n.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
});
