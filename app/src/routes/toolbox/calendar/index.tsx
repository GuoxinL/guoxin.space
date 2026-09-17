import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

import { ToolboxTabs } from '../../../components/layout/ToolboxTabs';
import { CalendarPanel } from '../../../components/calendar/CalendarPanel';

export default component$(() => {
  return (
    <>
      <ToolboxTabs />
      <CalendarPanel />
    </>
  );
});

export const head: DocumentHead = {
  title: 'Calendar — guoxin.space',
  meta: [
    {
      name: 'description',
      content:
        '在线日历：农历、法定节假日与调休、二十四节气。纯前端本地计算，无数据上传。',
    },
  ],
};
