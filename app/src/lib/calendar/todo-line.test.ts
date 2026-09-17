import { describe, it, expect } from 'vitest';

import { CAL_MAX_LANES, dayKey, layoutTodoRow, type DaySlot } from './todo-line';
import type { TodoIndexEntry } from '../todo/types';

/** 造一个索引条目（只填布局关心的字段）。 */
function entry(
  id: string,
  startDate: string,
  endDate: string | null = null,
  progress = 0,
): TodoIndexEntry {
  return {
    id,
    title: id,
    tags: [],
    startDate,
    endDate,
    progress,
    completedAt: null,
  };
}

/** 2026-09-06（周日）起的连续一周，默认 7 列全部参与布局。 */
const WEEK = [
  '2026-09-06',
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
  '2026-09-10',
  '2026-09-11',
  '2026-09-12',
];

function week(keys: string[] = WEEK, disabled: number[] = []): DaySlot[] {
  return keys.map((key, i) => ({ key, enabled: !disabled.includes(i) }));
}

describe('todo-line · dayKey', () => {
  it('月/日补零为 YYYY-MM-DD（与 TODO 日期字段口径一致）', () => {
    expect(dayKey(2026, 9, 7)).toBe('2026-09-07');
    expect(dayKey(2026, 12, 31)).toBe('2026-12-31');
    expect(dayKey(2026, 1, 1)).toBe('2026-01-01');
  });
});

describe('todo-line · 单日与行内跨日', () => {
  it('单日任务：只有该格有片段、两端均圆角（独立胶囊）', () => {
    const r = layoutTodoRow(week(), [entry('t1', '2026-09-09', '2026-09-09', 50)]);
    expect(r.laneCount).toBe(1);
    expect(r.overflow).toBe(0);
    expect(r.homeCol).toBe(0);
    expect(r.cells.map((c) => c.length)).toEqual([0, 0, 0, 1, 0, 0, 0]);
    expect(r.cells[3][0]).toEqual({
      id: 't1',
      lane: 0,
      color: 'yellow',
      openL: false,
      openR: false,
    });
  });

  it('行内跨日任务：中间格两端直角贴边，首末格各只开放一侧（视觉上是一条连续的线）', () => {
    // 09-07(周二) ~ 09-09(周四) → col1 / col2 / col3
    const r = layoutTodoRow(week(), [entry('t1', '2026-09-07', '2026-09-09', 10)]);
    expect(r.laneCount).toBe(1);
    expect(r.cells[1][0]).toMatchObject({ openL: false, openR: true, color: 'red' });
    expect(r.cells[2][0]).toMatchObject({ openL: true, openR: true });
    expect(r.cells[3][0]).toMatchObject({ openL: true, openR: false });
    // 未命中的列不留片段
    expect(r.cells[0]).toHaveLength(0);
    expect(r.cells[4]).toHaveLength(0);
  });

  it('endDate 为 null 按单日处理', () => {
    const r = layoutTodoRow(week(), [entry('t1', '2026-09-10', null, 100)]);
    expect(r.cells[4][0]).toMatchObject({
      color: 'green',
      openL: false,
      openR: false,
    });
  });
});

describe('todo-line · 跨行续接标记', () => {
  it('任务在本行首列之前已开始 → 首格左端仍贴边（承接上一行）', () => {
    const r = layoutTodoRow(week(), [entry('t1', '2026-09-01', '2026-09-08')]);
    // col0(09-06) / col1(09-07) / col2(09-08)
    expect(r.cells[0][0]).toMatchObject({ openL: true, openR: true });
    expect(r.cells[1][0]).toMatchObject({ openL: true, openR: true });
    expect(r.cells[2][0]).toMatchObject({ openL: true, openR: false });
    expect(r.cells[3]).toHaveLength(0);
  });

  it('任务在本行末列之后仍未结束 → 末格右端仍贴边（延续下一行）', () => {
    const r = layoutTodoRow(week(), [entry('t1', '2026-09-11', '2026-09-20')]);
    // col5(09-11) / col6(09-12)
    expect(r.cells[5][0]).toMatchObject({ openL: false, openR: true });
    expect(r.cells[6][0]).toMatchObject({ openL: true, openR: true });
  });

  it('任务完整覆盖本行 → 每一格两端都贴边（整行贯穿）', () => {
    const r = layoutTodoRow(week(), [entry('t1', '2026-08-01', '2026-12-31')]);
    expect(r.cells.map((c) => c.length)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    for (const cell of r.cells) {
      expect(cell[0]).toMatchObject({ openL: true, openR: true });
    }
  });
});

describe('todo-line · 通道分配', () => {
  it('3 个任务覆盖同一列 → 分配到 lane 0/1/2，无溢出', () => {
    const r = layoutTodoRow(week(), [
      entry('a', '2026-09-09', '2026-09-09'),
      entry('b', '2026-09-07', '2026-09-11'),
      entry('c', '2026-09-08', '2026-09-10'),
    ]);
    expect(r.laneCount).toBe(3);
    expect(r.overflow).toBe(0);
    expect(r.cells[3].map((s) => s.lane)).toEqual([0, 1, 2]);
  });

  it('超过通道上限 → 多余任务计入 overflow 且不产生片段', () => {
    expect(CAL_MAX_LANES).toBe(3);
    const r = layoutTodoRow(
      week(),
      [1, 2, 3, 4].map((i) => entry('t' + i, '2026-09-09', '2026-09-09')),
    );
    expect(r.cells[3]).toHaveLength(CAL_MAX_LANES);
    expect(r.laneCount).toBe(CAL_MAX_LANES);
    expect(r.overflow).toBe(1);
  });

  it('同通道内时间不重叠的任务复用同一 lane（laneCount 不虚增）', () => {
    const r = layoutTodoRow(week(), [
      entry('a', '2026-09-06', '2026-09-07'),
      entry('b', '2026-09-09', '2026-09-10'),
    ]);
    expect(r.laneCount).toBe(1);
    expect(r.cells[0][0].lane).toBe(0);
    expect(r.cells[1][0].lane).toBe(0);
    expect(r.cells[3][0].lane).toBe(0);
    expect(r.cells[4][0].lane).toBe(0);
  });

  it('同起点时长者优先，减少通道占用', () => {
    const r = layoutTodoRow(week(), [
      entry('short', '2026-09-08', '2026-09-08'),
      entry('long', '2026-09-08', '2026-09-12'),
    ]);
    // long 先占 lane 0，short 与它在 col2 重叠 → 只能落 lane 1
    const laneOf = (id: string) =>
      r.cells.find((cell) => cell.some((s) => s.id === id))?.find((s) => s.id === id)?.lane;
    expect(laneOf('long')).toBe(0);
    expect(laneOf('short')).toBe(1);
    expect(r.laneCount).toBe(2);
  });
});

describe('todo-line · 边界与异常输入', () => {
  it('无 TODO → 全空布局（laneCount 0，仍给出 homeCol）', () => {
    const r = layoutTodoRow(week(), []);
    expect(r.laneCount).toBe(0);
    expect(r.overflow).toBe(0);
    expect(r.homeCol).toBe(0);
    expect(r.cells.map((c) => c.length)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('整行不可用（全为跨月补白格）→ 空布局且 homeCol=-1', () => {
    const slots: DaySlot[] = WEEK.map((key) => ({ key, enabled: false }));
    const r = layoutTodoRow(slots, [entry('t1', '2026-09-09', '2026-09-09')]);
    expect(r).toEqual({
      cells: [0, 1, 2, 3, 4, 5, 6].map(() => []),
      laneCount: 0,
      overflow: 0,
      homeCol: -1,
    });
  });

  it('startDate > endDate（脏数据）→ 不命中任何格子、不产生片段', () => {
    const r = layoutTodoRow(week(), [entry('bad', '2026-09-10', '2026-09-08')]);
    expect(r.laneCount).toBe(0);
    expect(r.cells.every((c) => c.length === 0)).toBe(true);
  });

  it('完全落在本行之外的 TODO → 不产生片段', () => {
    const r = layoutTodoRow(week(), [entry('out', '2026-10-01', '2026-10-03')]);
    expect(r.cells.every((c) => c.length === 0)).toBe(true);
  });

  it('跨月补白格不参与：仅在 enabled 列上计算起止与开放端', () => {
    // 本行前两列（09-06 / 09-07）属上月，不参与
    const r = layoutTodoRow(week(WEEK, [0, 1]), [
      entry('t1', '2026-09-01', '2026-09-09'),
    ]);
    expect(r.homeCol).toBe(2);
    expect(r.cells[0]).toHaveLength(0);
    expect(r.cells[1]).toHaveLength(0);
    // col2(09-08) / col3(09-09)
    expect(r.cells[2][0]).toMatchObject({ openL: true, openR: true });
    expect(r.cells[3][0]).toMatchObject({ openL: true, openR: false });
  });
});
