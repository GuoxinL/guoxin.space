/** 周报生成（纯函数，便于单测）。
 *  入参 todos 已按标签预筛；本模块只负责「时间范围交集 + 统计 + 渲染」。 */
import { calcProgress, countSubtasksDone, sanitizeProgress } from "./progress";
import type { Todo } from "./types";

export interface WeeklyReportInput {
  /** 选中标签名（用于标题；未选则标「全部」）。 */
  tagName?: string;
  /** 周起始（周一）YYYY-MM-DD。 */
  rangeStart: string;
  /** 周结束（周日）YYYY-MM-DD。 */
  rangeEnd: string;
  /** 已按标签筛选的 Todo 列表。 */
  todos: Todo[];
}

export interface WeeklyReport {
  markdown: string;
  text: string;
  html: string;
}

/** YYYY-MM-DD 字符串比较（零填充可直接字典序比较）。 */
function dcmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Todo 是否与 [start, end] 有交叠。 */
export function inRange(todo: Todo, start: string, end: string): boolean {
  const s = todo.startDate || "";
  const e = todo.endDate || s;
  return dcmp(s, end) <= 0 && dcmp(e, start) >= 0;
}

function mdDate(d: string | null): string {
  return d ? d.slice(5) : "—";
}

function spanText(t: Todo): string {
  const s = mdDate(t.startDate);
  const e = mdDate(t.endDate);
  return e && e !== s ? `${s} ~ ${e}` : s;
}

function stats(todos: Todo[]) {
  let done = 0;
  let doing = 0;
  let notStarted = 0;
  let sum = 0;
  for (const t of todos) {
    const p = calcProgress(t);
    sum += p;
    if (p === 100) done++;
    else if (p > 0) doing++;
    else notStarted++;
  }
  const avg = todos.length ? Math.round(sum / todos.length) : 0;
  return { total: todos.length, done, doing, notStarted, avg };
}

/** 完成时间线：completedAt 落在区间内的 Todo（按完成时间升序）。 */
function completedTimeline(todos: Todo[], start: string, end: string) {
  return todos
    .filter(
      (t) =>
        t.completedAt &&
        dcmp(t.completedAt.slice(0, 10), start) >= 0 &&
        dcmp(t.completedAt.slice(0, 10), end) <= 0,
    )
    .sort((a, b) =>
      (a.completedAt as string).localeCompare(b.completedAt as string),
    )
    .map((t) => ({
      date: mdDate(t.completedAt!.slice(0, 10)),
      title: t.title,
    }));
}

/** 构建周报（Markdown / 纯文本 / HTML 三态）。 */
export function buildWeeklyReport(input: WeeklyReportInput): WeeklyReport {
  const { tagName, rangeStart, rangeEnd, todos } = input;
  const scoped = todos.filter((t) => inRange(t, rangeStart, rangeEnd));
  const st = stats(scoped);
  const tl = completedTimeline(scoped, rangeStart, rangeEnd);
  const titleTag = tagName ? tagName : "全部";
  const period = `${rangeStart} ~ ${rangeEnd}`;

  // ---------- Markdown ----------
  const lines: string[] = [];
  lines.push(`## 周报 — ${titleTag} (${period})`, "");
  lines.push(`### 📊 总体统计`);
  lines.push(`- Todo 总数：${st.total}`);
  lines.push(
    `- 已完成：${st.done} | 进行中：${st.doing} | 未开始：${st.notStarted}`,
  );
  lines.push(`- 平均进度：${st.avg}%`);
  lines.push("");
  lines.push(`### 📋 任务明细`);
  if (scoped.length === 0) {
    lines.push(`_本周（${titleTag}）暂无任务_`);
  } else {
    lines.push(`| 任务 | 进度 | 子任务完成 | 起止日期 |`);
    lines.push(`|------|------|-----------|----------|`);
    for (const t of scoped) {
      const p = calcProgress(t);
      const done = countSubtasksDone(t.subtasks);
      lines.push(
        `| ${t.title} | ${p}% | ${done}/${t.subtasks.length} | ${spanText(t)} |`,
      );
    }
  }
  if (scoped.length) {
    lines.push("");
    lines.push(`### 📝 任务与子任务明细`);
    scoped.forEach((t, i) => {
      const p = calcProgress(t);
      lines.push(`#### ${i + 1}. ${t.title}（进度 ${p}%）`);
      if (t.subtasks.length === 0) {
        lines.push(`- 无子任务`);
      } else {
        for (const s of t.subtasks) {
          const done = sanitizeProgress(s.progress) >= 100;
          lines.push(`- [${done ? "x" : " "}] ${s.title}（${s.progress}%）`);
        }
      }
    });
  }
  if (tl.length) {
    lines.push("");
    lines.push(`### 📈 完成时间线`);
    for (const c of tl)
      lines.push(`- ${c.date} ${c.title} → 100%（子任务全部完成）`);
  }
  const markdown = lines.join("\n");

  // ---------- 纯文本（去 Markdown 装饰） ----------
  const text = markdown
    .replace(/^#+\s*/gm, "")
    .replace(/\|/g, "  ")
    .replace(/^\s*[-*]\s+/gm, "- ")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\n{2,}/g, "\n\n")
    .trim();

  // ---------- HTML ----------
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = scoped
    .map((t) => {
      const p = calcProgress(t);
      const done = countSubtasksDone(t.subtasks);
      return `<tr><td>${esc(t.title)}</td><td>${p}%</td><td>${done}/${t.subtasks.length}</td><td>${esc(spanText(t))}</td></tr>`;
    })
    .join("");
  const tlHtml = tl.length
    ? `<h3>完成时间线</h3><ul>${tl.map((c) => `<li>${esc(c.date)} ${esc(c.title)} → 100%</li>`).join("")}</ul>`
    : "";
  const detailHtml = scoped.length
    ? `<h3>任务与子任务明细</h3>` +
      scoped
        .map((t, i) => {
          const p = calcProgress(t);
          const items = t.subtasks.length
            ? t.subtasks
                .map((s) => {
                  const done = sanitizeProgress(s.progress) >= 100;
                  return `<li>[${done ? "x" : " "}] ${esc(s.title)}（${s.progress}%）</li>`;
                })
                .join("")
            : `<li>无子任务</li>`;
          return `<h4>${i + 1}. ${esc(t.title)}（进度 ${p}%）</h4><ul>${items}</ul>`;
        })
        .join("")
    : "";
  const html = [
    `<h2>周报 — ${esc(titleTag)} (${esc(period)})</h2>`,
    `<h3>总体统计</h3>`,
    `<ul><li>Todo 总数：${st.total}</li><li>已完成：${st.done} | 进行中：${st.doing} | 未开始：${st.notStarted}</li><li>平均进度：${st.avg}%</li></ul>`,
    `<h3>任务明细</h3>`,
    scoped.length
      ? `<table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>任务</th><th>进度</th><th>子任务完成</th><th>起止日期</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<p>本周（${esc(titleTag)}）暂无任务</p>`,
    detailHtml,
    tlHtml,
  ].join("\n");

  return { markdown, text, html };
}

/** 计算某日期所在周的周一 ~ 周日（本地时间）。返回 [Mon, Sun] YYYY-MM-DD。 */
export function weekRangeOf(date: Date): [string, string] {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay(); // 0=Sun..6=Sat
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return [fmt(mon), fmt(sun)];
}
