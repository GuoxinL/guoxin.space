import {
  component$,
  useComputed$,
  useSignal,
  useStore,
  $,
  type QRL,
} from "@builder.io/qwik";

import type { Tag, Todo } from "../../lib/todo/types";
import { buildWeeklyReport, weekRangeOf } from "../../lib/todo/weekly";
import { copyText, downloadFile } from "../../lib/clipboard";

export interface WeeklyReportModalProps {
  todos: Todo[];
  tags: Tag[];
  onClose$: QRL<() => void>;
}

type Fmt = "markdown" | "text" | "html";

export const WeeklyReportModal = component$<WeeklyReportModalProps>(
  ({ todos, tags, onClose$ }) => {
    const [defStart, defEnd] = weekRangeOf(new Date());
    const sel = useStore<{
      tagId: string;
      start: string;
      end: string;
      fmt: Fmt;
    }>({
      tagId: "",
      start: defStart,
      end: defEnd,
      fmt: "markdown",
    });
    const copied = useSignal(false);

    const scoped = useComputed$(() =>
      sel.tagId ? todos.filter((t) => t.tags.includes(sel.tagId)) : todos,
    );

    const report = useComputed$(() => {
      const tagName = tags.find((t) => t.id === sel.tagId)?.name;
      return buildWeeklyReport({
        tagName,
        rangeStart: sel.start,
        rangeEnd: sel.end,
        todos: scoped.value,
      });
    });

    const copy = $(async () => {
      const ok = await copyText(report.value[sel.fmt]);
      copied.value = ok;
      if (ok) setTimeout(() => (copied.value = false), 1500);
    });

    const download = $(() => {
      const fmt = sel.fmt;
      const ext = fmt === "markdown" ? "md" : fmt === "html" ? "html" : "txt";
      const mime =
        fmt === "markdown"
          ? "text/markdown"
          : fmt === "html"
            ? "text/html"
            : "text/plain";
      const name = `周报_${sel.start}_${sel.end}.${ext}`;
      downloadFile(name, report.value[fmt], mime);
    });

    return (
      <div class="td-modal-mask" onClick$={onClose$}>
        <div class="td-modal td-weekly" onClick$={(e) => e.stopPropagation()}>
          <div class="td-modal-head">
            <h2>周报导出</h2>
            <button class="btn ghost" onClick$={onClose$}>
              关闭
            </button>
          </div>

          <div class="td-weekly-controls">
            <label class="td-field">
              <span>标签</span>
              <select
                value={sel.tagId}
                onChange$={(e) =>
                  (sel.tagId = (e.target as HTMLSelectElement).value)
                }
              >
                <option value="">全部</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label class="td-field">
              <span>开始</span>
              <input
                type="date"
                value={sel.start}
                onInput$={(e) =>
                  (sel.start = (e.target as HTMLInputElement).value)
                }
              />
            </label>
            <label class="td-field">
              <span>结束</span>
              <input
                type="date"
                value={sel.end}
                onInput$={(e) =>
                  (sel.end = (e.target as HTMLInputElement).value)
                }
              />
            </label>
            <div class="td-chips">
              {(["markdown", "text", "html"] as Fmt[]).map((f) => (
                <button
                  key={f}
                  class={"td-chip" + (sel.fmt === f ? " on" : "")}
                  onClick$={() => (sel.fmt = f)}
                >
                  {f === "markdown"
                    ? "Markdown"
                    : f === "text"
                      ? "纯文本"
                      : "HTML"}
                </button>
              ))}
            </div>
          </div>

          <pre class="td-weekly-out">{report.value[sel.fmt]}</pre>

          <div class="td-modal-foot">
            <span class="td-hint">{scoped.value.length} 个 TODO 命中范围</span>
            <div style="display:flex;gap:8px">
              <button class="btn" onClick$={download}>
                下载
              </button>
              <button class="btn" onClick$={copy}>
                {copied.value ? "已复制" : "复制到剪贴板"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
