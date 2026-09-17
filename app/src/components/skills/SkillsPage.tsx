import {
  component$,
  useSignal,
  useComputed$,
  useVisibleTask$,
  $,
} from '@builder.io/qwik';
import type { SkCfg, SkillMeta, SkStatus } from '../../types/skills';
import {
  loadSkCfg,
  fetchSkills,
  skRepoFull,
  skDirFromPath,
  resolveInitialSkillDir,
  skFilterSkills,
} from '../../lib/skills';
import { readPendingRedirect } from '../../lib/spa-redirect';
import { SkillDetail } from './SkillDetail';
import { SkillGrid } from './SkillGrid';
import { ChannelSettings } from './ChannelSettings';
import { CollectModal } from './CollectModal';
import { Toast } from './Toast';

/** Skills 列表页：客户端拉取 GitHub 公开 API（D5：配置在 localStorage，无法构建期解析）。 */
export const SkillsPage = component$(() => {
  const rows = useSignal<SkillMeta[]>([]);
  const status = useSignal<SkStatus>({ kind: 'wait', msg: '加载中…' });
  const toast = useSignal('');
  const cfg = useSignal<SkCfg | null>(null);
  const showCfg = useSignal(false);
  const showCollect = useSignal(false);
  // 列表检索 / 过滤 / 排序（纯客户端）
  const query = useSignal('');
  const modeFilter = useSignal<'all' | 'proxy' | 'mirror'>('all');
  const sortBy = useSignal<'default' | 'name'>('default');
  const filtered = useComputed$(() =>
    skFilterSkills(rows.value, {
      query: query.value,
      modeFilter: modeFilter.value,
      sortBy: sortBy.value,
    }),
  );
  // 详情透传：不走 Qwik City 路由（GitHub Pages 对 /skills/<dir> 的 q-data 返回 404 会中止 SPA 导航），
  // 改为组件状态 + history.pushState 透传 URL；popstate/初始 pathname 负责后退与恢复。
  const selectedDir = useSignal(''); // SSG 阶段无 location，初始 ''；客户端在 useVisibleTask$ 从 pathname 恢复

  const openDetail = $((dir: string) => {
    selectedDir.value = dir;
    history.pushState({ skDetail: dir }, '', '/skills/' + encodeURIComponent(dir));
  });
  const closeDetail = $(() => {
    if (history.state && history.state.skDetail) {
      history.back(); // popstate 统一处理回列表
    } else {
      history.pushState(null, '', '/skills');
      selectedDir.value = '';
    }
  });
  /** 深链进入的兜底场景专用：直接压一条列表 URL（history.back 可能退出站点）。 */
  const backToList = $(() => {
    history.pushState(null, '', '/skills');
    selectedDir.value = '';
  });

  const reload = $(async () => {
    const c = loadSkCfg();
    cfg.value = c;
    const full = skRepoFull(c);
    if (!full) {
      status.value = {
        kind: 'wait',
        msg: '未配置仓库 · 点击右上角「通道设置」填写 skill-collection 仓库地址（读取需公开仓库）',
      };
      rows.value = [];
      return;
    }
    status.value = { kind: 'wait', msg: '正在读取 ' + full + ' …' };
    rows.value = [];
    try {
      const res = await fetchSkills(c);
      rows.value = res.rows;
      if (!res.rows.length) {
        status.value = { kind: 'wait', msg: '空仓库 · 待初始化 · 点击「收藏 Skill」收藏第一个' };
      } else {
        status.value = {
          kind: 'ok',
          msg: full + ' · ' + res.rows.length + ' 个技能（' + res.branch + ' 分支，按最近提交排序）',
        };
      }
    } catch (e: any) {
      status.value = { kind: 'err', msg: '加载失败：' + (e?.message || e) };
    }
  });

  /** 深链「未找到」判定：仅在列表已成功加载且非空时判定，
   *  避免把「加载中 / 未配置仓库 / 加载失败」误判成 404（Skills 数据是异步拉取的）。 */
  const missing = useComputed$(() => {
    const d = selectedDir.value;
    if (!d) return false;
    if (!rows.value.length) return false;
    return !rows.value.some((r) => r.dir === d);
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    reload();
    // 详情透传：初始从 pathname 恢复（配合 404 壳可实现刷新/深链），popstate 同步后退/前进
    // 深链：优先用 404 引导页暂存的原始路径，并把 URL 修正回 /skills/<dir>
    const pending = readPendingRedirect();
    const { dir, restoreUrl } = resolveInitialSkillDir(location.pathname, pending);
    selectedDir.value = dir;
    if (restoreUrl) history.replaceState({ skDetail: dir }, '', restoreUrl);
    const onPop = () => (selectedDir.value = skDirFromPath(location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  return (
    <section class="sk-page">
      {missing.value ? (
        <div data-testid="skills-notfound">
          <div class="sk-back">
            <button type="button" class="btn ghost" onClick$={backToList}>
              ← 返回列表
            </button>
          </div>
          <h1 class="sk-title">未找到</h1>
          <div class="sk-status">
            <span class="dot err"></span>
            <span>不存在名为「{selectedDir.value}」的技能。</span>
          </div>
        </div>
      ) : selectedDir.value ? (
        <SkillDetail key={selectedDir.value} dir={selectedDir.value} onBack$={closeDetail} />
      ) : (
        <>
          <div class="sk-head">
            <div>
              <h1 class="sk-title">Skills</h1>
              <div class="sk-status">
                <span class={'dot ' + status.value.kind}></span>
                <span>{status.value.msg}</span>
              </div>
            </div>
            <div class="sk-actions">
              <button class="btn" onClick$={() => (showCollect.value = true)}>
                收藏 Skill
              </button>
              <button class="btn" onClick$={() => (showCfg.value = true)}>
                通道设置
              </button>
            </div>
          </div>

          {rows.value.length > 0 && (
            <div class="sk-toolbar">
              <input
                class="sk-search"
                type="search"
                placeholder="搜索技能名 / 简介 / 来源…"
                value={query.value}
                onInput$={(e) => (query.value = (e.target as HTMLInputElement).value)}
              />
              <select
                class="sk-select"
                aria-label="按收藏模式过滤"
                value={modeFilter.value}
                onChange$={(e) => (modeFilter.value = (e.target as HTMLSelectElement).value as 'all' | 'proxy' | 'mirror')}
              >
                <option value="all">全部</option>
                <option value="proxy">引用代理</option>
                <option value="mirror">镜像</option>
              </select>
              <select
                class="sk-select"
                aria-label="排序方式"
                value={sortBy.value}
                onChange$={(e) => (sortBy.value = (e.target as HTMLSelectElement).value as 'default' | 'name')}
              >
                <option value="default">默认排序</option>
                <option value="name">按名称</option>
              </select>
              <span class="sk-count">
                {filtered.value.length} / {rows.value.length}
              </span>
            </div>
          )}

          <SkillGrid rows={filtered.value} total={rows.value.length} toast={toast} openDetail$={openDetail} />

          {showCfg.value && (
            <ChannelSettings
              cfg={cfg.value}
              toast={toast}
              onClose$={() => (showCfg.value = false)}
              onSaved$={() => {
                showCfg.value = false;
                reload();
              }}
            />
          )}
          {showCollect.value && (
            <CollectModal
              toast={toast}
              onClose$={() => (showCollect.value = false)}
              onDone$={() => {
                showCollect.value = false;
                reload();
              }}
            />
          )}
        </>
      )}
      <Toast msg={toast} />
    </section>
  );
});
