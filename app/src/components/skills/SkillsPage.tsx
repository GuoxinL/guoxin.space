import { component$, useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import type { SkCfg, SkillMeta, SkStatus } from '../../types/skills';
import { loadSkCfg, fetchSkills, skRepoFull } from '../../lib/skills';
import { SkillGrid } from './SkillGrid';
import { ChannelSettings } from './ChannelSettings';
import { CollectModal } from './CollectModal';
import { Toast } from './Toast';

/** Skills 列表页：客户端拉取 GitHub 公开 API（D5：配置在 localStorage，无法构建期解析）。 */
export const SkillsPage = component$(() => {
  const rows = useSignal<SkillMeta[]>([]);
  const status = useSignal<SkStatus>({ kind: 'wait', msg: '加载中…' });
  const toast = useSignal('');
  const cfg = useSignal<SkCfg | null>(null);
  const showCfg = useSignal(false);
  const showCollect = useSignal(false);

  const reload = $(async () => {
    const c = loadSkCfg();
    cfg.value = c;
    const full = skRepoFull(c);
    if (!full) {
      status.value = {
        kind: 'wait',
        msg: '未配置仓库 · 点击右上角「通道设置」填写 skill-collection 仓库地址（读取需公开仓库）',
      };
      rows.value = [];
      return;
    }
    status.value = { kind: 'wait', msg: '正在读取 ' + full + ' …' };
    rows.value = [];
    try {
      const res = await fetchSkills(c);
      rows.value = res.rows;
      if (!res.rows.length) {
        status.value = { kind: 'wait', msg: '空仓库 · 待初始化 · 点击「收藏 Skill」收藏第一个' };
      } else {
        status.value = {
          kind: 'ok',
          msg: full + ' · ' + res.rows.length + ' 个技能（' + res.branch + ' 分支，按最近提交排序）',
        };
      }
    } catch (e: any) {
      status.value = { kind: 'err', msg: '加载失败：' + (e?.message || e) };
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    reload();
  });

  return (
    <section class="sk-page">
      <div class="sk-head">
        <div>
          <h1 class="sk-title">Skills</h1>
          <div class="sk-status">
            <span class={'dot ' + status.value.kind}></span>
            <span>{status.value.msg}</span>
          </div>
        </div>
        <div class="sk-actions">
          <button class="btn" onClick$={() => (showCollect.value = true)}>
            收藏 Skill
          </button>
          <button class="btn" onClick$={() => (showCfg.value = true)}>
            通道设置
          </button>
        </div>
      </div>

      <SkillGrid rows={rows.value} toast={toast} />

      {showCfg.value && (
        <ChannelSettings
          cfg={cfg.value}
          toast={toast}
          onClose$={() => (showCfg.value = false)}
          onSaved$={() => {
            showCfg.value = false;
            reload();
          }}
        />
      )}
      {showCollect.value && (
        <CollectModal
          toast={toast}
          onClose$={() => (showCollect.value = false)}
          onDone$={() => {
            showCollect.value = false;
            reload();
          }}
        />
      )}
      <Toast msg={toast} />
    </section>
  );
});
