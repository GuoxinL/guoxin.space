import { component$, useSignal, $, type QRL, type Signal } from '@builder.io/qwik';
import type { SkCfg } from '../../types/skills';
import {
  SK_DFLT_REPO,
  SK_DFLT_BRANCH,
  SK_DFLT_WORKER,
  saveSkCfg,
  testWorker,
} from '../../lib/skills';

/** 通道设置弹层：技能夹仓库 / 分支 / Worker URL；保存回写 localStorage，可测试 Worker 连通性。 */
export const ChannelSettings = component$<{
  cfg: SkCfg | null;
  toast: Signal<string>;
  onClose$: QRL<() => void>;
  onSaved$: QRL<() => void>;
}>(({ cfg, toast, onClose$, onSaved$ }) => {
  const repo = useSignal(cfg?.repo || SK_DFLT_REPO);
  const branch = useSignal(cfg?.branch || SK_DFLT_BRANCH);
  const worker = useSignal(cfg?.worker || SK_DFLT_WORKER);
  const msg = useSignal({ kind: '', text: '' });

  const onSave = $(() => {
    const norm = repo.value
      .trim()
      .replace(/^https?:\/\/(www\.)?github\.com\//, '')
      .replace(/\/$/, '')
      .replace(/\.git$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(norm)) {
      msg.value = { kind: 'err', text: '仓库格式应为 owner/repo 或 github.com/owner/repo' };
      return;
    }
    saveSkCfg({ repo: norm, branch: branch.value.trim() || 'main', worker: worker.value.trim().replace(/\/+$/, '') });
    msg.value = { kind: 'ok', text: '✓ 已保存' };
    onSaved$();
  });

  const onTest = $(async () => {
    const w = worker.value.trim().replace(/\/+$/, '') || SK_DFLT_WORKER;
    msg.value = { kind: '', text: '测试中…' };
    try {
      const { ok, data } = await testWorker(w);
      if (ok && data.ok) msg.value = { kind: 'ok', text: '✓ Worker 连通 · 仓库 ' + data.repo };
      else msg.value = { kind: 'err', text: '✖ ' + (data.error || 'HTTP ' + (data.status || '')) };
    } catch (e: any) {
      msg.value = { kind: 'err', text: '✖ 无法连接：' + (e?.message || e) };
    }
  });

  return (
    <div class="modal" onClick$={(e) => void (e.target === e.currentTarget && onClose$())}>
      <div class="modal-box">
        <div class="modal-head">
          <span>通道设置</span>
          <button class="btn ghost" onClick$={onClose$} aria-label="关闭">
            ✕
          </button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>技能夹仓库（owner/repo 或 github.com/owner/repo）</label>
            <input
              type="text"
              value={repo.value}
              onInput$={(e) => (repo.value = (e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="form-row">
            <label>分支</label>
            <input
              type="text"
              value={branch.value}
              onInput$={(e) => (branch.value = (e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="form-row">
            <label>Worker URL（收藏 / 同步写通道）</label>
            <input
              type="url"
              value={worker.value}
              onInput$={(e) => (worker.value = (e.target as HTMLInputElement).value)}
            />
            <span class="form-hint">列表读取走 GitHub 公开 API，无需 Worker；收藏 / 删除 / 同步才需要。</span>
          </div>
          <div class={'form-msg ' + msg.value.kind}>{msg.value.text}</div>
          <div class="modal-actions">
            <button class="btn" onClick$={onTest}>
              测试连通
            </button>
            <button class="btn primary" onClick$={onSave}>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
