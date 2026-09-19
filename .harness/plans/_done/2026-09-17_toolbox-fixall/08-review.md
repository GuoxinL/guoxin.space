# 08 Review — Code Review 收尾

## 自审清单

- [x] **A 真实缺陷已修复**：repair 传 lang（单引号 JSON 修复后变合法）；JSONPath 词边界消除 `mytype`/`types` 误命中（YAML/TOML）。
- [x] **B JSON P2 全落地**：清空历史 / 导入保护 / 快捷键 / 树搜索 / 分享 / 提取 / Schema 推断 / 小工具 / 结构对比 / 大文件限流。
- [x] **C 日历 P2 全落地**：下一假期倒计时 / 跨月格跳月 / 年视图 12 月格 / 调休 tooltip 明确。
- [x] **D 测试缺口**：toolbox-json e2e 10 例 + 新纯函数单测（schema / smalltools / structdiff / nextHoliday）。
- [x] **不引入新依赖**：全部浏览器内置 API + 自写纯函数。
- [x] **诚实原则**：2027 未维护年份不臆造节假日；`nextHoliday` 无未来数据返回 null。
- [x] **设计系统铁律**：未改 `.btn` 基类、`--container-w`、全局 pixelated；新增类复用既有 token。

## 门禁回看
- [x] C-10 单测 265 passed
- [x] C-05/C-06 build 干净（6 页 SSG + 404 fallback）
- [x] C-11 e2e 50 passed（2 环境性失败，与改动无关）
- [x] C-23 新 CSS hover/focus 态 getComputedStyle 回读全过
- [x] C-44 约定式 commit；C-45 ≤2 commit；C-46 直推 main；C-16 推即部署；C-19 gh run list 验证

## 遗留 / 已知
- Running / Notes 详情页 e2e 在沙箱浏览器因无外网失败，属环境限制，非本次改动引入；线上（有外网）不受影响。
- 语义 diff / 年视图为「增强项」，做到可用、自测通过、不破坏现有交互，未追求完备（大数组 diff 上限 2000 截断）。
