import { describe, it, expect } from "vitest";

import {
  closeTodo,
  localDay,
  patchTodo,
  reopenTodo,
  withSubtasks,
} from "./mutate";
import type { Subtask, Todo } from "./types";

function sub(id: string, weight: number, progress: number): Subtask {
  return {
    id,
    title: id,
    weight,
    progress: progress as Subtask["progress"],
    updatedAt: "2026-09-01T00:00:00",
  };
}

function todo(p: Partial<Todo>): Todo {
  return {
    id: "t1",
    title: "原标题",
    tags: ["tag-a"],
    startDate: "2026-09-15",
    endDate: null,
    createdAt: "2026-09-15T10:00:00",
    updatedAt: "2026-09-15T10:00:00",
    lastOperatedAt: "2026-09-15T10:00:00",
    completedAt: null,
    subtasks: [],
    ...p,
  };
}

const NOW = "2026-09-17T12:00:00";

describe("localDay", () => {
  it("取本地年月日分量（不是 UTC 日期）", () => {
    // 用本地时间构造：任何时区下本地分量都是 2026-09-17
    expect(localDay(new Date(2026, 8, 17, 13, 5))).toBe("2026-09-17");
    expect(localDay(new Date(2026, 8, 17, 0, 30))).toBe("2026-09-17");
  });

  it("月/日补零", () => {
    expect(localDay(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
    expect(localDay(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });

  it("默认参数返回今天的合法格式", () => {
    expect(localDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("patchTodo", () => {
  it("更新指定字段与时间戳，其余字段保持原引用", () => {
    const orig = todo({});
    const next = patchTodo(orig, { title: "新标题" }, NOW);

    expect(next.title).toBe("新标题");
    expect(next.updatedAt).toBe(NOW);
    expect(next.lastOperatedAt).toBe(NOW);
    expect(next.startDate).toBe(orig.startDate);
    expect(next.tags).toBe(orig.tags);
    expect(next.subtasks).toBe(orig.subtasks);
  });

  it("纯函数：不修改入参", () => {
    const orig = todo({});
    patchTodo(orig, { title: "改了" }, NOW);
    expect(orig.title).toBe("原标题");
    expect(orig.updatedAt).toBe("2026-09-15T10:00:00");
  });

  it("endDate 置 null 表达单日任务", () => {
    const next = patchTodo(todo({ endDate: "2026-09-20" }), { endDate: null }, NOW);
    expect(next.endDate).toBeNull();
  });

  it("空补丁只刷新时间戳", () => {
    const orig = todo({});
    const next = patchTodo(orig, {}, NOW);
    expect(next.title).toBe(orig.title);
    expect(next.tags).toBe(orig.tags);
    expect(next.updatedAt).toBe(NOW);
  });
});

describe("closeTodo", () => {
  it("把所有子任务进度写满 100% 并写 completedAt", () => {
    const next = closeTodo(
      todo({ subtasks: [sub("a", 1, 50), sub("b", 2, 0)] }),
      NOW,
    );
    expect(next.subtasks.map((s) => s.progress)).toEqual([100, 100]);
    expect(next.completedAt).toBe(NOW);
    expect(next.updatedAt).toBe(NOW);
    expect(next.lastOperatedAt).toBe(NOW);
  });

  it("无子任务时仍写 completedAt，subtasks 保持空数组", () => {
    const next = closeTodo(todo({}), NOW);
    expect(next.completedAt).toBe(NOW);
    expect(next.subtasks).toEqual([]);
  });

  it("已有 completedAt 时保留原完成时间", () => {
    const next = closeTodo(
      todo({ completedAt: "2026-09-10T00:00:00", subtasks: [sub("a", 1, 25)] }),
      NOW,
    );
    expect(next.completedAt).toBe("2026-09-10T00:00:00");
    expect(next.subtasks[0].progress).toBe(100);
  });

  it("纯函数：不修改入参与其子任务", () => {
    const orig = todo({ subtasks: [sub("a", 1, 50)] });
    closeTodo(orig, NOW);
    expect(orig.subtasks[0].progress).toBe(50);
    expect(orig.completedAt).toBeNull();
  });
});

describe("reopenTodo", () => {
  it("只清 completedAt，子任务进度保持不变", () => {
    const next = reopenTodo(
      todo({ completedAt: "2026-09-16T00:00:00", subtasks: [sub("a", 1, 100)] }),
      NOW,
    );
    expect(next.completedAt).toBeNull();
    expect(next.subtasks[0].progress).toBe(100);
    expect(next.updatedAt).toBe(NOW);
  });
});

describe("withSubtasks", () => {
  it("子任务全 100% → 自动写 completedAt", () => {
    const next = withSubtasks(todo({}), [sub("a", 1, 100), sub("b", 1, 100)], NOW);
    expect(next.completedAt).toBe(NOW);
  });

  it("子任务未达 100% → 不自动完成", () => {
    const next = withSubtasks(todo({}), [sub("a", 1, 75)], NOW);
    expect(next.completedAt).toBeNull();
  });

  it("已完成后子任务掉档 → 清空 completedAt（与原弹窗语义一致）", () => {
    const next = withSubtasks(
      todo({ completedAt: "2026-09-16T00:00:00" }),
      [sub("a", 1, 50)],
      NOW,
    );
    expect(next.completedAt).toBeNull();
  });

  it("进度收敛到五档并刷新 updatedAt", () => {
    const next = withSubtasks(todo({}), [sub("a", 1, 60)], NOW);
    expect(next.subtasks[0].progress).toBe(50);
    expect(next.subtasks[0].updatedAt).toBe(NOW);
    expect(next.lastOperatedAt).toBe(NOW);
  });

  it("纯函数：不修改入参子任务数组", () => {
    const subs = [sub("a", 1, 30)];
    withSubtasks(todo({}), subs, NOW);
    expect(subs[0].progress).toBe(30);
  });
});
