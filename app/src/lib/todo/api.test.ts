/** api.ts 单测：mock Worker fetch + authWorkerUrl/getAuthToken，覆盖 plan §6 #1~#6。 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchAll,
  fetchMonth,
  fetchTags,
  saveDay,
  saveTags,
  isTodoAuthed,
  isConflict,
  SaveConflictError,
} from "./api";
import type { Todo } from "./types";
import { authWorkerUrl, isAdmin } from "../auth";

vi.mock("../auth", () => ({
  authWorkerUrl: vi.fn(() => "https://worker.example/"),
  getAuthToken: vi.fn(() => "tok"),
  isAdmin: vi.fn(() => true),
}));

function mockFetch(body: unknown, status = 200): void {
  const res = {
    status,
    ok: status < 400,
    json: async () => body,
  };
  vi.mocked(globalThis.fetch).mockResolvedValueOnce(res as unknown as Response);
}

const sampleTodo: Todo = {
  id: "todo-1",
  title: "T",
  tags: [],
  startDate: "2026-09-17",
  endDate: null,
  createdAt: "2026-09-17T00:00:00.000Z",
  updatedAt: "2026-09-17T00:00:00.000Z",
  lastOperatedAt: "2026-09-17T00:00:00.000Z",
  completedAt: null,
  subtasks: [],
};

describe("lib/todo/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fetchMonth 解析月索引（plan §6 #8）", async () => {
    mockFetch({
      ok: true,
      index: [
        {
          id: "a",
          title: "A",
          tags: [],
          startDate: "2026-09-17",
          endDate: null,
          progress: 40,
          completedAt: null,
        },
      ],
    });
    const idx = await fetchMonth(2026, 9);
    expect(idx).toHaveLength(1);
    expect(idx[0].progress).toBe(40);
    const url = String(vi.mocked(globalThis.fetch).mock.calls[0][0]);
    expect(url).toContain("/api/todo/month");
    expect(url).toContain("y=2026");
    expect(url).toContain("m=9");
  });

  it("saveDay 遇 401 抛未登录错误（plan §6 #9）", async () => {
    mockFetch({ error: "unauthorized" }, 401);
    await expect(saveDay("2026-09-17", [sampleTodo])).rejects.toThrow(/未登录/);
  });

  it("saveDay 连续两次相同日文件均成功（plan §6 #10 幂等）", async () => {
    mockFetch({ ok: true });
    await saveDay("2026-09-17", [sampleTodo]);
    mockFetch({ ok: true });
    await saveDay("2026-09-17", [sampleTodo]);
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(2);
    for (const call of vi.mocked(globalThis.fetch).mock.calls) {
      expect((call[1] as RequestInit).method).toBe("POST");
    }
  });

  it("fetchAll / fetchTags 解析", async () => {
    mockFetch({ ok: true, todos: [sampleTodo] });
    mockFetch({ ok: true, tags: [{ id: "t", name: "N" }] });
    expect((await fetchAll()).todos[0].id).toBe("todo-1");
    expect((await fetchTags())[0].name).toBe("N");
  });

  describe("L2 CAS：head_sha 传递与 409 冲突", () => {
    it("fetchAll 返回 Worker 给出的 head_sha", async () => {
      mockFetch({ ok: true, todos: [], head_sha: "headsha1" });
      expect((await fetchAll()).headSha).toBe("headsha1");
    });

    it("Worker 未给 head_sha 时为 null（兼容旧 Worker）", async () => {
      mockFetch({ ok: true, todos: [] });
      expect((await fetchAll()).headSha).toBeNull();
    });

    it("saveDay 携带 head_sha", async () => {
      mockFetch({ ok: true });
      await saveDay("2026-09-17", [sampleTodo], undefined, "headsha1");
      const body = JSON.parse(
        String((vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit).body),
      );
      expect(body.head_sha).toBe("headsha1");
    });

    it("saveDay 不传 headSha 时请求体无该字段（跳过校验）", async () => {
      mockFetch({ ok: true });
      await saveDay("2026-09-17", [sampleTodo]);
      const body = JSON.parse(
        String((vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit).body),
      );
      expect(body).not.toHaveProperty("head_sha");
    });

    it("409 抛 SaveConflictError（可与普通错误区分）", async () => {
      mockFetch({ error: "stale", head_sha: "newsha" }, 409);
      await expect(
        saveDay("2026-09-17", [sampleTodo], undefined, "oldsha"),
      ).rejects.toBeInstanceOf(SaveConflictError);
    });

    it("SaveConflictError 携带服务端返回的新 head_sha", async () => {
      mockFetch({ error: "stale", head_sha: "newsha" }, 409);
      try {
        await saveDay("2026-09-17", [sampleTodo], undefined, "oldsha");
        throw new Error("本应抛出");
      } catch (e) {
        expect(e).toBeInstanceOf(SaveConflictError);
        expect((e as SaveConflictError).headSha).toBe("newsha");
        expect((e as SaveConflictError).message).toBe("stale");
      }
    });

    it("409 响应体非 JSON 时仍抛冲突错误（不崩）", async () => {
      const res = {
        status: 409,
        ok: false,
        json: async () => {
          throw new Error("not json");
        },
      };
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(res as unknown as Response);
      await expect(saveDay("2026-09-17", [sampleTodo], undefined, "x")).rejects.toBeInstanceOf(
        SaveConflictError,
      );
    });

    it("isConflict 对普通 Error 返回 false", () => {
      expect(isConflict(new Error("boom"))).toBe(false);
      expect(isConflict(new SaveConflictError("x", null))).toBe(true);
    });
  });

  describe("fetchAll 读取完整性闸门（L5）", () => {
    it("Worker 未返回 partial/missing 时按完整数据处理（向后兼容旧 Worker）", async () => {
      mockFetch({ ok: true, todos: [sampleTodo] });
      const r = await fetchAll();
      expect(r.partial).toBe(false);
      expect(r.missing).toEqual([]);
      expect(r.todos).toHaveLength(1);
    });

    it("partial=true 时透传 missing 名单（残缺快照不可用于写盘）", async () => {
      mockFetch({
        ok: true,
        todos: [sampleTodo],
        partial: true,
        missing: ["2026-09-19.json", "2026-09-17.json"],
      });
      const r = await fetchAll();
      expect(r.partial).toBe(true);
      expect(r.missing).toEqual(["2026-09-19.json", "2026-09-17.json"]);
      // 残缺快照仍返回已读到的部分，但 partial 为真，调用方据此禁止写盘
      expect(r.todos).toHaveLength(1);
    });

    it("todos 缺失时降级为空数组且不抛错", async () => {
      mockFetch({ ok: true, partial: false });
      const r = await fetchAll();
      expect(r.todos).toEqual([]);
      expect(r.partial).toBe(false);
    });

    it("partial 非布尔值时按 true 处理（防御性归一）", async () => {
      mockFetch({ ok: true, todos: [], partial: "yes" as unknown as boolean });
      expect((await fetchAll()).partial).toBe(true);
    });
  });

  it("saveTags POST 携带标签", async () => {
    mockFetch({ ok: true });
    await saveTags([{ id: "t", name: "N" }]);
    const init = vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body.tags[0].name).toBe("N");
  });

  it("isTodoAuthed：未登录时为假（plan §6 #2 逆向）", () => {
    vi.mocked(isAdmin).mockReturnValueOnce(false);
    expect(isTodoAuthed()).toBe(false);
  });

  it("isTodoAuthed：Worker 地址为空时为假（plan §6 #2 边界）", () => {
    vi.mocked(authWorkerUrl).mockReturnValueOnce("");
    expect(isTodoAuthed()).toBe(false);
  });

  it("isTodoAuthed 在 admin + Worker 已配时为真（plan §6 #1 正向）", () => {
    expect(isTodoAuthed()).toBe(true);
  });
});
