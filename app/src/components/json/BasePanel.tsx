import { component$, useSignal, $ } from "@builder.io/qwik";
import { copyText } from "../../lib/clipboard";
import {
  baseEncode,
  baseDecode,
  type BaseCodec,
} from "../../lib/json/smalltools";

const CODEC_LABELS: Record<BaseCodec, string> = {
  b16: "Base16 (Hex)",
  b32: "Base32",
  b58: "Base58",
  b64: "Base64",
  b64url: "Base64URL",
  b85: "Base85",
};
const CODEC_ORDER: BaseCodec[] = ["b16", "b32", "b58", "b64", "b64url", "b85"];
const PAD_CODECS: BaseCodec[] = ["b32", "b64"];
const WRAP_CODECS: BaseCodec[] = ["b64"];

export const BasePanel = component$(() => {
  const codec = useSignal<BaseCodec>("b64");
  const dir = useSignal<"enc" | "dec">("enc");
  const input = useSignal("");
  const output = useSignal("");
  const err = useSignal("");
  const pad = useSignal(true);
  const wrap = useSignal(false);
  const toast = useSignal("");

  const flash = $((msg: string) => {
    toast.value = msg;
    setTimeout(() => {
      if (toast.value === msg) toast.value = "";
    }, 1800);
  });

  const transform = $(() => {
    const v = input.value;
    err.value = "";
    if (!v) {
      output.value = "";
      return;
    }
    const r =
      dir.value === "enc"
        ? baseEncode(codec.value, v, { pad: pad.value, wrap: wrap.value })
        : baseDecode(codec.value, v);
    if (r.ok) output.value = r.text;
    else {
      output.value = "";
      err.value = "⚠ " + r.err;
    }
  });

  const setCodec = $((c: BaseCodec) => {
    codec.value = c;
    if (!PAD_CODECS.includes(c)) pad.value = true;
    if (!WRAP_CODECS.includes(c)) wrap.value = false;
    if (input.value) transform();
  });
  const setDir = $((d: "enc" | "dec") => {
    dir.value = d;
    if (input.value) transform();
  });
  const onInput = $((_e: Event, el: HTMLTextAreaElement) => {
    input.value = el.value;
    transform();
  });
  const togglePad = $((_e: Event, el: HTMLInputElement) => {
    pad.value = el.checked;
    if (input.value) transform();
  });
  const toggleWrap = $((_e: Event, el: HTMLInputElement) => {
    wrap.value = el.checked;
    if (input.value) transform();
  });
  const copy = $(async () => {
    if (!output.value) return;
    const ok = await copyText(output.value);
    flash(ok ? "已复制结果" : "复制失败，请手动选择");
  });
  const swap = $(() => {
    input.value = output.value;
    dir.value = dir.value === "enc" ? "dec" : "enc";
    transform();
  });

  const padEnabled = PAD_CODECS.includes(codec.value);
  const wrapEnabled = WRAP_CODECS.includes(codec.value);

  return (
    <div class="base-wrap">
      <p class="base-intro">
        Base 编解码全家桶：Base16(Hex) / Base32 / Base58 / Base64 / Base64URL /
        Base85，纯前端本地处理，数据不上传。左侧输入、右侧输出，点上方按钮切换编解码。
      </p>

      <div class="base-toolbar">
        <span class="base-grp-label">编码格式</span>
        {CODEC_ORDER.map((c) => (
          <button
            key={c}
            class={`btn codec ${codec.value === c ? "active" : ""}`}
            onClick$={() => setCodec(c)}
          >
            {CODEC_LABELS[c]}
          </button>
        ))}
      </div>

      <div class="base-toolbar">
        <span class="base-grp-label">方向</span>
        <button
          class={`btn dir ${dir.value === "enc" ? "active" : ""}`}
          onClick$={() => setDir("enc")}
        >
          编码 →
        </button>
        <button
          class={`btn dir ${dir.value === "dec" ? "active" : ""}`}
          onClick$={() => setDir("dec")}
        >
          ← 解码
        </button>
      </div>

      <div class="base-grid">
        <div class="base-col">
          <div class="base-col-label">
            <span>输入</span>
            <span class="base-tag">文本</span>
          </div>
          <textarea
            class="base-box"
            placeholder="输入文本…"
            value={input.value}
            onInput$={onInput}
          />
        </div>
        <div class="base-col">
          <div class="base-col-label">
            <span>输出</span>
            <span class="base-tag">{CODEC_LABELS[codec.value]}</span>
          </div>
          <textarea class="base-box" readOnly value={output.value} />
          <div class="base-actions">
            <button class="btn ghost" onClick$={copy}>
              复制结果
            </button>
            <button class="btn ghost" onClick$={swap}>
              ⇄ 交换
            </button>
            {toast.value && <span class="base-toast">{toast.value}</span>}
          </div>
        </div>
      </div>

      <div class="base-options">
        <label class="base-opt">
          <input
            type="checkbox"
            checked={pad.value}
            disabled={!padEnabled}
            onChange$={togglePad}
          />
          填充 = 号{padEnabled ? "" : "（不适用）"}
        </label>
        <label class="base-opt">
          <input
            type="checkbox"
            checked={wrap.value}
            disabled={!wrapEnabled}
            onChange$={toggleWrap}
          />
          76 字符换行（MIME）{wrapEnabled ? "" : "（不适用）"}
        </label>
      </div>

      {err.value && <div class="base-err">{err.value}</div>}
      <p class="base-hint">
        编码方向按 UTF-8 把文本转字节再编码；解码方向还原为 UTF-8 文本。Base58 /
        Base85 等不含 = 填充，对应选项自动失效。
      </p>
    </div>
  );
});
