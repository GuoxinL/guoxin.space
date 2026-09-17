import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWriteQueue } from "./write-queue";

/** 采集真实时间推进；write 为注入的 fake，本文件不触网（C-15）。 */
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createWriteQueue", () => {
  it("单次 push：到点写出一次", async () => {
    const write = vi.fn(async () => {});
    const q = createWriteQueue<string>(write, 400);

    q.push("a");
    expect(write).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(400);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("a");
  });

  it("连续 push 合并为一次写出，且写最后一次的值", async () => {
    const write = vi.fn(async () => {});
    const q = createWriteQueue<string>(write, 400);

    q.push("a");
    await vi.advanceTimersByTimeAsync(100);
    q.push("b");
    await vi.advanceTimersByTimeAsync(100);
    q.push("c");
    await vi.advanceTimersByTimeAsync(400);

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("c");
  });

  it("间隔超过 debounce 的两次 push 各写一次", async () => {
    const write = vi.fn(async () => {});
    const q = createWriteQueue<string>(write, 400);

    q.push("a");
    await vi.advanceTimersByTimeAsync(400);
    q.push("b");
    await vi.advanceTimersByTimeAsync(400);

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, "a");
    expect(write).toHaveBeenNthCalledWith(2, "b");
  });

  it("串行：上一次未写完时不并发，写完后自动补写排队值（尾写保证）", async () => {
    const resolvers: Array<() => void> = [];
    const write = vi.fn(
      () => new Promise<void>((resolve) => resolvers.push(resolve)),
    );
    const q = createWriteQueue<string>(write, 400);

    q.push("a");
    await vi.advanceTimersByTimeAsync(400);
    expect(write).toHaveBeenCalledTimes(1);

    // 第一次写尚未完成时 push 新值：不得并发调用 write
    q.push("b");
    await vi.advanceTimersByTimeAsync(400);
    expect(write).toHaveBeenCalledTimes(1);

    // 放行第一次写 → 队列自动把 b 写出去
    resolvers[0]();
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith("b");

    resolvers[1]();
    await vi.advanceTimersByTimeAsync(1);
  });

  it("flush 不等 debounce，立即写出并等待完成", async () => {
    let done = false;
    const write = vi.fn(async () => {
      done = true;
    });
    const q = createWriteQueue<string>(write, 400);

    q.push("a");
    await q.flush();

    expect(done).toBe(true);
    expect(write).toHaveBeenCalledWith("a");
  });

  it("flush 时无待写值：不调用 write 且正常 resolve", async () => {
    const write = vi.fn(async () => {});
    const q = createWriteQueue<string>(write, 400);

    await expect(q.flush()).resolves.toBeUndefined();
    expect(write).not.toHaveBeenCalled();
  });

  it("写入失败向 flush 冒泡，且队列不被卡死", async () => {
    let fail = true;
    const write = vi.fn(async () => {
      if (fail) throw new Error("boom");
    });
    const q = createWriteQueue<string>(write, 400);

    q.push("a");
    await expect(q.flush()).rejects.toThrow("boom");

    fail = false;
    q.push("b");
    await expect(q.flush()).resolves.toBeUndefined();
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("debounce 触发的写入失败不静默吞掉，下次 flush 时冒泡", async () => {
    const write = vi.fn(async () => {
      throw new Error("boom");
    });
    const q = createWriteQueue<string>(write, 400);

    q.push("a");
    await vi.advanceTimersByTimeAsync(400); // 失败被记录，不产生 unhandled rejection
    expect(write).toHaveBeenCalledTimes(1);

    await expect(q.flush()).rejects.toThrow("boom");
  });

  it("dispose 清掉待触发的 timer，不再写出", async () => {
    const write = vi.fn(async () => {});
    const q = createWriteQueue<string>(write, 400);

    q.push("a");
    q.dispose();
    await vi.advanceTimersByTimeAsync(400);

    expect(write).not.toHaveBeenCalled();
  });

  it("写入失败时上报 onError（debounce 路径也上报，便于页面提示）", async () => {
    const onError = vi.fn();
    const write = vi.fn(async () => {
      throw new Error("boom");
    });
    const q = createWriteQueue<string>(write, 400, onError);

    q.push("a");
    await vi.advanceTimersByTimeAsync(400);

    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe("boom");
  });
});
