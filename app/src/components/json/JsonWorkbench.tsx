import {
  $,
  component$,
  useComputed$,
  useSignal,
  useVisibleTask$,
  type JSXOutput,
} from "@builder.io/qwik";

import { copyText, downloadFile } from "../../lib/clipboard";
import { fmtTime, nowStr } from "../../lib/format";
import {
  convertLang,
  clearHistory,
  decodeShare,
  deleteHistory,
  diffLines,
  diffStats,
  diffStructure,
  draftKey,
  encodeShare,
  escapeText,
  formatText,
  inferSchema,
  jpMergeRanges,
  loadHistory,
  minifyText,
  parseByLang,
  pushHistory,
  jpComposePath,
  jpStripPrefixNoise,
  queryJsonPath,
  repairJson,
  unescapeText,
} from "../../lib/json";
import { SAMPLE_L, SAMPLE_R } from "../../lib/json/sample";
import { readStore, writeStore } from "../../lib/storage";
import {
  LANGS,
  type DataValue,
  type HistoryItem,
  type Indent,
  type Lang,
  type ParseError,
  type Range,
  type ShareState,
  type Side,
} from "../../types/json";
import { DiffPane } from "./DiffPane";
import { JsonTree } from "./JsonTree";
import { StructDiffView } from "./StructDiffView";

/** 草稿写入防抖，避免每敲一个字符就写 localStorage */
const saveTimers: Partial<Record<Side, ReturnType<typeof setTimeout>>> = {};

/** 草稿写入防抖，避免每敲一个字符就写 localStorage */
function scheduleSave(side: Side, text: string): void {
  clearTimeout(saveTimers[side]);
  saveTimers[side] = setTimeout(() => writeStore(draftKey(side), text), 500);
}

/**
 * 错误波浪线路径。坐标沿用既有度量：14px 等宽字体（字符宽 8.4）、行高 24、左内边距 12。
 * 注释：与 textarea 同度量叠加，y 需减去 scrollTop 才能跟随滚动。
 */
function squigglePath(raw: string, err: ParseError, scrollTop: number): string {
  const line = Math.max(err.line, 1);
  const col = Math.max(err.col, 1);
  const lineText = raw.split("\n")[line - 1] || "";
  const upTo = lineText.slice(0, col - 1);
  const charW = 8.4;
  let x = 12;
  for (let i = 0; i < upTo.length; i++)
    x += (upTo.charAt(i) === "\t" ? 2 : 1) * charW;
  const y = 12 + (line - 1) * 24 + 20 - scrollTop;
  let d = `M${x.toFixed(1)} ${y}`;
  for (let c = 0; c < 5; c++) d += " q4 -3.5 8 0 t8 0";
  return d;
}

const sideName = (s: Side): string => (s === "R" ? "右侧" : "左侧");

export const JsonWorkbench = component$(() => {
  const textL = useSignal(SAMPLE_L);
  const textR = useSignal(SAMPLE_R);
  const langL = useSignal<Lang>("json");
  const langR = useSignal<Lang>("json");
  const treeL = useSignal(false);
  const treeR = useSignal(false);
  const diffOn = useSignal(false);
  const structOn = useSignal(false);
  const indent = useSignal<Indent>(2);
  const lastSide = useSignal<Side>("L");
  const toast = useSignal<{ msg: string; kind: "ok" | "err" }>({
    msg: "就绪",
    kind: "ok",
  });
  const histOpen = useSignal(false);
  const hist = useSignal<HistoryItem[]>([]);
  const jpL = useSignal("");
  const jpR = useSignal("");
  const hlL = useSignal<Range[]>([]);
  const hlR = useSignal<Range[]>([]);
  const jpPathsL = useSignal<string[]>([]);
  const jpPathsR = useSignal<string[]>([]);
  const jpValsL = useSignal<DataValue[]>([]);
  const jpValsR = useSignal<DataValue[]>([]);
  const treeFilterL = useSignal("");
  const treeFilterR = useSignal("");
  const scL = useSignal(0);
  const scR = useSignal(0);
  const gutL = useSignal<HTMLElement>();
  const gutR = useSignal<HTMLElement>();
  const fileRef = useSignal<HTMLInputElement>();

  const valL = useComputed$(() => parseByLang(textL.value, langL.value));
  const valR = useComputed$(() => parseByLang(textR.value, langR.value));
  const diffRes = useComputed$(() =>
    diffOn.value && !structOn.value
      ? diffLines(textL.value, textR.value)
      : null,
  );
  const structRes = useComputed$(() => {
    if (!structOn.value) return null;
    const a = valL.value;
    const b = valR.value;
    if (!a.ok || !b.ok) return null;
    return diffStructure(a.val, b.val);
  });

  // 客户端恢复草稿与历史：SSR 阶段输出示例数据，避免首屏空白
  useVisibleTask$(() => {
    const dl = readStore(draftKey("L"));
    const dr = readStore(draftKey("R"));
    if (dl && dl.trim()) textL.value = dl;
    if (dr && dr.trim()) textR.value = dr;
    hist.value = loadHistory();

    // 分享链接：若 URL 带 #s=... 则优先用分享内容覆盖草稿
    const shared = decodeShare(location.hash);
    if (shared) {
      textL.value = shared.l.t;
      langL.value = shared.l.lang;
      textR.value = shared.r.t;
      langR.value = shared.r.lang;
    }
  });

  /* ---------------- 操作 ---------------- */

  // commit 必须声明为 QRL：它被多个 $(...) 事件处理器引用，
  // 若用普通函数则会被捕获进 QRL 的词法作用域而不可序列化（verifySerializable 报错）。
  const commit = $((side: Side, text: string) => {
    lastSide.value = side;
    if (side === "L") {
      textL.value = text;
      hlL.value = [];
      jpPathsL.value = [];
    } else {
      textR.value = text;
      hlR.value = [];
      jpPathsR.value = [];
    }
    scheduleSave(side, text);
  });

  const runOp = $(
    async (side: Side, op: "fmt" | "min" | "esc" | "unesc" | "repair") => {
      const raw = side === "L" ? textL.value : textR.value;
      const lang = side === "L" ? langL.value : langR.value;

      if (op !== "repair" && !raw.trim()) {
        toast.value = { msg: `${sideName(side)}内容为空`, kind: "err" };
        return;
      }

      pushHistory(raw);
      hist.value = loadHistory();

      let r:
        { ok: true; text: string; msg: string } | { ok: false; msg: string };
      if (op === "fmt") r = formatText(raw, lang, indent.value);
      else if (op === "min") r = minifyText(raw, lang, indent.value);
      else if (op === "esc") r = escapeText(raw, lang, indent.value);
      else if (op === "unesc") r = unescapeText(raw);
      else {
        const rr = repairJson(raw, lang, indent.value);
        r = rr.ok
          ? {
              ok: true,
              text: rr.text,
              msg: `修复成功 · 常见错误已自动处理（${sideName(side)}）`,
            }
          : {
              ok: false,
              msg: `无法自动修复 · ${rr.err.msg}（第 ${rr.err.line} 行）`,
            };
      }

      if (r.ok) {
        await commit(side, r.text);
        toast.value = { msg: `${sideName(side)}${r.msg}`, kind: "ok" };
      } else {
        toast.value = { msg: r.msg, kind: "err" };
      }
    },
  );

  const changeLang = $(
    async (side: Side, next: string, el: HTMLSelectElement) => {
      const to = next as Lang;
      const from = side === "L" ? langL.value : langR.value;
      if (from === to) return;

      const raw = side === "L" ? textL.value : textR.value;
      const r = convertLang(raw, from, to, indent.value);
      if (!r.ok) {
        el.value = from; // 回弹：解析失败时保持原语言，避免内容被破坏
        toast.value = { msg: `${sideName(side)}${r.msg}`, kind: "err" };
        return;
      }

      if (side === "L") langL.value = to;
      else langR.value = to;

      if (r.text !== raw) {
        pushHistory(raw);
        hist.value = loadHistory();
        await commit(side, r.text);
        if (side === "L") {
          treeL.value = false;
        } else {
          treeR.value = false;
        }
      }
      toast.value = { msg: `${sideName(side)}${r.msg}`, kind: "ok" };
    },
  );

  const toggleTree = $((side: Side) => {
    if (side === "L") treeL.value = !treeL.value;
    else treeR.value = !treeR.value;
  });

  const toggleDiff = $(() => {
    diffOn.value = !diffOn.value;
    const d = diffOn.value
      ? diffStats(diffLines(textL.value, textR.value))
      : null;
    toast.value = {
      msg: d
        ? `已进入对比模式：左删 ${d.del} 行 · 右增 ${d.add} 行`
        : "已退出对比模式",
      kind: "ok",
    };
  });

  /** 结构对比：按 key-path 递归比较两侧数据（需两侧均合法） */
  const toggleStruct = $(() => {
    const a = valL.value;
    const b = valR.value;
    if (!structOn.value && (!a.ok || !b.ok)) {
      toast.value = { msg: "结构对比需两侧均为合法 JSON", kind: "err" };
      return;
    }
    structOn.value = !structOn.value;
    diffOn.value = false;
    if (structOn.value && a.ok && b.ok) {
      const r = diffStructure(a.val, b.val);
      const s = r.summary;
      toast.value = {
        msg: r.changes.length
          ? `结构对比：${s.added} 新增 · ${s.removed} 删除 · ${s.changed} 变更`
          : "两侧结构完全一致",
        kind: "ok",
      };
    } else {
      toast.value = { msg: "已退出结构对比", kind: "ok" };
    }
  });

  /** 从当前侧数据推断 JSON Schema 并写入对侧编辑区 */
  const inferSchemaSide = $(() => {
    const side = lastSide.value;
    const raw = side === "L" ? textL.value : textR.value;
    const lang = side === "L" ? langL.value : langR.value;
    const p = parseByLang(raw, lang);
    if (!p.ok) {
      toast.value = {
        msg: `${sideName(side)}解析失败，无法推断 Schema`,
        kind: "err",
      };
      return;
    }
    const target: Side = side === "L" ? "R" : "L";
    commit(target, JSON.stringify(inferSchema(p.val), null, 2));
    toast.value = {
      msg: `已从${sideName(side)}数据推断 JSON Schema 并写入${sideName(target)}编辑区`,
      kind: "ok",
    };
  });

  const runJp = $((side: Side) => {
    const rest = side === "L" ? jpL.value : jpR.value;
    const expr = jpComposePath(rest);
    const raw = side === "L" ? textL.value : textR.value;
    const lang = side === "L" ? langL.value : langR.value;
    if (!expr) {
      toast.value = {
        msg: `${sideName(side)}请输入 $ 之后的 JSONPath 路径`,
        kind: "err",
      };
      return;
    }
    const r = queryJsonPath(raw, lang, expr);
    if (!r.ok) {
      toast.value = { msg: `${sideName(side)}${r.msg}`, kind: "err" };
      return;
    }
    if (side === "L") {
      hlL.value = r.ranges;
      jpPathsL.value = r.paths;
      jpValsL.value = r.values;
    } else {
      hlR.value = r.ranges;
      jpPathsR.value = r.paths;
      jpValsR.value = r.values;
    }
    toast.value = {
      msg: r.count
        ? `${sideName(side)} JSONPath 命中 ${r.count} 项 · 已在原文高亮 ${r.ranges.length} 处文字`
        : "未匹配到任何节点",
      kind: "ok",
    };
  });

  /** 把当前侧 JSONPath 命中结果（数组）提取到对侧编辑区 */
  const extractJp = $((side: Side) => {
    const vals = side === "L" ? jpValsL.value : jpValsR.value;
    if (!vals.length) {
      toast.value = {
        msg: `${sideName(side)}暂无 JSONPath 命中结果可提取`,
        kind: "err",
      };
      return;
    }
    const target: Side = side === "L" ? "R" : "L";
    commit(target, JSON.stringify(vals, null, 2));
    toast.value = {
      msg: `已提取 ${vals.length} 项结果到${sideName(target)}编辑区`,
      kind: "ok",
    };
  });

  /** 生成可分享链接：把两侧内容编码进 location.hash 并复制到剪贴板 */
  const shareJson = $(async () => {
    const state: ShareState = {
      l: { t: textL.value, lang: langL.value },
      r: { t: textR.value, lang: langR.value },
    };
    const enc = encodeShare(state);
    if (enc.length > 30000) {
      toast.value = {
        msg: "内容过大，无法生成分享链接（请缩减后重试）",
        kind: "err",
      };
      return;
    }
    const url = `${location.origin}${location.pathname}#${enc}`;
    history.replaceState(null, "", `#${enc}`);
    const ok = await copyText(url);
    toast.value = {
      msg: ok
        ? "已生成分享链接并复制到剪贴板"
        : `分享链接已写入地址栏：${url.slice(0, 48)}…`,
      kind: ok ? "ok" : "err",
    };
  });

  const clearJp = $((side: Side) => {
    if (side === "L") {
      jpL.value = "";
      hlL.value = [];
      jpPathsL.value = [];
      jpValsL.value = [];
    } else {
      jpR.value = "";
      hlR.value = [];
      jpPathsR.value = [];
      jpValsR.value = [];
    }
    toast.value = { msg: `已清除${sideName(side)} JSONPath 高亮`, kind: "ok" };
  });

  const exportJson = $(() => {
    const side = lastSide.value;
    const raw = side === "L" ? textL.value : textR.value;
    if (!raw.trim()) {
      toast.value = { msg: `${sideName(side)}内容为空，无法导出`, kind: "err" };
      return;
    }
    const p = parseByLang(raw, side === "L" ? langL.value : langR.value);
    const out = p.ok ? JSON.stringify(p.val, null, 2) : raw;
    downloadFile(`export_${nowStr()}.json`, out);
    toast.value = { msg: `已导出 ${sideName(side)}内容为 .json`, kind: "ok" };
  });

  const copySide = $(async () => {
    const side = lastSide.value;
    const txt = side === "L" ? textL.value : textR.value;
    if (!txt.trim()) {
      toast.value = { msg: "无可复制内容", kind: "err" };
      return;
    }
    const ok = await copyText(txt);
    toast.value = {
      msg: ok ? `已复制${sideName(side)}内容` : "复制失败，请手动选择文本",
      kind: ok ? "ok" : "err",
    };
  });

  const pickFile = $(() => {
    fileRef.value?.click();
  });

  const importFile = $(async (file: File) => {
    const side = lastSide.value;
    const cur = side === "L" ? textL.value : textR.value;
    if (
      cur &&
      cur.trim() &&
      !window.confirm(`导入 ${file.name} 将覆盖当前编辑区内容，是否继续？`)
    ) {
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      await commit(side, String(reader.result));
      toast.value = {
        msg: `已导入 ${file.name}（${sideName(side)}编辑区）`,
        kind: "ok",
      };
    };
    reader.readAsText(file, "utf-8");
  });

  const openHist = $(() => {
    hist.value = loadHistory();
    histOpen.value = true;
  });

  const restoreHist = $(async (idx: number) => {
    const item = hist.value[idx];
    if (!item) return;
    await commit(lastSide.value, item.text);
    histOpen.value = false;
    toast.value = {
      msg: `已恢复到${sideName(lastSide.value)}编辑区 · ${fmtTime(item.t)}`,
      kind: "ok",
    };
  });

  const delHist = $((idx: number) => {
    hist.value = deleteHistory(idx);
  });

  const clearAllHist = $(() => {
    hist.value = clearHistory();
    toast.value = { msg: "已清空全部历史记录", kind: "ok" };
  });

  /* ---------------- 渲染 ---------------- */

  const highlightNodes = (raw: string, ranges: Range[]): JSXOutput[] => {
    const lines = raw.split("\n");
    const starts: number[] = [0];
    for (let i = 0; i < lines.length; i++)
      starts.push(starts[i] + lines[i].length + 1);

    return lines.map((ln, li) => {
      const lStart = starts[li];
      const lEnd = lStart + ln.length;
      const segs: Range[] = [];
      for (const r of ranges) {
        const s = Math.max(r[0], lStart);
        const e = Math.min(r[1], lEnd);
        if (s < e) segs.push([s - lStart, e - lStart]);
      }
      if (!segs.length) return <span key={li}>{ln + "\n"}</span>;

      const merged = jpMergeRanges(segs);
      const nodes: JSXOutput[] = [];
      let cur = 0;
      merged.forEach((m, i) => {
        if (m[0] > cur) nodes.push(ln.slice(cur, m[0]));
        nodes.push(
          <span key={`h${i}`} class="jp-hl">
            {ln.slice(m[0], m[1])}
          </span>,
        );
        cur = m[1];
      });
      if (cur < ln.length) nodes.push(ln.slice(cur));
      nodes.push("\n");
      return <span key={li}>{nodes}</span>;
    });
  };

  const pane = (side: Side) => {
    const text = side === "L" ? textL.value : textR.value;
    const lang = side === "L" ? langL.value : langR.value;
    const tree = side === "L" ? treeL.value : treeR.value;
    const v = side === "L" ? valL.value : valR.value;
    const jp = side === "L" ? jpL.value : jpR.value;
    const hl = side === "L" ? hlL.value : hlR.value;
    const hlPaths = side === "L" ? jpPathsL.value : jpPathsR.value;
    const filter = side === "L" ? treeFilterL.value : treeFilterR.value;
    const scroll = side === "L" ? scL.value : scR.value;
    const diff = diffRes.value;
    const diffLinesOut = diff ? (side === "L" ? diff.a : diff.b) : null;
    const sRes = structRes.value;

    const showDiff = !!diffLinesOut;
    const showStruct = !!sRes;
    const showTree = !showDiff && !showStruct && tree;
    const err = v.ok ? null : v.err;
    const lineCount = text.split("\n").length;
    const BIG_FILE_LINES = 5000;
    const big = lineCount > BIG_FILE_LINES;
    const gut = side === "L" ? gutL : gutR;

    return (
      <div class="json-col" key={side}>
        <div class="col-title">
          <span>{side === "L" ? "左侧" : "右侧"} JSON</span>
          <span class="col-tag">{side === "L" ? "A" : "B"}</span>
        </div>

        <div class="editor-wrap">
          <div class="ed-toolbar">
            <select
              class="lang-sel"
              value={lang}
              title="本侧数据语言（切换即自动转换内容）"
              onChange$={(_e, el) => changeLang(side, el.value, el)}
            >
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {l === "json5" ? "JSON5" : l.toUpperCase()}
                </option>
              ))}
            </select>

            <button class="btn primary" onClick$={() => runOp(side, "fmt")}>
              格式化
            </button>
            <button class="btn" onClick$={() => runOp(side, "min")}>
              压缩
            </button>
            <button
              class="btn"
              title="把文本转义为 JSON 字符串字面量"
              onClick$={() => runOp(side, "esc")}
            >
              转义
            </button>
            <button
              class="btn"
              title="把 JSON 字符串字面量还原为文本"
              onClick$={() => runOp(side, "unesc")}
            >
              去转义
            </button>
            <button
              class={`btn ${tree ? "active" : ""}`}
              onClick$={() => toggleTree(side)}
            >
              {tree ? "JSON" : "树形"}
            </button>

            <span class="jp-inline">
              <span class="jp-box">
                <span class="jp-prefix" aria-hidden="true">
                  $.
                </span>
                <input
                  class="jp-input"
                  placeholder="JSONPath 查询（原文高亮）"
                  spellcheck={false}
                  value={jp}
                  onInput$={(_e, el) => {
                    const v = jpStripPrefixNoise(el.value);
                    if (el.value !== v) el.value = v;
                    if (side === "L") jpL.value = v;
                    else jpR.value = v;
                  }}
                  onKeyDown$={(e) => {
                    if (e.key === "Enter") runJp(side);
                  }}
                />
              </span>
              <button class="btn ghost jp-run" onClick$={() => runJp(side)}>
                查
              </button>
              <button class="btn ghost jp-clear" onClick$={() => clearJp(side)}>
                ×
              </button>
              <button
                class="btn ghost jp-extract"
                title="把 JSONPath 命中结果提取到对侧编辑区"
                onClick$={() => extractJp(side)}
              >
                提取
              </button>
            </span>
          </div>

          <div class={`editor view-edit ${showTree || showDiff ? "hide" : ""}`}>
            <div class={`gutter ${big ? "big" : ""}`} ref={gut}>
              {big
                ? (() => {
                    const LINE_H = 24;
                    const PAD = 12;
                    const VIEW = 480;
                    const start = Math.max(
                      0,
                      Math.floor((scroll - PAD) / LINE_H) - 8,
                    );
                    const end = Math.min(
                      lineCount,
                      Math.ceil((scroll - PAD + VIEW) / LINE_H) + 8,
                    );
                    const nodes: JSXOutput[] = [];
                    for (let i = start; i < end; i++) {
                      nodes.push(
                        <div
                          key={i}
                          class={err && err.line === i + 1 ? "ln err" : "ln"}
                          style={{
                            position: "absolute",
                            top: `${i * LINE_H - scroll + PAD}px`,
                            left: "0",
                            right: "0",
                            paddingRight: "8px",
                          }}
                        >
                          {i + 1}
                        </div>,
                      );
                    }
                    return nodes;
                  })()
                : Array.from({ length: lineCount }, (_, i) => (
                    <div
                      key={i}
                      class={err && err.line === i + 1 ? "ln err" : "ln"}
                    >
                      {i + 1}
                    </div>
                  ))}
            </div>
            <textarea
              spellcheck={false}
              autocapitalize="off"
              autocomplete="off"
              placeholder='{"示例":"粘贴或输入 JSON，拖入文件亦可"}'
              value={text}
              onInput$={(_e, el) => {
                lastSide.value = side;
                if (side === "L") {
                  textL.value = el.value;
                  hlL.value = [];
                } else {
                  textR.value = el.value;
                  hlR.value = [];
                }
                scheduleSave(side, el.value);
              }}
              onScroll$={(_e, el) => {
                if (gut.value) gut.value.scrollTop = el.scrollTop;
                if (side === "L") scL.value = el.scrollTop;
                else scR.value = el.scrollTop;
              }}
              onKeyDown$={(e) => {
                // Ctrl/Cmd+Enter 格式化当前侧（便捷快捷键）
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  runOp(side, "fmt");
                }
              }}
            />
            {hl.length > 0 && !big && (
              <pre class="jp-overlay" aria-hidden="true">
                {highlightNodes(text, hl)}
              </pre>
            )}
            {err && (
              <svg class="err-squiggle" aria-hidden="true">
                <path
                  d={squigglePath(text, err, scroll)}
                  fill="none"
                  stroke="#E24B4A"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  opacity="0.85"
                />
              </svg>
            )}
          </div>

          {showTree && (
            <div class="tree-toolbar">
              <input
                class="tree-filter"
                placeholder="过滤键名高亮…"
                spellcheck={false}
                value={filter}
                onInput$={(_e, el) => {
                  if (side === "L") treeFilterL.value = el.value;
                  else treeFilterR.value = el.value;
                }}
              />
            </div>
          )}
          {showTree &&
            (v.ok ? (
              <div class="tree-view">
                <JsonTree
                  val={v.val}
                  name="root"
                  depth={0}
                  path="$"
                  hlPaths={hlPaths}
                  filter={filter}
                />
              </div>
            ) : (
              <div class="tree-view">
                <div class="empty">
                  {lang} 解析失败：{v.err.msg}
                </div>
              </div>
            ))}

          {showStruct && side === "L" && sRes && (
            <StructDiffView result={sRes} />
          )}
          {showDiff && <DiffPane lines={diffLinesOut} />}

          <div class="vbar">
            <span class={`dot ${err ? "err" : text.trim() ? "ok" : "wait"}`} />
            <span>
              {err
                ? `✖ ${err.msg}（第 ${err.line} 行，第 ${err.col} 列）`
                : text.trim()
                  ? `✓ ${lang.toUpperCase()} 合法 · 共 ${lineCount} 行`
                  : "就绪 · 输入后实时校验"}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div class="json-wrap">
      <div class="json-head">
        <div class="json-head-text">
          <h1 class="json-h1">JSON</h1>
          <div class="json-intro">
            JSON 在线工具：格式化、压缩、转义、修复、树形浏览、左右对比与 JSONPath
            查询，纯前端本地处理，数据不上传。
          </div>
        </div>
        <div class="toolbar">
          <select
            class="indent"
            title="缩进宽度"
            value={String(indent.value)}
            onChange$={(_e, el) => {
              indent.value =
                el.value === "tab" ? "tab" : (Number(el.value) as Indent);
            }}
          >
            <option value="2">缩进 2 空格</option>
            <option value="4">缩进 4 空格</option>
            <option value="tab">缩进 Tab</option>
          </select>
          <button
            class="btn"
            title="自动修复常见错误（尾逗号 / 单引号 / 键名缺引号 / 注释）"
            onClick$={() => runOp(lastSide.value, "repair")}
          >
            修复
          </button>
          <button
            class={`btn ${diffOn.value ? "primary" : ""}`}
            title="左右编辑区内联显示颜色差异（行级）"
            onClick$={() => toggleDiff()}
          >
            {diffOn.value ? "退出对比" : "对比"}
          </button>
          <button
            class={`btn ${structOn.value ? "primary" : ""}`}
            title="按 key-path 比较两侧结构（需两侧均合法 JSON）"
            onClick$={() => toggleStruct()}
          >
            {structOn.value ? "退出结构" : "结构"}
          </button>
          <button
            class="btn"
            title="从当前侧数据推断 JSON Schema 并写入对侧"
            onClick$={() => inferSchemaSide()}
          >
            Schema
          </button>
          <button
            class="btn ghost"
            title="最近 10 条历史记录"
            onClick$={() => openHist()}
          >
            历史
          </button>
          <button
            class="btn ghost"
            title="导入文件到当前编辑区"
            onClick$={() => pickFile()}
          >
            导入
          </button>
          <button
            class="btn ghost"
            title="导出当前编辑区为 .json"
            onClick$={() => exportJson()}
          >
            导出
          </button>
          <button
            class="btn ghost"
            title="复制当前编辑区内容"
            onClick$={() => copySide()}
          >
            复制
          </button>
          <button
            class="btn ghost"
            title="生成可分享链接（含两侧内容）"
            onClick$={() => shareJson()}
          >
            分享
          </button>
        </div>
      </div>

      <div class="json-body">
        {pane("L")}
        {pane("R")}
      </div>

      <div class={`json-status ${toast.value.kind}`}>
        <span class={`dot ${toast.value.kind}`} />
        <span>{toast.value.msg}</span>
      </div>

      <div class="hint">
        所有处理均在本地浏览器完成，数据不会上传。左右两侧互不干扰：每侧可独立格式化
        / 压缩 / 转义 /
        去转义，点击「树形」在编辑区与树形视图间互斥切换；编辑区内
        Ctrl/Cmd+Enter
        可快速格式化当前侧；输入即实时校验（绿色=合法，红色=错误位置）；「对比」按行着色差异，「结构」按
        key-path
        比较两侧差异（红=左侧独有，绿=右侧新增）；「Schema」从一侧数据推断 JSON
        Schema 写入对侧。Base64 / URL / 时间戳 / JWT / CSV 等小工具见页头
        Toolbox 子导航。
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".json,.txt,.yaml,.yml,.toml,.xml,application/json,text/plain"
        class="hidden-file"
        onChange$={(_e, el) => {
          const f = el.files?.[0];
          if (f) importFile(f);
          el.value = "";
        }}
      />

      {histOpen.value && (
        <div class="modal show" onClick$={() => (histOpen.value = false)}>
          <div class="modal-box" onClick$={(e) => e.stopPropagation()}>
            <div class="modal-head">
              <span>历史记录</span>
              <div class="modal-head-actions">
                <button
                  class="btn ghost"
                  title="清空全部历史"
                  onClick$={() => clearAllHist()}
                >
                  清空
                </button>
                <button
                  class="btn ghost"
                  onClick$={() => (histOpen.value = false)}
                >
                  ×
                </button>
              </div>
            </div>
            <div class="hist-out">
              {hist.value.length === 0 ? (
                <div class="empty">
                  暂无历史记录
                  <br />
                  格式化 / 压缩 / 转义 / 去转义 / 修复等操作后会自动保存
                </div>
              ) : (
                hist.value.map((h, idx) => (
                  <div class="hist-item" key={h.t}>
                    <div
                      class="hist-prev"
                      title="点击恢复到最近操作的一侧"
                      onClick$={() => restoreHist(idx)}
                    >
                      {h.text.replace(/\s+/g, " ").slice(0, 60)}
                    </div>
                    <div class="hist-time">{fmtTime(h.t)}</div>
                    <button
                      class="hist-del"
                      title="删除"
                      onClick$={() => delHist(idx)}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
