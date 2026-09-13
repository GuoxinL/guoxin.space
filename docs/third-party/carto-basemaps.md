# CARTO Basemaps 接入操作步骤（Running 地图瓦片源）

> 用途：Running 页轨迹地图 / 轨迹回放的底图瓦片（三档样式：浅色 light / 明亮 voyager / 暗色 dark）。
> 现状：2026-09 起 CARTO 对无 key 请求返回「API KEY REQUIRED」错误图（水印形式，不硬断服务）。
> 代码位置：`app/src/lib/running.ts` 的 `RK_STYLES`（URL 模板）与 `tileUrl()`（{z}/{y}/{x} 占位替换 + abcd 子域轮换）。
> 最后核验：2026-09-13（官方申请页与 FAQ）。

---

## 一、申请 API Key（免账号，约 1 分钟）

1. 打开官方申请页：**https://carto.com/basemaps/apikey/**
2. 表单填写：**邮箱**、身份（个人/公司）、大致用途说明（如 "Personal homepage map tiles, non-commercial"）。
3. （可选收紧）把 key 限制到特定网站 / 移动应用 / 服务器 IP——后续可随时修改。
4. **Continue to summary → 提交**。**无需审核排队、无需 CARTO 账号、无需信用卡**，key 立即发送到邮箱。

## 二、免费额度与条款

| 项 | 内容 |
|---|---|
| 免费额度 | **500 万次瓦片请求 / 月**（日历月计，raster+vector 合并；个人站用量可忽略） |
| 超额 | 不会直接切断——官方会主动联系协商 |
| 适用 | 个人项目 / 研究 / 教学 / 非营利直接免费；商业项目同样可领 key，超额后或需转商业协议 |
| 署名条款 | 地图上**必须保留 CARTO 与 OpenStreetMap 署名**（免费额度的交换条件） |
| key 专属 | 不得共享、不得跨项目复用 |

## 三、key 的使用方式（URL 参数）

```
https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=YOUR_KEY
```

- key 同时适用于 raster（PNG）与 vector 服务；
- raster 先行强制，vector 随后跟进；同一 key 两者通用；
- 支持到 **z20**（Leaflet 官方示例 maxZoom: 20）；
- 若配置后仍见「API KEY REQUIRED」水印：浏览器与 CARTO 的 CDN 都缓存了旧瓦片，**强制刷新**即可。

## 四、配置到本仓库

1. 拿到 key 后，修改 `app/src/lib/running.ts` 的 `RK_STYLES` 三条 URL，末尾追加 `?key=<KEY>`；
2. 若此前切过 Esri（2026-09-13 曾临时切换），一并删除 Esri 注释恢复 CARTO 原三档；
3. 地图/回放角落补一行 attribution（CARTO · OpenStreetMap）以满足署名条款；
4. push main → CI 自动部署 → 强刷 Running 页验证（无水印、瓦片正常）。

## 五、轮换 / 撤销

- **疑似泄露**：申请页同邮箱登录可 Roll（旧值立即失效）/ Delete；轮换后更新 `RK_STYLES` 三条 URL 即可（key 在前端 URL 中，本就属于公开性质凭据，靠额度与域名限制保护）。
- **限制修改**（换绑域名/IP）：申请页同邮箱登录即可改。

## 六、排障

| 现象 | 原因 | 解决 |
|---|---|---|
| 瓦片显示「API KEY REQUIRED」水印 | URL 未带 key 或 key 无效 | 核对 URL `?key=` 参数与 §0.1 的 token 状态 |
| 配了 key 仍有水印 | 浏览器 / CARTO CDN 缓存旧瓦片 | 强制刷新（Ctrl+Shift+R） |
| 本机 curl workers.dev / cartocdn 超时（HTTP 000） | 本地网络对部分国际 CDN 不可达，**不代表服务故障** | 以浏览器实际渲染或 GitHub Actions 侧验证为准 |
| 深缩放瓦片 404 | 底图源层级上限（Esri 灰系 ~16；CARTO 到 20） | 属预期；可切回 CARTO 获得高层级 |
