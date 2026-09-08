/** Skills 模块共享类型定义 */

/** 单个技能目录的元数据（由 SKILL.md frontmatter / _collect.json / 图标探测聚合） */
export interface SkillMeta {
  /** 一级目录名（技能唯一标识，用作路由段） */
  dir: string;
  /** 展示名（frontmatter.name 或目录名） */
  name: string;
  /** 简介（frontmatter.description） */
  description: string;
  /** 收藏模式：proxy=引用代理 / mirror=镜像 / 其他或 null=原始条目 */
  mode: string | null;
  /** 来源仓库 URL（frontmatter.metadata.source 或 _collect.json.source） */
  source: string;
  /** 来源 owner（用于头像与 badge） */
  sourceOwner: string;
  /** 图标 URL（命中优先图标，否则回退 owner 头像） */
  icon: string | null;
  /** SKILL.md 原文（用于详情页直接渲染，避免二次请求） */
  skillMd: string | null;
}

/** GitHub git/trees 条目 */
export interface GitTreeEntry {
  path: string;
  type: 'blob' | 'tree';
}

/** 列表加载结果 */
export interface FetchSkillsResult {
  rows: SkillMeta[];
  tree: GitTreeEntry[];
  repo: string;
  branch: string;
}

/** 顶部状态条 */
export interface SkStatus {
  kind: 'wait' | 'ok' | 'err' | 'info';
  msg: string;
}

/** 通道配置（Skills / Running / Auth 共用 localStorage） */
export interface SkCfg {
  repo: string;
  branch: string;
  worker: string;
}
