/** TODO 模块数据模型（与需求文档 v2.0 对齐）。
 *  存储按 createdAt 日期归档为 YYYY-MM-DD.json（日文件），每月一份 index/YYYY-MM.json 索引摘要。
 *  时间一律本地时间 ISO 8601（createdAt/updatedAt/lastOperatedAt/completedAt/子任务 updatedAt）；
 *  日期字段（startDate/endDate）为 YYYY-MM-DD 字符串。 */

/** 子任务进度五档（滑块）。运行时以 number 承载，写入前用 clampProgress 收敛。 */
export type SubProgress = 0 | 25 | 50 | 75 | 100;

export interface Subtask {
  id: string;
  title: string;
  /** 权重：正整数，默认 1；非法值按 1 处理。 */
  weight: number;
  /** 进度五档。 */
  progress: SubProgress;
  /** 最后更新时间（本地时间 ISO 8601）。 */
  updatedAt: string;
}

export interface Todo {
  id: string;
  title: string;
  /** 标签 id 数组（引用 tags.json）。 */
  tags: string[];
  /** 任务开始日期 YYYY-MM-DD。 */
  startDate: string;
  /** 任务结束日期 YYYY-MM-DD；null 表示单日任务。 */
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  /** 最后操作时间（本地时间，用于排序）。 */
  lastOperatedAt: string;
  /** 完成时间；null 表示未完成。进度达 100% 自动填充。 */
  completedAt: string | null;
  subtasks: Subtask[];
}

export interface Tag {
  id: string;
  name: string;
}

/** 月索引摘要条目（日历只读这些字段，不存 subtasks）。 */
export interface TodoIndexEntry {
  id: string;
  title: string;
  tags: string[];
  startDate: string;
  endDate: string | null;
  progress: number;
  completedAt: string | null;
}

/** 进度筛选档位：未开始(0%) / 进行中(0<p<100) / 已完成(100%) / 全部。 */
export type ProgressFilter = "all" | "todo" | "doing" | "done";

/** 排序键：最近操作 / 进度升 / 进度降 / 创建时间降。 */
export type SortKey = "recent" | "progress-asc" | "progress-desc" | "created";
