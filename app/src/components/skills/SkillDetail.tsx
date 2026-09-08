import { component$, useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import type { GitTreeEntry, SkillMeta, SkStatus } from '../../types/skills';
import {
  loadSkCfg,
  skRepoFull,
  skInstallCmd,
  fetchMeta,
  fetchTree,
  fetchFile,
  removeSkill,
  syncSkill,
} from '../../lib/skills';
import { getAuthToken, isAdmin } from '../../lib/auth';
import { copyText } from '../../lib/clipboard';
import { Link } from '@builder.io/qwik-city';
import { useLocation, useNavigate } from '@builder.io/qwik-city';
import { FileTree } from './FileTree';
import { Markdown } from './Markdown';
import { Toast } from './Toast';

/** Skills 详情页：SKILL.md 渲染 + 文件树 + 收藏/删除/同步（admin，走 Worker）。 */
export const SkillDetail = component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  const dir = (loc.params.dir || '').toString();

  const meta = useSignal<SkillMeta | null>(null);
  const tree = useSignal<GitTreeEntry[]>([]);
  const openFileSig = useSignal(''); // 当前打开的文件中相对路径，'' = SKILL.md
  const content = useSignal<{
    text: string;
    isImage: boolean;
    isMd: boolean;
    truncated: boolean;
  } | null>(null);
  const mdMode = useSignal<'preview' | 'code'>('preview');
  const status = useSignal<SkStatus>({ kind: 'wait', msg: '加载中…' });
  const toast = useSignal('');
  const busy = useSignal(false);
  const admin = useSignal(false);

  const openFile = $(async (path: string) => {
    openFileSig.value = path;
    const cfg = loadSkCfg();
    const target = path || 'SKILL.md';
    try {
      const fc = await fetchFile(cfg, dir, target);
      content.value = { text: fc.text, isImage: fc.isImage, isMd: fc.isMd, truncated: fc.truncated };
      mdMode.value = fc.isImage ? 'code' : fc.isMd ? 'preview' : 'code';
    } catch (e: any) {
      content.value = {
        text: '（读取失败：' + (e?.message || e) + '）',
        isImage: false,
        isMd: false,
        truncated: false,
      };
      mdMode.value = 'code';
    }
  });

  const load = $(async () => {
    admin.value = isAdmin();
    const cfg = loadSkCfg();
    const full = skRepoFull(cfg);
    if (!full) {
      status.value = { kind: 'err', msg: '未配置仓库' };
      return;
    }
    const branch = cfg.branch.trim() || 'main';
    const [owner, repo] = full.split('/');
    try {
      const [m, t] = await Promise.all([fetchMeta(owner, repo, branch, dir), fetchTree(cfg, branch)]);
      meta.value = m;
      tree.value = t;
      await openFile('');
      status.value = { kind: 'ok', msg: m.name };
    } catch (e: any) {
      status.value = { kind: 'err', msg: '加载失败：' + (e?.message || e) };
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    load();
  });

  const onCopyInstall = $(async () => {
    const ok = await copyText(skInstallCmd(dir));
    toast.value = ok ? '已复制 · 到终端粘贴运行即可安装到常用 Agent' : '复制失败，请手动复制';
  });

  const onRemove = $(async () => {
    if (!confirm('确定删除技能目录 ' + dir + ' ？将删除收藏仓库中的整个目录（不可恢复）')) return;
    const cfg = loadSkCfg();
    const worker = cfg.worker;
    const tok = getAuthToken();
    if (!worker) {
      toast.value = '未配置 Worker 写通道';
      return;
    }
    if (!tok) {
      toast.value = '请先登录 GitHub（删除为站长功能）';
      return;
    }
    busy.value = true;
    try {
      const { ok, data } = await removeSkill(worker, tok, dir);
      if (ok && data.ok) {
        toast.value = '已删除 ' + (data.removed ?? dir) + ' 个文件';
        nav('/skills');
      } else {
        toast.value = '删除失败：' + (data.error || 'HTTP ' + (data.status || ''));
      }
    } catch (e: any) {
      toast.value = '网络错误：' + (e?.message || e);
    } finally {
      busy.value = false;
    }
  });

  const onSync = $(async () => {
    const m = meta.value;
    if (!m) return;
    if (m.mode === 'mirror') {
      toast.value = '镜像模式条目已含全部文件，无需同步；如需更新请先删除再重新收藏';
      return;
    }
    if (!confirm('重新探测原仓库并更新代理 SKILL.md / 图标？')) return;
    const cfg = loadSkCfg();
    const worker = cfg.worker;
    const tok = getAuthToken();
    if (!worker) {
      toast.value = '未配置 Worker 写通道';
      return;
    }
    if (!tok) {
      toast.value = '请先登录 GitHub（同步为站长功能）';
      return;
    }
    busy.value = true;
    try {
      const { ok, data } = await syncSkill(worker, tok, dir, m.source);
      if (ok && data.ok) {
        toast.value = '✓ 已同步 ' + data.name + '（更新 ' + (data.written ?? 0) + ' 个文件）';
        await load();
      } else {
        toast.value = '同步失败：' + (data.error || 'HTTP ' + (data.status || ''));
      }
    } catch (e: any) {
      toast.value = '网络错误：' + (e?.message || e);
    } finally {
      busy.value = false;
    }
  });

  const badge =
    meta.value?.mode === 'mirror' ? (
      <span class="sk-badge mirror">镜像</span>
    ) : meta.value?.mode === 'proxy' ? (
      <span class="sk-badge proxy">引用</span>
    ) : null;

  return (
    <section class="sk-page">
      <div class="sk-back">
        <Link href="/skills" class="btn ghost">
          ← 返回列表
        </Link>
      </div>

      <div class="sk-detail">
        <div class="sk-detail-main">
          <div class="sk-detail-head">
            <img
              class="sk-d-icon"
              src={meta.value?.icon || ''}
              alt=""
              onError$={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
            <div class="sk-d-info">
              <div class="sk-d-name">
                {meta.value?.name}
                {badge}
              </div>
              <div class="sk-d-src">
                {meta.value
                  ? meta.value.source
                    ? '来自 ' + meta.value.source.replace(/^https:\/\//, '')
                    : dir
                  : ''}
              </div>
              <div class="sk-d-desc">{meta.value?.description || '（无简介）'}</div>
            </div>
            <div class="sk-detail-actions">
              <button class="btn" onClick$={onCopyInstall}>
                复制安装
              </button>
              {admin.value && meta.value?.mode && meta.value.mode !== 'mirror' && (
                <button class="btn" onClick$={onSync} disabled={busy.value}>
                  同步
                </button>
              )}
              {admin.value && (
                <button class="btn danger" onClick$={onRemove} disabled={busy.value}>
                  删除
                </button>
              )}
            </div>
          </div>

          <div class="sk-file-label">{openFileSig.value || 'SKILL.md'}</div>
          {content.value && content.value.isImage ? (
            <img class="sk-img" src={content.value.text} alt={openFileSig.value} />
          ) : (
            <>
              {content.value && content.value.isMd && (
                <div class="sk-tabs">
                  <button
                    class={'sk-tab' + (mdMode.value === 'preview' ? ' active' : '')}
                    onClick$={() => (mdMode.value = 'preview')}
                  >
                    预览
                  </button>
                  <button
                    class={'sk-tab' + (mdMode.value === 'code' ? ' active' : '')}
                    onClick$={() => (mdMode.value = 'code')}
                  >
                    源码
                  </button>
                </div>
              )}
              {content.value && mdMode.value === 'preview' && content.value.isMd ? (
                <Markdown text={content.value.text} />
              ) : (
                <pre class="sk-code">
                  <code>{content.value?.text}</code>
                </pre>
              )}
            </>
          )}
        </div>

        <aside class="sk-detail-side">
          <div class="sk-side-head">文件树</div>
          <FileTree dir={dir} tree={tree.value} openFile={openFileSig.value} onSelect$={openFile} />
        </aside>
      </div>

      <Toast msg={toast} />
    </section>
  );
});
