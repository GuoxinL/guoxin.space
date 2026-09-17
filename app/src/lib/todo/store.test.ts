/** store.ts 单测：覆盖真实纯函数导出与边界（plan §6 #7 意图：缺字段 / 非法输入兜底）。
 *  注：store.ts 实际导出为 groupByDay/indexEntryOf/buildMonthIndex/genTodoId 等，
 *  无 plan 早期假设的 sanitizeTodo（已在实现期收敛），此处改测真实表面。 */
import { describe, it, expect } from "vitest";
import {
  groupByDay,
  indexEntryOf,
  buildMonthIndex,
  genTodoId,
  dayFileOf,
  ymFromDate,
  isDayFile,
  dayFileName,
  monthIndexName,
} from "./store";
import type { Todo } from "./types";

function mk(over: Partial<Todo> = {}): Todo {
  return {
    id: "todo-1",
    title: "T",
    tags: [],
    startDate: "2026-09-17",
    endDate: null,
    createdAt: "2026-09-17T08:00:00.000Z",
    updatedAt: "2026-09-17T08:00:00.000Z",
    lastOperatedAt: "2026-09-17T08:00:00.000Z",
    completedAt: null,
    subtasks: [],
    ...over,
  };
}

describe("lib/todo/store", () => {
  it("groupByDay 按 createdAt 日期分组（缺 createdAt 跳过）", () => {
    const a = mk();
    const b = mk({ id: "todo-2", createdAt: "2026-09-18T08:00:00.000Z" });
    const c = mk({ id: "todo-3", createdAt: "" }); // 非法 → 跳过
    const g = groupByDay([a, b, c]);
    expect(Object.keys(g).sort()).toEqual(["2026-09-17", "2026-09-18"]);
    expect(g["2026-09-17"]).toHaveLength(1);
    expect(g["2026-09-18"][0].id).toBe("todo-2");
  });

  it("indexEntryOf 摘要含加权进度（子任务缺 id 不影响计算）", () => {
    const t = mk({
      subtasks: [
        { id: "", title: "s1", weight: 1, progress: 100, updatedAt: "x" },
        { id: "s2", title: "s2", weight: 1, progress: 0, updatedAt: "x" },
      ],
    });
    const e = indexEntryOf(t);
    expect(e.id).toBe("todo-1");
    expect(e.progress).toBe(50);
  });

  it("buildMonthIndex 映射为摘要数组", () => {
    const idx = buildMonthIndex([mk(), mk({ id: "todo-2" })]);
    expect(idx).toHaveLength(2);
    expect(idx[1].id).toBe("todo-2");
  });

  it("genTodoId 返回 todo- 前缀字符串", () => {
    expect(genTodoId().startsWith("todo-")).toBe(true);
  });

  it("dayFileOf / ymFromDate / isDayFile / dayFileName / monthIndexName", () => {
    expect(dayFileOf(mk())).toBe("2026-09-17");
    expect(ymFromDate("2026-09-17")).toEqual({ y: 2026, m: 9 });
    expect(ymFromDate("bad")).toEqual({ y: 0, m: 0 });
    expect(isDayFile("2026-09-17.json")).toBe(true);
    expect(isDayFile("index.json")).toBe(false);
    expect(dayFileName("2026-09-17")).toBe("2026-09-17.json");
    expect(monthIndexName(2026, 9)).toBe("index/2026-09.json");
  });
});
