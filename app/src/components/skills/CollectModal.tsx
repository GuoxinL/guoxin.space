import { component$, useSignal, $, type QRL, type Signal } from '@builder.io/qwik';
import { getAuthToken } from '../../lib/auth';
import { collectSkill } from '../../lib/skills';

/** 收藏弹层：粘贴 GitHub 仓库或子目录链接，选择 proxy(引用)/mirror(镜像) 模式，POST /api/collect。 */
export const CollectModal = component$<{
  toast: Signal<string>;
  onClose$: QRL<() => void>;
  onDone$: QRL<() => void>;
}>(({ toast, onClose$, onDone$ }) => {
  const url = useSignal('');
  const mode = useSignal<'proxy' | 'mirror'>('proxy');
  const msg = useSignal({ kind: '', text: '' });

  const onCollect = $(async () => {
    const u = url.value.trim();
    if (!u) {
      msg.value = { kind: 'err', text: '请粘贴 GitHub 仓库或子目录链接' };
      return;
    }
    const tok = getAuthToken();
    if (!tok) {
      msg.value = { kind: 'err', text: '请先登录 GitHub（收藏为站长功能）' };
      return;
    }
    const worker = (function () {
      try {
        return JSON.parse(localStorage.getItem('wb_home_sk_set') || '{}').worker || '';
      } catch {
        return '';
      }
    })();
    if (!worker) {
      msg.value = { kind: 'err', text: '未配置 Worker 写通道 · 请先在「通道设置」填写 Worker URL' };
      return;
    }
    msg.value = { kind: '', text: '收藏中…' };
    try {
      const { ok, data } = await collectSkill(worker, tok, u, mode.value);
      if (ok && data.ok) {
        msg.value = { kind: 'ok', text: `✓ 已收藏「${data.name}」（${data.dir}，${data.mode === 'mirror' ? '镜像' : '引用'}）` };
        onDone$();
      } else {
        msg.value = { kind: 'err', text: '✖ ' + (data.error || 'HTTP ' + (data.status || '')) + (data.dir ? '（' + data.dir + '）' : '') };
      }
    } catch (e: any) {
      msg.value = { kind: 'err', text: '✖ 网络错误：' + (e?.message || e) + '（Worker URL 是否正确？是否已部署？）' };
    }
  });

  return (
    <div class="modal" onClick$={(e) => void (e.target === e.currentTarget && onClose$())}>
      <div class="modal-box">
        <div class="modal-head">
          <span>收藏 Skill</span>
          <button class="btn ghost" onClick$={onClose$} aria-label="关闭">
            ✕
          </button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>GitHub 仓库或子目录链接</label>
            <input
              type="url"
              placeholder="https://github.com/owner/repo 或 .../tree/main/skill-name"
              value={url.value}
              onInput$={(e) => (url.value = (e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="form-row">
            <label>模式</label>
            <div class="mode-opt">
              <label class={mode.value === 'proxy' ? 'on' : ''}>
                <input
                  type="radio"
                  name="skMode"
                  value="proxy"
                  checked={mode.value === 'proxy'}
                  onChange$={() => (mode.value = 'proxy')}
                />
                引用（proxy）
              </label>
              <label class={mode.value === 'mirror' ? 'on' : ''}>
                <input
                  type="radio"
                  name="skMode"
                  value="mirror"
                  checked={mode.value === 'mirror'}
                  onChange$={() => (mode.value = 'mirror')}
                />
                镜像（mirror）
              </label>
            </div>
            <span class="form-hint">
              引用：仅存 SKILL.md 与图标，运行时回源原仓库；镜像：把整个目录物化到收藏仓库。
            </span>
          </div>
          <div class={'form-msg ' + msg.value.kind}>{msg.value.text}</div>
          <div class="modal-actions">
            <button class="btn" onClick$={onClose$}>
              取消
            </button>
            <button class="btn primary" onClick$={onCollect}>
              收藏
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
