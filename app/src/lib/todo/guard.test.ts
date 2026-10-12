/** guard.ts 单测：动作前重载的判定逻辑（纯函数，无副作用）。 */
import { describe, it, expect } from "vitest";

import { decideGuard, isDirty } from "./guard";

describe("lib/todo/guard", () => {
  describe("decideGuard", () => {
    it("无未同步改动 → 静默重载后再执行", () => {
      expect(decideGuard(false, false)).toBe("reload-then-run");
    });

    it("有未同步改动 → 直接执行（交 CAS 把关）", () => {
      expect(decideGuard(false, true)).toBe("run-directly");
    });

    it("只读模式下两者都 blocked（既不重载也不写盘）", () => {
      expect(decideGuard(true, false)).toBe("blocked-readonly");
      expect(decideGuard(true, true)).toBe("blocked-readonly");
    });

    it("只读优先于 dirty 判定", () => {
      // 顺序不能反：若先判 dirty 会返回 run-directly，导致只读失效
      expect(decideGuard(true, true)).not.toBe("run-directly");
    });
  });

  describe("isDirty", () => {
    it("暂存存在即为 dirty", () => {
      expect(isDirty(true)).toBe(true);
    });

    it("暂存不存在即为干净（写盘成功 clearDraft 后）", () => {
      expect(isDirty(false)).toBe(false);
    });
  });

  describe("三动作共用同一判据（增/改/删）", () => {
    // 这条用例守护 D5 的修正：不引入按动作类型的分支
    const actions = ["create", "edit", "delete"] as const;
    it.each(actions)("%s 动作在相同状态下判定相同", (action) => {
      expect(decideGuard(false, false)).toBe("reload-then-run");
      expect(decideGuard(false, true)).toBe("run-directly");
      expect(decideGuard(true, false)).toBe("blocked-readonly");
      // action 本身不参与判定 —— 这正是「零动作分支」的体现
      expect(typeof action).toBe("string");
    });
  });
});
