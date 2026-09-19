# 02 Plan — Toolbox 全量修复

## 范围（用户「SOP 修复全部」）

| 区 | 内容 | 落地任务 |
|----|------|----------|
| A 真实缺陷 | ① 修复未传 lang ② JSONPath 子串误命中 | #24 ✅ |
| B JSON P2 | 清空历史 / 导入保护 / 快捷键（a）· 树搜索 / 分享 / 提取（b）· Schema 推断 / 小工具 / 语义 diff / 大文件限流（c） | #25 ✅ #26 ✅ #27 ✅ |
| C 日历 P2 | 下一假期倒计时 / 跨月格可点 / 年视图 / 调休标注 | #28 ✅ |
| D 测试缺口 | toolbox-json e2e 扩到 10 例 + 新纯函数单测 | #29 ✅ |

## 关键决策

- **不引入新 npm 依赖**：Schema 推断 / Base64 / URL / 时间戳 / JWT / CSV 全部浏览器内置 API + 自写纯函数（无成熟零依赖库，符合「不造轮子」务实取舍）。
- **结构对比**为两侧均合法 JSON 时的替代视图（左栏统一渲染，避免双栏重复）。
- **大文件限流**：行数 > 5000 时 gutter 改为窗口化渲染（仅绘可视区）、JSONPath 高亮层不渲染，避免主线程卡顿。
- **诚实原则**：下一假期仅在「已维护年份」内查找，无未来数据则返回 null（不臆造 2027）。

## 门禁（CONSTRAINTS）

- C-05/C-06 构建（Node ≥24 + `CODEBUDDY_SAFE_DELETE_ENABLED=0`）
- C-08 `npm run <script>` 兜底（无全局 pnpm）
- C-10 改 `lib/` 必跑 `npm run test`
- C-11 改页面/CSS 必跑 `npm run test:e2e`（先 build）
- C-23 改 CSS 用 `getComputedStyle` 在 hover/focus 回读
- C-44 约定式 commit；C-45 ≤2 commit；C-46 直推 main；C-16 推即部署；C-19 `gh run list` 验证
