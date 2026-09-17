import { $, component$, useSignal } from '@builder.io/qwik';

import { copyText } from '../../lib/clipboard';
import {
  b64Decode,
  b64Encode,
  csvToJson,
  dateToTs,
  jsonToCsv,
  jwtDecode,
  parseTimestamp,
  tsToDate,
  urlDecode,
  urlEncode,
} from '../../lib/json';

type Tab = 'b64' | 'url' | 'ts' | 'jwt' | 'csv';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'b64', label: 'Base64' },
  { id: 'url', label: 'URL' },
  { id: 'ts', label: '时间戳' },
  { id: 'jwt', label: 'JWT' },
  { id: 'csv', label: 'CSV' },
];

/** 小工具弹窗：Base64 / URL / 时间戳 / JWT / CSV，纯前端、零上传 */
export const SmallTools = component$<{ onClose$: () => void }>(({ onClose$ }) => {
  const tab = useSignal<Tab>('b64');
  const toast = useSignal('');

  // Base64
  const b64In = useSignal('');
  const b64Out = useSignal('');
  const b64Err = useSignal('');
  // URL
  const urlIn = useSignal('');
  const urlOut = useSignal('');
  const urlErr = useSignal('');
  // 时间戳
  const tsIn = useSignal('');
  const tsOut = useSignal('');
  const tsErr = useSignal('');
  // JWT
  const jwtIn = useSignal('');
  const jwtOut = useSignal('');
  const jwtErr = useSignal('');
  // CSV
  const csvIn = useSignal('');
  const csvOut = useSignal('');
  const csvErr = useSignal('');
  const csvMode = useSignal<'tojson' | 'tocsv'>('tojson');

  const flash = $((msg: string) => {
    toast.value = msg;
    setTimeout(() => {
      if (toast.value === msg) toast.value = '';
    }, 1800);
  });

  const doB64 = $((dir: 'enc' | 'dec') => {
    b64Err.value = '';
    const r = dir === 'enc' ? b64Encode(b64In.value) : b64Decode(b64In.value);
    if (r.ok) b64Out.value = r.text;
    else b64Err.value = r.err;
  });
  const doUrl = $((dir: 'enc' | 'dec') => {
    urlErr.value = '';
    const r = dir === 'enc' ? urlEncode(urlIn.value) : urlDecode(urlIn.value);
    if (r.ok) urlOut.value = r.text;
    else urlErr.value = r.err;
  });
  const doTs = $((dir: 'todate' | 'tots') => {
    tsErr.value = '';
    if (dir === 'todate') {
      const p = parseTimestamp(tsIn.value);
      if (!p.ok) {
        tsErr.value = p.err;
        return;
      }
      const d = tsToDate(p.ms);
      tsOut.value = d.ok
        ? `输入口径：${p.unit === 's' ? '秒（已×1000）' : '毫秒'}\nUTC：${d.iso}\n本地：${d.local}`
        : d.err;
    } else {
      const p = dateToTs(tsIn.value);
      if (!p.ok) {
        tsErr.value = p.err;
        return;
      }
      tsOut.value = `毫秒：${p.ms}\n秒：${Math.floor(p.ms / 1000)}`;
    }
  });
  const doJwt = $(() => {
    jwtErr.value = '';
    const r = jwtDecode(jwtIn.value);
    if (!r.ok) {
      jwtErr.value = r.err;
      return;
    }
    jwtOut.value = `Header:\n${JSON.stringify(r.header, null, 2)}\n\nPayload:\n${JSON.stringify(
      r.payload,
      null,
      2
    )}\n\nSignature 长度：${r.sigLen} 字符（未校验签名）`;
  });
  const doCsv = $(() => {
    csvErr.value = '';
    if (csvMode.value === 'tojson') {
      const r = csvToJson(csvIn.value);
      if (!r.ok) {
        csvErr.value = r.err;
        return;
      }
      csvOut.value = JSON.stringify(r.rows, null, 2);
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(csvIn.value);
      } catch (e) {
        csvErr.value = 'JSON 解析失败：' + (e as Error).message;
        return;
      }
      const r = jsonToCsv(parsed);
      if (!r.ok) {
        csvErr.value = r.err;
        return;
      }
      csvOut.value = r.csv;
    }
  });

  const copy = $(async (text: string) => {
    if (!text) return;
    const ok = await copyText(text);
    flash(ok ? '已复制结果' : '复制失败，请手动选择');
  });

  return (
    <div class="modal show" onClick$={() => onClose$()}>
      <div class="modal-box tools-box" onClick$={(e) => e.stopPropagation()}>
        <div class="modal-head">
          <span>小工具</span>
          <div class="modal-head-actions">
            {toast.value && <span class="tools-toast">{toast.value}</span>}
            <button class="btn ghost" onClick$={() => onClose$()}>
              ×
            </button>
          </div>
        </div>

        <div class="tools-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              class={`tools-tab ${tab.value === t.id ? 'active' : ''}`}
              onClick$={() => (tab.value = t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div class="tools-body">
          {/* Base64 */}
          {tab.value === 'b64' && (
            <div class="tools-pane">
              <textarea class="tools-in" placeholder="输入文本…" value={b64In.value} onInput$={(_e, el) => (b64In.value = el.value)} />
              <div class="tools-actions">
                <button class="btn" onClick$={() => doB64('enc')}>编码</button>
                <button class="btn" onClick$={() => doB64('dec')}>解码</button>
                <button class="btn ghost" onClick$={() => copy(b64Out.value)}>复制结果</button>
              </div>
              {b64Err.value && <div class="tools-err">{b64Err.value}</div>}
              <textarea class="tools-out" readonly value={b64Out.value} />
            </div>
          )}

          {/* URL */}
          {tab.value === 'url' && (
            <div class="tools-pane">
              <textarea class="tools-in" placeholder="输入文本…" value={urlIn.value} onInput$={(_e, el) => (urlIn.value = el.value)} />
              <div class="tools-actions">
                <button class="btn" onClick$={() => doUrl('enc')}>编码</button>
                <button class="btn" onClick$={() => doUrl('dec')}>解码</button>
                <button class="btn ghost" onClick$={() => copy(urlOut.value)}>复制结果</button>
              </div>
              {urlErr.value && <div class="tools-err">{urlErr.value}</div>}
              <textarea class="tools-out" readonly value={urlOut.value} />
            </div>
          )}

          {/* 时间戳 */}
          {tab.value === 'ts' && (
            <div class="tools-pane">
              <input class="tools-in-line" placeholder="时间戳（毫秒/秒）或日期 ISO 串…" value={tsIn.value} onInput$={(_e, el) => (tsIn.value = el.value)} />
              <div class="tools-actions">
                <button class="btn" onClick$={() => doTs('todate')}>转日期</button>
                <button class="btn" onClick$={() => doTs('tots')}>转时间戳</button>
                <button class="btn ghost" onClick$={() => copy(tsOut.value)}>复制结果</button>
              </div>
              {tsErr.value && <div class="tools-err">{tsErr.value}</div>}
              <textarea class="tools-out" readonly value={tsOut.value} />
              <p class="tools-hint">提示：输入 ≤ 1e12 的整数按「秒」处理并自动×1000；其余按毫秒。</p>
            </div>
          )}

          {/* JWT */}
          {tab.value === 'jwt' && (
            <div class="tools-pane">
              <textarea class="tools-in" placeholder="粘贴 JWT（header.payload.signature）…" value={jwtIn.value} onInput$={(_e, el) => (jwtIn.value = el.value)} />
              <div class="tools-actions">
                <button class="btn" onClick$={() => doJwt()}>解码</button>
                <button class="btn ghost" onClick$={() => copy(jwtOut.value)}>复制结果</button>
              </div>
              {jwtErr.value && <div class="tools-err">{jwtErr.value}</div>}
              <textarea class="tools-out" readonly value={jwtOut.value} />
              <p class="tools-hint">仅解码查看，不校验签名；注意避免粘贴含敏感信息的真实令牌到不可信环境。</p>
            </div>
          )}

          {/* CSV */}
          {tab.value === 'csv' && (
            <div class="tools-pane">
              <div class="tools-actions">
                <button class={`btn ${csvMode.value === 'tojson' ? 'primary' : ''}`} onClick$={() => (csvMode.value = 'tojson')}>CSV→JSON</button>
                <button class={`btn ${csvMode.value === 'tocsv' ? 'primary' : ''}`} onClick$={() => (csvMode.value = 'tocsv')}>JSON→CSV</button>
                <button class="btn" onClick$={() => doCsv()}>转换</button>
                <button class="btn ghost" onClick$={() => copy(csvOut.value)}>复制结果</button>
              </div>
              {csvMode.value === 'tojson' ? (
                <textarea class="tools-in" placeholder="粘贴 CSV（首行为表头）…" value={csvIn.value} onInput$={(_e, el) => (csvIn.value = el.value)} />
              ) : (
                <textarea class="tools-in" placeholder="粘贴 JSON 数组（元素为对象）…" value={csvIn.value} onInput$={(_e, el) => (csvIn.value = el.value)} />
              )}
              {csvErr.value && <div class="tools-err">{csvErr.value}</div>}
              <textarea class="tools-out" readonly value={csvOut.value} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
