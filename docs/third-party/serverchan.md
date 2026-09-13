# Server酱 接入操作步骤（CI 失败微信推送）

> 用途：两个仓库的 CI 失败时推送微信通知——`guoxin.space` 的部署失败（`deploy.yml` notify job）与 `running-private` 的同步失败（`xingzhe_sync.yml` notify job）。
> 接入日期：2026-09-13 | 通道已实测（`error:SUCCESS`）。

---

## 一、准备

1. 微信扫码登录 [sct.ftqq.com](https://sct.ftqq.com)，首页即显示 **SendKey**（`SCT` 开头）。
2. 微信**关注「方糖」服务号**——推送通道就是这个服务号，不关注收不到消息。
3. 免费额度 **5 条/天**：只在失败时发通知，正常够用；连续失败一整天会被截流（第 6 条起不发），介意可赞助提额。

## 二、配置 Secret（两个仓库各一份）

Secret 名统一 `SERVERCHAN_SENDKEY`，两种方式任选：

```bash
# 方式 A：gh CLI（推荐；注意本机 WorkBuddy 终端可能注入失效的 GH_TOKEN，见排障 §五）
gh secret set SERVERCHAN_SENDKEY --repo GuoxinL/guoxin.space
gh secret set SERVERCHAN_SENDKEY --repo GuoxinL/running-private
# 回车后粘贴 SendKey；或 --body "$SERVERCHAN_SENDKEY" 从变量传值
```

方式 B：网页——各仓库 `Settings → Secrets and variables → Actions → New repository secret`，Name 填 `SERVERCHAN_SENDKEY`。

复核（两边都应列出该条目）：

```bash
gh secret list --repo GuoxinL/guoxin.space
gh secret list --repo GuoxinL/running-private
```

## 三、验证

```bash
# 本地直测通道（微信应收到测试消息）
curl -sS "https://sctapi.ftqq.com/<SendKey>.send" \
  --data-urlencode "title=Server酱通道测试" \
  --data-urlencode "desp=通道 OK"
# 返回 {"code":0,...,"error":"SUCCESS"} 即通

# CI 侧为「失败才触发」：成功运行不发通知（notify job 显示 skipped 是预期）
# 真实失败路径验证：任一仓库制造一次失败 run，微信收到「部署失败/行者同步失败」即全链路通
```

## 四、通知落在哪（涉及文件）

| 仓库 | 文件 | 触发条件 | 内容 |
|---|---|---|---|
| guoxin.space | `.github/workflows/deploy.yml` → `notify` job | `needs: [build, deploy]` 且 `if: failure()` | 部署失败 + 分支 + 提交信息 + run 链接 |
| running-private | `.github/workflows/xingzhe_sync.yml` → `notify` job | `needs: [sync]` 且 `if: failure()` | 同步失败 + run 链接 |

## 五、排障

| 现象 | 原因 | 解决 |
|---|---|---|
| `gh secret set/list` 报 `HTTP 401: Bad credentials` | 终端环境变量 `GH_TOKEN`（失效旧 PAT）**覆盖**了 keyring 的有效登录——本机 WorkBuddy 会向其终端注入 | `unset GH_TOKEN` 后重试；或单条命令前缀 `env -u GH_TOKEN`。`gh auth login` 无效（环境变量优先级最高） |
| CI 通知步骤 401/无推送 | Secret 未配置或名字不一致 | `gh secret list` 复核名字精确为 `SERVERCHAN_SENDKEY` |
| Worker 审计（收藏/删除）不推送，页面上传成功 | `SERVERCHAN_SENDKEY` 只配了 GitHub Actions，**没配 Cloudflare Worker 侧**——两边是独立的保险柜 | Cloudflare dashboard → skillboard-collect → Settings → Variables and Secrets 补配同名 Secret；或 `npx wrangler secret put SERVERCHAN_SENDKEY --name skillboard-collect` |
| 所有路径都不推送（连手动 curl 都失败） | sctapi 侧问题：免费额度 5 条/天 用尽、SendKey 重置后未同步、未关注「方糖」服务号 | 先用 §三 的 curl 自验；额度用尽等次日或赞助提额 |
| 微信收不到但 API 返回 SUCCESS | 未关注「方糖」服务号 | 关注后重试 |
| 失败但一天只收到前 5 条 | 免费额度 5 条/天 | 属预期截流；需要更多则赞助提额 |
| Key 疑似泄露 | SendKey 只能被用来给你发推送，风险低 | sct.ftqq.com 重置 SendKey → 重跑 §二 更新两个仓库 Secret |

## 六、轮换 / 撤销

- **重置 SendKey**：sct.ftqq.com 后台重置 → 重复 §二 覆盖两个仓库的 Secret 即可，workflow 无需改动。
- **停用通知**：删除两个仓库的 `SERVERCHAN_SENDKEY` Secret（notify job 会因取不到 Key 而失败——如需彻底停用，连同两个 workflow 的 `notify` job 一起删除）。
