# guoxin.space 腾讯云部署手册

> 把单文件个人工作台（`index.html`）从 workbuddy.link 迁移映射到 **guoxin.space**（域名在腾讯云 DNSPod 管理）。
> 写通道（Skills 页收藏/删除/同步）**保留 Cloudflare Worker**，不受本次部署影响。

---

## 0. 目标与现状

| 项 | 现状 | 目标 |
|---|---|---|
| 工作台文件 | `index.html`（全内联零依赖单文件）托管在 workbuddy.link（CloudStudio 部署的分享域名） | 原生跑在 `https://guoxin.space` 下 |
| 域名 `guoxin.space` | 裸域无解析；`www` 指向 GitHub Pages（404） | DNSPod 解析到腾讯云托管 |
| 域名管理权 | 腾讯云 DNSPod（你已确认） | 不变 |
| 写通道 | Cloudflare Worker `skillboard-collect.lgx31.workers.dev` | **保留**（CORS 已通配 `*`，页面零改动） |

**⚠️ 为什么不能直接把域名 CNAME 到 workbuddy.link**：workbuddy.link 是 WorkBuddy 的分享域名（APISIX 网关），只认自己的站点路径，外部自定义域名无法绑定到它名下。所以"映射"必须走：**把文件放到腾讯云托管 + DNSPod 解析过去**。

**✅ 为什么成本极低**：`index.html` 是单文件全内联（无外部 css/js/图片），且路由全部是 hash 路由（`#/home` 等，hash 不发给服务器）——迁移 = 上传 1 个文件 + 配解析，不需要任何代码改动。

---

## 1. 前置检查（3 项，一次做完）

| # | 检查项 | 怎么做 | 通过标准 |
|---|---|---|---|
| 1 | **ICP 备案** | 腾讯云控制台 → 搜索「备案」→ 查主体 | 已备案 ✅ / 未备案 → 看 §4 或先备案（个人备案约 1~3 周） |
| 2 | 域名实名 | DNSPod 控制台 → 我的域名 → guoxin.space → 域名信息 | 显示「已实名认证」 |
| 3 | 本地文件 | 确认 `index.html` 为最新版（与 workbuddy.link 线上一致） | 字节数一致，无 `skCfgWorker` 以外残留 |

> **备案是关键分叉**：腾讯云**中国大陆地域**的 COS 静态网站 + CDN 强制要求已备案域名。未备案 → 走 §4 备选（EdgeOne 国际站 / 先备案）。

---

## 2. 方案选型

| 方案 | 适用 | 成本 | 效果 | 推荐度 |
|---|---|---|---|---|
| **A. COS + CDN**（主方案） | 已备案 | 近零（COS 免费额度 + CDN 按量，个人站通常每月 < ¥1） | guoxin.space 原生承载工作台，国内访问快 | ⭐⭐⭐ |
| **B. EdgeOne Pages** | 未备案 / 想全站统一腾讯云 | 免费额度高 | 同上，且可承载写通道边缘函数 | ⭐⭐ |
| **C. 301 过渡映射** | 已备案但想先跑通 | 近零 | guoxin.space 打开即 301 跳转 workbuddy.link（地址栏变化，仅过渡用） | 过渡 |

**推荐：方案 A**。下面 §3 为完整步骤；§5 给出方案 C 作为过渡。

---

## 3. 方案 A：COS + CDN 完整部署（已备案时）

### 3.1 创建 COS 存储桶

1. 打开 [腾讯云控制台](https://console.cloud.tencent.com/) → **对象存储 COS** → **存储桶列表** → **创建存储桶**。
2. 配置：
   - **名称**：`guoxin-space`（全局唯一，可用你的 appid 后缀如 `guoxin-space-125xxxxxxx`）
   - **地域**：`华南-广州（ap-guangzhou）`（或就近华北-北京；建议与备案地一致）
   - **访问权限**：`公有读私有写`（静态网站必须公有读）
   - 其余默认。
3. 创建后记录 **存储桶访问域名**（基础配置页可见）：
   `guoxin-space-125xxxxxxx.cos.ap-guangzhou.myqcloud.com`

### 3.2 上传 index.html + 开启静态网站

1. 存储桶 → **文件列表** → **上传文件** → 选择本目录的 `index.html`（**放在根目录，路径必须是 `/index.html`**）。
2. 存储桶 → **基础配置** → **静态网站** → **开启**：
   - 索引文档：`index.html`
   - 错误文档：`index.html`（hash 路由下其实用不到，但留空可能返回 XML 错误，建议填上）
3. 记录**静态网站访问域名**（基础配置页顶部）：
   `guoxin-space-125xxxxxxx.cos-website.ap-guangzhou.myqcloud.com`

> 先用这个域名直接访问试一下：`http://guoxin-space-125xxxxxxx.cos-website.ap-guangzhou.myqcloud.com/#/home`，确认能出工作台再继续。

### 3.3 配置 CDN 加速域名

1. 控制台 → **CDN 内容分发网络** → **域名管理** → **添加域名**：
   - **加速域名**：`guoxin.space`（主域名；`www.guoxin.space` 可后面再加一条）
   - **源站类型**：`对象存储 COS 源站` → 勾选刚才的 `guoxin-space` 桶
   - **加速区域**：`中国境内`（备案过才可选；没备案只能选全球/境外，见 §4）
   - **服务类型**：`静态加速`
2. 提交后，CDN 会分配一个 **CNAME 域名**（形如 `guoxin-space.cdn.dnsv1.com`），**记下来**。

### 3.4 HTTPS 证书

1. 控制台 → **SSL 证书** → **申请免费证书**：
   - 证书类型：`免费证书（DV）`
   - 绑定域名：`guoxin.space`（如申请的是 www 就绑 www）
   - 域名验证：DNS 验证 → 按提示在 DNSPod 加一条解析（控制台可一键自动添加）
2. 证书签发后（通常几分钟~几小时）→ 回到 **CDN → 域名管理 → guoxin.space → HTTPS 配置** → 选择该证书并开启。
3. ⚠️ 免费 DV 证书有效期 3 个月，**到期需手动续期**。可在 SSL 证书控制台开启自动续期。

### 3.5 DNSPod 解析（最后一步，切流量）

1. 打开 [DNSPod 控制台](https://console.dnspod.cn/) → **我的域名** → `guoxin.space` → **记录管理** → **添加记录**：

| 主机记录 | 记录类型 | 记录值 | 说明 |
|---|---|---|---|
| `@` | CNAME | `guoxin-space.cdn.dnsv1.com`（§3.3 记的） | 裸域指向 CDN |
| `www` | CNAME | `guoxin-space.cdn.dnsv1.com` | 可选，www 也指过去 |

2. 保存后等待生效（CNAME 一般几分钟~几小时，可用 `nslookup guoxin.space` 验证）。
3. ⚠️ 原 `www` 指向 GitHub Pages 的 A 记录会被覆盖，GitHub Pages 站点不受影响（它还在 404 状态，无损失）。

### 3.6 验证清单

```bash
# 1. DNS 生效
nslookup guoxin.space          # 应返回 CDN 的 CNAME 或 CDN 节点 IP
nslookup www.guoxin.space      # 同左

# 2. HTTPS 与页面
curl -sI https://guoxin.space                 # 期望 200，Server 含 CDN/tencent 标识
curl -s  https://guoxin.space | head -5       # 期望返回 index.html 内容
```

浏览器验证（重点 4 项）：
- [ ] `https://guoxin.space` → 首页渲染（日期问候 / 天气）
- [ ] `https://guoxin.space/#/skills` → 技能夹列表可加载（GitHub 公开接口）
- [ ] `https://guoxin.space/#/running` → 运动页数据/地图正常（3.4MB activities.json 拉取 + 缓存）
- [ ] `https://guoxin.space/#/json` → JSON 工具可用

> 写通道（收藏/删除/同步）涉及 Cloudflare workers.dev，国内直连可能超时——不影响页面本身，见 §6。

---

## 4. 未备案时的备选：EdgeOne Pages

腾讯云 **EdgeOne（边缘安全加速平台）** 的 Pages 服务对标 Cloudflare Pages，**免费额度高，且全球节点无需备案**：

1. 控制台 → 搜索 **EdgeOne** → **Pages** → **创建项目** → 上传 `index.html`（或关联 Git 仓库自动部署）。
2. 项目设置 → **自定义域名** → 绑定 `guoxin.space`。
3. DNSPod 加记录：`@` CNAME → EdgeOne 分配的域名。
4. HTTPS：EdgeOne 自动签发证书（免费）。

> EdgeOne Pages 还支持**边缘函数**——将来想把写通道也迁到腾讯云（解决 workers.dev 国内直连问题），可直接把 `worker.js` 逻辑改造成 EdgeOne Function，并把页面 `skCfgWorker` 指向 `https://api.guoxin.space`（需另绑一个子域）。这是 overview.md 里"方案 B/C"的落地路径。

---

## 5. 过渡方案 C：301 映射到 workbuddy.link

想先让 guoxin.space 能打开（但地址栏跳走），不需要迁文件：

1. 按 §3.1 建桶（可叫 `guoxin-space-redirect`）。
2. 存储桶 → **基础配置** → **静态网站** → 开启 → **重定向规则**：
   - 条件：`*`（全部路径）
   - 动作：`301 重定向` → `https://<你的 workbuddy.link 完整链接>`
3. 存储桶 → **域名与传输管理** → 按提示配置自定义域名 `guoxin.space`（会要求走备案/回源校验）。
4. DNSPod：`@` CNAME → 静态网站域名或 CDN。

> 缺点：地址栏变为 workbuddy.link，hash 路由状态丢失。仅作为过渡，跑通后建议升级 §3。

---

## 6. 写通道（Cloudflare Worker）处理说明

| 问题 | 答案 |
|---|---|
| 需要改代码吗？ | **不需要**。`SK_DEFAULTS.worker` 仍指向 `skillboard-collect.lgx31.workers.dev`，CORS `*` 已放行新域名 |
| 国内访问收藏功能？ | workers.dev 国内直连不稳定，`/api/collect` 等可能超时；**页面只读功能（列表/预览）完全正常**（走 GitHub 公开接口） |
| 想彻底解决？ | 后续把 `worker.js` 迁到腾讯云 **EdgeOne 函数 / SCF**，绑 `api.guoxin.space`，页面改一处配置即可（见 §4 末段）。本次不做 |

---

## 7. 回滚方案

| 动作 | 操作 | 恢复效果 |
|---|---|---|
| 解析回滚 | DNSPod 删除 `@`/`www` 的 CNAME 记录 | 回到现状（www → GitHub Pages 404，裸域无解析） |
| 站点下线 | 停用 CDN 加速域名 / 删除 COS 桶 | 即刻生效，无任何残留费用（COS 按量计费，删除桶前先清空文件） |
| 写通道回滚 | 不受影响（Cloudflare 侧无改动） | — |

---

## 8. 时间线建议

| 阶段 | 内容 | 耗时 |
|---|---|---|
| ① 检查 | 前置检查 §1（备案状态确认） | 10 分钟 |
| ② 搭建 | §3.1~3.2 建桶 + 上传 + 静态网站 | 15 分钟 |
| ③ 加速 | §3.3~3.4 CDN + 证书 | 30 分钟~数小时（证书签发等待） |
| ④ 切流 | §3.5 DNSPod 解析 | 5 分钟（生效等 1~2 小时） |
| ⑤ 验证 | §3.6 清单 | 15 分钟 |

**总用时：约 1~2 小时（不含备案等待）**。若未备案，先走 §4 EdgeOne（约 30 分钟上线），备案下来后再切回 COS+CDN 主方案。
