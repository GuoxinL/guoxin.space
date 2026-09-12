import { $, component$, useSignal, useStore, useVisibleTask$ } from '@builder.io/qwik';
import {
  rkActReplay,
  rkApplyThemeChange,
  rkComma,
  rkFmtDist,
  rkFmtDur,
  rkHeatYearHTML,
  rkLoadRides,
  rkMapFocus,
  rkMovingSec,
  rkParse,
  rkPbsItems,
  rkShowMap,
  rkSortDate,
  rkStats,
  rkTheme,
  rkTitleFor,
  rkTrendHTML,
  rkTypeTag,
  rkYears,
  rkFetchPreview,
  tracksUrl,
  type RkActivity,
} from '../../lib/running';
import { authInit, getAuthToken, isAdmin } from '../../lib/auth';

const PIN_IC = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export const RunningPage = component$(() => {
  const state = useStore({
    statusText: '',
    statusCls: '' as '' | 'ok' | 'err',
    acts: [] as RkActivity[],
    years: [] as string[],
    admin: false,
    ridesFull: null as Record<string, string> | null,
    loaded: false,
    err: false,
    setupHint: false,
    fullBadge: false,
    // ui
    year: '',
    trend: 'm' as 'm' | 'y',
    listYear: 'all',
    listN: 30,
    selId: '' as string,
    actOpen: null as RkActivity | null,
  });

  const mapRef = useSignal<HTMLElement>();
  const replayRef = useSignal<HTMLElement>();

  /* 加载数据（客户端 Worker 通道） */
  useVisibleTask$(async () => {
    authInit(); // 幂等：确保 ?auth= 回调已被消费（layout 已先行时此处为 no-op）
    const admin = isAdmin();
    const url = tracksUrl('preview.json');
    if (!url) {
      state.setupHint = true;
      state.statusText = '未配置 Worker 写通道 · 请先在 Skills「通道设置」填写 Worker URL';
      state.statusCls = 'err';
      return;
    }
    try {
      const text = await rkFetchPreview();
      const list = rkParse(text);
      if (!list.length) throw new Error('数据为空');
      const years = rkYears(list);
      const curYr = String(new Date().getFullYear());
      state.year = years.includes(curYr) ? curYr : years[0] || curYr;
      state.acts = list;
      state.years = years;
      state.admin = admin;
      state.loaded = true;
      state.statusText = `数据已加载：${rkComma(list.length)} 条记录`;
      state.statusCls = 'ok';
      if (admin) {
        const token = getAuthToken();
        const rf = await rkLoadRides(token);
        if (rf) {
          state.ridesFull = rf;
          state.fullBadge = true;
        }
      }
    } catch (e) {
      state.err = true;
      state.statusText = '数据加载失败：' + (e && (e as Error).message ? (e as Error).message : String(e)) + ' — 可稍后重试';
      state.statusCls = 'err';
    }
  });

  /* 地图：acts / ridesFull 就绪后渲染（命令式孤岛） */
  useVisibleTask$(({ track }) => {
    track(() => state.acts.length);
    track(() => state.ridesFull);
    const el = mapRef.value;
    if (!el || !state.acts.length) return;
    rkShowMap({ container: el, acts: state.acts, ridesFull: state.ridesFull, selId: state.selId });
  });

  /* 轨迹回放：actOpen 变化时（重）启动 canvas 动画。
     回放 handle 含 stop() 函数、不可序列化，不能存进 Qwik signal（dev 下报
     Value cannot be serialized，并触发 vitest 跨进程 DataCloneError）。改为挂在 wrap DOM
     元素上（随元素生命周期存活），原 stop→start 语义不变。 */
  useVisibleTask$(({ track }) => {
    track(() => state.actOpen?.id);
    const wrap = replayRef.value;
    if (!wrap) return;
    const prev = (wrap as any).__replay;
    if (prev && typeof prev.stop === 'function') prev.stop();
    (wrap as any).__replay = null;
    if (!state.actOpen) return;
    (wrap as any).__replay = rkActReplay(wrap, state.actOpen, state.ridesFull);
  });

  /* 主题联动：刷新缩略图 / 矢量层 */
  useVisibleTask$(() => {
    const onTheme = () => rkApplyThemeChange();
    if (typeof window !== 'undefined') window.addEventListener('themechange', onTheme);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('themechange', onTheme);
    };
  });

  const openAct = $((a: RkActivity) => {
    state.selId = a.id;
    state.actOpen = a;
    rkMapFocus(a.id);
  });
  const closeAct = $(() => {
    state.actOpen = null;
    const wrap = replayRef.value;
    const prev = wrap && (wrap as any).__replay;
    if (prev && typeof prev.stop === 'function') prev.stop();
    if (wrap) (wrap as any).__replay = null;
  });

  return (
    <section class="rk-page">
      <h1 class="text-2xl font-bold">Running</h1>
      <p class="mt-2 text-[var(--muted)]">
        骑行与跑步数据：轨迹地图、年度热力、趋势统计与轨迹回放。完整轨迹仅 admin 可见，游客展示预览。
      </p>

      <div class="rk-bar">
        <span class={`dot ${state.statusCls}`} />
        <span class="rk-bar-text">{state.statusText || '等待加载…'}</span>
        {state.fullBadge && <span class="rk-full-badge">完整轨迹</span>}
      </div>

      {state.setupHint && (
        <div class="rk-empty">
          Running 数据现经 Cloudflare Worker 代理下发（轨迹仓库为私有仓库），请先在 Skills 页「通道设置」填写 Worker URL 后刷新页面。
        </div>
      )}
      {state.err && (
        <div class="rk-empty">无法连接数据源（Cloudflare Worker 代理）。请检查网络后刷新页面重试。</div>
      )}

      {/* 统计总览 */}
      {state.acts.length > 0 && <StatsCards acts={state.acts} />}

      {/* 年度热力图 */}
      {state.acts.length > 0 && (
        <div class="rk-section">
          <div class="rk-section-h">年度热力图</div>
          <div class="rk-tabs">
            {state.years.map((y) => (
              <button key={y} class={`rk-tab ${state.year === y ? 'active' : ''}`} onClick$={() => (state.year = y)}>
                {y}
              </button>
            ))}
          </div>
          <div class="rk-heat-wrap-host" dangerouslySetInnerHTML={rkHeatYearHTML(state.acts, state.year)} />
        </div>
      )}

      {/* 趋势图 */}
      {state.acts.length > 0 && (
        <div class="rk-section">
          <div class="rk-section-h">跑量趋势</div>
          <div class="rk-tabs">
            <button class={`rk-tab ${state.trend === 'm' ? 'active' : ''}`} onClick$={() => (state.trend = 'm')}>
              按月
            </button>
            <button class={`rk-tab ${state.trend === 'y' ? 'active' : ''}`} onClick$={() => (state.trend = 'y')}>
              历年
            </button>
          </div>
          <div dangerouslySetInnerHTML={rkTrendHTML(state.acts, state.trend, state.year)} />
        </div>
      )}

      {/* 个人最佳 */}
      {state.acts.length > 0 && (
        <div class="rk-section">
          <div class="rk-section-h">个人最佳 / 总览</div>
          <div class="rk-pb">
            {rkPbsItems(state.acts).map((it) => (
              <div class="rk-pb-item" key={it.k + it.v}>
                <div class="rk-pb-k">{it.k}</div>
                <div class="rk-pb-v" style={it.empty ? 'font-size:15px;color:var(--text3)' : ''}>
                  {it.v}
                  {it.u && <small> {it.u}</small>}
                </div>
                <div class="rk-pb-d">{it.d}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 活动列表 */}
      {state.acts.length > 0 && <ActivityList state={state} openAct$={openAct} />}

      {/* 轨迹地图 */}
      {state.acts.length > 0 && (
        <div class="rk-map-sec">
          <div id="rkMapTitle" class="rk-map-title" />
          <div class="rk-map" ref={mapRef}>
            <div class="rk-map-hint">
              <div class="rk-mh-t">轨迹地图加载中…</div>
            </div>
          </div>
        </div>
      )}

      {/* 轨迹回放弹窗 */}
      {state.actOpen && (
        <div
          class="rk-act-modal modal-mask show"
          onClick$={(e) => {
            const t = e.target as HTMLElement;
            if (t.classList.contains('rk-act-modal')) closeAct();
          }}
        >
          <div class="modal">
            <div class="rk-act-video">
              <span class="rk-act-hint">轨迹回放</span>
              <button class="rk-act-close" onClick$={closeAct}>
                ×
              </button>
              <div ref={replayRef} style="position:absolute;inset:0" />
            </div>
            <ActivityInfo a={state.actOpen} />
          </div>
        </div>
      )}
    </section>
  );
});

/* 统计总览卡片 */
const StatsCards = component$<{ acts: RkActivity[] }>(({ acts }) => {
  const s = rkStats(acts);
  const cards = [
    { k: '总距离', v: rkFmtDist(s.dist), u: 'km' },
    { k: '总时长', v: rkFmtDur(s.sec), u: '' },
    { k: '运动次数', v: rkComma(s.count), u: '次' },
    { k: '活跃天数', v: String(s.days), u: '天' },
    { k: '累计爬升', v: rkComma(s.elev), u: 'm' },
  ];
  return (
    <div class="rk-section">
      <div class="rk-section-h">运动总览</div>
      <div class="rk-pb">
        {cards.map((c) => (
          <div class="rk-pb-item" key={c.k}>
            <div class="rk-pb-k">{c.k}</div>
            <div class="rk-pb-v">
              {c.v}
              {c.u && <small> {c.u}</small>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/* 活动列表 */
const ActivityList = component$<{
  state: {
    acts: RkActivity[];
    years: string[];
    listYear: string;
    listN: number;
  };
  openAct$: (a: RkActivity) => void;
}>(({ state, openAct$ }) => {
  let acts = state.acts.slice().sort(rkSortDate);
  if (state.listYear !== 'all') acts = acts.filter((a) => (a.date || '').slice(0, 4) === state.listYear);
  const show = acts.slice(0, state.listN);
  return (
    <div class="rk-section">
      <div class="rk-section-h">活动记录</div>
      <div class="rk-list-tools">
        <select
          class="indent"
          onChange$={(e, el) => {
            state.listYear = (el as HTMLSelectElement).value;
            state.listN = 30;
          }}
        >
          <option value="all" selected={state.listYear === 'all'}>
            全部年份
          </option>
          {state.years.map((y) => (
            <option key={y} value={y} selected={state.listYear === y}>
              {`${y} 年`}
            </option>
          ))}
        </select>
      </div>
      <div class="rk-actlist">
        {show.map((a) => (
          <ActCard key={a.id} a={a} onOpen$={openAct$} />
        ))}
      </div>
      {acts.length > state.listN && (
        <button class="rk-more" onClick$={() => (state.listN += 30)}>
          加载更多（已显示 {state.listN} / {acts.length}）
        </button>
      )}
    </div>
  );
});

/* 活动卡片 */
const ActCard = component$<{ a: RkActivity; onOpen$: (a: RkActivity) => void }>(({ a, onOpen$ }) => {
  const t = rkMovingSec(a.mt);
  const kmh = a.spd ? a.spd * 3.6 : a.dist > 0 && t > 0 ? (a.dist / t) * 3.6 : 0;
  const nm = a.name || rkTitleFor(a);
  const d = (a.date || '').slice(0, 10);
  return (
    <div class="rk-actcard" onClick$={() => onOpen$(a)} title="查看轨迹回放">
      <div class="rk-act-thumb">
        {a.poly && <img src={tracksUrl('thumb/' + a.id + '.' + rkTheme() + '.png')} alt="" loading="lazy" />}
        <span class="rk-act-tag">{rkTypeTag(a.type)}</span>
      </div>
      <div class="rk-act-body">
        <div class="rk-act-title">
          <span class="rk-act-tag">{rkTypeTag(a.type)}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{nm}</span>
        </div>
        <div class="rk-act-meta">
          <span class="rk-act-loc">
            {PIN_IC}
            <span>{a.city || '未知地点'}</span>
          </span>
          <span>{d}</span>
        </div>
        <div class="rk-act-stats">
          <div class="rk-act-stat">
            <b>{(a.dist / 1000).toFixed(1)}</b>
            <span>公里</span>
          </div>
          <div class="rk-act-stat">
            <b>{kmh ? kmh.toFixed(1) : '--'}</b>
            <span>km/h</span>
          </div>
          <div class="rk-act-stat">
            <b>{rkFmtDur(t)}</b>
            <span>时长</span>
          </div>
        </div>
      </div>
    </div>
  );
});

/* 回放弹窗信息面板 */
const ActivityInfo = component$<{ a: RkActivity }>(({ a }) => {
  const t = rkMovingSec(a.mt);
  const kmh = a.spd ? a.spd * 3.6 : a.dist > 0 && t > 0 ? (a.dist / t) * 3.6 : 0;
  const cells = [
    { k: '距离', v: (a.dist / 1000).toFixed(2), u: 'km' },
    { k: '时长', v: rkFmtDur(t), u: '' },
    { k: '平均时速', v: kmh ? kmh.toFixed(1) : '--', u: 'km/h' },
    { k: '累计爬升', v: String(a.elev || 0), u: 'm' },
    { k: '平均心率', v: a.hr ? String(a.hr) : '--', u: a.hr ? 'bpm' : '' },
  ];
  return (
    <div class="rk-act-info">
      <div class="rk-ai-title">
        <span class="rk-act-tag">{rkTypeTag(a.type)}</span>
        <span class="rk-ai-name">{a.name || rkTitleFor(a)}</span>
      </div>
      <div class="rk-ai-sub">
        <span>{a.date || ''}</span>
        {a.city && <span>· {a.city}</span>}
      </div>
      <div class="rk-act-grid">
        {cells.map((c) => (
          <div class="rk-act-cell" key={c.k}>
            <div class="rk-k">{c.k}</div>
            <div class="rk-v">
              {c.v}
              {c.u && <small> {c.u}</small>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
