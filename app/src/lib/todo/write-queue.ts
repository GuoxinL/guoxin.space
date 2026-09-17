/** 写盘合并队列：debounce + 串行 + 尾写保证。
 *
 *  **为什么需要**：Worker `/api/todo/save` 每次调用都会写一次 GitHub 数据仓
 *  （`GuoxinL/todo-data`）。卡片时代「保存」是一次显式点击；改为行内原地编辑后，
 *  提交变成高频隐式行为——不合并会让连续改几个字段就产生多次仓库写入、污染提交历史。
 *
 *  语义：
 *  - `push` 覆盖待写值并重置计时（同一窗口内多次变更只写最后一次）；
 *  - 同一时刻只跑一个 `write`，写完后若又有新值自动补写（不丢最后一次）；
 *  - `flush()` 立即写出并等待全部完成，失败向调用方冒泡（不静默吞，C-32）；
 *  - `dispose()` 只清 timer，不触发写入（供组件 cleanup 用）。 */

export interface WriteQueue<T> {
  /** 覆盖待写值并重置 debounce 计时。 */
  push(value: T): void;
  /** 立即写出并等待全部完成（含排队中的尾写）；失败时 reject。 */
  flush(): Promise<void>;
  /** 清掉未触发的 timer（不写入）。 */
  dispose(): void;
}

export function createWriteQueue<T>(
  write: (value: T) => Promise<void>,
  delayMs = 400,
  /** 写入失败时的上报回调（页面据此给用户提示）；错误同时会在下一次 flush() 冒泡 */
  onError?: (e: unknown) => void,
): WriteQueue<T> {
  let pending: { value: T } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let lastError: unknown;

  const clearTimer = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  /** 串行消费 pending：一次只跑一个 write；写完后若又有新值，继续写。 */
  const drain = async (): Promise<void> => {
    while (pending) {
      const { value } = pending;
      pending = undefined;
      await write(value);
    }
  };

  const start = (): Promise<void> => {
    if (running) return running;
    const p = drain()
      .catch((e: unknown) => {
        // 记录 + 上报：不静默吞错（C-32），调用方据此提示，flush() 也会把它冒泡出去
        lastError = e;
        if (onError) onError(e);
      })
      .finally(() => {
        running = undefined;
      });
    running = p;
    return p;
  };

  return {
    push(value) {
      pending = { value };
      clearTimer();
      timer = setTimeout(() => {
        timer = undefined;
        void start();
      }, delayMs);
    },

    async flush() {
      clearTimer();
      // start() 已把失败记录进 lastError，这里只需等待并在最后统一抛出
      if (pending || running) await start();
      if (lastError !== undefined) {
        const e = lastError;
        lastError = undefined;
        throw e;
      }
    },

    dispose() {
      clearTimer();
    },
  };
}
