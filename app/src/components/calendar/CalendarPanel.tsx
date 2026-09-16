import {
  $,
  component$,
  useComputed$,
  useSignal,
  useVisibleTask$,
} from '@builder.io/qwik';

import {
  buildMonthGrid,
  dayLabel,
  getLunarInfo,
  WEEKDAYS,
  type CalendarCell,
  type DayRef,
} from '../../lib/calendar';

function weekdayText(w: number): string {
  return w === 0 ? '日' : WEEKDAYS[w];
}

function cellClass(c: CalendarCell): string {
  const cls = ['cal-cell'];
  if (!c.inMonth) cls.push('cal-out');
  else if (c.holiday.type === 'rest') cls.push('cal-rest-cell');
  else if (c.weekday === 0 || c.weekday === 6) cls.push('cal-we');
  if (c.isToday) cls.push('cal-today');
  return cls.join(' ');
}

function numClass(c: CalendarCell): string {
  const cls = ['cal-num'];
  if (c.holiday.type === 'rest') cls.push('cal-num-fest');
  return cls.join(' ');
}

export const CalendarPanel = component$(() => {
  // 初始为确定值（与构建期当前月一致），保证 SSR 与客户端首帧一致；挂载后由 useVisibleTask 校正到真实今日。
  const viewY = useSignal(2026);
  const viewM = useSignal(9);
  const today = useSignal<DayRef | null>(null);
  const selected = useSignal<DayRef>({ y: 2026, m: 9, d: 1 });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const now = new Date();
    const t: DayRef = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
    today.value = t;
    viewY.value = t.y;
    viewM.value = t.m;
    selected.value = t;
  });

  const grid = useComputed$(() => buildMonthGrid(viewY.value, viewM.value, today.value));
  const sel = useComputed$(() => {
    const s = selected.value;
    return {
      ref: s,
      lunar: getLunarInfo(s.y, s.m, s.d),
      weekday: new Date(s.y, s.m - 1, s.d).getDay(),
    };
  });

  const pickDay = $((y: number, m: number, d: number) => {
    viewY.value = y;
    viewM.value = m;
    selected.value = { y, m, d };
  });
  const prev = $(() => {
    if (viewM.value === 1) {
      viewY.value -= 1;
      viewM.value = 12;
    } else {
      viewM.value -= 1;
    }
  });
  const next = $(() => {
    if (viewM.value === 12) {
      viewY.value += 1;
      viewM.value = 1;
    } else {
      viewM.value += 1;
    }
  });
  const goToday = $(() => {
    if (today.value) {
      viewY.value = today.value.y;
      viewM.value = today.value.m;
      selected.value = { ...today.value };
    }
  });

  return (
    <div class="cal-page">
      <h1 class="cal-h1">日历</h1>
      <p class="cal-intro">
        农历 · 法定节假日与调休 · 节气 · 黄历宜忌。纯前端本地计算，无数据上传。
      </p>

      <div class="cal-head">
        <div class="cal-title">
          {viewY.value} 年 {viewM.value} 月
        </div>
        <div class="cal-nav">
          <button type="button" class="btn" onClick$={prev} aria-label="上一月">
            ‹ 上月
          </button>
          <button type="button" class="btn" onClick$={goToday}>
            今天
          </button>
          <button type="button" class="btn" onClick$={next} aria-label="下一月">
            下月 ›
          </button>
        </div>
      </div>

      <div class="cal-grid cal-dow" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <div class="cal-dow-cell" key={w}>
            {w}
          </div>
        ))}
      </div>

      <div class="cal-grid cal-body" role="grid">
        {grid.value.map((c) => {
          const label = dayLabel(c);
          return (
            <button
              type="button"
              class={cellClass(c)}
              key={`${c.y}-${c.m}-${c.d}`}
              aria-label={`${c.y}年${c.m}月${c.d}日 ${c.lunar.lunarText}`}
              onClick$={() => pickDay(c.y, c.m, c.d)}
            >
              <span class={numClass(c)}>{c.d}</span>
              {c.holiday.type === 'work' ? (
                <span class="cal-badge cal-work">班</span>
              ) : c.holiday.type === 'rest' && !c.holiday.name ? (
                <span class="cal-badge cal-rest">休</span>
              ) : null}
              <span
                class={
                  'cal-sub ' +
                  (label.kind === 'fest'
                    ? 'cal-fest'
                    : label.kind === 'term'
                      ? 'cal-term'
                      : 'cal-lunar')
                }
              >
                {label.text}
              </span>
            </button>
          );
        })}
      </div>

      <div class="cal-cols">
        <section class="mc-panel cal-almanac" aria-live="polite">
          <div class="cal-almanac-head">
            <span class="cal-almanac-date">
              {sel.value.ref.y} 年 {sel.value.ref.m} 月 {sel.value.ref.d} 日 星期
              {weekdayText(sel.value.weekday)}
            </span>
            <span class="cal-almanac-lunar">
              {sel.value.lunar.lunarText}
              <span class="cal-almanac-animal">
                （{sel.value.lunar.yearGanZhi}
                {sel.value.lunar.animal}年）
              </span>
            </span>
          </div>
          {sel.value.lunar.solarTerm ? (
            <div class="cal-row">
              <b class="cal-row-k">节气</b>
              <span class="cal-term">{sel.value.lunar.solarTerm}</span>
            </div>
          ) : null}
          <div class="cal-row">
            <b class="cal-row-k">宜</b>
            <span class="cal-yi">{sel.value.lunar.yi.join('、')}</span>
          </div>
          <div class="cal-row">
            <b class="cal-row-k">忌</b>
            <span class="cal-ji">{sel.value.lunar.ji.join('、')}</span>
          </div>
          {sel.value.lunar.chongSha ? (
            <div class="cal-row">
              <b class="cal-row-k">冲煞</b>
              <span class="cal-chong">{sel.value.lunar.chongSha}</span>
            </div>
          ) : null}
          {sel.value.lunar.xiPosition ? (
            <div class="cal-row">
              <b class="cal-row-k">喜神</b>
              <span class="cal-xi">{sel.value.lunar.xiPosition}</span>
            </div>
          ) : null}
          {sel.value.lunar.festivals.length > 0 ? (
            <div class="cal-row">
              <b class="cal-row-k">节日</b>
              <span class="cal-fest">{sel.value.lunar.festivals.join('、')}</span>
            </div>
          ) : null}
        </section>
      </div>

      <p class="cal-disclaimer">
        黄历宜忌为传统历法参考，不构成任何决策依据。
      </p>
    </div>
  );
});
