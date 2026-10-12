/** write-plan.ts 单测：写盘计划的核心安全逻辑。
 *
 * 重点覆盖「删除反推」—— 2026-10-09 事故中正是这里把
 * 「读不到的日期」当成「已删空」而真删。 */
import { describe, it, expect } from "vitest";

import { planWrite } from "./write-plan";
import type { Todo } from "./types";

function todo(id: string, createdAt: string): Todo {
  return {
    id,
    title: "T" + id,
    tags: [],
    startDate: createdAt.slice(0, 10),
    endDate: null,
    createdAt,
    updatedAt: createdAt,
    lastOperatedAt: createdAt,
    completedAt: null,
    subtasks: [],
  };
}

describe("lib/todo/write-plan", () => {
  it("按 createdAt 日期分组，每天一条写入", () => {
    const plan = planWrite(
      [todo("a", "2026-09-20T01:00:00.000Z"), todo("b", "2026-09-21T01:00:00.000Z")],
      new Set(),
    );
    expect(plan.writes).toHaveLength(2);
    expect(plan.removed).toEqual([]);
    const byDay = Object.fromEntries(plan.writes.map((w) => [w.day, w.todos.length]));
    expect(byDay).toEqual({ "2026-09-20": 1, "2026-09-21": 1 });
  });

  it("同一天的多个 todo 归为一次写入", () => {
    const plan = planWrite(
      [
        todo("a", "2026-09-20T01:00:00.000Z"),
        todo("b", "2026-09-20T02:00:00.000Z"),
      ],
      new Set(),
    );
    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0].todos).toHaveLength(2);
  });

  it("knownDays 中不再出现的日期进 removed", () => {
    const plan = planWrite(
      [todo("a", "2026-09-20T01:00:00.000Z")],
      new Set(["2026-09-20", "2026-09-21"]),
    );
    expect(plan.removed).toEqual(["2026-09-21"]);
    expect(plan.writes.map((w) => w.day)).toEqual(["2026-09-20"]);
  });

  it("knownDays 为空（读取不完整场景）时 removed 必为空 —— 绝不误删", () => {
    // 这正是 L5 闸门依赖的降级行为：数据残缺时删除反推失效但不会错删
    const plan = planWrite(
      [todo("a", "2026-09-20T01:00:00.000Z")],
      new Set<string>(),
    );
    expect(plan.removed).toEqual([]);
    expect(plan.writes).toHaveLength(1);
  });

  it("空快照 + 空的 knownDays → 无任何写入也不删任何文件", () => {
    const plan = planWrite([], new Set());
    expect(plan.writes).toEqual([]);
    expect(plan.removed).toEqual([]);
  });

  it("空快照 + 非空 knownDays → 全部判为已删空（用户确实删光了）", () => {
    const plan = planWrite([], new Set(["2026-09-20"]));
    expect(plan.removed).toEqual(["2026-09-20"]);
  });

  it("createdAt 为空的 todo 被忽略（不产生非法日期文件）", () => {
    const plan = planWrite(
      [todo("a", "2026-09-20T01:00:00.000Z"), { ...todo("b", ""), createdAt: "" }],
      new Set(),
    );
    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0].day).toBe("2026-09-20");
  });

  it("不修改入参（纯函数）", () => {
    const snapshot = [todo("a", "2026-09-20T01:00:00.000Z")];
    const known = new Set(["2026-09-20"]);
    const before = JSON.stringify(snapshot);
    planWrite(snapshot, known);
    expect(JSON.stringify(snapshot)).toBe(before);
    expect([...known]).toEqual(["2026-09-20"]);
  });
});
