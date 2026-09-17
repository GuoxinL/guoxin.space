import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

import { TodoPage } from "../../components/todo/TodoPage";

export default component$(() => {
  return <TodoPage />;
});

export const head: DocumentHead = {
  title: "TODO — guoxin.space",
  meta: [
    {
      name: "description",
      content: "TODO 列表：子任务、标签、双层进度与周报（仅站长本人可见）。",
    },
  ],
};
