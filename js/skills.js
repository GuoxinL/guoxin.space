"use strict";
/* ================= Skills ================= */
var KEY_SK_SET = KEY_PREFIX + "sk_set";
/* 默认值统一在 util.js（skCfg 回退），此处仅为设置弹窗预填等处的向后兼容引用 */
var SK_DEFAULTS = {repo: SK_DFLT_REPO, branch: SK_DFLT_BRANCH, worker: SK_DFLT_WORKER};
function saveSkCfg(c){ store(KEY_SK_SET, JSON.stringify(c)); }
function skWorkerUrl(cfg){ return String(cfg.worker||"").trim().replace(/\/+$/,""); }
var skRepo = "", skBranchNow = "main", skTreeData = null, skRows = [], skOpenDir = "";

function skRepoFull(cfg){
  var s = String(cfg.repo||"").trim().replace(/^https?:\/\/(www\.)?github\.com\//,"").replace(/\/$/,"").replace(/\.git$/,"");
  return /^[\w.-]+\/[\w.-]+$/.test(s) ? s : "";
}
function skRaw(o,r,b,p){ return "https://raw.githubusercontent.com/"+o+"/"+r+"/"+b+"/"+p; }
function skApi(full, path, q){ return "https://api.github.com/repos/"+full+path+(q||""); }
function skEmptyHtml(msg){ return '<div class="sk-empty">'+esc(msg)+'</div>'; }
function skSetBar(kind, msg){
  var dot=$("skDot"), tx=$("skBarText");
  if(dot) dot.className = "dot "+(kind||"info");
  if(tx) tx.textContent = msg;
}

/* —— 列表：git/trees 一级目录 + commits 排序 —— */
async function skLoad(){
  var cfg = skCfg();
  var full = skRepoFull(cfg);
  var grid = $("skGrid");
  skRepo = ""; skTreeData = null; skRows = [];
  if(!full){
    grid.innerHTML = skEmptyHtml("未配置技能夹仓库 · 点击右上角「通道设置」填写 skill-collection 仓库地址（读取需公开仓库）");
    skSetBar("wait","未配置仓库");
    return;
  }
  skSetBar("wait","正在读取 "+full+" …");
  grid.innerHTML = skEmptyHtml("加载中…");
  try{
    var branch = String(cfg.branch||"").trim() || "main";
    skBranchNow = branch;
    var r = await fetch(skApi(full, "/git/trees/"+encodeURIComponent(branch)+"?recursive=1"), {headers:{Accept:"application/vnd.github+json"}});
    if(r.status===409){ // 空仓库：无任何提交，git/trees 返回 409 Git Repository is empty
      skRepo = full; skTreeData = null; skRows = [];
      grid.innerHTML = skEmptyHtml("技能夹仓库还是空的 · 点击「收藏 Skill」收藏第一个（写通道会自动初始化）");
      skSetBar("wait","空仓库 · 待初始化");
      return;
    }
    if(r.status===404) throw new Error("仓库或分支不存在，请检查「通道设置」");
    if(!r.ok) throw new Error("GitHub HTTP "+r.status);
    var tree = await r.json();
    skRepo = full; skTreeData = tree;
    var dirSet = {};
    (tree.tree||[]).forEach(function(t){ if(t.type==="tree" && t.path.indexOf("/")<0) dirSet[t.path]=1; });
    var order = await skOrder(full, branch, Object.keys(dirSet));
    skRows = [];
    for(var i=0;i<order.length;i++) skRows.push(await skFetchMeta(order[i]));
    skRender();
    skRoute(skHashDir()); // 应用二级路由：#/skills/<dir> 直接进详情
    skSetBar("ok", full+" · "+skRows.length+" 个技能（"+branch+" 分支，按最近提交排序）");
  }catch(e){
    grid.innerHTML = skEmptyHtml("加载失败："+esc(e.message));
    skSetBar("err","加载失败");
  }
}
/* commits API 提取最近提交涉及的一级路径（最新在上） */
async function skOrder(full, branch, dirs){
  if(!dirs.length) return [];
  try{
    var r = await fetch(skApi(full, "/commits", "?per_page=100&sha="+encodeURIComponent(branch)), {headers:{Accept:"application/vnd.github+json"}});
    if(!r.ok) throw 0;
    var commits = await r.json();
    var seen = {}, ordered = [];
    commits.forEach(function(c){
      (c.files||[]).forEach(function(f){
        var top = String(f.filename||"").split("/")[0];
        if(top && dirs.indexOf(top)>=0 && !seen[top]){ seen[top]=1; ordered.push(top); }
      });
    });
    dirs.forEach(function(d){ if(!seen[d]) ordered.push(d); });
    return ordered;
  }catch(e){ return dirs.slice().sort(); }
}
/* 单目录元数据：SKILL.md frontmatter + 图标三级探测 */
async function skFetchMeta(dir){
  var o = skRepo.split("/")[0], r = skRepo.split("/")[1];
  var meta = {dir:dir, name:dir, description:"", mode:null, source:"", sourceOwner:"", icon:null, skillMd:null};
  try{
    var md = await fetch(skRaw(o,r,skBranchNow,dir+"/SKILL.md"));
    if(md.ok){
      var text = await md.text();
      meta.skillMd = text;
      var fm = skParseFrontmatter(text);
      if(fm.name) meta.name = fm.name;
      if(fm.description) meta.description = fm.description;
      if(fm.mode) meta.mode = fm.mode;
      if(fm.source) meta.source = fm.source;
      if(fm.sourceOwner) meta.sourceOwner = fm.sourceOwner;
    }
  }catch(e){}
  // 旧镜像收藏没有 metadata → 读 _collect.json 补来源（兼容历史数据）
  if(!meta.source){
    try{
      var cj = await fetch(skRaw(o,r,skBranchNow,dir+"/_collect.json"));
      if(cj.ok){
        var col = await cj.json().catch(function(){ return null; });
        if(col && col.source){ meta.source = col.source; if(!meta.mode && col.mode) meta.mode = col.mode; if(col.sourceOwner) meta.sourceOwner = col.sourceOwner; }
      }
    }catch(e){}
  }
  if(!meta.sourceOwner) meta.sourceOwner = skSourceOwner(meta.source, "");
  var cands = ["_icon.png","icon.svg","icon.png","logo.png","logo.svg"];
  try{
    var probes = await Promise.all(cands.map(function(c){
      return fetch(skRaw(o,r,skBranchNow,dir+"/"+c), {method:"HEAD"})
        .then(function(res){ return res.ok ? c : null; }).catch(function(){ return null; });
    }));
    for(var i=0;i<probes.length;i++) if(probes[i]){ meta.icon = skRaw(o,r,skBranchNow,dir+"/"+probes[i]); break; }
  }catch(e){}
  // 目录内无图标 → 用目标仓库 owner 头像（而非收藏仓库 owner 头像）
  if(!meta.icon) meta.icon = "https://github.com/"+(meta.sourceOwner||o)+".png";
  return meta;
}
/* 与 Worker 一致的 frontmatter 解析（name/description 折叠 + metadata.source/mode/sourceOwner） */
function skParseFrontmatter(text){
  var out = {name:"", description:"", mode:null, source:"", sourceOwner:""};
  var m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(text||""));
  if(!m) return out;
  var lines = m[1].split(/\r?\n/), inMeta=false, desc=[], inDesc=false;
  for(var i=0;i<lines.length;i++){
    var line = lines[i].replace(/\s+$/,"");
    if(inDesc){
      if(/^\s+\S/.test(line)){ desc.push(line.trim()); continue; }
      inDesc = false;
    }
    var nm = /^name:\s*(.+)$/.exec(line);
    if(nm){ out.name = nm[1].trim().replace(/^["']|["']$/g,""); continue; }
    var dm = /^description:\s*(.*)$/.exec(line);
    if(dm){
      var rest = dm[1].trim();
      if(rest===">"||rest==="|"||rest==="|-"){ inDesc=true; continue; }
      desc.push(rest.replace(/^["']|["']$/g,"")); inDesc=true; continue;
    }
    if(/^metadata:\s*$/.test(line)){ inMeta=true; continue; }
    if(inMeta){
      var sm = /^\s+(source|mode|sourceOwner):\s*(.+)$/.exec(line);
      if(sm) out[sm[1]] = sm[2].trim();
    }
  }
  out.description = desc.join(" ").replace(/\s+/g," ").trim();
  return out;
}
/* 目标仓库 owner：优先 frontmatter 的 sourceOwner，其次从 source URL 提取 */
function skSourceOwner(source, sourceOwner){
  if(sourceOwner) return sourceOwner;
  var m = /github\.com\/([\w.-]+)/.exec(String(source||""));
  return m ? m[1] : "";
}
function escAttr(s){ return esc(s).replace(/"/g,"&quot;"); }
function skRender(){
  var grid = $("skGrid");
  if(!skRows.length){ grid.innerHTML = skEmptyHtml("技能夹是空的 · 点击「收藏 Skill」从 GitHub 收藏第一个"); return; }
  grid.innerHTML = skRows.map(function(row){
    var badge = row.mode==="mirror" ? '<span class="sk-badge mirror">镜像</span>' : (row.mode==="proxy" ? '<span class="sk-badge proxy">引用</span>' : "");
    var src = row.source ? row.source.replace(/^https:\/\//,"") : (skRepo+"/"+row.dir);
    return '<button class="sk-card" onclick="skGoto(\''+row.dir+'\')">'
      + '<div class="sk-icon"><img src="'+row.icon+'" alt="" onerror="this.style.display=\'none\'"></div>'
      + '<div class="sk-body"><div class="sk-name">'+esc(row.name)+badge+'</div>'
      + '<div class="sk-desc">'+esc(row.description||"（无简介）")+'</div>'
      + '<div class="sk-src">'+esc(src)+'</div></div></button>';
  }).join("");
}

/* —— 视图：列表 / 详情独立页 + 右侧文件树抽屉 —— */
var skView_ = "list", skPendingFile = "";   // 当前视图(list|detail)、列表页点文件树时待打开的文件路径
var skOpenFile_ = "", skTreeBound = false;  // 当前选中的文件（相对路径，""=SKILL.md）
var skTreeOpen_ = false;                    // 右侧文件树抽屉展开状态
function skGoto(dir){ go("/skills/"+encodeURIComponent(dir)); }
function skBack(){ go("/skills"); }
function skInDetail(){ return skView_ === "detail"; }
/* 当前路径中的技能目录（/skills/<dir>），非 skills 页返回空串 */
function skHashDir(){
  var raw = String(location.pathname || "").replace(/^\//,"");
  var parts = raw.split("/");
  if(parts[0] !== "skills") return "";
  return decodeURIComponent(parts.slice(1).join("/") || "");
}
/* 二级路由：#/skills -> 列表，#/skills/<dir> -> 详情独立页（skRows 未加载完时由 skLoad 完成后调用 skRoute 补齐） */
function skRoute(dir){
  if(dir && skRows.length){
    for(var i=0;i<skRows.length;i++) if(skRows[i].dir===dir) return skShowDetail(dir);
    return skShowList();
  }
  skShowList();
}
function skShowList(){
  skView_ = "list";
  var d = $("skDetail"), l = $("skList");
  if(d) d.classList.remove("show");
  if(l) l.classList.add("show");
  skTreeVisible(false);
  skTreeRender("");
}
function skShowDetail(dir){
  var row = null;
  for(var i=0;i<skRows.length;i++) if(skRows[i].dir===dir){ row=skRows[i]; break; }
  if(!row) return skShowList();
  skView_ = "detail";
  skTreeVisible(true);
  skOpenDir = dir;
  var l = $("skList"), d = $("skDetail");
  if(l) l.classList.remove("show");
  if(d) d.classList.add("show");
  $("drName").textContent = row.name;
  $("drIcon").src = row.icon;
  $("drSrc").textContent = row.source ? "来自 "+row.source.replace(/^https:\/\//,"") : (skRepo+"/"+dir);
  $("drDesc").textContent = row.description || "（无简介）";
  $("drFileLabel").textContent = "SKILL.md";
  skMdName_ = "SKILL.md";
  var pf = skPendingFile; skPendingFile = "";
  if(pf){ skOpenFile(dir, pf); }
  else{
    skOpenFile_ = "";
    var hasMd = !!row.skillMd;
    skMdText_ = row.skillMd || "（该目录没有 SKILL.md）";
    $("drMd").textContent = skMdText_;
    skMdTabsShow(hasMd);
    skMdMode_ = hasMd ? "preview" : "code";
    skMdApply();
    skTreeRender(dir);
  }
}
/* —— 右侧文件树抽屉（有且仅有文件树，抽拉按钮三角形随展开/收起旋转 180°）—— */
function skTreeRender(dir){
  var body = $("skTreeBody");
  if(!body) return;
  if(!dir){
    body.innerHTML = '<div class="tree-empty">未选择 Skill<br>点击卡片进入详情后，此处显示该目录的文件树</div>';
    skTreeClose();
    return;
  }
  body.innerHTML = skTreeHtml(dir);
  if(!skTreeBound){
    skTreeBound = true;
    body.addEventListener("click", function(e){
      var t = e.target;
      while(t && t !== this && !(t.classList && t.classList.contains("ft-click"))) t = t.parentNode;
      if(t && t !== this && t.dataset && t.dataset.file !== undefined) skOpenFile(skOpenDir, t.dataset.file);
    });
  }
  skTreeOpen();
}
function skToggleTree(){ skTreeOpen_ ? skTreeClose() : skTreeOpen(); }
function skTreeOpen(){ skTreeOpen_ = true; var d = $("skTreeDrawer"); if(d) d.classList.add("open"); }
function skTreeClose(){ skTreeOpen_ = false; var d = $("skTreeDrawer"); if(d) d.classList.remove("open"); }
/* 文件树抽屉整体显隐：仅 Skills 详情页显示（含右侧 tab 按钮），其余页面完全隐藏 */
function skTreeVisible(show){ var d = $("skTreeDrawer"); if(d) d.classList.toggle("show", !!show); }
function skTreeHtml(dir){
  var files = [];
  (skTreeData && skTreeData.tree || []).forEach(function(t){
    if(t.type!=="blob") return;
    if(t.path===dir) files.push("");
    else if(t.path.indexOf(dir+"/")===0) files.push(t.path.slice(dir.length+1));
  });
  if(!files.length) return '<div class="empty">（空目录）</div>';
  files.sort();
  var html = files.map(function(p){
    var depth = p ? p.split("/").length-1 : 0;
    var act = (p === skOpenFile_) ? " ft-active" : "";
    return '<div class="ft-item ft-click'+act+'" data-file="'+escAttr(p)+'" title="'+escAttr(p||"/")+'" style="padding-left:'+(depth*16+4)+'px">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'
      + '<span class="ft-name">'+esc(p||"/")+'</span></div>';
  }).join("");
  return '<div class="ft-item" style="color:var(--primary);font-weight:600">'+esc(dir)+'<span style="color:var(--text3);font-weight:400;font-size:11px"> · '+files.length+' 个文件</span></div>'+html;
}
/* —— GitHub 风格 Markdown 渲染（GFM 子集，零依赖行级状态机）—— */
var skMdMode_ = "preview", skMdText_ = "", skMdName_ = "SKILL.md";
function skMdIsMarkdown(name){ return /\.(md|markdown|mdown|mkd)$/i.test(String(name||"")); }
function skMdTabsShow(show){
  var tabs = $("drTabs");
  if(tabs) tabs.style.display = show ? "flex" : "none";
}
function skMdMode(mode){
  skMdMode_ = (mode === "code") ? "code" : "preview";
  var tp = $("mdTabPreview"), tc = $("mdTabCode");
  if(tp) tp.classList.toggle("active", skMdMode_ === "preview");
  if(tc) tc.classList.toggle("active", skMdMode_ === "code");
  skMdApply();
}
function skMdApply(){
  var code = $("drMd"), pv = $("drPreview");
  if(!code) return;
  if(skMdMode_ === "code" || !skMdIsMarkdown(skMdName_)){
    code.style.display = "block";
    if(pv) pv.style.display = "none";
  }else{
    if(pv){ pv.innerHTML = skMdRender(skMdText_); pv.style.display = "block"; }
    code.style.display = "none";
  }
}
function skToast(msg){
  var t = $("skToast");
  if(!t){
    t = document.createElement("div");
    t.id = "skToast";
    t.style.cssText = "position:fixed;left:50%;bottom:44px;transform:translateX(-50%);background:rgba(16,24,40,.92);color:#fff;font-size:12.5px;line-height:1.5;padding:8px 16px;border-radius:8px;z-index:999;pointer-events:none;transition:opacity .25s;opacity:0;max-width:80vw;box-shadow:0 6px 20px rgba(0,0,0,.28)";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(skToast._t);
  skToast._t = setTimeout(function(){ t.style.opacity = "0"; }, 1600);
}
function skAnchorBind(){
  var pv = $("drPreview");
  if(!pv || pv.dataset.anchorBound) return;
  pv.dataset.anchorBound = "1";
  pv.addEventListener("click", function(e){
    var a = e.target;
    while(a && a !== this && !(a.classList && a.classList.contains("anchor"))) a = a.parentNode;
    if(!a || a === this) return;
    e.preventDefault();
    var id = a.getAttribute("data-anchor");
    var el = document.getElementById(id);
    if(el) el.scrollIntoView({behavior:"smooth", block:"start"});
    var txt = "#"+id;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(function(){ skToast("已复制锚点 "+txt); }, function(){ skToast(txt); });
    }else{
      var ta=document.createElement("textarea"); ta.value=txt; ta.style.position="fixed"; ta.style.opacity="0";
      document.body.appendChild(ta); ta.select();
      try{ document.execCommand("copy"); skToast("已复制锚点 "+txt); }catch(e){ skToast(txt); }
      ta.remove();
    }
  });
}
var skLinkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
function skSlug(text){
  var t = String(text||"")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .trim().toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "");
  return t || "section";
}
function skSlugId(text, seen){
  var base = skSlug(text);
  if(seen[base] == null){ seen[base] = 0; return base; }
  seen[base]++;
  return base + "-" + seen[base];
}
function skMdRender(md){
  var src = String(md || "").replace(/\r\n?/g, "\n");
  src = src.replace(/^\ufeff?---\n[\s\S]*?\n---\n?/, ""); // 剥离 YAML frontmatter
  var lines = src.split("\n");
  var out = [], i = 0, N = lines.length, slugSeen = {};
  function inline(s){
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^\w_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }
  function splitRow(s){ var a = s.split("|").map(function(c){ return c.trim(); }); if(a[0] === "") a.shift(); if(a.length && a[a.length - 1] === "") a.pop(); return a; }
  function isHr(s){ return /^\s*([-*_])(\s*\1){2,}\s*$/.test(s); }
  function isH(s){ return /^#{1,6}\s+/.test(s); }
  function isTask(s){ return /^\s*[-*+]\s+\[([ xX])\]\s+/.test(s); }
  function isUl(s){ return /^\s*[-*+]\s+/.test(s); }
  function isOl(s){ return /^\s*\d+[.)]\s+/.test(s); }
  function isQuote(s){ return /^\s*>/.test(s); }
  function isFence(s){ return /^\s*(```|~~~)/.test(s); }
  while(i < N){
    var t = lines[i].replace(/\s+$/, "");
    if(!t){ i++; continue; }
    var fm = /^\s*(```|~~~)\s*.*$/.exec(t);
    if(fm){
      var fence = fm[1];
      out.push('<pre><code>');
      i++;
      while(i < N){
        var c = lines[i].replace(/\s+$/, "");
        if(c.indexOf(fence) === 0 && /^\s*(```+|~~~+)\s*$/.test(c)){ i++; break; }
        out.push(esc(lines[i]) + "\n");
        i++;
      }
      out.push('</code></pre>');
      continue;
    }
    if(isHr(t)){ out.push('<hr>'); i++; continue; }
    if(isH(t)){
      var hm = /^(#{1,6})\s+(.*)$/.exec(t);
      var lv = hm[1].length;
      var id = skSlugId(hm[2], slugSeen);
      out.push('<h'+lv+' id="'+escAttr(id)+'"><a class="anchor" href="#'+escAttr(id)+'" data-anchor="'+escAttr(id)+'" title="复制锚点链接">'+skLinkIcon+'</a>'+inline(hm[2])+'</h'+lv+'>');
      i++; continue;
    }
    if(isQuote(t)){
      var q = [];
      while(i < N && isQuote(lines[i])){ q.push(inline(lines[i].replace(/^\s*> ?/, ""))); i++; }
      out.push('<blockquote><p>' + q.join('<br>') + '</p></blockquote>');
      continue;
    }
    if(isTask(t)){
      var items = [];
      while(i < N && isTask(lines[i])){
        var tm = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(lines[i]);
        items.push('<li><input type="checkbox" disabled' + (/^[xX]$/.test(tm[1]) ? ' checked' : '') + '> ' + inline(tm[2]) + '</li>');
        i++;
      }
      out.push('<ul class="task-list">' + items.join("") + '</ul>');
      continue;
    }
    if(isUl(t)){
      var uls = [];
      while(i < N && isUl(lines[i]) && !isTask(lines[i])){
        uls.push('<li>' + inline(lines[i].replace(/^\s*[-*+]\s+/, "")) + '</li>');
        i++;
      }
      out.push('<ul>' + uls.join("") + '</ul>');
      continue;
    }
    if(isOl(t)){
      var ols = [];
      while(i < N && isOl(lines[i])){
        ols.push('<li>' + inline(lines[i].replace(/^\s*\d+[.)]\s+/, "")) + '</li>');
        i++;
      }
      out.push('<ol>' + ols.join("") + '</ol>');
      continue;
    }
    if(t.indexOf("|") >= 0 && i + 1 < N && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && lines[i + 1].indexOf("-") >= 0){
      var head = splitRow(t);
      i += 2;
      var rows = [];
      while(i < N && lines[i].indexOf("|") >= 0 && lines[i].trim()){
        rows.push('<tr>' + splitRow(lines[i]).map(function(c){ return '<td>' + inline(c) + '</td>'; }).join("") + '</tr>');
        i++;
      }
      out.push('<table><thead><tr>' + head.map(function(c){ return '<th>' + inline(c) + '</th>'; }).join("") + '</tr></thead><tbody>' + rows.join("") + '</tbody></table>');
      continue;
    }
    var para = [];
    while(i < N && lines[i].trim() && !isH(lines[i]) && !isHr(lines[i]) && !isUl(lines[i]) && !isOl(lines[i]) && !isQuote(lines[i]) && !isTask(lines[i]) && !isFence(lines[i]) && lines[i].indexOf("|") < 0){
      para.push(lines[i].trim());
      i++;
    }
    if(para.length) out.push('<p>' + inline(para.join(" ")) + '</p>');
    else i++;
  }
  return out.join("");
}
/* 点击文件树条目 → 拉取 raw 内容展示（md 走 Preview/Code 切换，图片直接预览，大文件截断）；列表页点击自动进入详情 */
async function skOpenFile(dir, path){
  if(!skInDetail()){
    skPendingFile = path || "";
    skOpenDir = dir;
    go("/skills/"+encodeURIComponent(dir));
    return;
  }
  var o = skRepo.split("/")[0], r = skRepo.split("/")[1];
  var target = path || "SKILL.md";
  skOpenFile_ = target;
  skTreeRender(dir); // 刷新文件树高亮并保持抽屉展开（幂等）
  $("drFileLabel").textContent = target || "/";
  skMdName_ = target;
  var code = $("drMd"), pv = $("drPreview");
  var url = skRaw(o,r,skBranchNow,dir+"/"+target);
  if(/\.(png|jpe?g|gif|webp|ico|svg)$/i.test(target)){
    skMdTabsShow(false);
    if(pv) pv.style.display = "none";
    code.style.display = "block";
    code.innerHTML = '<img src="'+escAttr(url)+'" alt="'+escAttr(target)+'" style="max-width:100%;border-radius:8px;display:block">';
    return;
  }
  var isMd = skMdIsMarkdown(target);
  skMdTabsShow(isMd);
  if(pv) pv.style.display = "none";
  code.style.display = "block";
  code.textContent = "加载中…";
  skMdText_ = "";
  try{
    var res = await fetch(url);
    if(!res.ok){ code.textContent = "（读取失败：HTTP "+res.status+"）"; return; }
    var text = await res.text();
    if(text.length > 200000) text = text.slice(0,200000)+"\n\n…（文件较大，已截断至前 200KB）";
    skMdText_ = text;
    code.textContent = text;
    skMdMode_ = isMd ? "preview" : "code";
    var tp = $("mdTabPreview"), tc = $("mdTabCode");
    if(tp) tp.classList.toggle("active", skMdMode_ === "preview");
    if(tc) tc.classList.toggle("active", skMdMode_ === "code");
    skMdApply();
  }catch(e){ code.textContent = "（读取失败："+e.message+"）"; }
}

/* —— 收藏（POST /api/collect）—— */
var skMode = "proxy";
function skOpenCollect(){
  $("skCollectMsg").className = "form-msg";
  $("skCollectMsg").textContent = "";
  $("skCollectModal").classList.add("show");
  var radios = document.querySelectorAll('input[name="skMode"]');
  skMode = "proxy";
  for(var i=0;i<radios.length;i++) radios[i].checked = (radios[i].value==="proxy");
  var labels = document.querySelectorAll("#skModeOpt label");
  for(var j=0;j<labels.length;j++) labels[j].classList.toggle("on", j===0);
  setTimeout(function(){ $("skUrl").focus(); }, 60);
}
function skCloseCollect(){ $("skCollectModal").classList.remove("show"); }
$("skModeOpt").addEventListener("change", function(e){
  if(e.target && e.target.name==="skMode"){
    skMode = e.target.value;
    var labels = this.querySelectorAll("label");
    for(var i=0;i<labels.length;i++) labels[i].classList.toggle("on", labels[i].querySelector("input").checked);
  }
});
async function skCollect(){
  var cfg = skCfg();
  var url = $("skUrl").value.trim();
  var worker = skWorkerUrl(cfg);
  var msg = $("skCollectMsg");
  if(!url){ msg.className="form-msg err"; msg.textContent="请粘贴 GitHub 仓库或子目录链接"; return; }
  if(!worker){ msg.className="form-msg err"; msg.textContent="未配置 Worker 写通道 · 请先在「通道设置」填写 Worker URL（需先部署 worker.js 到 Cloudflare）"; return; }
  msg.className = "form-msg"; msg.textContent = "收藏中…";
  try{
    var headers = {"Content-Type":"application/json"};
    var tok = authToken();
    if(!tok){ msg.className="form-msg err"; msg.textContent="请先登录 GitHub（收藏为站长功能）"; return; }
    headers["Authorization"] = "Bearer " + tok;
    var res = await fetch(worker+"/api/collect", {method:"POST", headers:headers, body:JSON.stringify({url:url, mode:skMode})});
    var j = await res.json().catch(function(){ return {}; });
    if(res.ok && j.ok){
      msg.className = "form-msg ok";
      msg.textContent = "✓ 已收藏「"+j.name+"」（"+j.dir+"，"+(j.mode==="mirror"?"镜像":"引用")+"）";
      skCloseCollect();
      skLoad();
    }else{
      msg.className = "form-msg err";
      msg.textContent = "✖ "+(j.error||("HTTP "+res.status))+(j.dir?"（"+j.dir+"）":"");
    }
  }catch(e){
    msg.className = "form-msg err";
    msg.textContent = "✖ 网络错误："+e.message+"（Worker URL 是否正确？是否已部署？）";
  }
}

/* —— 删除 / 同步（POST /api/remove /api/sync）—— */
async function skRemove(){
  if(!skOpenDir) return;
  if(!confirm("确定删除技能目录 "+skOpenDir+" ？将删除收藏仓库中的整个目录（不可恢复）")) return;
  var cfg = skCfg(), worker = skWorkerUrl(cfg);
  if(!worker){ alert("未配置 Worker 写通道"); return; }
  try{
    var headers = {"Content-Type":"application/json"};
    var tok = authToken();
    if(!tok){ alert("请先登录 GitHub（删除为站长功能）"); return; }
    headers["Authorization"] = "Bearer " + tok;
    var res = await fetch(worker+"/api/remove", {method:"POST", headers:headers, body:JSON.stringify({dir:skOpenDir})});
    var j = await res.json().catch(function(){ return {}; });
    if(res.ok && j.ok){ alert("已删除 "+j.removed+" 个文件"); skBack(); skLoad(); }
    else alert("删除失败："+(j.error||("HTTP "+res.status)));
  }catch(e){ alert("网络错误："+e.message); }
}
async function skSync(){
  if(!skOpenDir) return;
  var cfg = skCfg(), worker = skWorkerUrl(cfg);
  if(!worker){ alert("未配置 Worker 写通道"); return; }
  var row = null;
  for(var i=0;i<skRows.length;i++) if(skRows[i].dir===skOpenDir){ row=skRows[i]; break; }
  if(!row){ alert("找不到当前条目"); return; }
  if(row.mode==="mirror"){ alert("镜像模式条目已含全部文件，无需同步；如需更新请先删除再重新收藏"); return; }
  if(!confirm("重新探测原仓库并更新代理 SKILL.md / 图标？")) return;
  try{
    var headers = {"Content-Type":"application/json"};
    var tok = authToken();
    if(!tok){ alert("请先登录 GitHub（同步为站长功能）"); return; }
    headers["Authorization"] = "Bearer " + tok;
    var res = await fetch(worker+"/api/sync", {method:"POST", headers:headers, body:JSON.stringify({dir:skOpenDir, url:row.source})});
    var j = await res.json().catch(function(){ return {}; });
    if(res.ok && j.ok){ alert("✓ 已同步 "+j.name+"（更新 "+j.written+" 个文件）"); skLoad(); }
    else alert("同步失败："+(j.error||("HTTP "+res.status)));
  }catch(e){ alert("网络错误："+e.message); }
}

/* —— 通道设置 —— */
function skOpenCfg(){
  var cfg = skCfg();
  $("skCfgRepo").value = cfg.repo || SK_DEFAULTS.repo;
  $("skCfgBranch").value = cfg.branch || SK_DEFAULTS.branch;
  $("skCfgWorker").value = cfg.worker || SK_DEFAULTS.worker;
  $("skCfgMsg").className = "form-msg";
  $("skCfgMsg").textContent = "";
  $("skCfgModal").classList.add("show");
}
function skCloseCfg(){ $("skCfgModal").classList.remove("show"); }
function skSaveCfg(){
  var repo = $("skCfgRepo").value.trim();
  var branch = $("skCfgBranch").value.trim() || "main";
  var worker = $("skCfgWorker").value.trim().replace(/\/+$/,"");
  var msg = $("skCfgMsg");
  var norm = repo.replace(/^https?:\/\/(www\.)?github\.com\//,"").replace(/\/$/,"").replace(/\.git$/,"");
  if(!/^[\w.-]+\/[\w.-]+$/.test(norm)){
    msg.className="form-msg err"; msg.textContent="仓库格式应为 owner/repo 或 github.com/owner/repo"; return;
  }
  saveSkCfg({repo:norm, branch:branch, worker:worker});
  msg.className="form-msg ok"; msg.textContent="✓ 已保存";
  skCloseCfg();
  skLoad();
}
async function skTest(){
  var cfg = skCfg();
  // 优先取输入框当前值（未保存也能测），回退到已保存配置，再回退到内置默认
  var worker = String($("skCfgWorker").value||"").trim().replace(/\/+$/,"") || skWorkerUrl(cfg) || SK_DEFAULTS.worker;
  var msg = $("skCfgMsg");
  if(!worker){ msg.className="form-msg err"; msg.textContent="请先填写 Worker URL"; return; }
  msg.className = "form-msg"; msg.textContent = "测试中…";
  try{
    var res = await fetch(worker+"/api/health", {method:"GET"});
    var j = await res.json().catch(function(){ return {}; });
    if(j.ok){ msg.className="form-msg ok"; msg.textContent="✓ Worker 连通 · 仓库 "+j.repo+"（默认分支 "+j.default_branch+" · 私有:"+(j.private?"是":"否")+"）"; }
    else{ msg.className="form-msg err"; msg.textContent="✖ "+(j.error||("HTTP "+res.status)); }
  }catch(e){ msg.className="form-msg err"; msg.textContent="✖ 无法连接："+e.message; }
}
