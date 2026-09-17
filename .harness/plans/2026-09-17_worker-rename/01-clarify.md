# 01 · 需求澄清

## 用户诉求
「我想 guoxin.space 整体从新配一遍，`skillboard-collect` 改为 `guoxin.space`，让命名不再有歧义。」

## 问题拆解
- 歧义点：站点域名是 `guoxin.space`，但 Worker 脚本名 / 默认域名却是 `skillboard-collect.lgx31.workers.dev`，二者命名体系不一致。
- 目标：Worker 侧命名统一到 `guoxin.space` 体系 → 脚本名 `guoxin-space`、对外域名 `api.guoxin.space`。

## 方案对比（已向用户以人话呈现）
| 方案 | 做法 | 代价 |
|---|---|---|
| A | 仅给旧 Worker `skillboard-collect` 加自定义域 `api.guoxin.space`，不改脚本名 | 零中断，但 Cloudflare 里脚本名仍是 `skillboard-collect`，歧义未除 |
| **B（用户选）** | 新建/改名脚本为 `guoxin-space` + 自定义域 `api.guoxin.space` + 代码侧同步 | 彻底消除歧义；需 Dashboard 操作与代码同步 |

## 用户后续操作
用户在 Cloudflare Dashboard **把原脚本就地改名为 `guoxin-space`** → 变量与密钥自动保留（无需复制），但旧默认域名 `skillboard-collect.lgx31.workers.dev` 失效。

## 结论
按方案 B 执行；因旧域名已失效、生产已中断，直接切换到目标规范域 `api.guoxin.space`。
