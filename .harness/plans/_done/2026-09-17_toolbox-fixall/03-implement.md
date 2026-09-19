# 03 Implement — 实现记录

## #24 JSON 真实缺陷
- `lib/json/repair.ts`：`repairJson(raw, lang, indent)` 非 json/json5 分支走 `parseByLang` + `dumpByLang` 归一化；`JsonWorkbench.tsx` 调用补传 `lang`。
- `lib/json/jsonpath.ts`：`jpFindRanges` 增 `wordBoundary`（标识符 `[A-Za-z0-9_]` 两侧不匹配），`queryJsonPath` 对非 json/json5 设 `wordBoundary`，消除 YAML/TOML 裸键 `mytype`/`types` 误命中。

## #25 JSON P2-a
- 历史「清空」按钮接 `clearHistory`；导入 `importFile` 覆盖前 `window.confirm`；textarea `Ctrl/Cmd+Enter` → 格式化；`global.css` 增 `.modal-head-actions`。

## #26 JSON P2-b
- `lib/json/share.ts`：`encodeShare`/`decodeShare`（Unicode 安全 base64 + TextEncoder/TextDecoder，解码失败返回 null 不抛）。
- `JsonWorkbench.tsx`：挂载解码 `location.hash` 覆盖草稿；树过滤 `filter` prop + `.jt-match` 高亮；「提取」写对侧、「分享」写地址栏并复制。

## #27 JSON P2-c
- `lib/json/schema.ts`：`inferSchema` 递归推断 JSON Schema（对象属性并集 / 数组元素合并 / 混合退化为 any）。
- `lib/json/smalltools.ts`：Base64 / URL / 时间戳↔日期 / JWT 解码 / CSV↔JSON，全部纯函数返回 `{ok}`。
- `lib/json/structdiff.ts`：`diffStructure` 按 key-path 递归比较（新增/删除/变更，2000 上限截断）。
- `JsonWorkbench.tsx`：新增「Schema」「结构」「小工具」按钮 + `StructDiffView` + `SmallTools` 弹窗 + 大文件 gutter 窗口化。

## #28 日历 P2
- `lib/calendar/holidays.ts`：增 `nextHoliday(from)`（距今日最近法定假，仅已维护年份）。
- `CalendarPanel.tsx`：月/年视图切换（`viewMode`）；「距下一假期 N 天」提示条；跨月补白格可点击跳月（`cal-link`）；调休/放假 tooltip 明确语义；年视图 12 紧凑月格总览。

## #29 测试缺口
- `e2e/toolbox-json.spec.ts`：2 → 10 例（语言互转 / 修复传 lang / JSONPath 高亮 / 历史 / 分享 / 提取 / 小工具 / 结构对比）。
- 新增纯函数单测：`schema.test.ts` / `smalltools.test.ts` / `structdiff.test.ts` / `calendar.test.ts`（`nextHoliday` +5 例）。
