/**
 * 法定节假日与调休补班数据（按年维护）。
 *
 * 数据来源：国务院办公厅《关于 2026 年部分节假日安排的通知》（2025-11-04 发布）。
 * 后续年份在 HOLIDAYS 中追加对应年份条目即可，无需改动计算逻辑。
 *
 * - rest：放假日期（ISO yyyy-mm-dd，含节日当天与调休连休）。
 * - work：调休补班日期（原本为周末、但因调休需上班的日期）。
 * - names：法定节日名（仅标注锚点日，用于日历格高亮显示，如「春节」标在正月初一）。 */

import type { DayRef } from './calendar';
export interface YearHoliday {
  year: number;
  rest: string[];
  work: string[];
  names: Record<string, string>;
}

export const HOLIDAYS: Record<number, YearHoliday> = {
  2026: {
    year: 2026,
    rest: [
      // 元旦：1/1–1/3 放假 3 天
      '2026-01-01', '2026-01-02', '2026-01-03',
      // 春节：2/15（腊月廿八）–2/23（正月初七）放假 9 天
      '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
      '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
      // 清明：4/4–4/6 放假 3 天
      '2026-04-04', '2026-04-05', '2026-04-06',
      // 劳动：5/1–5/5 放假 5 天
      '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
      // 端午：6/19–6/21 放假 3 天
      '2026-06-19', '2026-06-20', '2026-06-21',
      // 中秋：9/25–9/27 放假 3 天
      '2026-09-25', '2026-09-26', '2026-09-27',
      // 国庆：10/1–10/7 放假 7 天
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
      '2026-10-06', '2026-10-07',
    ],
    work: [
      // 元旦调休：1/4（周日）上班
      '2026-01-04',
      // 春节调休：2/14（周六）、2/28（周六）上班
      '2026-02-14', '2026-02-28',
      // 劳动调休：5/9（周六）上班
      '2026-05-09',
      // 国庆调休：9/20（周日）、10/10（周六）上班
      '2026-09-20', '2026-10-10',
    ],
    names: {
      '2026-01-01': '元旦',
      '2026-02-17': '春节',
      '2026-04-05': '清明',
      '2026-05-01': '劳动节',
      '2026-06-19': '端午',
      '2026-09-25': '中秋',
      '2026-10-01': '国庆',
    },
  },
};

export type HolidayType = 'rest' | 'work' | null;

export interface HolidayInfo {
  type: HolidayType;
  name?: string;
}

function iso(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/**
 * 查询某日是否为法定节假日 / 调休补班。
 * 返回 type：'rest' 放假、'work' 调休补班、null 普通日；name 为法定节日名（仅锚点日有）。
 */
export function getHoliday(y: number, m: number, d: number): HolidayInfo {
  const year = HOLIDAYS[y];
  if (!year) return { type: null };
  const key = iso(y, m, d);
  if (year.rest.includes(key)) {
    return { type: 'rest', name: year.names[key] };
  }
  if (year.work.includes(key)) {
    return { type: 'work' };
  }
  return { type: null };
}

/**
 * 已维护法定节假日数据的年份（升序）。
 * 仅这些年份的日历会显示「休/班」标记；其余年份（国办尚未发布放假安排）只显示农历与节气，
 * 并给出诚实提示，绝不臆造节假日数据。
 */
export const HOLIDAY_YEARS: number[] = Object.keys(HOLIDAYS)
  .map(Number)
  .sort((a, b) => a - b);

export function isHolidayYearMaintained(y: number): boolean {
  return HOLIDAYS[y] !== undefined;
}

export interface NextHoliday {
  /** 距今天数差（含今天=0） */
  days: number;
  date: DayRef;
  name?: string;
}

/**
 * 自 from（含）起最近的法定放假日的天数差与日期。
 * 仅在「已维护年份」的放假数据内查找；若未来无已维护的放假数据则返回 null（诚实不臆造）。
 */
export function nextHoliday(from: DayRef): NextHoliday | null {
  const fromTime = Date.UTC(from.y, from.m - 1, from.d);
  let best: { time: number; date: DayRef; name?: string } | null = null;
  for (const y of HOLIDAY_YEARS) {
    const year = HOLIDAYS[y];
    for (const isoStr of year.rest) {
      const parts = isoStr.split('-');
      const yy = Number(parts[0]);
      const mm = Number(parts[1]);
      const dd = Number(parts[2]);
      const time = Date.UTC(yy, mm - 1, dd);
      if (time >= fromTime && (!best || time < best.time)) {
        best = { time, date: { y: yy, m: mm, d: dd }, name: year.names[isoStr] };
      }
    }
  }
  if (!best) return null;
  const days = Math.round((best.time - fromTime) / 86_400_000);
  return { days, date: best.date, name: best.name };
}
