import { describe, it, expect } from 'vitest';
import { getHoliday, HOLIDAYS, HOLIDAY_YEARS, isHolidayYearMaintained, nextHoliday } from './holidays';
import { getLunarInfo } from './lunar';
import { buildMonthGrid, dayLabel } from './calendar';

describe('holidays · 2026 法定节假日与调休', () => {
  it('元旦放假且 1/4 调休补班', () => {
    expect(getHoliday(2026, 1, 1)).toEqual({ type: 'rest', name: '元旦' });
    expect(getHoliday(2026, 1, 4)).toEqual({ type: 'work' });
  });

  it('春节 9 天连休且两个补班周六', () => {
    expect(getHoliday(2026, 2, 17)).toEqual({ type: 'rest', name: '春节' });
    expect(getHoliday(2026, 2, 15).type).toBe('rest');
    expect(getHoliday(2026, 2, 23).type).toBe('rest');
    expect(getHoliday(2026, 2, 14)).toEqual({ type: 'work' });
    expect(getHoliday(2026, 2, 28)).toEqual({ type: 'work' });
  });

  it('劳动节 5 天且 5/9 补班', () => {
    expect(getHoliday(2026, 5, 1)).toEqual({ type: 'rest', name: '劳动节' });
    expect(getHoliday(2026, 5, 5).type).toBe('rest');
    expect(getHoliday(2026, 5, 9)).toEqual({ type: 'work' });
  });

  it('国庆 7 天且 9/20、10/10 补班', () => {
    expect(getHoliday(2026, 10, 1)).toEqual({ type: 'rest', name: '国庆' });
    expect(getHoliday(2026, 10, 7).type).toBe('rest');
    expect(getHoliday(2026, 9, 20)).toEqual({ type: 'work' });
    expect(getHoliday(2026, 10, 10)).toEqual({ type: 'work' });
  });

  it('普通日返回 null', () => {
    expect(getHoliday(2026, 3, 15)).toEqual({ type: null });
  });

  it('数据覆盖 2026 全年 33 天法定假', () => {
    expect(HOLIDAYS[2026].rest.length).toBe(33);
  });

  it('维护年份清单含 2026、不含 2027（国办尚未发布）', () => {
    expect(HOLIDAY_YEARS).toContain(2026);
    expect(isHolidayYearMaintained(2026)).toBe(true);
    expect(HOLIDAY_YEARS).not.toContain(2027);
    expect(isHolidayYearMaintained(2027)).toBe(false);
  });

  it('未维护年份 getHoliday 返回普通日（不臆造节假日）', () => {
    expect(getHoliday(2027, 1, 1)).toEqual({ type: null });
    expect(getHoliday(2027, 10, 1)).toEqual({ type: null });
  });

  it('nextHoliday 返回最近未来法定假日的天数差与日期', () => {
    // 2026-09-17 → 最近为中秋 9/25（8 天）
    const r = nextHoliday({ y: 2026, m: 9, d: 17 });
    expect(r).not.toBeNull();
    if (r) {
      expect(r.date).toEqual({ y: 2026, m: 9, d: 25 });
      expect(r.days).toBe(8);
      expect(r.name).toBe('中秋');
    }
  });

  it('nextHoliday 当天为假期时 days=0', () => {
    const r = nextHoliday({ y: 2026, m: 10, d: 1 });
    expect(r?.days).toBe(0);
    expect(r?.name).toBe('国庆');
  });

  it('nextHoliday 在已维护年份的最后假期之后返回 null（诚实不臆造 2027）', () => {
    // 2026-10-08 国庆连休已结束，2027 尚未维护 → 无未来假期
    expect(nextHoliday({ y: 2026, m: 10, d: 8 })).toBeNull();
  });

  it('nextHoliday 早于首假期的年前日期定位到首假期', () => {
    const r = nextHoliday({ y: 2026, m: 1, d: 1 });
    expect(r?.date).toEqual({ y: 2026, m: 1, d: 1 }); // 元旦当天
    expect(r?.days).toBe(0);
  });
});

describe('lunar · 农历 / 黄历封装', () => {
  it('2026-02-17 为正月初一（丙午马年）', () => {
    const info = getLunarInfo(2026, 2, 17);
    expect(info.lunarText).toBe('正月初一');
    expect(info.yearGanZhi).toBe('丙午');
    expect(info.animal).toBe('马');
  });

  it('节气取法：立春 / 清明', () => {
    expect(getLunarInfo(2026, 2, 4).solarTerm).toBe('立春');
    expect(getLunarInfo(2026, 4, 5).solarTerm).toBe('清明');
  });

  it('农历节日：端午节', () => {
    expect(getLunarInfo(2026, 6, 19).festivals).toContain('端午节');
  });

  it('宜忌为数组', () => {
    const info = getLunarInfo(2026, 2, 17);
    expect(Array.isArray(info.yi)).toBe(true);
    expect(Array.isArray(info.ji)).toBe(true);
    // 当日忌含嫁娶、入宅
    expect(info.ji).toContain('嫁娶');
    expect(info.ji).toContain('入宅');
  });
});

describe('calendar · 月视图网格', () => {
  it('固定 42 格、周日起始、跨月补白存在', () => {
    const grid = buildMonthGrid(2026, 9, null);
    expect(grid.length).toBe(42);
    expect(grid[0].weekday).toBe(0); // 首格为周日
    expect(grid[0].inMonth).toBe(false); // 跨月补白
  });

  it('当月格子数正确（9 月 30 天）', () => {
    const grid = buildMonthGrid(2026, 9, null);
    expect(grid.filter((c) => c.inMonth).length).toBe(30);
    const firstOfMonth = grid.find((c) => c.inMonth && c.d === 1)!;
    expect(firstOfMonth.weekday).toBe(2); // 2026-09-01 为周二
  });

  it('today 命中标记', () => {
    const grid = buildMonthGrid(2026, 9, { y: 2026, m: 9, d: 16 });
    const cell = grid.find((c) => c.inMonth && c.d === 16)!;
    expect(cell.isToday).toBe(true);
    expect(grid.find((c) => c.inMonth && c.d === 1)!.isToday).toBe(false);
  });

  it('dayLabel 优先级：法定名 > 节气 > 农历节日 > 农历', () => {
    expect(dayLabel(buildMonthGrid(2026, 1, null)[0]).text).toBeTruthy();
    // 清明（有 name）显示为「清明」
    const apr5 = buildMonthGrid(2026, 4, null).find((c) => c.m === 4 && c.d === 5)!;
    expect(dayLabel(apr5)).toEqual({ text: '清明', kind: 'fest' });
    // 立春（无 name，纯节气）显示为「立春」
    const feb4 = buildMonthGrid(2026, 2, null).find((c) => c.m === 2 && c.d === 4)!;
    expect(dayLabel(feb4)).toEqual({ text: '立春', kind: 'term' });
  });
});
