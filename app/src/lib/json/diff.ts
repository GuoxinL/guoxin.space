import type { DiffLine, DiffResult } from '../../types/json';

/** LCS 表规模上限：超过则退化为逐行对比，避免大文本卡死主线程 */
const DP_CELL_LIMIT = 400_000;

type Table = number[][];

/** 构建最长公共子序列长度表，dp[i][j] = a[i..] 与 b[j..] 的 LCS 长度 */
function buildLcsTable(a: string[], b: string[]): Table {
  const n = a.length;
  const m = b.length;
  const dp: Table = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

/**
 * 行级 diff：红=左侧独有（del），绿=右侧新增（add），gap 为占位空行。
 * 输出两侧等长，便于逐行对齐渲染。
 */
export function diffLines(aText: string, bText: string): DiffResult {
  const a = aText.replace(/\r/g, '').split('\n');
  const b = bText.replace(/\r/g, '').split('\n');
  const n = a.length;
  const m = b.length;
  const dp = n * m <= DP_CELL_LIMIT ? buildLcsTable(a, b) : null;

  const outA: DiffLine[] = [];
  const outB: DiffLine[] = [];
  let x = 0;
  let y = 0;

  while (x < n && y < m) {
    if (dp) {
      if (a[x] === b[y]) {
        outA.push({ t: 'same', s: a[x] });
        outB.push({ t: 'same', s: b[y] });
        x++;
        y++;
      } else if (dp[x + 1][y] >= dp[x][y + 1]) {
        outA.push({ t: 'del', s: a[x] });
        outB.push({ t: 'gap', s: '' });
        x++;
      } else {
        outA.push({ t: 'gap', s: '' });
        outB.push({ t: 'add', s: b[y] });
        y++;
      }
    } else {
      // 超阈值：不做对齐，逐行一一对应，不同则两侧同时标红标绿
      if (a[x] === b[y]) {
        outA.push({ t: 'same', s: a[x] });
        outB.push({ t: 'same', s: b[y] });
      } else {
        outA.push({ t: 'del', s: a[x] });
        outB.push({ t: 'add', s: b[y] });
      }
      x++;
      y++;
    }
  }
  while (x < n) {
    outA.push({ t: 'del', s: a[x] });
    outB.push({ t: 'gap', s: '' });
    x++;
  }
  while (y < m) {
    outA.push({ t: 'gap', s: '' });
    outB.push({ t: 'add', s: b[y] });
    y++;
  }

  return { a: outA, b: outB };
}

/** 统计差异：左侧独有行数与右侧新增行数 */
export function diffStats(d: DiffResult): { del: number; add: number } {
  let del = 0;
  let add = 0;
  for (const l of d.a) if (l.t === 'del') del++;
  for (const l of d.b) if (l.t === 'add') add++;
  return { del, add };
}

/** 两段文本是否完全一致（忽略换行符差异） */
export function isIdentical(a: string, b: string): boolean {
  return a.replace(/\r/g, '') === b.replace(/\r/g, '');
}
