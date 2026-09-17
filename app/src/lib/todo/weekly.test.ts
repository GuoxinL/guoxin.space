import { describe, it, expect } from "vitest";
import { buildWeeklyReport, inRange, weekRangeOf } from "./weekly";
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

describe("inRange", () => {
  it("单日任务在区间内", () => {
    const t = todo({ id: "a", startDate: "2026-09-16", endDate: null });
    expect(inRange(t, "2026-09-15", "2026-09-21")).toBe(true);
  });
  it("跨月任务与本周交叠", () => {
    const t = todo({ id: "a", startDate: "2026-09-15", endDate: "2026-09-20" });
    expect(inRange(t, "2026-09-15", "2026-09-21")).toBe(true);
  });
  it("完全在区间之前则不交叠", () => {
    const t = todo({ id: "a", startDate: "2026-09-01", endDate: "2026-09-05" });
    expect(inRange(t, "2026-09-15", "2026-09-21")).toBe(false);
  });
});

describe("buildWeeklyReport", () => {
  const todos: Todo[] = [
    todo({
      id: "a",
      title: "重构个人主页",
      tags: ["work"],
      startDate: "2026-09-15",
      endDate: "2026-09-20",
      subtasks: [sub("a1", 30, 100), sub("a2", 50, 60), sub("a3", 20, 0)],
      completedAt: null,
    }),
    todo({
      id: "b",
      title: "写技术博客",
      tags: ["work"],
      startDate: "2026-09-16",
      endDate: "2026-09-16",
      subtasks: [sub("b1", 1, 100), sub("b2", 1, 100)],
      completedAt: "2026-09-16T09:00:00",
    }),
  ];
  const rep = buildWeeklyReport({
    tagName: "工作",
    rangeStart: "2026-09-15",
    rangeEnd: "2026-09-21",
    todos,
  });

  it("统计正确", () => {
    expect(rep.markdown).toContain("Todo 总数：2");
    expect(rep.markdown).toContain("已完成：1 | 进行中：1 | 未开始：0");
    expect(rep.markdown).toContain("平均进度：80%"); // (60+100)/2
  });
  it("明细含进度与子任务完成数", () => {
    expect(rep.markdown).toContain("重构个人主页 | 60% | 1/3");
    expect(rep.markdown).toContain("写技术博客 | 100% | 2/2");
  });
  it("完成时间线含 09-16", () => {
    expect(rep.markdown).toContain("09-16 写技术博客 → 100%");
  });
  it("标题含标签与周期", () => {
    expect(rep.markdown).toContain("周报 — 工作 (2026-09-15 ~ 2026-09-21)");
  });
  it("三态均生成", () => {
    expect(rep.text.length).toBeGreaterThan(0);
    expect(rep.html).toContain("<table");
    expect(rep.html).toContain("重构个人主页");
  });
  it("calcProgress 复核", () => {
    expect(calcProgress(todos[0])).toBe(60);
    expect(calcProgress(todos[1])).toBe(100);
  });
});

describe("weekRangeOf", () => {
  it("周三返回当周一二~周日", () => {
    // 2026-09-16 是周三
    const [mon, sun] = weekRangeOf(new Date(2026, 8, 16));
    expect(mon).toBe("2026-09-14");
    expect(sun).toBe("2026-09-20");
  });
  it("周日返回当周一二~周日", () => {
    const [mon, sun] = weekRangeOf(new Date(2026, 8, 20));
    expect(mon).toBe("2026-09-14");
    expect(sun).toBe("2026-09-20");
  });
});
