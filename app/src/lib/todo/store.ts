/** 存储路径与 id 辅助（纯函数，便于单测）。
 *  目录约定（Worker 端 TODO_PATH 默认 app/src/data/todo）：
 *    tags.json                  标签定义
 *    index/YYYY-MM.json         月索引摘要
 *    YYYY-MM-DD.json            当天创建的 todo 列表（按 createdAt 归档） */
import { calcProgress } from "./progress";
import type { Todo, TodoIndexEntry } from "./types";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 日文件名：date 须为 YYYY-MM-DD。 */
export function dayFileName(date: string): string {
  return `${date}.json`;
}

/** 月索引文件名：index/YYYY-MM.json。 */
export function monthIndexName(y: number, m: number): string {
  return `index/${y}-${pad2(m)}.json`;
}

/** 从 YYYY-MM-DD 解析 {y, m}。非法返回 {y:0,m:0}。 */
export function ymFromDate(date: string): { y: number; m: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
  if (!m) return { y: 0, m: 0 };
  return { y: Number(m[1]), m: Number(m[2]) };
}

/** 是否为合法的日文件名（用于 Worker 列举目录时过滤）。 */
export function isDayFile(name: string): boolean {
  return /^\d{4}-\d{2}-\d{2}\.json$/.test(name);
}

/** 由 createdAt 推出所属日文件名（YYYY-MM-DD 取前 10 位）。 */
export function dayFileOf(todo: Pick<Todo, "createdAt">): string {
  return (todo.createdAt || "").slice(0, 10);
}

/** 生成 Todo id（base36 时间戳 + 随机后缀，避免碰撞）。 */
export function genTodoId(now: Date = new Date()): string {
  return (
    "todo-" +
    now.getTime().toString(36) +
    Math.random().toString(36).slice(2, 6)
  );
}

/** 生成子任务 id（基于所属 todo id + 序号）。 */
export function genSubId(todoId: string, n: number): string {
  return `${todoId}-${n}`;
}

/** 由完整 Todo 生成月索引摘要条目。 */
export function indexEntryOf(todo: Todo): TodoIndexEntry {
  return {
    id: todo.id,
    title: todo.title,
    tags: todo.tags,
    startDate: todo.startDate,
    endDate: todo.endDate,
    progress: calcProgress(todo),
    completedAt: todo.completedAt,
  };
}

/** 将完整 todos 数组按 createdAt 日期分组为 { 'YYYY-MM-DD': Todo[] }（保持各文件内原顺序）。 */
export function groupByDay(todos: Todo[]): Record<string, Todo[]> {
  const out: Record<string, Todo[]> = {};
  for (const t of todos) {
    const d = dayFileOf(t);
    if (!d) continue;
    (out[d] ||= []).push(t);
  }
  return out;
}

/** 将一批 Todo 重建为某月索引摘要数组（按 id 去重，取最新 lastOperatedAt 优先；这里直接取每条摘要）。 */
export function buildMonthIndex(todos: Todo[]): TodoIndexEntry[] {
  return todos.map(indexEntryOf);
}
