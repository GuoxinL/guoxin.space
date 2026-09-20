import { component$ } from "@builder.io/qwik";
import { ToolboxTabs } from "../layout/ToolboxTabs";
import { SmallToolPanel } from "./SmallToolPanel";

export const SmallToolPage = component$<{ tab: "url" | "jwt" | "csv" }>(
  ({ tab }) => (
    <>
      <ToolboxTabs />
      <SmallToolPanel tab={tab} />
    </>
  ),
);
