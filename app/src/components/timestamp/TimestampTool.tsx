import {
  $,
  component$,
  useSignal,
  useVisibleTask$,
} from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import { copyText } from "../../lib/clipboard";
import {
  detectDstAmbiguity,
  formatInZone,
  generateInterval,
  localToEpochNs,
  parseInput,
  periodBoundaries,
  relativeTime,
  toAiJson,
  type Unit,
} from "../../lib/timestamp";

/** 常用 IANA 时区（用于多时区对比与下拉候选） */
const COMMON_ZONES = [
  "UTC",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
];

const SCENARIO_TAGS: { label: string; sample: string; hint: string }[] = [
  { label: "JWT iat", sample: "1700000000", hint: "常见 JWT 签发时间（秒）" },
  { label: "日志时间戳", sample: "1700000000000", hint: "毫秒口径日志" },
  { label: "纳秒精度", sample: "1700000000000000000", hint: "真实纳秒" },
  { label: "Unix 元年", sample: "0", hint: "1970-01-01T00:00:00Z" },
  { label: "2038 边界", sample: "2147483647", hint: "32 位有符号溢出点（秒）" },
];

const HISTORY_KEY = "ts_tool_history";
const HISTORY_MAX = 5;

export const TimestampTool = component$(() => {
  const loc = useLocation();
  const q = loc.url.searchParams;

  const raw = useSignal(q.get("ts") ?? "");
  const unitLock = useSignal<Unit>((q.get("unit") as Unit) || "auto");
  const zone = useSignal(q.get("tz") || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const nowNs = useSignal(BigInt(Date.now()) * 1_000_000n);
  const engineReady = useSignal(false);
  const toast = useSignal("");
  const history = useSignal<string[]>([]);
  const openSection = useSignal<string | null>("relative");

  // 反向转换
  const revLocal = useSignal("");
  const revZone = useSignal(zone.value);
  // 区间生成
  const ivStart = useSignal("");
  const ivEnd = useSignal("");
  const ivStep = useSignal<"1s" | "1m" | "1h" | "1d">("1h");

  const flash = $((msg: string) => {
    toast.value = msg;
    setTimeout(() => {
      if (toast.value === msg) toast.value = "";
    }, 1800);
  });

  const copy = $(async (text: string) => {
    if (!text) return;
    const ok = await copyText(text);
    flash(ok ? "已复制" : "复制失败，请手动选择");
  });

  const pushHistory = $((val: string) => {
    const v = val.trim();
    if (!v) return;
    const next = [v, ...history.value.filter((h) => h !== v)].slice(0, HISTORY_MAX);
    history.value = next;
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      /* 忽略隐私模式写入失败 */
    }
  });

  const syncUrl = $(() => {
    try {
      const sp = new URLSearchParams();
      if (raw.value) sp.set("ts", raw.value);
      if (zone.value && zone.value !== "UTC") sp.set("tz", zone.value);
      if (unitLock.value !== "auto") sp.set("unit", unitLock.value);
      const qs = sp.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    } catch {
      /* SSR 下无 window，忽略 */
    }
  });

  // 客户端：加载 Temporal 引擎 + 启动秒级时钟 + 读取历史
  useVisibleTask$(async ({ cleanup }) => {
    if (!(globalThis as Record<string, unknown>).Temporal) {
      const mod = await import("@js-temporal/polyfill");
      (globalThis as Record<string, unknown>).Temporal = (mod as { Temporal: unknown }).Temporal;
    }
    engineReady.value = true;

    const tick = () => {
      nowNs.value = BigInt(Date.now()) * 1_000_000n;
    };
    const timer = setInterval(tick, 1000);
    cleanup(() => clearInterval(timer));

    try {
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) history.value = JSON.parse(h) as string[];
    } catch {
      /* 忽略 */
    }
  });

  const parsed = parseInput(raw.value, unitLock.value);
  const epochNs = parsed.ok ? parsed.epochNs : null;
  const fmt = epochNs !== null ? formatInZone(epochNs, zone.value) : null;
  const fmtUtc = epochNs !== null ? formatInZone(epochNs, "UTC") : null;

  const rel = epochNs !== null ? relativeTime(epochNs, nowNs.value) : null;
  const periods = epochNs !== null ? periodBoundaries(zone.value, epochNs) : null;

  const rev = revLocal.value.trim()
    ? localToEpochNs(revZone.value, revLocal.value.trim())
    : null;
  const revDst = revLocal.value.trim()
    ? detectDstAmbiguity(revZone.value, revLocal.value.trim())
    : null;

  const ivStartP = parseInput(ivStart.value.trim() || "0", "auto");
  const ivEndP = parseInput(ivEnd.value.trim() || "0", "auto");
  const interval =
    ivStartP.ok && ivEndP.ok
      ? generateInterval(ivStartP.epochNs, ivEndP.epochNs, ivStep.value)
      : null;

  const aiJson =
    parsed.ok
      ? toAiJson({
          input: raw.value,
          unit: unitLock.value,
          epochNs: parsed.epochNs,
          zone: zone.value,
          utc: fmtUtc && fmtUtc.ok ? fmtUtc.formats.utcIso : "",
          local: fmt && fmt.ok ? fmt.formats.localIso : "",
          offset: fmt && fmt.ok ? fmt.formats.offset : "",
          valid: true,
        })
      : null;

  const card = (label: string, value: string, key?: string) => (
    <div class="ts-card">
      <div class="ts-card-label">{label}</div>
      <div class="ts-card-value" key={key}>
        {value}
      </div>
      <button class="btn ghost ts-card-copy" onClick$={() => copy(value)}>
        复制
      </button>
    </div>
  );

  const section = (id: string, title: string, node: unknown) => (
    <div class="ts-adv-item">
      <button
        class={{ "ts-adv-head": true, "is-open": openSection.value === id }}
        onClick$={() => (openSection.value = openSection.value === id ? null : id)}
      >
        <span>{title}</span>
        <span class="ts-adv-chevron">{openSection.value === id ? "▾" : "▸"}</span>
      </button>
      {openSection.value === id && <div class="ts-adv-body">{node as any}</div>}
    </div>
  );

  return (
    <div class="ts-wrap">
      <div class="tools-body">
        {toast.value && (
          <div class="tools-status">
            <span class="tools-toast">{toast.value}</span>
          </div>
        )}

        <h1 class="tools-h1">时间戳</h1>
        <p class="tools-intro">
          开发者向时间戳工具：自动识别秒 / 毫秒 / 微秒 / 纳秒，多格式同屏输出，支持时区切换、相对时间、时段边界与区间生成。纯前端本地处理，数据不上传。
        </p>

        {/* 主区 + 侧栏双栏（等高） */}
        <div class="ts-cols">
          <div class="ts-main">
            {/* 主流程：输入即解析 */}
            <div class="ts-input-row">
              <input
                class="tools-in-line ts-input"
                placeholder="输入时间戳（10~19 位）或日期 ISO 串，如 1700000000000000000 / 2023-11-14T22:13:20Z"
                value={raw.value}
                onInput$={(_e, el) => {
                  raw.value = el.value;
                  syncUrl();
                }}
              />
              <select
                class="ts-unit"
                value={unitLock.value}
                onChange$={(_e, el) => {
                  unitLock.value = (el as HTMLSelectElement).value as Unit;
                  syncUrl();
                }}
              >
                <option value="auto">自动</option>
                <option value="s">秒</option>
                <option value="ms">毫秒</option>
                <option value="us">微秒</option>
                <option value="ns">纳秒</option>
              </select>
            </div>

            {!parsed.ok && raw.value.trim() !== "" && (
              <div class="tools-err">{parsed.err}</div>
            )}

            {/* 当前时间条 */}
            <div class="ts-nowbar">
              <div class="ts-nowbar-item">
                <span class="ts-nowbar-tag">当前（{zone.value}）</span>
                <span class="ts-nowbar-time">
                  {fmtNow(zone.value, nowNs.value)}
                </span>
              </div>
              <div class="ts-nowbar-item">
                <span class="ts-nowbar-tag">UTC</span>
                <span class="ts-nowbar-time">{fmtNow("UTC", nowNs.value)}</span>
              </div>
              <button class="btn ghost ts-nowbar-use" onClick$={() => (raw.value = String(Number(nowNs.value / 1_000_000n)))}>
                用当前毫秒
              </button>
            </div>

            {/* 多格式输出卡片 */}
            {fmt && fmt.ok && (
              <div class="ts-cards">
                {card("RFC 3339", fmt.formats.rfc3339, "rfc3339")}
                {card("RFC 2822", fmt.formats.rfc2822, "rfc2822")}
                {card("UTC ISO", fmt.formats.utcIso, "utc")}
                {card("本地自定义", fmt.formats.custom, "custom")}
                {card("含亚秒(ns)", fmt.formats.withSub, "sub")}
                {card(
                  "偏移 / DST",
                  `${fmt.formats.offset}${fmt.formats.isDst ? " · 夏令时" : ""}`,
                  "off",
                )}
              </div>
            )}
          </div>

          {/* 侧栏：时区 / 相对时间 / 历史（等高填充） */}
          <aside class="ts-side">
            <div class="ts-side-block">
              <label class="ts-tz-label" for="ts-tz">
                时区
              </label>
              <input
                id="ts-tz"
                class="tools-in-line ts-tz-input"
                list="ts-tz-list"
                placeholder="搜索 IANA 时区，如 Asia/Shanghai"
                value={zone.value}
                onInput$={(_e, el) => {
                  zone.value = (el as HTMLInputElement).value;
                  syncUrl();
                }}
              />
              <datalist id="ts-tz-list">
                {COMMON_ZONES.map((z) => (
                  <option value={z} />
                ))}
              </datalist>
            </div>

            <div class="ts-side-block">
              <span class="ts-side-label">相对时间</span>
              {rel && rel.ok && (
                <div class="ts-rel">
                  <span class="ts-rel-text">{rel.text}</span>
                  {rel.countdown && <span class="ts-rel-cd">（{rel.countdown}）</span>}
                </div>
              )}
            </div>

            <div class="ts-side-block ts-side-history">
              <span class="ts-side-label">历史</span>
              {history.value.length === 0 && <span class="ts-history-empty">暂无</span>}
              <div class="ts-history">
                {history.value.map((h) => (
                  <button
                    class="btn ghost ts-history-chip"
                    key={h}
                    onClick$={() => (raw.value = h)}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* 高级分区（手风琴） */}
        <div class="ts-adv">
          {section(
            "compare",
            "多时区对比",
            <div class="ts-compare">
              {COMMON_ZONES.concat(zone.value)
                .filter((z, i, a) => a.indexOf(z) === i)
                .map((z) => {
                  const f = epochNs !== null ? formatInZone(epochNs, z) : null;
                  return (
                    <div class="ts-compare-row" key={z}>
                      <span class="ts-compare-zone">{z}</span>
                      <span class="ts-compare-time">
                        {f && f.ok ? f.formats.custom : "—"}
                      </span>
                      <span class="ts-compare-off">
                        {f && f.ok ? f.formats.offset : ""}
                      </span>
                    </div>
                  );
                })}
            </div>,
          )}

          {section(
            "reverse",
            "反向转换（本地时间 → 时间戳）",
            <div class="ts-reverse">
              <div class="ts-input-row">
                <input
                  class="tools-in-line ts-input"
                  placeholder="本地日期时间，如 2023-11-14 22:13:20"
                  value={revLocal.value}
                  onInput$={(_e, el) => (revLocal.value = (el as HTMLInputElement).value)}
                />
                <input
                  class="tools-in-line ts-tz-input"
                  list="ts-tz-list"
                  value={revZone.value}
                  onInput$={(_e, el) => (revZone.value = (el as HTMLInputElement).value)}
                />
              </div>
              {revDst && revDst.ok && revDst.status !== "ok" && (
                <div class="tools-err">{revDst.info}</div>
              )}
              {rev && rev.ok && (
                <div class="ts-cards">
                  {card("毫秒", String(Number(rev.epochNs / 1_000_000n)))}
                  {card("秒", String(Number(rev.epochNs / 1_000_000_000n)))}
                  {card("纳秒", rev.epochNs.toString())}
                </div>
              )}
              {rev && !rev.ok && <div class="tools-err">{rev.err}</div>}
            </div>,
          )}

          {section(
            "period",
            "时段边界",
            <div class="ts-period">
              {periods && periods.ok ? (
                periods.items.map((it) => (
                  <div class="ts-period-row" key={it.label}>
                    <span class="ts-period-label">{it.label}</span>
                    <button
                      class="btn ghost ts-period-copy"
                      onClick$={() => copy(String(it.s))}
                    >
                      {it.s}
                    </button>
                  </div>
                ))
              ) : (
                <div class="tools-hint">输入有效时间戳后显示本时区的时段边界。</div>
              )}
            </div>,
          )}

          {section(
            "interval",
            "区间生成",
            <div class="ts-interval">
              <div class="ts-input-row">
                <input
                  class="tools-in-line ts-input"
                  placeholder="起始时间戳 / 日期"
                  value={ivStart.value}
                  onInput$={(_e, el) => (ivStart.value = (el as HTMLInputElement).value)}
                />
                <input
                  class="tools-in-line ts-input"
                  placeholder="结束时间戳 / 日期"
                  value={ivEnd.value}
                  onInput$={(_e, el) => (ivEnd.value = (el as HTMLInputElement).value)}
                />
                <select
                  class="ts-unit"
                  value={ivStep.value}
                  onChange$={(_e, el) =>
                    (ivStep.value = (el as HTMLSelectElement).value as typeof ivStep.value)
                  }
                >
                  <option value="1s">1 秒</option>
                  <option value="1m">1 分</option>
                  <option value="1h">1 时</option>
                  <option value="1d">1 天</option>
                </select>
              </div>
              {interval && interval.ok ? (
                <div class="ts-interval-out">
                  {interval.truncated && (
                    <div class="tools-hint">结果超过 2000 点，已截断显示前段。</div>
                  )}
                  <div class="ts-interval-list">
                    {interval.values.slice(0, 50).map((v, i) => (
                      <code key={i}>{v}</code>
                    ))}
                  </div>
                  <div class="ts-interval-count">共 {interval.count} 点</div>
                </div>
              ) : (
                interval &&
                !interval.ok && <div class="tools-err">{interval.err}</div>
              )}
            </div>,
          )}

          {section(
            "scenario",
            "场景标签（一键填入）",
            <div class="ts-scenario">
              {SCENARIO_TAGS.map((t) => (
                <button
                  class="btn ghost ts-scenario-chip"
                  key={t.label}
                  onClick$={() => {
                    raw.value = t.sample;
                    pushHistory(t.sample);
                    syncUrl();
                  }}
                  title={t.hint}
                >
                  {t.label}
                </button>
              ))}
            </div>,
          )}

          {section(
            "aijson",
            "AI 友好 JSON",
            <div class="ts-aijson">
              {aiJson ? (
                <>
                  <pre class="ts-aijson-pre">{aiJson}</pre>
                  <button class="btn ghost" onClick$={() => copy(aiJson)}>
                    复制 JSON
                  </button>
                </>
              ) : (
                <div class="tools-hint">输入有效时间戳后生成结构化 JSON。</div>
              )}
            </div>,
          )}
        </div>

        <p class="tools-hint">
          提示：Temporal 引擎{engineReady.value ? "已加载" : "加载中…"}，支持真实纳秒精度与夏令时计算。
        </p>
      </div>
    </div>
  );
});

/** 把纳秒时间戳格式化为「YYYY-MM-DD HH:mm:ss」便于时间条展示 */
function fmtNow(z: string, ns: bigint): string {
  const T = (globalThis as Record<string, unknown>).Temporal as
    | { Instant: { fromEpochNanoseconds(n: bigint): { toZonedDateTimeISO(z: string): { toString(): string } } } }
    | undefined;
  const d = new Date(Number(ns / 1_000_000n));
  if (T) {
    try {
      const s = T.Instant.fromEpochNanoseconds(ns).toZonedDateTimeISO(z).toString();
      return s.replace("T", " ").replace(/\[.*\]$/, "").slice(0, 19);
    } catch {
      /* 落到原生 */
    }
  }
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: z,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return p.format(d).replace(",", "");
}
