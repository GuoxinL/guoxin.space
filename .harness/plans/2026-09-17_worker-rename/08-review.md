# 08 · 复盘

## 结论
Worker 脚本 `skillboard-collect` → `guoxin-space`，对外域 `guoxin-space.lgx31.workers.dev`，代码/配置/文档全量同步，命名歧义消除。自定义域 `api.guoxin.space` 经用户拍板**不采用**。

## 关键教训（可复用）
1. **Cloudflare「就地重命名」会改变 `*.workers.dev` 子域**：脚本名是子域前缀，改名后旧 URL 立即 404 → 若站点默认域名未同步，Worker 功能**静默中断**。改名前先确认默认域名，或改后立刻同步代码。
2. **就地重命名保留变量/密钥**：比「新建脚本 + 复制变量」省事得多，个人项目优选。
3. **CI e2e 依赖真实 Worker 可达**：`running.spec.ts` 需真实数据才渲染「年度热力图」区块；默认域指向未解析的自定义域会导致门禁失败。→ **默认域必须用可达地址**；长期建议给该用例加 Worker mock（见遗留）。
4. **`deploy.yml` 无 `[skip ci]` 跳过条件**：push main 一律重建站点，`[skip ci]` 不跳过；上线看 `deploy.yml` 的 run。
5. **自定义域不写 `wrangler.toml`**：`wrangler deploy` 不管自定义域，Dashboard 绑定最稳。
6. **`running-private/` 是嵌套独立仓**（父仓 `.gitignore` 忽略）：其中改动不进父仓提交。
7. **改 `app/src/lib` 的常量牵连多处测试断言**：`SK_DFLT_WORKER` 改动同时影响 `running.test.ts`、`auth.test.ts`——改常量必须全局搜断言。

## 遗留 / 后续
- [ ] 用户更新 GitHub OAuth App callback → `https://guoxin-space.lgx31.workers.dev/api/auth/callback`。
- [ ] 生产 Playwright 自测（/todo /skills /running）。
- [ ] 可选加固：`e2e/running.spec.ts` 增加 Worker route mock，去除对真实域名的可达性依赖。
- [ ] `running-private` 两个文档改动是否提交（用户决定）。
