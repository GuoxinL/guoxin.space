# 行者 OpenAPI 接入操作步骤（Running 数据源）

> 用途：骑行/跑步原始数据上游。数据生产在 **running-private 私有仓库**（本仓库不参与），其 `xingzhe_sync.yml` 每小时整点（UTC）从行者 OpenAPI 同步，产出 4 个轨迹产物提交到该仓 master，经 Cloudflare Worker 白名单代理给前端。
> 本仓库角色：只读消费（经 Worker）。改同步链路一律去 running-private 仓库（红线 10）。
> 最后核验：2026-09-13。

---

## 一、凭据结构

行者凭据是一个 JSON 字符串，含 **4 个必填字段**，配置在 running-private 的 Secret `XINGZHE_CREDENTIALS_JSON`：

```json
{
  "client_id": "行者应用 ID",
  "client_secret": "行者应用秘钥",
  "access_token": "OAuth2 授权令牌（Bearer）",
  "refresh_token": "刷新令牌（可换新 access_token）"
}
```

## 二、从零接入（概览）

完整图文步骤在 **running-private 仓库 `docs/GET-XINGZHE-CREDENTIALS.md`**（私有仓，维护者可读），流程：

1. 注册行者账号（imxingzhe.com）；
2. 行者开放平台**创建应用**，获取 `client_id` / `client_secret`；
3. 走 OAuth2 授权流程，获取 `access_token` / `refresh_token`；
4. 组装 4 字段 JSON，配置到 running-private 的 `Settings → Secrets → XINGZHE_CREDENTIALS_JSON`。

## 三、token 轮换机制（重要）

- 行者 `refresh_token` **每次刷新都会轮换，旧值立即失效**——凭据是「易腐」的。
- 同步 workflow 检测到 token 被刷新后：
  - 配置了 Secret `XINGZHE_PAT`（细粒度 PAT，授权 running-private）→ **自动回写** `XINGZHE_CREDENTIALS_JSON`，无需人工干预（推荐配置）；
  - 未配置 → workflow 日志出现 `::warning::` 并打印新凭据，需**手动**更新 Secret。
- 同步失败（含凭证失效、限流）→ Server酱微信推送（见 [serverchan.md](./serverchan.md)）。

## 四、日常运维

| 场景 | 操作 |
|---|---|
| 手动触发一次同步 | running-private → Actions → Xingzhe Sync → Run workflow（支持 `workflow_dispatch`） |
| 同步失败收到通知 | 点通知里的 run 链接看日志：凭证类错误 → 重新走 §二 更新 `XINGZHE_CREDENTIALS_JSON`；限流 → 等下一轮 |
| 更换/重置凭据 | 更新 Secret `XINGZHE_CREDENTIALS_JSON` 的 JSON 内容即可，workflow 无需改动 |
| 数据新鲜度 | 产物提交记录即同步历史（`chore: xingzhe sync update`）；页面侧暂无新鲜度角标（relationship.md TODO） |

## 五、排障

| 现象 | 原因 | 解决 |
|---|---|---|
| 通知「行者同步失败」 | 凭证失效 / 限流 / 脚本异常 | 看 run 日志定位；凭证失效走 §二.4 手动更新（或配 `XINGZHE_PAT` 免维护） |
| 轨迹数据陈旧但无通知 | 同步成功但数据源本身无新活动 | 属正常；数据新鲜度以 running-private 提交时间为准 |
| 产物嵌套目录（`thumb/thumb/`） | 历史坑：复制产物必须先删后拷 | 已在 workflow 固化为 `rm -rf` + `cp -r`（详见 DEPLOY-WORKER 迁移注记） |
