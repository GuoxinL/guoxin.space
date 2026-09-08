import { readJSON, writeJSON } from '../storage';
import type { HistoryItem, Side } from '../../types/json';

/** 与旧站保持一致的 localStorage key，保证迁移后历史与草稿不丢 */
export const KEY_DRAFT_L = 'wb_home_json_draft';
export const KEY_DRAFT_R = 'wb_home_json_draft_r';
export const KEY_HIST = 'wb_home_json_history';

const MAX_ITEMS = 10;

export const draftKey = (side: Side): string => (side === 'R' ? KEY_DRAFT_R : KEY_DRAFT_L);

export function loadHistory(): HistoryItem[] {
  const list = readJSON<HistoryItem[]>(KEY_HIST, []);
  return Array.isArray(list) ? list : [];
}

/** 记录一次操作前的原文；与最近一条重复或空白则不记，最多保留 10 条 */
export function pushHistory(text: string): HistoryItem[] {
  if (!text || !text.trim()) return loadHistory();
  const list = loadHistory();
  if (list[0] && list[0].text === text) return list;

  const next = [{ t: Date.now(), text }, ...list];
  if (next.length > MAX_ITEMS) next.length = MAX_ITEMS;
  writeJSON(KEY_HIST, next);
  return next;
}

export function deleteHistory(idx: number): HistoryItem[] {
  const list = loadHistory();
  list.splice(idx, 1);
  writeJSON(KEY_HIST, list);
  return list;
}

export function clearHistory(): HistoryItem[] {
  writeJSON(KEY_HIST, []);
  return [];
}
