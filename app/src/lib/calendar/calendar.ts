/**
 * 月视图网格、日期底部标签等纯计算逻辑（农历/黄历由 lunar.ts 提供）。
 * 所有函数均为确定性纯函数，便于 SSR 预渲染与单元测试。
 */
import { getHoliday, type HolidayInfo } from './holidays';
import { getLunarInfo, type LunarInfo } from './lunar';

export interface DayRef {
  y: number;
  m: number; // 1-based
  d: number;
}

/** 日历格：含跨月补白格。 */
export interface CalendarCell {
  y: number;
  m: number;
  d: number;
  /** 是否属于当前展示月（跨月补白为 false） */
  inMonth: boolean;
  /** 星期，0=周日 … 6=周六 */
  weekday: number;
  lunar: LunarInfo;
  holiday: HolidayInfo;
  /** 是否今日（由调用方传入 today 决定；SSR 不传则为 false） */
  isToday: boolean;
}

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const;

/**
 * 构建某月网格（固定 6 行 × 7 列 = 42 格，周日起始）。
 * 跨月补白格 inMonth=false，其 lunar/holiday 仍按真实日期计算。
 * @param viewY 展示年
 * @param viewM 展示月（1-based）
 * @param today  今日（客户端注入；不传则全格 isToday=false，避免 SSR/CSR 水合不一致）
 */
export function buildMonthGrid(viewY: number, viewM: number, today?: DayRef | null): CalendarCell[] {
  const t = today ?? null;
  const first = new Date(viewY, viewM - 1, 1);
  const firstWeekday = first.getDay(); // 0=Sun
  // 网格起点：当月 1 号所在周的周日
  const start = new Date(viewY, viewM - 1, 1 - firstWeekday);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const isToday = !!t && t.y === y && t.m === m && t.d === d;
    cells.push({
      y,
      m,
      d,
      inMonth: m === viewM,
      weekday: date.getDay(),
      lunar: getLunarInfo(y, m, d),
      holiday: getHoliday(y, m, d),
      isToday,
    });
  }
  return cells;
}

/**
 * 日期格底部小字优先级：法定节日名 > 节气 > 农历节日 > 农历日期。
 * 返回 { text, kind }，kind 用于着色：fest=节日/法定（主色）、term=节气（天蓝）、lunar=农历。
 */
export function dayLabel(
  cell: CalendarCell
): { text: string; kind: 'fest' | 'term' | 'lunar' } {
  if (cell.holiday.name) return { text: cell.holiday.name, kind: 'fest' };
  if (cell.lunar.solarTerm) return { text: cell.lunar.solarTerm, kind: 'term' };
  if (cell.lunar.festivals.length > 0) return { text: cell.lunar.festivals[0], kind: 'fest' };
  return { text: cell.lunar.lunarText, kind: 'lunar' };
}
