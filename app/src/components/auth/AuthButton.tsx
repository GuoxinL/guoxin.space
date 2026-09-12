import { component$, useStore, useVisibleTask$ } from '@builder.io/qwik';
import {
  authInit,
  authLogin,
  authLogout,
  authSubscribe,
  getAuthState,
} from '../../lib/auth';
import { PixelIcon } from '../pixel/PixelIcon';

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

  return (
    <button
      type="button"
      class="btn"
      title={st.isAdmin ? '已登录 GitHub · 点击退出' : '登录 GitHub（站长功能）'}
      onClick$={() => (st.isAdmin ? authLogout() : authLogin())}
    >
      <PixelIcon name="user" size={14} />
      <span>{st.isAdmin ? st.login : '登录 GitHub'}</span>
    </button>
  );
});
