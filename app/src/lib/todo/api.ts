/** TODO 前端数据访问层：封装 Worker `/api/todo/*`，统一鉴权头与错误解析。
 *  仅登录态（isAdmin + 已配 Worker URL）可调用；非登录抛错，由页面门禁拦截。 */

import { authWorkerUrl, getAuthToken, isAdmin } from "../auth";
import type { Tag, Todo, TodoIndexEntry } from "./types";

const ERR_UNAUTH = "未登录 GitHub（仅站长本人可用 TODO）";

/** 当前是否已具备访问 TODO 的登录态（admin + Worker 已配）。 */
export function isTodoAuthed(): boolean {
  return isAdmin() && !!authWorkerUrl();
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
  const base = authWorkerUrl();
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
  const base = authWorkerUrl();
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
  // L2：并发冲突单独归类，便于页面区分「可刷新重试」与「真错误」。
  // 注意**不丢弃任何编辑** —— 内容仍安全保留在本地暂存区（L1）。
  if (res.status === 409) {
    let head: string | null = null;
    let msg = "";
    try {
      const j = (await res.json()) as { error?: string; head_sha?: string };
      msg = (j && j.error) || "";
      head = (j && j.head_sha) || null;
    } catch {
      /* 响应体非 JSON */
    }
    throw new SaveConflictError(msg || "数据已在别处更新，请重新加载后再保存", head);
  }
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

/** `fetchAll` 的返回结构。
 *
 *  `partial` 是**读取完整性闸门（L5）的核心**：Worker 侧逐文件记账，
 *  任何一个日文件读不出来就置`partial: true` 并把文件名列入 `missing`。
 *  此时 `todos` 是**残缺快照** —— 页面必须进入只读模式禁止写盘，
 *  否则用残缺快照做全量覆盖写会把「读不到的日期」当成「已删空」而真删
 *  （2026-10-09 事故机制）。 */
export interface FetchAllResult {
  todos: Todo[];
  partial: boolean;
  missing: string[];
  /** L2 CAS 基准：读取时分支的 head commit sha，写入时原样回传。
   *  null/undefined 表示 Worker 未提供（旧 Worker）→ 跳过校验，保持原行为。 */
  headSha: string | null;
}

export async function fetchAll(): Promise<FetchAllResult> {
  const j = await todoGet<{
    ok: boolean;
    todos: Todo[];
    partial?: boolean;
    missing?: string[];
    head_sha?: string | null;
  }>("/api/todo/all");
  return {
    todos: j.todos || [],
    partial: !!j.partial,
    missing: j.missing || [],
    headSha: j.head_sha || null,
  };
}

/** 保存失败分类：区分「并发冲突（可提示刷新重试）」与「其他错误」。 */
export class SaveConflictError extends Error {
  readonly headSha: string | null;
  constructor(msg: string, headSha: string | null) {
    super(msg);
    this.name = "SaveConflictError";
    this.headSha = headSha;
  }
}

/** 判断错误是否为并发冲突（Worker 409 / code=stale_head）。 */
export function isConflict(e: unknown): boolean {
  return e instanceof SaveConflictError;
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
  /** L2 CAS 基准：读取时的分支 head sha。传 null/空则跳过校验（兼容旧 Worker）。 */
  headSha?: string | null,
): Promise<string | null> {
  const body: Record<string, unknown> = { day, todos, message };
  if (headSha) body.head_sha = headSha;
  const j = await todoPost<{ ok: boolean; head_sha?: string | null }>("/api/todo/save", body);
  // 返回写入后的新 head：调用方必须推进 CAS 基线（否则下一次保存自撞 409）。
  // 旧 Worker 无此字段 → null，基线保持不变（向后兼容）。
  return j.head_sha || null;
}

export async function saveTags(tags: Tag[], message?: string): Promise<string | null> {
  const j = await todoPost<{ ok: boolean; head_sha?: string | null }>("/api/todo/tags", { tags, message });
  return j.head_sha || null;
}
