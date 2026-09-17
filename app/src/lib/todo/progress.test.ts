import { describe, it, expect } from "vitest";
import {
  calcProgress,
  clampProgress,
  normWeight,
  progressColor,
  shouldAutoComplete,
  applyAutoComplete,
  countSubtasksDone,
  isLocked,
} from "./progress";
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
function todo(p: Partial<Todo>): Todo {
  return {
    id: "t1",
    title: "t",
    tags: [],
    startDate: "2026-09-15",
    endDate: null,
    createdAt: "2026-09-15T10:00:00",
    updatedAt: "2026-09-17T00:00:00",
    lastOperatedAt: "2026-09-17T00:00:00",
    completedAt: null,
    subtasks: [],
    ...p,
  };
}

describe("calcProgress", () => {
  it("加权平均示例：(100×30 + 60×50 + 0×20)/100 = 60", () => {
    const t = todo({
      subtasks: [sub("a", 30, 100), sub("b", 50, 60), sub("c", 20, 0)],
    });
    expect(calcProgress(t)).toBe(60);
  });

  it("无子任务时 completedAt 有值=100，否则 0", () => {
    expect(calcProgress(todo({ subtasks: [] }))).toBe(0);
    expect(
      calcProgress(todo({ subtasks: [], completedAt: "2026-09-17T00:00:00" })),
    ).toBe(100);
  });

  it("非法权重按 1 处理", () => {
    const t = todo({ subtasks: [sub("a", 0, 100), sub("b", -3, 0)] });
    // (100*1 + 0*1)/2 = 50
    expect(calcProgress(t)).toBe(50);
  });

  it("全部完成=100（触发自动完成）", () => {
    const t = todo({ subtasks: [sub("a", 1, 100), sub("b", 1, 100)] });
    expect(calcProgress(t)).toBe(100);
    expect(shouldAutoComplete(t)).toBe(true);
  });
});

describe("clampProgress / normWeight", () => {
  it("收敛到最近档位", () => {
    expect(clampProgress(0)).toBe(0);
    expect(clampProgress(10)).toBe(0);
    expect(clampProgress(30)).toBe(25);
    expect(clampProgress(50)).toBe(50);
    expect(clampProgress(75)).toBe(75);
    expect(clampProgress(100)).toBe(100);
    expect(clampProgress("80")).toBe(75);
    expect(clampProgress("xx")).toBe(0);
  });
  it("权重非法回退 1", () => {
    expect(normWeight(0)).toBe(1);
    expect(normWeight(-5)).toBe(1);
    expect(normWeight(2.9)).toBe(3);
    expect(normWeight("3")).toBe(3);
  });
});

describe("progressColor", () => {
  it("红<30 / 黄30~70 / 绿>70", () => {
    expect(progressColor(0)).toBe("red");
    expect(progressColor(29)).toBe("red");
    expect(progressColor(30)).toBe("yellow");
    expect(progressColor(70)).toBe("yellow");
    expect(progressColor(71)).toBe("green");
    expect(progressColor(100)).toBe("green");
  });
});

describe("自动完成 / 锁定", () => {
  it("applyAutoComplete 在进度 100 且未标记时写入", () => {
    const t = todo({ subtasks: [sub("a", 1, 100)] });
    expect(applyAutoComplete(t, "2026-09-17T12:00:00")).toBe(
      "2026-09-17T12:00:00",
    );
  });
  it("已标记完成保持原值", () => {
    const t = todo({
      completedAt: "2026-09-10T00:00:00",
      subtasks: [sub("a", 1, 100)],
    });
    expect(applyAutoComplete(t, "2026-09-17T12:00:00")).toBe(
      "2026-09-10T00:00:00",
    );
  });
  it("isLocked 仅 completedAt 存在为真", () => {
    expect(isLocked(todo({}))).toBe(false);
    expect(isLocked(todo({ completedAt: "x" }))).toBe(true);
  });
});

describe("countSubtasksDone", () => {
  it("仅 100% 计为完成", () => {
    expect(
      countSubtasksDone([sub("a", 1, 100), sub("b", 1, 75), sub("c", 1, 0)]),
    ).toBe(1);
  });
});
