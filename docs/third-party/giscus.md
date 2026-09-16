# Giscus 接入操作步骤（Notes 文章评论）

> 用途：Notes 详情页底部评论区（N-T27）。Giscus 把 GitHub Discussions 当评论后端——访客用 GitHub 账号登录后即可在文章下留言，评论数据存在你自己的仓库里，无独立数据库。
> 代码位置：`app/src/components/notes/NotesShell.tsx` 的 `Comments` 组件（脚本注入 + 主题跟随）；配置常量 `NOTES_GISCUS` 在 `app/src/lib/notes/source.ts`；类型 `NotesGiscus` 在 `app/src/lib/notes/types.ts`。
> 现状（2026-09-16）：**已启用**——`NOTES_GISCUS` 已填入四元组（`GuoxinL/notes` / `Announcements`），详情页底部评论区注入 giscus 脚本。改四元组只需编辑 `app/src/lib/notes/source.ts` 并重新部署。
> 最后核验：2026-09-16。

---

## 零、先分清「两半配置」（最常见的误解）

评论要能跑，必须**同时**满足两半，缺一半就是「我明明开了却不好使」：

| 半边 | 在哪里做 | 做完的表现 |
| --- | --- | --- |
| ① **GitHub / Giscus 侧** | 仓库开 Discussions、装 giscus App 并授权该仓库、建一个讨论分类 | giscus.app 上能生成配置四元组 |
| ② **本站侧** | 把四元组填进 `app/src/lib/notes/source.ts` 的 `NOTES_GISCUS` 并重新部署 | 详情页底部出现 giscus iframe，可登录评论 |

**只做第 ① 半不会有任何效果**——站点读不到 `repoId` / `categoryId`，脚本根本不会注入，只会显示占位。

## 一、GitHub 侧准备（一次性，约 3 分钟）

1. **仓库设为 Public**：Giscus 依赖公开读取 Discussions。目标仓库建议用 `GuoxinL/notes`（也可另建仓库专存评论，只要公开即可）。
2. **开启 Discussions**：仓库 → Settings → 勾选 **Discussions**。
3. **安装 giscus App**：打开 https://github.com/apps/giscus → Install → **只勾选目标仓库**（最小权限原则，不要给 All repositories）。
4. **建一个讨论分类**：Discussions → Categories → New category。推荐 **Announcements**（Discussions 里内置类型，只有维护者能开贴，访客只能回帖——正好适合当评论区）；名称记下来，第 ③ 步要用。

## 二、拿到配置四元组

1. 打开 **https://giscus.app/zh-CN**。
2. 在「仓库」输入 `owner/repo`（如 `GuoxinL/notes`），页面会校验：仓库公开 + Discussions 已开 + giscus App 已安装。
3. 在「讨论分类」选上一步建的分类（如 Announcements）。
4. 页面下方生成的 `<script>` 标签里，取这 4 个属性：

   ```
   data-repo="GuoxinL/notes"
   data-repo-id="R_kgDOxxxxxx"
   data-category="Announcements"
   data-category-id="DIC_kwDOxxxxxx"
   ```

   其余属性（`data-mapping` / `data-theme` 等）本站已在代码里固定，不用管。

> 这四个 ID **不是机密**（本就会出现在公开 HTML 中），可以直接写进源码；真正的权限边界是「giscus App 只授权了指定仓库」。

## 三、配置到本仓库

编辑 `app/src/lib/notes/source.ts`，把 `NOTES_GISCUS` 从 `null` 换成四元组：

```ts
export const NOTES_GISCUS: NotesGiscus | null = {
  repo: 'GuoxinL/notes',
  repoId: 'R_kgDOxxxxxx',
  category: 'Announcements',
  categoryId: 'DIC_kwDOxxxxxx',
  mapping: 'pathname', // ⚠️ 本站必须用它，见下方红线
};
```

然后正常提交 → push main → CI 自动构建部署。

### ⚠️ 红线：`mapping` 必须是 `pathname`

本站 `/notes/<中文标题>/` 是**纯 CSR 详情页**（同一份预渲染页 + 运行时取数），`<title>` 固定为 `Notes — guoxin.space`、也没有 `og:title`：

- 用 `pathname`（默认）→ 每篇文章按 URL 路径独立成串 ✅
- 用 `title` / `og:title` → **所有文章共用一个讨论串** ❌（读到的都是同一个固定标题）

所以不要改 `mapping`；真要改，得先让详情页的 head 随文章变化（那是另一件事）。

## 四、验证

1. 本地：`npm run build && npx playwright test e2e/notes.spec.ts`（未启用时应仍是占位用例通过）。
2. 线上：push 后打开任一篇 `/notes/<标题>/`，**强刷**（giscus 与 CDN 都有缓存）：
   - 底部「评论」区块出现 giscus iframe；
   - 用 GitHub 账号登录后可留言，刷新后评论仍在；
   - 留言会同步到目标仓库 → Discussions 里生成一条以文章路径命名的讨论。
3. 后台核对：目标仓库 Discussions 中出现新帖，即链路全通。

## 五、排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 显示「评论功能需在 NotesCfg 中配置…当前站点未启用。」 | **只做了 GitHub 侧的 ①，没做本站侧的 ②**（`NOTES_GISCUS` 仍是 `null`） | 按 §三 填四元组并重新部署 |
| iframe 内提示 `giscus is not installed on this repository` / 401 | giscus App 未给该仓库授权（或装到了别的仓库） | https://github.com/apps/giscus → Configure → 勾选目标仓库 |
| iframe 内提示 `Discussion category not found` | `categoryId` 与 `category` 对不上，或分类被删/改名 | 回 giscus.app 重新生成，或到仓库 Discussions 重建分类 |
| iframe 空白、无报错 | 仓库是私有 或 Discussions 未开启 | Settings 里勾选 Discussions、仓库转 Public |
| 所有文章评论区是同一串 | `mapping` 被改成了 `title` / `og:title` | 改回 `pathname`（见 §三 红线） |
| 切换明暗后评论框主题不变 | 已修：站点现在会在 `body[data-theme]` 变化时给 iframe 发 `setConfig` | 若仍不跟随，确认部署的是最新产物（强刷） |
| 本机 curl giscus.app 超时（HTTP 000 / exit 28） | 本地网络对部分国际 CDN 不稳定，**不代表服务故障** | 以浏览器实际渲染为准 |
| 留言后别人看不到 | 文章路径变了（改标题 = 改 slug = 换 pathname）会让旧讨论串失联 | 尽量不改已发布文章的标题；真要改，去 Discussions 手动改帖标题 |

## 六、轮换 / 撤销

- **换评论仓库或分类**：改 `NOTES_GISCUS` 四元组重新部署（历史讨论留在旧仓库，不会迁移）。
- **彻底关闭**：把 `NOTES_GISCUS` 改回 `null` 并部署，详情页恢复诚实占位、脚本不再注入；Discussions 数据不受影响，需要的话再去 GitHub 卸载 giscus App 或关闭 Discussions。
- **收紧权限**：giscus App 的仓库授权随时可在 https://github.com/apps/giscus → Configure 调整；卸载 App 后评论立即失效（数据仍在 Discussions 里）。
