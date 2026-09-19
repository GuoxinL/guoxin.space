# 01. Clarify — Base 家族工具落地 + Toolbox 页头重排

## 背景
- Toolbox 现有 5 个小工具页（`/toolbox/{base64,url,timestamp,jwt,csv}`）+ JSON / 日历，共 7 个入口。
- Base64 当前只是 Base 家族的一个子集；用户希望统一为 Base 家族在线工具。
- JSON 页（`JsonWorkbench`）内嵌了 "Toolbox / Small tools for everyday bytes." 区块标题，位于子导航**下方**；用户要将其提到子导航**上方**，并在原位改为"介绍当前工具"。
- 5 个小工具页共用 `SmallToolPanel`，内含冗余内层导航 `tools-tabs`（与外层 `ToolboxTabs` 重复）与通用 `tools-panel-head`（"小工具" + 通用 slogan）。用户要移除"小工具"概念。

## 目标
1. Toolbox 区块标题共享到所有 toolbox 页，置于子导航上方。
2. 删除 `tools-panel-head` 与 `tools-tabs`；每个工具在内容区顶部有自身简介。
3. 落地 Base 家族统一工具（6 种编解码，单页双框 + 功能按钮）。

## 范围
- 入：A. Toolbox 页头重排（JsonWorkbench + ToolboxTabs）；B. 删除内层 head/tabs + 补各工具简介；C. Base 家族落地。
- 出：不改路由 slug（`/toolbox/base64` 保留）、不新增第三方依赖、不改后端 / Worker。

## 待确认问题（已通过 AskUserQuestion 确认，2026-09-19）
1. 标题作用范围 → **共享到所有 toolbox 页**（推荐）。
2. Base 路由 → **保持 `/toolbox/base64`，标签改 "Base"**（推荐）。
3. Codec 集 → **demo 的 6 个**：Base16(Hex) / Base32 / Base58 / Base64 / Base64URL / Base85（推荐）。
4. 其余 4 个小工具简介 → **补简介，统一**（推荐）。
