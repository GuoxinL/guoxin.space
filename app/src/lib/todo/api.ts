/** TODO 前端数据访问层：封装 Worker `/api/todo/*`，统一鉴权头与错误解析。
 *  仅登录态（isAdmin + 已配 Worker URL）可调用；非登录抛错，由页面门禁拦截。 */

import { getWorkerUrl } from "../worker";
import { getAuthToken, isAdmin } from "../auth";
import type { Tag, Todo, TodoIndexEntry } from "./types";

const ERR_UNAUTH = "未登录 GitHub（仅站长本人可用 TODO）";

/** 当前是否已具备访问 TODO 的登录态（admin + Worker 已配）。 */
export function isTodoAuthed(): boolean {
  return isAdmin() && !!getWorkerUrl();
}

function authBearer(): string {
  const token = getAuthToken();
  if (!token) throw new Error(ERR_UNAUTH);
  return "Bearer " + token;
}

async function todoGet<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const base = getWorkerUrl();
  if (!base)
    throw new Error("未配置 Worker 地址（请在「通道设置」中填写 Worker URL）");
  const url = new URL(base + path);
  if (params) {
    for (const [k, v] of Object.entries(params))
      url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: authBearer() },
  });
  if (res.status === 401) throw new Error(ERR_UNAUTH);
  if (!res.ok) throw new Error(await errMessage(res));
  return (await res.json()) as T;
}

async function todoPost<T>(path: string, body: unknown): Promise<T> {
  const base = getWorkerUrl();
  if (!base)
    throw new Error("未配置 Worker 地址（请在「通道设置」中填写 Worker URL）");
  const res = await fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authBearer(),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error(ERR_UNAUTH);
  if (!res.ok) throw new Error(await errMessage(res));
  return (await res.json()) as T;
}

async function errMessage(res: Response): Promise<string> {
  let msg = "请求失败（HTTP " + res.status + "）";
  try {
    const j = (await res.json()) as { error?: string };
    if (j && j.error) msg = j.error;
  } catch {
    /* 响应体非 JSON，保留默认信息 */
  }
  return msg;
}

export async function fetchAll(): Promise<Todo[]> {
  const j = await todoGet<{ ok: boolean; todos: Todo[] }>("/api/todo/all");
  return j.todos || [];
}

export async function fetchMonth(
  y: number,
  m: number,
): Promise<TodoIndexEntry[]> {
  const j = await todoGet<{ ok: boolean; index: TodoIndexEntry[] }>(
    "/api/todo/month",
    { y, m },
  );
  return j.index || [];
}

export async function fetchTags(): Promise<Tag[]> {
  const j = await todoGet<{ ok: boolean; tags: Tag[] }>("/api/todo/tags");
  return j.tags || [];
}

export async function saveDay(
  day: string,
  todos: Todo[],
  message?: string,
): Promise<void> {
  await todoPost<{ ok: boolean }>("/api/todo/save", { day, todos, message });
}

export async function saveTags(tags: Tag[], message?: string): Promise<void> {
  await todoPost<{ ok: boolean }>("/api/todo/tags", { tags, message });
}
