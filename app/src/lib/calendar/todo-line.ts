/** 日历任务线布局：把当月 TODO 索引按「周（行）」分配进通道（lane）。
 *
 *  设计动机：日历单元格各自渲染「当天一段」会导致同一个跨日任务被切成互不相连的短线。
 *  本模块按行统一分配 lane 与 laneCount —— 同一行 7 个格共用一套 lane 编号，格内按 lane
 *  固定槽位渲染（无段处用不可见占位），使同一 lane 在 7 格中的 y 完全一致；再配合
 *  「未封闭端负 margin 贴边」即可让同一任务的线段跨格无缝衔接。
 *
 *  跨行（换行）在几何上无法连续，改由 openL/openR 标记「承接上一行 / 延续下一行」，
 *  由样式渲染成贴边直角（日历多日事件的通行表达）。
 *
 *  纯函数、无 DOM 依赖：可参与 SSR 预渲染，并被单测覆盖。
 */
import { progressColor } from '../todo/progress';
import type { TodoIndexEntry } from '../todo/types';

/** 一行内最多同时渲染的通道数；超出部分计入 overflow（由行首格显示 +N）。 */
export const CAL_MAX_LANES = 3;

/** 周内某一列。 */
export interface DaySlot {
  /** 该列日期键 YYYY-MM-DD */
  key: string;
  /** 是否参与布局（月视图跨月补白格为 false） */
  enabled: boolean;
}

/** 某一格内的任务线段（同一任务在本格内的一小段）。 */
export interface TodoCellSeg {
  id: string;
  /** 通道号，0 起；与同一行其它格子的 lane 编号对齐 */
  lane: number;
  color: 'red' | 'yellow' | 'green';
  /** 左端直角贴边：本格不是任务在本行内的起点，或任务承接上一行 */
  openL: boolean;
  /** 右端直角贴边：本格不是任务在本行内的终点，或任务延续到下一行 */
  openR: boolean;
}

/** 一行的布局结果。 */
export interface TodoRowLayout {
  /** 按列下标（0..slots.length-1）给出的格内线段；无任务的列为空数组 */
  cells: TodoCellSeg[][];
  /** 本行占用的通道数（0 表示本行无线条） */
  laneCount: number;
  /** 超出通道上限而未能显示的任务数 */
  overflow: number;
  /** 本行首个可用列（+N 提示的落位），无可用列为 -1 */
  homeCol: number;
}

/** 日期键（本地日期口径，与 TODO 的 startDate/endDate 一致，字典序可直接比较）。 */
export function dayKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

interface RowSeg {
  id: string;
  lane: number;
  colStart: number;
  colEnd: number;
  color: 'red' | 'yellow' | 'green';
  openL: boolean;
  openR: boolean;
}

interface Candidate {
  id: string;
  colStart: number;
  colEnd: number;
  color: 'red' | 'yellow' | 'green';
  openL: boolean;
  openR: boolean;
}

/** 为一行（7 天）分配 TODO 通道，并拆成「每格一小段」。 */
export function layoutTodoRow(
  slots: DaySlot[],
  todos: TodoIndexEntry[],
): TodoRowLayout {
  const empty = () => slots.map<TodoCellSeg[]>(() => []);
  const cols: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].enabled) cols.push(i);
  }
  if (cols.length === 0) {
    return { cells: empty(), laneCount: 0, overflow: 0, homeCol: -1 };
  }
  const homeCol = cols[0];
  if (todos.length === 0) {
    return { cells: empty(), laneCount: 0, overflow: 0, homeCol };
  }
  const firstKey = slots[cols[0]].key;
  const lastKey = slots[cols[cols.length - 1]].key;

  const cand: Candidate[] = [];
  for (const t of todos) {
    const start = t.startDate;
    const end = t.endDate || t.startDate;
    let colStart = -1;
    let colEnd = -1;
    for (const c of cols) {
      const k = slots[c].key;
      if (start <= k && k <= end) {
        if (colStart < 0) colStart = c;
        colEnd = c;
      }
    }
    // 未命中本行任何可用列（含 startDate > endDate 的脏数据）
    if (colStart < 0) continue;
    cand.push({
      id: t.id,
      colStart,
      colEnd,
      color: progressColor(t.progress),
      openL: start < firstKey,
      openR: end > lastKey,
    });
  }

  // 起点升序 → 同起点时长的优先：贪心分配更省通道
  cand.sort((a, b) => a.colStart - b.colStart || b.colEnd - a.colEnd);

  const used: { s: number; e: number }[][] = [];
  const segs: RowSeg[] = [];
  let overflow = 0;
  for (const c of cand) {
    let lane = -1;
    for (let i = 0; i < CAL_MAX_LANES; i++) {
      const occ = used[i];
      if (!occ) {
        used[i] = [{ s: c.colStart, e: c.colEnd }];
        lane = i;
        break;
      }
      // 列区间（闭区间）不重叠即可复用该通道
      if (!occ.some((r) => c.colStart <= r.e && r.s <= c.colEnd)) {
        occ.push({ s: c.colStart, e: c.colEnd });
        lane = i;
        break;
      }
    }
    if (lane < 0) {
      overflow += 1;
      continue;
    }
    segs.push({ ...c, lane });
  }

  // 行级段 → 每格一小段：段内部（非首/末格）两端都贴边，首/末格再叠加跨行开放标记
  const cells = empty();
  for (const seg of segs) {
    for (let c = seg.colStart; c <= seg.colEnd; c++) {
      cells[c].push({
        id: seg.id,
        lane: seg.lane,
        color: seg.color,
        openL: seg.openL || c > seg.colStart,
        openR: seg.openR || c < seg.colEnd,
      });
    }
  }
  for (const cell of cells) cell.sort((a, b) => a.lane - b.lane);

  // 贪心从 lane 0 起填，used 长度即实际用到的通道数
  return { cells, laneCount: used.length, overflow, homeCol };
}
