import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { ToolboxTabs } from "../../../components/layout/ToolboxTabs";
import { TimestampTool } from "../../../components/timestamp/TimestampTool";

export default component$(() => (
  <>
    <ToolboxTabs />
    <TimestampTool />
  </>
));

export const head: DocumentHead = {
  title: "时间戳 — Toolbox",
  meta: [
    {
      name: "description",
      content:
        "开发者向时间戳工具：自动识别秒/毫秒/微秒/纳秒，多格式同屏输出，支持时区切换、相对时间、时段边界与区间生成。",
    },
  ],
};
