/** api.ts 单测：mock Worker fetch + authWorkerUrl/getAuthToken，覆盖 plan §6 #1~#6。 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchAll,
  fetchMonth,
  fetchTags,
  saveDay,
  saveTags,
  isTodoAuthed,
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
    expect((await fetchAll())[0].id).toBe("todo-1");
    expect((await fetchTags())[0].name).toBe("N");
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
