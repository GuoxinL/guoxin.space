/** draft.ts 单测：暂存区读写 / 损坏容错 / 差异分类（纯逻辑，不触网、不依赖真实 localStorage）。 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  makeBase,
  readDraft,
  writeDraft,
  clearDraft,
  hasDraft,
  diffDraft,
  isDiffEmpty,
  describeDiff,
  type DraftData,
} from "./draft";
import type { Todo } from "./types";

/** 内存版localStorage 打桩：storage.ts 判的是裸 `localStorage`，故须 stub 全局。
 *  沿用 notes/reading.test.ts 的既有做法（C-15：不依赖真实浏览器环境）。 */
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  clear(): void {
    this.m.clear();
  }
  key(i: number): string | null {
    return Array.from(this.m.keys())[i] ?? null;
  }
  get length(): number {
    return this.m.size;
  }
}

const store = new MemStorage();

function todo(id: string, updatedAt: string, title = "T"): Todo {
  return {
    id,
    title,
    tags: [],
    startDate: "2026-09-20",
    endDate: null,
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt,
    lastOperatedAt: updatedAt,
    completedAt: null,
    subtasks: [],
  };
}

describe("lib/todo/draft", () => {
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", store);
    vi.stubGlobal("window", { localStorage: store } as unknown as Window);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("无暂存时 readDraft 返回 null，hasDraft 为假", () => {
    expect(readDraft()).toBeNull();
    expect(hasDraft()).toBe(false);
  });

  it("写入后可读回，字段完整", () => {
    const todos = [todo("t1", "2026-09-20T01:00:00.000Z")];
    writeDraft(todos);
    const d = readDraft();
    expect(d).not.toBeNull();
    expect(d!.todos).toHaveLength(1);
    expect(d!.todos[0].id).toBe("t1");
    expect(d!.savedAt).toBeTruthy();
  });

  it("makeBase 生成 id -> updatedAt 摘要", () => {
    const base = makeBase([
      todo("t1", "A"),
      todo("t2", "B"),
      { ...todo("t3", "C"), id: "" } as Todo,
    ]);
    expect(base).toEqual({ t1: "A", t2: "B" });
  });

  it("clearDraft 清空后 readDraft 为 null", () => {
    writeDraft([todo("t1", "A")]);
    expect(hasDraft()).toBe(true);
    clearDraft();
    expect(readDraft()).toBeNull();
  });

  it("损坏的 JSON 不抛错，按无暂存处理", () => {
    localStorage.setItem("todo:draft", "{not json");
    expect(readDraft()).toBeNull();
  });

  it("结构不对的数据（todos 非数组）按无暂存处理", () => {
    localStorage.setItem("todo:draft", JSON.stringify({ todos: "oops" }));
    expect(readDraft()).toBeNull();
  });

  it("缺失 savedAt / base 时补默认值，不抛错", () => {
    localStorage.setItem(
      "todo:draft",
      JSON.stringify({ todos: [todo("t1", "A")] }),
    );
    const d = readDraft();
    expect(d).not.toBeNull();
    expect(d!.base).toEqual({});
  });

  describe("diffDraft 差异分类", () => {
    const remote = [
      todo("t1", "v1"),
      todo("t2", "v2"),
      todo("t3", "v3"),
    ];
    // 暂存：t1 与 t3 均以基准 v1/v3 为准、t2 被本地改过；另含一条远端没有的 t9
    const draft: DraftData = {
      todos: [
        todo("t1", "v1"),
        todo("t2", "v2-local"),
        todo("t3", "v3"),
        todo("t9", "v9"),
      ],
      savedAt: "2026-09-20T00:00:00.000Z",
      base: { t1: "v1", t2: "v2", t3: "v3", t9: "v9" },
    };

    it("无暂存时差异为空", () => {
      const d = diffDraft(null, remote);
      expect(isDiffEmpty(d)).toBe(true);
    });

    it("仅本地有的条目进 localOnly", () => {
      const d = diffDraft(draft, remote);
      expect(d.localOnly).toContain("t9");
    });

    it("仅远端有的条目进 remoteOnly（暂存缺 t1、t3）", () => {
      const localOnlyInDraft: DraftData = {
        ...draft,
        todos: [todo("t2", "v2-local")],
        base: { t2: "v2" },
      };
      const d = diffDraft(localOnlyInDraft, remote);
      expect(d.remoteOnly.sort()).toEqual(["t1", "t3"]);
      expect(d.localOnly).toEqual([]);
    });

    it("本地相对基准改动 → 进changed", () => {
      const d = diffDraft(draft, remote);
      expect(d.changed).toContain("t2");
    });

    it("远端相对基准改动 → 也进 changed（即使本地没动）", () => {
      const remoteChanged = [
        todo("t1", "v1-server"),
        todo("t2", "v2"),
        todo("t3", "v3"),
      ];
      const d = diffDraft(draft, remoteChanged);
      expect(d.changed).toContain("t1");
    });

    it("双方完全一致时差异为空", () => {
      const same: DraftData = {
        todos: remote.map((t) => ({ ...t })),
        savedAt: "x",
        base: makeBase(remote),
      };
      const d = diffDraft(same, remote);
      expect(isDiffEmpty(d)).toBe(true);
    });

    it("两边改同一字段 → 计入 changed（不做自动合并，交用户决定）", () => {
      const bothChanged: DraftData = {
        todos: [todo("t1", "v1-local"), todo("t2", "v2"), todo("t3", "v3")],
        savedAt: "x",
        base: { t1: "v1", t2: "v2", t3: "v3" },
      };
      const remoteBoth = [
        todo("t1", "v1-server"),
        todo("t2", "v2"),
        todo("t3", "v3"),
      ];
      const d = diffDraft(bothChanged, remoteBoth);
      expect(d.changed).toEqual(["t1"]);
    });
  });

  describe("describeDiff", () => {
    it("空差异返回空串", () => {
      expect(describeDiff({ localOnly: [], remoteOnly: [], changed: [] })).toBe("");
    });

    it("按类别拼接计数", () => {
      const s = describeDiff({
        localOnly: ["a"],
        remoteOnly: ["b", "c"],
        changed: ["d"],
      });
      expect(s).toBe("本地 1 条、远端 2 条、内容不同 1 条");
    });
  });

  it("writeDraft 接受显式 base，不自行推导", () => {
    writeDraft([todo("t1", "now")], { t1: "original" });
    expect(readDraft()!.base).toEqual({ t1: "original" });
  });

  it("写入空数组是合法操作（清空暂存语义）", () => {
    writeDraft([]);
    const d = readDraft();
    expect(d!.todos).toEqual([]);
  });
});
