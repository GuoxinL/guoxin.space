# 08 · 复盘

## 结论
方案 B 落地：脚本名 `guoxin-space` + 自定义域 `api.guoxin.space`，代码/配置/文档全量同步，命名歧义消除。

## 关键教训（可复用）
1. **Cloudflare「就地重命名」会改变 `*.workers.dev` 子域**：脚本名是 workers.dev 子域的前缀，改名后旧 URL 立即 404。若站点仍指向旧 URL，会**静默中断**。→ 改名前应先确认站点默认域名，或改后立刻同步代码默认域名。
2. **就地重命名保留变量/密钥**：比「新建脚本 + 复制变量」省事得多，是个人项目的优选迁移路径。
3. **`deploy.yml` 无 `[skip ci]` 跳过条件**：本仓 push main 一律重建站点；「[skip ci] 只构建不发布」的旧认知不成立。判断上线看 `deploy.yml` 的 run。
4. **自定义域不写 `wrangler.toml`**：`wrangler deploy` 不管自定义域，写在 toml 的 `[[custom_domains]]` 可能在域名未就绪时导致部署失败；Dashboard 绑定最稳。
5. **`running-private/` 是嵌套独立仓**（父仓 `.gitignore` 忽略）：其中的文档改动**不会**进父仓提交，需在该仓单独提交/推送。
6. **改 `app/src/lib` 的常量会连带测试断言失败**：`SK_DFLT_WORKER` 改动牵连 `running.test.ts`、`auth.test.ts` 两处硬编码断言——改常量必须全局搜断言。

## 遗留 / 后续
- [ ] Turn B 用户 Dashboard 操作（自定义域 + OAuth callback）。
- [ ] Turn C push 后生产 Playwright 自测 + `api.guoxin.space` 可用性确认。
- [ ] `running-private` 两个文档改动是否提交（用户决定）。
- [ ] `docs/archive/*` 保留旧名（如需彻底清亦可后续统一改）。
