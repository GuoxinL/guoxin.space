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
  WEEKDAYS,
  type CalendarCell,
  type DayRef,
} from '../../lib/calendar';
import { isHolidayYearMaintained, nextHoliday } from '../../lib/calendar/holidays';

function cellClass(c: CalendarCell): string {
  const cls = ['cal-cell'];
  if (!c.inMonth) cls.push('cal-out', 'cal-link');
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

/** 单元格 tooltip：调休/放假日给出明确语义说明（不依赖视觉配色即可理解） */
function cellTitle(c: CalendarCell): string {
  if (c.holiday.type === 'work') return '调休补班日：原本为周末，因节假日调休需上班';
  if (c.holiday.type === 'rest') {
    return c.holiday.name ? `${c.holiday.name} · 法定节假日（放假）` : '法定节假日（放假）';
  }
  if (!c.inMonth) return `点击查看 ${c.y} 年 ${c.m} 月`;
  return '';
}

export const CalendarPanel = component$(() => {
  // 初始为确定值（与构建期当前月一致），保证 SSR 与客户端首帧一致；挂载后由 useVisibleTask 校正到真实今日。
  const viewY = useSignal(2026);
  const viewM = useSignal(9);
  const today = useSignal<DayRef | null>(null);
  const viewMode = useSignal<'month' | 'year'>('month');

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const now = new Date();
    const t: DayRef = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
    today.value = t;
    viewY.value = t.y;
    viewM.value = t.m;
  });

  const grid = useComputed$(() => buildMonthGrid(viewY.value, viewM.value, today.value));
  // 距今日最近的法定放假日（仅已维护年份）；无则返回 null
  const nextInfo = useComputed$(() => (today.value ? nextHoliday(today.value) : null));

  const prev = $(() => {
    if (viewMode.value === 'year') {
      viewY.value -= 1;
      return;
    }
    if (viewM.value === 1) {
      viewY.value -= 1;
      viewM.value = 12;
    } else {
      viewM.value -= 1;
    }
  });
  const next = $(() => {
    if (viewMode.value === 'year') {
      viewY.value += 1;
      return;
    }
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
      viewMode.value = 'month';
    }
  });

  /** 跳转到指定年月（跨月补白格点击 / 年视图点击月份时调用） */
  const gotoMonth = $((y: number, m: number) => {
    viewY.value = y;
    viewM.value = m;
    viewMode.value = 'month';
  });

  const toggleView = $(() => {
    viewMode.value = viewMode.value === 'month' ? 'year' : 'month';
  });

  return (
    <div class="cal-page">
      <h1 class="cal-h1">Calendar</h1>
      <p class="cal-intro">
        农历 · 法定节假日与调休 · 节气。纯前端本地计算，无数据上传。
      </p>

      <div class="cal-head">
        <div class="cal-title">
          {viewMode.value === 'year' ? `${viewY.value} 年` : `${viewY.value} 年 ${viewM.value} 月`}
        </div>
        <div class="cal-nav">
          <button type="button" class="btn" onClick$={prev} aria-label={viewMode.value === 'year' ? '上一年' : '上一月'}>
            ‹ {viewMode.value === 'year' ? '上年' : '上月'}
          </button>
          <button type="button" class="btn" onClick$={goToday}>
            今天
          </button>
          <button type="button" class="btn" onClick$={next} aria-label={viewMode.value === 'year' ? '下一年' : '下一月'}>
            {viewMode.value === 'year' ? '下年' : '下月'} ›
          </button>
          <span class="cal-view-toggle" role="group" aria-label="视图切换">
            <button
              type="button"
              class={`cal-view-btn ${viewMode.value === 'month' ? 'active' : ''}`}
              onClick$={toggleView}
              aria-pressed={viewMode.value === 'month'}
            >
              月
            </button>
            <button
              type="button"
              class={`cal-view-btn ${viewMode.value === 'year' ? 'active' : ''}`}
              onClick$={toggleView}
              aria-pressed={viewMode.value === 'year'}
            >
              年
            </button>
          </span>
        </div>
      </div>

      {!isHolidayYearMaintained(viewY.value) && (
        <p class="cal-hint">
          法定节假日与调休数据待补充：国务院办公厅尚未发布 {viewY.value}{' '}
          年放假安排，当前仅显示农历与二十四节气。
        </p>
      )}

      {/* 距下一假期提示条：仅月视图 + 已维护年份 + 存在未来假期时显示 */}
      {viewMode.value === 'month' && nextInfo.value && (
        <p class="cal-next">
          {nextInfo.value.days === 0
            ? '今天是法定节假日 🎉'
            : `距下一假期还有 ${nextInfo.value.days} 天（${nextInfo.value.name ?? '法定节假日'} · ${nextInfo.value.date.m} 月 ${nextInfo.value.date.d} 日）`}
        </p>
      )}

      {viewMode.value === 'year' ? (
        <div class="cal-year">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const yGrid = buildMonthGrid(viewY.value, m, today.value);
            return (
              <div class="cal-mini" key={m}>
                <button type="button" class="cal-mini-head" onClick$={() => gotoMonth(viewY.value, m)}>
                  {m} 月
                </button>
                <div class="cal-grid cal-mini-grid" role="grid" aria-label={`${viewY.value}年${m}月`}>
                  {yGrid.map((c) => (
                    <button
                      type="button"
                      key={`${c.y}-${c.m}-${c.d}`}
                      class={
                        'cal-mini-cell' +
                        (c.inMonth ? '' : ' cal-mini-out') +
                        (c.holiday.type === 'rest' ? ' cal-mini-rest' : '') +
                        (c.holiday.type === 'work' ? ' cal-mini-work' : '') +
                        (c.isToday ? ' cal-mini-today' : '')
                      }
                      title={cellTitle(c)}
                      onClick$={() => {
                        if (!c.inMonth) gotoMonth(c.y, c.m);
                        else gotoMonth(viewY.value, m);
                      }}
                    >
                      {c.d}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
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
                  title={cellTitle(c)}
                  onClick$={() => {
                    if (!c.inMonth) gotoMonth(c.y, c.m);
                  }}
                >
                  <span class={numClass(c)}>{c.d}</span>
                  {c.holiday.type === 'work' ? (
                    <span class="cal-badge cal-work" title="调休补班（需上班）">
                      班
                    </span>
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
        </>
      )}

      <p class="cal-disclaimer">
        农历与节气为传统历法参考，不构成任何决策依据。
      </p>
    </div>
  );
});
