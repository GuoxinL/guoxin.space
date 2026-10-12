/** save-pipeline.ts 单测：三条写盘不变量（L5 只读闸门 / 删除反推 / 失败保暂存）。
 *  mock api.saveDay 与 draft 写入，不触网、不用真实 localStorage（C-15）。 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  createSavePipeline,
  MSGT_READONLY,
  MSGT_FAILED,
  MSGT_CONFLICT,
  type SavePipelineDeps,
} from "./save-pipeline";
import { saveDay } from "./api";
import * as draftMod from "./draft";
import type { Todo } from "./types";

vi.mock("./api", () => ({
  saveDay: vi.fn(async () => {}),
  // isConflict 被 save-pipeline 的 onError 用到，必须一并 mock，
  // 否则它是undefined → 调用即抛 TypeError。
  isConflict: (e: unknown) => e instanceof SaveConflictErrorMock,
}));

/** 供上面 mock 的 isConflict 判别的错误类型（避免在 mock 工厂里引用外部 import）。 */
class SaveConflictErrorMock extends Error {
  readonly headSha: string | null;
  constructor(msg: string, headSha: string | null) {
    super(msg);
    this.name = "SaveConflictError";
    this.headSha = headSha;
  }
}

vi.mock("./draft", async () => {
  const actual =
    await vi.importActual<typeof import("./draft")>("./draft");
  return {
    ...actual,
    clearDraft: vi.fn(),
    makeBase: vi.fn((t: Todo[]) => ({ [t[0]?.id ?? ""]: "base" })),
  };
});

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

function makeDeps(over: Partial<SavePipelineDeps> = {}) {
  const known = over.knownDays ? over.knownDays() : new Set<string>();
  const setStatus = vi.fn();
  const setKnownDays = vi.fn();
  const setBase = vi.fn();
  const deps: SavePipelineDeps = {
    readOnly: () => false,
    knownDays: () => known,
    setKnownDays,
    setBase,
    setStatus,
    headSha: () => null,
    ...over,
  };
  return { deps, setStatus, setKnownDays, setBase };
}

describe("lib/todo/save-pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("正常路径：按天写入并收敛 knownDays", async () => {
    const { deps, setKnownDays, setBase } = makeDeps({
      knownDays: () => new Set(["2026-09-20"]),
    });
    const q = createSavePipeline(deps);
    q.push([todo("a", "2026-09-20T01:00:00.000Z")]);
    await q.flush();

    expect(saveDay).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveDay).mock.calls[0][0]).toBe("2026-09-20");
    expect(setKnownDays).toHaveBeenCalled();
    expect(setBase).toHaveBeenCalled();
  });

  it("写盘成功后清空暂存（L1 收敛）", async () => {
    const { deps } = makeDeps();
    const q = createSavePipeline(deps);
    q.push([todo("a", "2026-09-20T01:00:00.000Z")]);
    await q.flush();
    expect(draftMod.clearDraft).toHaveBeenCalledTimes(1);
  });

  it("L5 闸门：只读模式下一律不发写盘请求", async () => {
    const { deps, setStatus } = makeDeps({ readOnly: () => true });
    const q = createSavePipeline(deps);
    q.push([todo("a", "2026-09-20T01:00:00.000Z")]);
    await q.flush();

    expect(saveDay).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(MSGT_READONLY, "err");
  });

  it("只读模式下也不清暂存（编辑继续安全留存）", async () => {
    const { deps } = makeDeps({ readOnly: () => true });
    const q = createSavePipeline(deps);
    q.push([todo("a", "2026-09-20T01:00:00.000Z")]);
    await q.flush();
    expect(draftMod.clearDraft).not.toHaveBeenCalled();
  });

  it("knownDays 为空（读取不完整）时不会写任何空数组 —— 不误删", async () => {
    const { deps } = makeDeps({ knownDays: () => new Set<string>() });
    const q = createSavePipeline(deps);
    q.push([todo("a", "2026-09-20T01:00:00.000Z")]);
    await q.flush();

    const emptyWrites = vi
      .mocked(saveDay)
      .mock.calls.filter((c) => Array.isArray(c[1]) && (c[1] as Todo[]).length === 0);
    expect(emptyWrites).toHaveLength(0);
  });

  it("knownDays 含已被删空的日期时写空数组（用户确实删光）", async () => {
    const { deps } = makeDeps({ knownDays: () => new Set(["2026-09-21"]) });
    const q = createSavePipeline(deps);
    q.push([todo("a", "2026-09-20T01:00:00.000Z")]);
    await q.flush();

    const emptyWrites = vi
      .mocked(saveDay)
      .mock.calls.filter((c) => Array.isArray(c[1]) && (c[1] as Todo[]).length === 0);
    expect(emptyWrites).toHaveLength(1);
    expect(emptyWrites[0][0]).toBe("2026-09-21");
  });

  it("写盘失败：向flush 冒泡，且**不清暂存**（刷新不丢编辑）", async () => {
    vi.mocked(saveDay).mockRejectedValueOnce(new Error("boom"));
    const { deps, setStatus } = makeDeps();
    const q = createSavePipeline(deps);
    q.push([todo("a", "2026-09-20T01:00:00.000Z")]);

    await expect(q.flush()).rejects.toThrow("boom");
    expect(draftMod.clearDraft).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(
      expect.stringContaining(MSGT_FAILED),
      "err",
    );
    expect(setStatus).toHaveBeenCalledWith(
      expect.stringContaining("已暂存本地"),
      "err",
    );
  });

  it("debounce 触发的失败也上报状态且不清暂存", async () => {
    vi.mocked(saveDay).mockRejectedValueOnce(new Error("net down"));
    const { deps, setStatus } = makeDeps();
    const q = createSavePipeline(deps);
    q.push([todo("a", "2026-09-20T01:00:00.000Z")]);
    await vi.advanceTimersByTimeAsync(400);

    expect(setStatus).toHaveBeenCalled();
    expect(draftMod.clearDraft).not.toHaveBeenCalled();
    await expect(q.flush()).rejects.toThrow("net down");
  });

  // ---------- L2 CAS ----------
  it("L2：写盘时携带读取时的 head_sha", async () => {
    const { deps } = makeDeps({ headSha: () => "abc123" });
    const q = createSavePipeline(deps);
    q.push([todo("a", "2026-09-20T01:00:00.000Z")]);
    await q.flush();
    // 第 4 个参数为 headSha
    expect(vi.mocked(saveDay).mock.calls[0][3]).toBe("abc123");
  });

  it("L2：headSha 为 null 时不传该字段（兼容旧 Worker，跳过校验）", async () => {
    const { deps } = makeDeps({ headSha: () => null });
    const q = createSavePipeline(deps);
    q.push([todo("a", "2026-09-20T01:00:00.000Z")]);
    await q.flush();
    expect(vi.mocked(saveDay).mock.calls[0][3]).toBeNull();
  });

  it("L2：409 冲突 → 提示「刷新读取最新」且不清暂存（编辑不丢）", async () => {
    vi.mocked(saveDay).mockRejectedValueOnce(
      new SaveConflictErrorMock("stale", "newsha"),
    );
    const { deps, setStatus } = makeDeps();
    const q = createSavePipeline(deps);
    q.push([todo("a", "2026-09-20T01:00:00.000Z")]);

    await expect(q.flush()).rejects.toThrow("stale");
    expect(setStatus).toHaveBeenCalledWith(MSGT_CONFLICT, "err");
    expect(draftMod.clearDraft).not.toHaveBeenCalled();
  });

  it("L2：冲突提示文案与普通失败文案可区分", () => {
    expect(MSGT_CONFLICT).toContain("刷新");
    expect(MSGT_FAILED).toContain("失败");
    expect(MSGT_CONFLICT).not.toBe(MSGT_FAILED);
    expect(new SaveConflictErrorMock("x", "y")).toBeInstanceOf(Error);
  });

  it("多天并发写入：每天一个请求", async () => {
    const { deps } = makeDeps();
    const q = createSavePipeline(deps);
    q.push([
      todo("a", "2026-09-20T01:00:00.000Z"),
      todo("b", "2026-09-21T01:00:00.000Z"),
    ]);
    await q.flush();
    expect(saveDay).toHaveBeenCalledTimes(2);
  });
});
