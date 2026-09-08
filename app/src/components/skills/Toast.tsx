import { component$, useVisibleTask$, type Signal } from '@builder.io/qwik';

/** 轻量 toast：由页面持有的 signal 驱动，1.8s 自动消失。 */
export const Toast = component$<{ msg: Signal<string> }>(({ msg }) => {
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const m = track(() => msg.value);
    if (!m) return;
    const t = setTimeout(() => {
      msg.value = '';
    }, 1800);
    return () => clearTimeout(t);
  });
  if (!msg.value) return null;
  return <div class="sk-toast">{msg.value}</div>;
});
