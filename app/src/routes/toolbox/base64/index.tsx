import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { ToolboxTabs } from "../../../components/layout/ToolboxTabs";
import { BasePanel } from "../../../components/json/BasePanel";

export default component$(() => (
  <>
    <ToolboxTabs />
    <BasePanel />
  </>
));

export const head: DocumentHead = {
  title: "Base 编解码 — Toolbox",
  meta: [
    {
      name: "description",
      content:
        "Base 编解码在线工具：Base16(Hex) / Base32 / Base58 / Base64 / Base64URL / Base85，纯前端本地处理，数据不上传。",
    },
  ],
};
