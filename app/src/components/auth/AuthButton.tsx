import { component$, useStore, useVisibleTask$ } from '@builder.io/qwik';
import {
  authInit,
  authLogin,
  authLogout,
  authSubscribe,
  getAuthState,
} from '../../lib/auth';

/* GitHub 标识（登录态图标），fill=currentColor 随主题文字色 */
const GH_IC = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="h-4 w-4">
    <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.21 11.19.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.58-4.04-1.58-.55-1.38-1.34-1.75-1.34-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.81 2.81 1.29 3.5.99.11-.77.42-1.29.76-1.59-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.17-.13-.3-.54-1.52.12-3.17 0 0 1-.32 3.3 1.21.96-.27 1.98-.4 3-.41 1.02 0 2.04.14 3 .41 2.29-1.53 3.29-1.21 3.29-1.21.66 1.65.25 2.87.12 3.17.77.83 1.23 1.88 1.23 3.17 0 4.53-2.81 5.52-5.49 5.81.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.28 0 .32.21.7.82.58A12.03 12.03 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" />
  </svg>
);

/* 退出图标（已登录态） */
const EXIT_IC = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="h-4 w-4"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export const AuthButton = component$(() => {
  const st = useStore({ login: '', isAdmin: false });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    // 确保回调 token 已被消费（幂等；layout 已先跑过也无妨）
    authInit();
    const sync = () => {
      const s = getAuthState();
      st.login = s.login;
      st.isAdmin = s.isAdmin;
    };
    const unsub = authSubscribe(sync);
    cleanup(unsub);
    sync();
  });

  const cls =
    'ml-1 flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--hover)] ' +
    (st.isAdmin ? 'text-[var(--accent)]' : '');

  return (
    <button
      type="button"
      class={cls}
      title={st.isAdmin ? '已登录 GitHub · 点击退出' : '登录 GitHub（站长功能）'}
      onClick$={() => (st.isAdmin ? authLogout() : authLogin())}
    >
      <span class="auth-ic">{st.isAdmin ? EXIT_IC : GH_IC}</span>
      <span>{st.isAdmin ? st.login : '登录 GitHub'}</span>
    </button>
  );
});
