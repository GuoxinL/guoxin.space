import { describe, it, expect } from "vitest";
import {
  matchProgress,
  matchTags,
  matchQuery,
  filterTodos,
  sortTodos,
} from "./filter";
import { calcProgress } from "./progress";
import type { Subtask, Todo } from "./types";

function sub(id: string, weight: number, progress: number): Subtask {
  return {
    id,
    title: id,
    weight,
    progress: progress as unknown as Subtask["progress"],
    updatedAt: "2026-09-17T00:00:00",
  };
}
function todo(p: Partial<Todo> & { id: string }): Todo {
  return {
    title: p.id,
    tags: [],
    startDate: "2026-09-15",
    endDate: null,
    createdAt: "2026-09-15T10:00:00",
    updatedAt: "2026-09-17T00:00:00",
    lastOperatedAt: "2026-09-17T00:00:00",
    completedAt: null,
    subtasks: [],
    ...p,
  } as Todo;
}

describe("matchProgress", () => {
  it("档位判定", () => {
    expect(matchProgress(0, "todo")).toBe(true);
    expect(matchProgress(0, "doing")).toBe(false);
    expect(matchProgress(50, "doing")).toBe(true);
    expect(matchProgress(100, "done")).toBe(true);
    expect(matchProgress(100, "all")).toBe(true);
  });
});

describe("matchTags (OR)", () => {
  it("未选全部通过", () => {
    expect(matchTags(["work"], [])).toBe(true);
  });
  it("选中任一即命中", () => {
    expect(matchTags(["work", "life"], ["life"])).toBe(true);
    expect(matchTags(["work"], ["life", "study"])).toBe(false);
  });
});

describe("matchQuery", () => {
  it("标题/子任务/标签包含", () => {
    const t = todo({
      id: "x",
      title: "重构主页",
      tags: ["work"],
      subtasks: [sub("s", 1, 0)],
    });
    t.subtasks[0].title = "设计布局";
    expect(matchQuery(t, "重构")).toBe(true);
    expect(matchQuery(t, "布局")).toBe(true);
    expect(matchQuery(t, "work")).toBe(true);
    expect(matchQuery(t, "跑步")).toBe(false);
  });
});

describe("filterTodos / sortTodos", () => {
  const todos: Todo[] = [
    todo({ id: "a", tags: ["work"], subtasks: [sub("a1", 1, 0)] }),
    todo({ id: "b", tags: ["life"], subtasks: [sub("b1", 1, 100)] }),
    todo({ id: "c", tags: ["work", "life"], subtasks: [sub("c1", 1, 50)] }),
  ];
  it("复合过滤：标签 life + 进度 all", () => {
    const r = filterTodos(todos, { tags: ["life"], progress: "all" });
    expect(r.map((t) => t.id).sort()).toEqual(["b", "c"]);
  });
  it("复合过滤：标签 work + 已完成", () => {
    const r = filterTodos(todos, { tags: ["work"], progress: "done" });
    expect(r.map((t) => t.id)).toEqual([]); // b 不属于 work，a/c 未完成
    expect(r.length).toBe(0);
  });
  it("关键词", () => {
    expect(filterTodos(todos, { query: "a" }).map((t) => t.id)).toContain("a");
  });
  it("排序：进度升序", () => {
    const r = sortTodos(todos, "progress-asc");
    // a=0, c=50, b=100
    expect(r.map((t) => t.id)).toEqual(["a", "c", "b"]);
  });
  it("排序：最近操作降序", () => {
    const r = sortTodos(
      [
        todo({ id: "a", lastOperatedAt: "2026-09-10T00:00:00" }),
        todo({ id: "b", lastOperatedAt: "2026-09-20T00:00:00" }),
      ],
      "recent",
    );
    expect(r.map((t) => t.id)).toEqual(["b", "a"]);
  });
  it("calcProgress 一致性", () => {
    expect(calcProgress(todos[0])).toBe(0);
    expect(calcProgress(todos[1])).toBe(100);
    expect(calcProgress(todos[2])).toBe(50);
  });
});
