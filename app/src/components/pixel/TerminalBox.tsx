import { component$, useSignal } from '@builder.io/qwik';
import { copyText } from '../../lib/clipboard';

/**
 * 像素终端框：借鉴 Qwik 官网 hero 的「可复制命令」模式，
 * 但用黑曜石底 + 硬边框 + 等宽像素字重新诠释。
 */
export const TerminalBox = component$<{ cmd: string; label?: string; hint?: string }>(
  ({ cmd, label = 'terminal', hint }) => {
    const copied = useSignal(false);

    return (
      <div class="mc-term">
        <div class="mc-term-bar">
          <span class="mc-term-btns" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span class="mc-term-title">{label}</span>
        </div>
        <div class="mc-term-body">
          <code class="mc-term-cmd">
            <span class="mc-term-prompt" aria-hidden="true">
              &gt;
            </span>
            {cmd}
          </code>
          <button
            type="button"
            class="btn mc-term-copy"
            aria-label="复制命令"
            onClick$={async () => {
              const ok = await copyText(cmd);
              copied.value = ok;
              if (ok) setTimeout(() => (copied.value = false), 1600);
            }}
          >
            {copied.value ? '已复制' : '复制'}
          </button>
        </div>
        {hint ? <p class="mc-term-hint">{hint}</p> : null}
      </div>
    );
  }
);
