"use strict";
/* ================= 常量与状态 ================= */
var KEY_PREFIX = "wb_home_";
var KEY_THEME  = KEY_PREFIX + "theme";
var KEY_DRAFT  = KEY_PREFIX + "json_draft";
var KEY_HIST   = KEY_PREFIX + "json_history";
var $ = function(id){ return document.getElementById(id); };

var J = { hist:[] };

/* ================= 通道配置默认值（Skills / Running / Auth 共用） =================
   首次访问（localStorage 无 wb_home_sk_set）或配置被清空时，回退到内置默认值：
   - skills 列表读取走 GitHub 公开 API，不依赖登录与 Worker；
   - running 预览数据经 Worker 代理下发（preview.* 游客可读），默认 Worker 直连；
   保证游客打开页面即可看到 skills / running 数据，无需先配置写通道。 */
var SK_DFLT_REPO   = "guoxinl/skill-collection";
var SK_DFLT_BRANCH = "main";
var SK_DFLT_WORKER = "https://skillboard-collect.lgx31.workers.dev";
/* 读取 Skills 通道配置（wb_home_sk_set）；任一字段为空时回退内置默认值 */
function skCfg(){
  var c = {};
  try{ c = JSON.parse(load(KEY_PREFIX + "sk_set") || "null") || {}; }catch(e){ c = {}; }
  return {
    repo:   String(c.repo   || "").trim() || SK_DFLT_REPO,
    branch: String(c.branch || "").trim() || SK_DFLT_BRANCH,
    worker: String(c.worker || "").trim().replace(/\/+$/, "") || SK_DFLT_WORKER
  };
}

/* ================= 工具函数 ================= */
function store(key, val){ try{ localStorage.setItem(key, val); }catch(e){} }
function load(key){ try{ return localStorage.getItem(key); }catch(e){ return null; } }
function remove(key){ try{ localStorage.removeItem(key); }catch(e){} }
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function fmtTime(ts){ var d=new Date(ts); function p(n){return n<10?"0"+n:n;} return p(d.getMonth()+1)+"-"+p(d.getDate())+" "+p(d.getHours())+":"+p(d.getMinutes()); }
function nowStr(){ var d=new Date(); function p(n){return n<10?"0"+n:n;} return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"_"+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds()); }
function download(name, content, mime){
  var blob = new Blob([content], {type:mime||"application/octet-stream"});
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 300);
}
function copyText(text, okMsg){
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){ flashStatus(okMsg||"已复制到剪贴板","ok"); });
  }else{
    var ta=document.createElement("textarea"); ta.value=text; ta.style.position="fixed"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand("copy"); flashStatus(okMsg||"已复制到剪贴板","ok"); }catch(e){ flashStatus("复制失败","err"); }
    ta.remove();
  }
}
function flashStatus(msg, kind){
  var dot=$("statusDot"), tx=$("statusText");
  /* 旧版全局状态条元素已移除：回退到当前激活侧（lastSide）的校验条 vdot/vtext */
  if(!dot || !tx){
    var side = (lastSide === "L" || lastSide === "R") ? lastSide : "R";
    dot = $("vdot"+side); tx = $("vtext"+side);
  }
  if(!dot || !tx) return;
  dot.className="dot "+(kind||"ok");
  tx.textContent=msg;
}

/* ================= 主题 ================= */
function applyTheme(t){
  document.body.dataset.theme = t;
  store(KEY_THEME, t);
  var label = $("themeLabel");
  if(label) label.textContent = (t==="dark" ? "亮色模式" : "暗色模式");
  /* 地图样式固定浅色（不随明暗切换），主题切换无需重绘地图 */
}
function toggleTheme(){
  applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
}

/* ================= 路由 ================= */
/* path 路由：/home /json /skills /running（原 #/home 等 hash 路由）。
   GitHub Pages 无服务端 rewrite，由 404.html 兜底任意深层路径。
   navigate 触发源：popstate（前进/后退）、站内链接拦截、go()。 */
function navigate(){
  var raw = String(location.pathname || "/").replace(/^\//,"");
  var parts = raw.split("/"), h = parts[0] || "";
  /* 回退：本地 file:// 预览 pathname 为磁盘路径无法解析 → 从旧 hash 链接解析目标页 */
  if(["home","json","skills","running"].indexOf(h) < 0 && /^#\//.test(location.hash || "")){
    h = location.hash.replace(/^#\//,"").split("/")[0];
    parts[0] = h;
  }
  /* 兼容旧链接：/run → /running（file:// 下 replaceState 受限时本地修正后继续） */
  if(h === "run"){
    var np = "/running" + (parts.length > 1 ? "/" + parts.slice(1).join("/") : "");
    var replaced = false;
    try{ history.replaceState(null,"",np); replaced = true; }catch(e){ /* file:// 受限 */ }
    if(replaced) return navigate();
    h = "running"; parts[0] = "running";
  }
  if(["home","json","skills","running"].indexOf(h) < 0) h = "home";
  var pages = document.querySelectorAll(".page");
  for(var i=0;i<pages.length;i++) pages[i].classList.toggle("active", pages[i].id === "page-"+h);
  var nvs = document.querySelectorAll("[data-nav]");
  for(var j=0;j<nvs.length;j++) nvs[j].classList.toggle("active", nvs[j].getAttribute("data-nav") === h);
  var tabs = document.querySelectorAll("[data-tabpage]");
  for(var k=0;k<tabs.length;k++) tabs[k].classList.toggle("active", tabs[k].getAttribute("data-tabpage") === h);
  if(h === "json"){ renderGutter("L"); renderGutter("R"); }
  /* skills 二级路由：/skills = 列表，/skills/<dir> = 详情独立页；离开 skills 页收起并隐藏文件树抽屉 */
  if(h === "skills") skRoute(decodeURIComponent(parts.slice(1).join("/") || ""));
  else { skTreeClose(); skTreeVisible(false); }
  if(h === "running") rkLoad();
}
/* 编程式导航：pushState 无刷新切换（file:// 等受限环境回退为仅渲染不换地址） */
function go(path){
  if(path !== location.pathname){
    try{ history.pushState(null,"",path); }
    catch(e){ /* 忽略：本地 file:// 预览下 pushState 受限，仅渲染不换地址 */ }
  }
  navigate();
}
window.go = go;
window.addEventListener("popstate", navigate);
/* 拦截站内 /xxx 链接 → pushState 无刷新；中键/新标签打开走真实 URL（由 404.html 兜底渲染） */
document.addEventListener("click", function(e){
  var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
  if(!a || e.defaultPrevented) return;
  var href = a.getAttribute("href") || "";
  if(href.charAt(0) === "/" && href.charAt(1) !== "/" && href.indexOf(":") < 0){
    e.preventDefault();
    go(href);
  }
});
/* 兼容旧 hash 链接：#/xxx → /xxx（replaceState 不留历史记录；file:// 下受限则忽略）。
   注意：此处仅规范化地址栏，不立即 navigate()——util.js 加载时 skills/running 模块尚未加载，
   立即 navigate() 会因 skTreeClose/rkLoad 未定义抛 ReferenceError，并中断 WEEK 等后续顶层赋值。 */
if(location.hash && /^#\//.test(location.hash)){
  try{ history.replaceState(null,"",location.hash.slice(1)); }catch(e){ /* 本地 file:// 预览下 replaceState 受限 */ }
}

/* ================= 工作台：日期 + 问候 ================= */
var WEEK = ["日","一","二","三","四","五","六"];
function greetFor(h){
  if(h>=5 && h<11)  return "早上好";
  if(h>=11 && h<13) return "中午好";
  if(h>=13 && h<18) return "下午好";
  if(h>=18 && h<23) return "晚上好";
  return "夜深了，注意休息";
}
function renderClock(){
  var d = new Date();
  $("fullDate").textContent = d.getFullYear()+"年"+(d.getMonth()+1)+"月"+d.getDate()+"日 星期"+WEEK[d.getDay()];
  $("greetText").textContent = greetFor(d.getHours());
}
setInterval(renderClock, 60000);

/* ================= 工作台：天气 =================
   数据源：ipwho.is（IP 定位，返回城市/经纬度）+ Open-Meteo（天气，免费无 key，原生支持 CORS）。
   天气代码采用 WMO weather code（0-99）。 */
function weatherIcon(code){
  var c = parseInt(code,10);
  var sun='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg>';
  var cloud='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 1.8A3.8 3.8 0 0 0 7 19h10.5z"/></svg>';
  var rain='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 16a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 1.8A3.8 3.8 0 0 0 7 16h10.5z"/><path d="M8 20l-1 2M12.5 20l-1 2M17 20l-1 2"/></svg>';
  var snow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 16a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 1.8A3.8 3.8 0 0 0 7 16h10.5z"/><path d="M9.5 20l.5 1M14 20l.5 1"/></svg>';
  var fog='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7a6 6 0 0 1 12 0M3 13h18M5 17h14M7 21h10"/></svg>';
  var bolt='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 16a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 1.8A3.8 3.8 0 0 0 7 16h10.5z"/><path d="M13 11l-3 4h4l-3 4"/></svg>';
  var part='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="4.5"/><path d="M16 17.5a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 1.8A3.8 3.8 0 0 0 5 17.5h11z"/></svg>';
  if(c===0 || c===1) return sun;               // 晴
  if(c===2) return part;                       // 多云
  if(c===3) return cloud;                      // 阴
  if(c===45 || c===48) return fog;             // 雾
  if(c>=51 && c<=67) return rain;              // 毛毛雨/雨/冻雨
  if(c>=71 && c<=77) return snow;              // 雪
  if(c>=80 && c<=82) return rain;              // 阵雨
  if(c===85 || c===86) return snow;            // 阵雪
  if(c>=95) return bolt;                       // 雷暴
  return part;
}
/* WMO 天气代码 → 中文描述 */
function weatherDesc(code){
  var c = parseInt(code,10);
  if(c===0 || c===1) return "晴";
  if(c===2) return "多云";
  if(c===3) return "阴";
  if(c===45 || c===48) return "雾";
  if(c>=51 && c<=55) return "毛毛雨";
  if(c===56 || c===57) return "冻毛毛雨";
  if(c>=61 && c<=65) return "雨";
  if(c===66 || c===67) return "冻雨";
  if(c>=71 && c<=75) return "雪";
  if(c===77) return "雪粒";
  if(c>=80 && c<=82) return "阵雨";
  if(c===85 || c===86) return "阵雪";
  if(c>=95) return "雷暴";
  return "晴";
}
/* IP 定位：geojs.io 主源，ipwho.is 兜底（均免费无 key、支持 CORS） */
function fetchLoc(){
  function fromGeojs(){
    return fetch("https://get.geojs.io/v1/ip/geo.json")
      .then(function(r){ if(!r.ok) throw new Error("g "+r.status); return r.json(); })
      .then(function(g){
        if(!g || !g.latitude || !g.longitude) throw new Error("no loc");
        return { city:g.city || "", region:g.region || "", lat:Number(g.latitude), lon:Number(g.longitude) };
      });
  }
  function fromIpwho(){
    return fetch("https://ipwho.is/")
      .then(function(r){ if(!r.ok) throw new Error("i "+r.status); return r.json(); })
      .then(function(j){
        if(!j || j.success !== true || !j.latitude || !j.longitude) throw new Error("no loc");
        return { city:j.city || "", region:j.region || "", lat:Number(j.latitude), lon:Number(j.longitude) };
      });
  }
  return fromGeojs().catch(fromIpwho);
}
function loadWeather(manual){
  var box=$("weatherText");
  if(!manual){ box.textContent = "天气获取中…"; }
  var refreshBtn = '<button class="w-refresh" onclick="loadWeather(true)" title="刷新天气"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v6h-6"/></svg></button>';
  fetchLoc()
    .then(function(loc){
      var city = loc.city, region = loc.region;
      var m = "https://api.open-meteo.com/v1/forecast?latitude="+loc.lat+"&longitude="+loc.lon+"&current=temperature_2m,weather_code&timezone=auto";
      return fetch(m)
        .then(function(r){ if(!r.ok) throw new Error("w "+r.status); return r.json(); })
        .then(function(j){
          var cur = j && j.current;
          if(!cur) throw new Error("no data");
          var temp = Math.round(Number(cur.temperature_2m));
          var code = cur.weather_code;
          var desc = weatherDesc(code);
          $("weatherBox").innerHTML = weatherIcon(code) + "<span id=\"weatherText\">" + esc(city+(region&&region!==city?"·"+region:"")+" · "+desc+" "+temp+"°C") + "</span>" + refreshBtn;
          box=$("weatherText");
          store(KEY_PREFIX+"weather", JSON.stringify({t:Date.now(), txt:box.textContent}));
        });
    })
    .catch(function(){
      var cached = load(KEY_PREFIX+"weather");
      if(cached){
        try{ var c=JSON.parse(cached); $("weatherBox").innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 16a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 1.8A3.8 3.8 0 0 0 7 16h10.5z"/></svg><span id="weatherText">'+esc(c.txt)+'（离线缓存）</span>'+refreshBtn; }
        catch(e){ $("weatherText").textContent="天气获取失败，点击右侧刷新重试"; }
      }else{
        $("weatherText").textContent="天气获取失败（离线），点击右侧刷新重试";
      }
    });
}

