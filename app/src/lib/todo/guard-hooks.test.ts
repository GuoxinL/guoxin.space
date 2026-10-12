/** guard-hooks.ts 单测：守卫控制流（注入 reload / 状态，mock readDraft）。 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { makeGuardAction } from "./guard-hooks";
import * as draftMod from "./draft";

vi.mock("./draft", async () => {
  const actual = await vi.importActual<typeof import("./draft")>("./draft");
  return { ...actual, readDraft: vi.fn(() => null) };
});

function deps(readOnly: boolean) {
  const reload = vi.fn(async () => {});
  const setStatus = vi.fn();
  return {
    d: {
      readOnly: { value: readOnly } as never,
      reload,
      setStatus,
    },
    reload,
    setStatus,
  };
}

describe("lib/todo/guard-hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(draftMod.readDraft).mockReturnValue(null);
  });

  it("干净状态 → 先 reload 再执行动作", async () => {
    const { d, reload } = deps(false);
    const order: string[] = [];
    reload.mockImplementation(async () => {
      order.push("reload");
    });
    await makeGuardAction(d)(() => order.push("run"), "新建");

    expect(order).toEqual(["reload", "run"]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("有未同步改动 → 不 reload 直接执行", async () => {
    vi.mocked(draftMod.readDraft).mockReturnValue({
      todos: [],
      savedAt: "x",
      base: {},
    });
    const { d, reload } = deps(false);
    const run = vi.fn();
    await makeGuardAction(d)(run, "编辑");

    expect(reload).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("只读模式 → 不 reload，提示后仍放行动作（编辑不丢）", async () => {
    const { d, reload, setStatus } = deps(true);
    const run = vi.fn();
    await makeGuardAction(d)(run, "删除");

    expect(reload).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("读取不完整"), "err");
    expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("删除"), "err");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("reload 抛错时动作仍被执行（不让刷新失败吞掉用户操作）", async () => {
    const { d, reload } = deps(false);
    reload.mockRejectedValue(new Error("net down"));
    const run = vi.fn();
    await makeGuardAction(d)(run, "新建");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("三种动作共用同一判据：状态相同时行为一致", async () => {
    for (const label of ["新建 TODO", "编辑 TODO", "删除 TODO"]) {
      vi.clearAllMocks();
      vi.mocked(draftMod.readDraft).mockReturnValue(null);
      const { d, reload } = deps(false);
      await makeGuardAction(d)(() => {}, label);
      expect(reload).toHaveBeenCalledTimes(1);
    }
  });
});
