import { component$, $, type Signal } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import type { SkillMeta } from '../../types/skills';
import { skInstallCmd } from '../../lib/skills';
import { copyText } from '../../lib/clipboard';

const DL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
);

/** 技能卡片：点击进入详情；右上角下载按钮复制「应用到 Agent」安装命令。 */
export const SkillCard = component$<{ row: SkillMeta; toast: Signal<string> }>(({ row, toast }) => {
  const badge =
    row.mode === 'mirror' ? (
      <span class="sk-badge mirror">镜像</span>
    ) : row.mode === 'proxy' ? (
      <span class="sk-badge proxy">引用</span>
    ) : null;
  const src = row.source ? row.source.replace(/^https:\/\//, '') : row.dir;

  const onCopy = $(async () => {
    const cmd = skInstallCmd(row.dir);
    const ok = await copyText(cmd);
    toast.value = ok ? '已复制 · 到终端粘贴运行即可安装到常用 Agent' : '复制失败，请手动复制';
  });

  return (
    <div class="sk-grid-item">
      <button
        class="sk-card-dl"
        type="button"
        title="复制安装命令 · 粘贴到终端即可装到常用 Agent"
        aria-label={'安装 ' + row.dir}
        onClick$={onCopy}
      >
        {DL_ICON}
      </button>
      <Link href={'/skills/' + encodeURIComponent(row.dir)} class="sk-card">
        <div class="sk-icon">
          <img src={row.icon || ''} alt="" onError$={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
        </div>
        <div class="sk-body">
          <div class="sk-name">
            <span class="sk-name-text">{row.name}</span>
            {badge}
          </div>
          <div class="sk-desc">{row.description || '（无简介）'}</div>
          <div class="sk-src">{src}</div>
        </div>
      </Link>
    </div>
  );
});
