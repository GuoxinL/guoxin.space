# 01 · 需求澄清

## 用户诉求
「guoxin.space 整体从新配一遍，`skillboard-collect` 改为 `guoxin.space`，让命名不再有歧义。」

## 问题本质
站点域名 `guoxin.space` 与 Worker 脚本名 / 默认域名 `skillboard-collect.lgx31.workers.dev` 命名体系不一致。

## 澄清结论
- **达成目标的关键 = 改脚本名**：脚本 `skillboard-collect` → `guoxin-space` 后，默认域自动变为 `guoxin-space.lgx31.workers.dev`，全站不再出现 `skillboard-collect`。
- **自定义域 `api.guoxin.space` 属可选增强**（更短的名字），**非必需**。用户最终拍板：不绑自定义域，直接用默认域。
- 用户已在 Dashboard 就地改名（变量/密钥保留），旧默认域名随之失效 → 生产 Worker 功能一度中断，需同步站点默认域名恢复。
