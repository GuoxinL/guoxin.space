import { component$ } from "@builder.io/qwik";
import { ToolboxTabs } from "../layout/ToolboxTabs";
import { SmallToolPanel } from "./SmallToolPanel";

export const SmallToolPage = component$<{ tab: "url" | "ts" | "jwt" | "csv" }>(
  ({ tab }) => (
    <>
      <ToolboxTabs />
      <SmallToolPanel tab={tab} />
    </>
  ),
);
