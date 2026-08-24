"use strict";
/* ================= Running (run)：数据源 = running 仓库直连（preview 抽帧数据） ================= */
var RK_URL = "https://raw.githubusercontent.com/GuoxinL/running/master/src/static/activities.preview.json";
var RK_CACHE = "wb_rk_acts_v2";
/* MapCN（CARTO Basemaps）免费瓦片，无 token；默认浅色固定（与 running 仓库
   activities.preview.png 生成规格一致：640:360 + z8 + 浅色，不随系统明暗切换），
   用户可手动切 明亮 / 暗色（浅色 / 明亮 / 暗色 三档循环） */
var RK_STYLES = [
  { k:"light",   n:"浅色", bg:"#e9e5dd", url:"https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png" },
  { k:"voyager", n:"明亮", bg:"#e9e5dd", url:"https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png" },
  { k:"dark",    n:"暗色", bg:"#1a2234", url:"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" }
];
var RK_STYLE_KEY = "wb_run_map_style";
var RK_TILE = 256, RK_Z_MIN = 3, RK_Z_MAX = 18;
/* 全量轨迹垫底 PNG（running 仓库构建产物：浅灰纯色底图 + 全量轨迹，1x 640x360，
   位图解码 + GPU 合成秒显不卡，矢量层就绪后无缝切换） */
var RK_PV_URL = "https://raw.githubusercontent.com/GuoxinL/running/master/src/static/activities.preview.png";
/* 垫底 PNG 的视角元数据（cx/cy 为 z13 世界像素中心，z 为 zoom）：
   矢量层初始视角优先用它，保证垫底与矢量层切换零跳动 */
var RK_META_URL = "https://raw.githubusercontent.com/GuoxinL/running/master/src/static/activities.preview.meta.json";
/* 固定投影基准 zoom：与 running/scripts/prebuild_preview.py 的 RK_Z 一致。
   所有轨迹只在此 zoom 的世界像素投影一次，缩放/平移仅改 viewBox（零重投影） */
var RK_BASE_Z = 13;
/* 投影抽稀上限：全量 345K 点在缩放时每次 viewBox 变化都触发整张 SVG 重光栅化，
   中低端设备（核显/移动端）会明显掉帧。非选中轨迹抽稀到至多 RK_THIN_MAX 点
   （视觉无差，光栅化成本降 ~4 倍），选中轨迹保留全量（单条放大查看精度不损） */
var RK_THIN_MAX = 500;
/* 解析实际生效的样式索引：默认浅色固定（三档无 auto，直接返回目标档） */
function rkResolveStyle(idx){
  return RK_STYLES[idx] || RK_STYLES[0];
}
var RK_RUN_PAL = ["#fed7aa","#fb923c","#f97316","#ea580c"];   /* 对齐 running_page TYPE_PALETTES.Run */
var RK_RIDE_PAL = ["#bfdbfe","#60a5fa","#3b82f6","#2563eb"];
var RK_ALL_PAL = ["#e9d5ff","#c084fc","#a855f7","#7c3aed"];
var rkActs = null;               /* 规整后的活动数组 */
var rkState = { year:String(new Date().getFullYear()), trend:"m", listYear:"all", listN:30, selId:0 };

function rkEl(id){ try{ return document.getElementById(id); }catch(e){ return null; } }
/* 当前样式索引：默认 0=浅色（固定浅色），用户切换后存 localStorage */
function rkMapStyleIdx(){
  try{
    var i = parseInt(localStorage.getItem(RK_STYLE_KEY), 10);
    return (i >= 0 && i < RK_STYLES.length) ? i : 0;
  }catch(e){ return 0; }
}

/* ---- 数据解析（verify 可测）---- */
function rkParse(json){
  var arr = json;
  if(typeof arr === "string") arr = JSON.parse(arr);
  if(!arr || !Array.isArray(arr)) return [];
  return arr.map(function(a){
    return {
      id: a.run_id != null ? String(a.run_id) : "0",
      name: a.name || "",
      dist: Number(a.distance) || 0,
      mt: a.moving_time || "",
      type: a.type || a.subtype || "Run",
      sub: a.subtype || "",
      date: a.start_date_local || a.start_date || "",
      city: a.location_city || a.location_country || "",
      thumb: a.thumbnail || "",
      poly: a.summary_polyline || "",
      hr: Number(a.average_heartrate) || 0,
      spd: Number(a.average_speed) || 0,
      elev: Number(a.elevation_gain) || 0,
      streak: Number(a.streak) || 0
    };
  }).filter(function(a){ return a.dist > 0 || a.date; });
}
/* moving_time -> 秒；支持 '12:34:56' 与 '2 days, 12:34:56'（对齐 convertMovingTime2Sec） */
function rkMovingSec(t){
  if(!t) return 0;
  var s = String(t), days = 0;
  if(s.indexOf("day") >= 0){
    var dm = s.match(/(\d+)\s*days?/);
    if(dm) days = parseInt(dm[1], 10);
    s = s.split(",").pop();
  }
  var p = s.trim().split(":").map(Number);
  if(p.length === 3) return days*86400 + p[0]*3600 + p[1]*60 + p[2];
  if(p.length === 2) return days*86400 + p[0]*60 + p[1];
  if(p.length === 1) return days*86400 + (p[0]||0);
  return 0;
}
/* formatDistance：Math.round(m/1000)（对齐 running_page 新版） */
function rkFmtDist(m){ return Math.round((Number(m)||0)/1000).toString(); }
/* formatPace：paceMin=1000/60/speedMs -> m:ss（对齐 running_page 新版） */
function rkPace(spd){
  if(!spd || spd <= 0) return "--";
  var pm = 1000/60/spd, min = Math.floor(pm), sec = Math.round((pm-min)*60);
  if(sec === 60){ min += 1; sec = 0; }
  return min + ":" + (sec<10?"0":"") + sec;
}
/* 秒 -> '5h 32m' */
function rkFmtDur(sec){
  sec = Math.round(sec||0);
  var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  if(h > 0) return h + "h " + m + "m";
  return m + "m";
}
/* 秒 -> 'H:MM:SS' 或 'M:SS'（PB 展示用） */
function rkFmtClock(sec){
  sec = Math.floor(sec||0);
  var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  if(h > 0) return h + ":" + (m<10?"0":"") + m + ":" + (s<10?"0":"") + s;
  return m + ":" + (s<10?"0":"") + s;
}
/* 日期倒序（对齐 sortDateFunc） */
function rkSortDate(a, b){
  function ts(x){ return x.date ? new Date(x.date.replace(" ","T")).getTime() : 0; }
  return ts(b) - ts(a);
}
/* 可用年份倒序（对齐 getAvailableYears） */
function rkYears(acts){
  var set = {};
  (acts||[]).forEach(function(a){ if(a.date) set[a.date.slice(0,4)] = 1; });
  return Object.keys(set).sort(function(a,b){ return Number(b)-Number(a); });
}
/* 全量统计 */
function rkStats(acts){
  var s = { dist:0, sec:0, count:0, days:0, elev:0, runDist:0, runSec:0, runN:0, pace:0 };
  var daySet = {};
  (acts||[]).forEach(function(a){
    s.dist += a.dist;
    s.sec += rkMovingSec(a.mt);
    s.count += 1;
    if(a.date) daySet[a.date.slice(0,10)] = 1;
    s.elev += a.elev;
    if(a.type === "Run"){ s.runDist += a.dist; s.runSec += rkMovingSec(a.mt); s.runN += 1; }
  });
  s.days = Object.keys(daySet).length;
  if(s.runSec > 0 && s.runDist > 0) s.pace = s.runDist/s.runSec;
  return s;
}
/* 年度热力图网格（对齐 ContributionHeatmap.buildYearGrid） */
function rkHeatYear(acts, yr){
  yr = String(yr);
  var ya = (acts||[]).filter(function(a){ return a.date && a.date.slice(0,4) === yr; });
  var dayMap = {}, dayActs = {};
  ya.forEach(function(a){
    var d = a.date.slice(0,10);
    dayMap[d] = (dayMap[d]||0) + (a.dist > 0 ? a.dist : 1);
    (dayActs[d] = dayActs[d] || []).push(a);
  });
  var vals = []; for(var k in dayMap) vals.push(dayMap[k]);
  var max = vals.length ? Math.max.apply(null, vals) : 1;
  var start = new Date(+yr, 0, 1), startDay = start.getDay();
  var totalDays = Math.round((new Date(+yr, 11, 31).getTime() - start.getTime())/86400000) + 1;
  var grid = [], months = [], curM = -1;
  for(var d = 0; d < totalDays; d++){
    var dt = new Date(+yr, 0, 1 + d);
    var wi = Math.floor((d + startDay)/7);
    while(grid.length <= wi) grid.push([]);
    var key = yr + "-" + ((dt.getMonth()+1)<10?"0":"") + (dt.getMonth()+1) + "-" + (dt.getDate()<10?"0":"") + dt.getDate();
    var da = dayActs[key] || [], dist = dayMap[key] || 0;
    grid[wi].push({ date:key, dist:dist, n:da.length });
    if(dt.getMonth() !== curM){ curM = dt.getMonth(); months.push({ m:curM+1, w:wi }); }
  }
  var rd = 0, rt = 0, tot = 0, tc = 0;
  ya.forEach(function(a){
    tot += a.dist; tc += 1;
    if(a.type === "Run"){ rd += a.dist; rt += rkMovingSec(a.mt); }
  });
  return { grid:grid, max:max, months:months, count:tc, dist:tot, sec: ya.reduce(function(s,a){ return s+rkMovingSec(a.mt); },0), pace: (rt>0 && rd>0 ? rd/rt : 0) };
}
/* 热力图 4 级色阶（对齐 getColor：level=ceil(min(dist/max,1)*4)） */
function rkHeatColor(dist, max, palette){
  if(!dist || dist <= 0) return "";
  var level = Math.ceil(Math.min(dist/max, 1) * 4);
  return (palette||RK_RUN_PAL)[level-1] || (palette||RK_RUN_PAL)[0];
}
/* 个人最佳（对齐 PersonalBest：窗口 + 配速过滤 + 最快 moving_time） */
function rkPbs(acts){
  var runs = (acts||[]).filter(function(a){ return a.type === "Run" && a.poly && a.poly.length > 20; });
  var win = [ {k:"5K", min:4.8, max:5.5}, {k:"10K", min:9.5, max:11}, {k:"Half", min:20, max:22.5}, {k:"Full", min:41, max:44} ];
  return win.map(function(w){
    var best = null, bt = 0;
    runs.forEach(function(a){
      var km = a.dist/1000;
      if(km < w.min || km > w.max) return;
      var t = rkMovingSec(a.mt), p = km > 0 ? t/km : 0;
      if(p < 180 || p > 480) return;
      if(!best || t < bt){ best = a; bt = t; }
    });
    return { key:w.k, act:best, time:bt };
  });
}
/* 月度距离汇总 */
function rkMonthDist(acts, yr){
  yr = String(yr);
  var m = [0,0,0,0,0,0,0,0,0,0,0,0], c = [0,0,0,0,0,0,0,0,0,0,0,0];
  (acts||[]).forEach(function(a){
    if(!a.date || a.date.slice(0,4) !== yr) return;
    var mo = parseInt(a.date.slice(5,7), 10) - 1;
    if(mo < 0 || mo > 11) return;
    m[mo] += a.dist; c[mo] += 1;
  });
  return { dist:m, count:c };
}
/* 年度距离汇总 */
function rkYearDist(acts){
  var map = {};
  (acts||[]).forEach(function(a){
    if(!a.date) return;
    var y = a.date.slice(0,4);
    map[y] = (map[y]||0) + a.dist;
  });
  return map;
}
/* Google encoded polyline 解码（precision 5） */
function rkDecodePolyline(str){
  if(!str) return [];
  var idx = 0, lat = 0, lng = 0, out = [], len = str.length;
  while(idx < len){
    var res = 0, shift = 0, b;
    do{ b = str.charCodeAt(idx++) - 63; res |= (b & 0x1f) << shift; shift += 5; }while(b >= 0x20);
    var dlat = (res & 1) ? ~(res >> 1) : (res >> 1); lat += dlat;
    res = 0; shift = 0;
    do{ b = str.charCodeAt(idx++) - 63; res |= (b & 0x1f) << shift; shift += 5; }while(b >= 0x20);
    var dlng = (res & 1) ? ~(res >> 1) : (res >> 1); lng += dlng;
    out.push([lat/1e5, lng/1e5]);
  }
  return out;
}
/* 活动标题（对齐 classic titleForRun：距离 / 时段） */
function rkTitleFor(a){
  var km = a.dist/1000;
  if(km > 20 && km < 40) return "半程马拉松";
  if(km >= 40) return "全程马拉松";
  var hr = parseInt((a.date||"").slice(11,13), 10);
  if(isNaN(hr)) return "运动";
  if(hr >= 0 && hr <= 10) return "清晨跑步";
  if(hr > 10 && hr <= 14) return "午间跑步";
  if(hr > 14 && hr <= 18) return "午后跑步";
  if(hr > 18 && hr <= 21) return "傍晚跑步";
  return "夜晚跑步";
}
function rkTypeTag(t){
  var map = { "Run":"跑步", "Ride":"骑行", "Hike":"徒步", "Walk":"步行", "Walking":"步行", "Workout":"训练" };
  return map[t] || t || "运动";
}
/* 千分位 */
function rkComma(x){
  var s = String(x);
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/* ---- 状态条 ---- */
function rkBar(text, cls){
  var b = rkEl("rkBar"), d = rkEl("rkDot"), t = rkEl("rkBarText");
  if(d) d.className = "dot" + (cls ? " " + cls : "");
  if(t) t.textContent = text;
  if(b) b.style.display = "flex";
}

/* ---- 渲染：统计卡 ---- */
function rkRenderStats(){
  var s = rkStats(rkActs);
  var cards = [
    { k:"总距离", v:rkFmtDist(s.dist), u:"km", ic:"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M13 7h8m0 0v8m0-8l-8 8-4-4-6 6\"/></svg>" },
    { k:"总时长", v:rkFmtDur(s.sec), u:"", ic:"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 3\"/></svg>" },
    { k:"运动次数", v:rkComma(s.count), u:"次", ic:"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z\"/><path d=\"M4 22v-7\"/></svg>" },
    { k:"运动天数", v:rkComma(s.days), u:"天", ic:"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M8 3v4M16 3v4M3 10h18\"/></svg>" },
    { k:"累计爬升", v:rkComma(Math.round(s.elev)), u:"m", ic:"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 3l4 8 5-5 5 15H2L8 3z\"/></svg>" }
  ];
  var h = "";
  cards.forEach(function(c){
    h += "<div class=\"rk-card\"><div class=\"rk-k\">" + c.ic + c.k + "</div><div class=\"rk-v\">" + c.v + "<small>" + c.u + "</small></div></div>";
  });
  var e = rkEl("rkStats"); if(e) e.innerHTML = h;
}

/* ---- 渲染：年度热力图 ---- */
function rkHeatSel(y){
  rkState.year = y;
  rkRenderHeatTabs();
  rkRenderHeat();
}
function rkRenderHeatTabs(){
  var ys = rkYears(rkActs), e = rkEl("rkHeatTabs");
  if(!e) return;
  var h = "";
  ys.forEach(function(v){
    h += "<button class=\"rk-tab" + (rkState.year===v ? " active" : "") + "\" onclick=\"rkHeatSel('" + v + "')\">" + v + "</button>";
  });
  e.innerHTML = h;
  rkRenderHeat();
}
function rkRenderHeat(){
  var out = rkEl("rkHeatOut");
  if(!out) return;
  out.innerHTML = rkHeatYearHTML(rkState.year);
}
function rkHeatYearHTML(yr){
  var g = rkHeatYear(rkActs, yr);
  var h = "<div style=\"margin-bottom:20px\">";
  h += "<div style=\"display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap\">";
  h += "<span style=\"font-size:12px;font-weight:600;color:var(--primary)\">" + yr + "</span>";
  h += "<span style=\"font-size:12px;color:var(--text3)\">" + g.count + " 次 · " + rkFmtDist(g.dist) + " km · " + rkFmtDur(g.sec) + (g.pace > 0 ? " · 均配 " + rkPace(g.pace) : "") + "</span>";
  h += "</div>";
  /* 月份标签 + 网格：共用横向滚动容器（窄屏对齐滚动，避免撑开页面宽度） */
  h += "<div class=\"rk-heat-wrap\">";
  h += "<div class=\"rk-heat-mths\">";
  g.months.forEach(function(m, i){
    var nw = i+1 < g.months.length ? g.months[i+1].w : g.grid.length;
    var span = Math.max(1, nw - m.w);
    h += "<span style=\"font-size:10px;color:var(--text3);width:" + (span*15) + "px;flex-shrink:0\">" + m.m + "月</span>";
  });
  h += "</div>";
  /* 星期标签 + 网格 */
  h += "<div class=\"rk-heat\">";
  h += "<div class=\"rk-wd\"><span></span><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span></div>";
  g.grid.forEach(function(week){
    h += "<div class=\"rk-col\">";
    week.forEach(function(day){
      var c = rkHeatColor(day.dist, g.max, RK_RUN_PAL);
      var tip = day.n ? (day.date + ": " + (day.dist/1000).toFixed(1) + " km") : day.date;
      h += "<div class=\"rk-cell" + (day.n ? " act" : "") + "\" style=\"" + (c ? "background:" + c : "") + "\" title=\"" + tip + "\"></div>";
    });
    h += "</div>";
  });
  h += "</div>";
  h += "</div>";
  h += "<div class=\"rk-legend\"><span>少</span>";
  [0.1, 0.35, 0.6, 0.82, 1].forEach(function(r){
    h += "<span class=\"rk-cell\" style=\"background:" + rkHeatColor(r * g.max, g.max, RK_RUN_PAL) + "\"></span>";
  });
  h += "<span>多</span><span style=\"margin-left:10px\">点击格子可看当天记录</span></div>";
  h += "</div>";
  return h;
}

/* ---- 渲染：趋势图（SVG 柱状） ---- */
function rkTrendMode(m){
  rkState.trend = m;
  var tabs = document.querySelectorAll("#rkTrendTabs .rk-tab");
  for(var i=0;i<tabs.length;i++) tabs[i].classList.toggle("active", tabs[i].getAttribute("data-tt") === m);
  rkRenderTrend();
}
function rkRenderTrend(){
  var out = rkEl("rkTrendOut");
  if(!out) return;
  if(rkState.trend === "m"){
    var yr = Number(rkState.year);
    var md = rkMonthDist(rkActs, yr);
    out.innerHTML = rkTrendSVG(md.dist, md.count, null, yr + " 年各月跑量（km）");
  } else {
    var yd = rkYearDist(rkActs);
    var ys = Object.keys(yd).sort(function(a,b){ return Number(a)-Number(b); });
    out.innerHTML = rkTrendSVG(ys.map(function(y){ return yd[y]; }), null, ys, "历年跑量（km）");
  }
}
function rkTrendSVG(vals, counts, labels, title){
  var max = Math.max.apply(null, vals.concat([0]));
  var W = 720, H = 220, padL = 36, padB = 26, padT = 16, padR = 10;
  var n = vals.length, bw = (W - padL - padR) / Math.max(n, 1);
  var h = "<svg class=\"rk-trend\" viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"" + esc(title) + "\">";
  h += "<text x=\"" + padL + "\" y=\"14\" font-size=\"12\" fill=\"var(--text2)\">" + esc(title) + "</text>";
  for(var gi = 0; gi <= 4; gi++){
    var gy = padT + (H-padT-padB) * (1 - gi/4);
    h += "<line x1=\"" + padL + "\" y1=\"" + gy + "\" x2=\"" + (W-padR) + "\" y2=\"" + gy + "\" stroke=\"var(--border)\" stroke-width=\"1\"/>";
    var gv = Math.round(max*gi/4);
    h += "<text x=\"" + (padL-6) + "\" y=\"" + (gy+4) + "\" font-size=\"10\" fill=\"var(--text3)\" text-anchor=\"end\">" + gv + "</text>";
  }
  vals.forEach(function(v, i){
    var bh = v > 0 ? Math.max((H-padT-padB) * v / max, 2) : 0;
    var x = padL + bw*i + bw*0.15, w = Math.max(bw*0.7, 2);
    var y = padT + (H-padT-padB) - bh;
    h += "<rect x=\"" + x + "\" y=\"" + y + "\" width=\"" + w + "\" height=\"" + bh + "\" rx=\"2\" style=\"fill:var(--primary)\" opacity=\"0.85\"><title>" + esc((labels ? labels[i] + "年 " : (i+1) + "月 ")) + Math.round(v) + " km" + (counts ? " · " + counts[i] + " 次" : "") + "</title></rect>";
    var lbl = labels ? labels[i] : (i+1) + "月";
    if(n <= 15 || i % 2 === 0){
      h += "<text x=\"" + (x+w/2) + "\" y=\"" + (H-9) + "\" font-size=\"9\" fill=\"var(--text3)\" text-anchor=\"middle\">" + lbl + "</text>";
    }
  });
  h += "</svg>";
  return h;
}

/* ---- 渲染：个人最佳 ---- */
function rkRenderPbs(){
  var pbs = rkPbs(rkActs);
  var names = { "5K":"5公里", "10K":"10公里", "Half":"半程马拉松", "Full":"全程马拉松" };
  var h = "";
  pbs.forEach(function(p){
    if(p.act){
      var d = p.act.date ? p.act.date.slice(0,10) : "";
      h += "<div class=\"rk-pb-item\"><div class=\"rk-pb-k\">" + names[p.key] + "</div><div class=\"rk-pb-v\">" + rkFmtClock(p.time) + "</div><div class=\"rk-pb-d\">" + rkFmtDist(p.act.dist) + " km · " + d + "</div></div>";
    } else {
      h += "<div class=\"rk-pb-item\"><div class=\"rk-pb-k\">" + names[p.key] + "</div><div class=\"rk-pb-v\" style=\"font-size:15px;color:var(--text3)\">暂无</div><div class=\"rk-pb-d\">窗口内无符合记录</div></div>";
    }
  });
  var e = rkEl("rkPbs"); if(e) e.innerHTML = h;
}

/* ---- 渲染：活动列表 ---- */
function rkRenderListTools(){
  var e = rkEl("rkListTools");
  if(!e) return;
  var h = "<select class=\"indent\" onchange=\"rkListSel(this.value)\">";
  h += "<option value=\"all\"" + (rkState.listYear==="all" ? " selected" : "") + ">全部年份</option>";
  rkYears(rkActs).forEach(function(y){
    h += "<option value=\"" + y + "\"" + (rkState.listYear===y ? " selected" : "") + ">" + y + " 年</option>";
  });
  h += "</select>";
  e.innerHTML = h;
  rkRenderList();
}
function rkListSel(y){
  rkState.listYear = y; rkState.listN = 30;
  rkRenderList();
}
function rkRenderList(){
  var e = rkEl("rkList");
  if(!e) return;
  var acts = rkActs.slice().sort(rkSortDate);
  if(rkState.listYear !== "all") acts = acts.filter(function(a){ return (a.date||"").slice(0,4) === rkState.listYear; });
  var show = acts.slice(0, rkState.listN);
  var pinIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var h = "";
  show.forEach(function(a){
    var d = (a.date||"").slice(0,10);
    var t = rkMovingSec(a.mt);
    var kmh = a.spd ? (a.spd*3.6) : (a.dist > 0 && t > 0 ? a.dist/t*3.6 : 0);
    var nm = a.name || rkTitleFor(a);
    h += "<div class=\"rk-actcard\" onclick=\"rkOpenAct('" + a.id + "')\" title=\"查看轨迹回放\">";
    h += "<div class=\"rk-act-thumb\">" + (a.thumb ? "<img src=\"" + esc(a.thumb) + "\" alt=\"\" loading=\"lazy\">" : "") + "<span class=\"rk-act-tag\">" + rkTypeTag(a.type) + "</span></div>";
    h += "<div class=\"rk-act-body\">";
    h += "<div class=\"rk-act-title\">" + esc(nm) + "</div>";
    h += "<div class=\"rk-act-meta\">";
    h += "<span class=\"rk-act-loc\">" + pinIc + "<span>" + esc(a.city || "未知地点") + "</span></span>";
    h += "<span>" + d + "</span>";
    h += "</div>";
    h += "<div class=\"rk-act-stats\">";
    h += "<div class=\"rk-act-stat\"><b>" + (a.dist/1000).toFixed(1) + "</b><span>公里</span></div>";
    h += "<div class=\"rk-act-stat\"><b>" + (kmh ? kmh.toFixed(1) : "--") + "</b><span>km/h</span></div>";
    h += "<div class=\"rk-act-stat\"><b>" + rkFmtDur(t) + "</b><span>时长</span></div>";
    h += "</div>";
    h += "</div></div>";
  });
  if(!h) h = "<div class=\"rk-empty\">该年份暂无记录</div>";
  if(acts.length > rkState.listN) h += "<button class=\"rk-more\" onclick=\"rkMore()\">加载更多（已显示 " + rkState.listN + " / " + acts.length + "）</button>";
  e.innerHTML = h;
}
function rkMore(){ rkState.listN += 30; rkRenderList(); }

/* ---- 活动详情弹窗 + 轨迹回放动画 ---- */
var RK_ACT_DUR = 8;          /* 单条轨迹回放时长（秒），循环播放 */
var rkActAnim = null;        /* 当前回放动画句柄 */
function rkOpenAct(id){
  var a = null;
  (rkActs||[]).forEach(function(x){ if(x.id === id) a = x; });
  if(!a) return;
  var m = rkEl("rkActModal");
  if(m) m.classList.add("show");
  rkActInfo(a);
  rkActReplay(a);
}
function rkCloseAct(){
  var m = rkEl("rkActModal");
  if(m) m.classList.remove("show");
  rkActStop();
}
function rkMaskClose(ev){
  if(ev && ev.target && ev.target.id === "rkActModal") rkCloseAct();
}
function rkActStop(){
  if(rkActAnim){ cancelAnimationFrame(rkActAnim); rkActAnim = null; }
}
function rkActInfo(a){
  var e = rkEl("rkActInfo");
  if(!e) return;
  var t = rkMovingSec(a.mt);
  var kmh = a.spd ? (a.spd*3.6) : (a.dist > 0 && t > 0 ? a.dist/t*3.6 : 0);
  var pace = a.spd ? rkPace(a.spd) : (a.dist > 0 && t > 0 ? rkPace(a.dist/t) : "--");
  var cells = [
    { k:"距离", v:(a.dist/1000).toFixed(2), u:"km" },
    { k:"时长", v:rkFmtDur(t), u:"" },
    { k:"平均时速", v:(kmh ? kmh.toFixed(1) : "--"), u:"km/h" },
    { k:"平均配速", v:pace, u:"/km" },
    { k:"累计爬升", v:String(a.elev||0), u:"m" },
    { k:"平均心率", v:(a.hr ? String(a.hr) : "--"), u:(a.hr ? "bpm" : "") }
  ];
  var h = "<div class=\"rk-ai-title\"><span class=\"rk-act-tag\">" + rkTypeTag(a.type) + "</span><span class=\"rk-ai-name\">" + esc(a.name || rkTitleFor(a)) + "</span></div>";
  h += "<div class=\"rk-ai-sub\"><span>" + esc(a.date || "") + "</span>" + (a.city ? "<span>· " + esc(a.city) + "</span>" : "") + "</div>";
  h += "<div class=\"rk-act-grid\">";
  cells.forEach(function(c){
    h += "<div class=\"rk-act-cell\"><div class=\"rk-k\">" + c.k + "</div><div class=\"rk-v\">" + c.v + (c.u ? " <small>" + c.u + "</small>" : "") + "</div></div>";
  });
  h += "</div>";
  e.innerHTML = h;
}
/* 回放底图样式：跟随系统默认明暗（浅色系统 → light，暗色系统 → dark）。
   与运行页地图三档手动切换相互独立，回放底图不做手动切换。 */
function rkActBgStyle(){
  var dark = false;
  try{
    if(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) dark = true;
  }catch(e){}
  return dark ? RK_STYLES[2] : RK_STYLES[0];
}
/* 把视口内瓦片异步画到离屏 canvas（bgCtx）作为回放底图；单块加载失败保留占位底色，
   不阻断回放动画（渐进加载，加载完成即随下一帧呈现）。 */
function rkActLoadBg(bgCtx, z, vx0, vy0, W, H, style){
  var tx0 = Math.floor(vx0 / RK_TILE), ty0 = Math.floor(vy0 / RK_TILE);
  var tx1 = Math.floor((vx0 + W) / RK_TILE), ty1 = Math.floor((vy0 + H) / RK_TILE);
  var n = Math.pow(2, z);
  for(var ty = ty0; ty <= ty1; ty++){
    for(var tx = tx0; tx <= tx1; tx++){
      (function(tx, ty){
        var wx = ((tx % n) + n) % n;
        var u = style.url.replace("{z}", z).replace("{x}", wx).replace("{y}", ty);
        if(u.indexOf("{s}") >= 0) u = u.replace("{s}", "abcd"[(wx + ty + z) % 4]);
        var img = new Image();
        img.onload = function(){
          bgCtx.drawImage(img, tx*RK_TILE - vx0, ty*RK_TILE - vy0, RK_TILE, RK_TILE);
        };
        img.src = u;
      })(tx, ty);
    }
  }
}
/* 轨迹回放：解码 polyline -> Web Mercator 投影到 canvas（与 MapCN 瓦片底图严格对齐）
   -> 标记点沿轨迹循环移动，进入即自动播放；底图样式跟随系统默认明暗 */
function rkActReplay(a){
  var wrap = rkEl("rkActVideo");
  if(!wrap) return;
  var hint = wrap.querySelector(".rk-act-hint");
  var coords = rkDecodePolyline(a.poly);
  var oldCv = wrap.querySelector("canvas");
  if(!coords || coords.length < 2){
    if(oldCv) oldCv.remove();
    if(hint) hint.textContent = "无轨迹数据";
    rkActStop();
    return;
  }
  coords = rkThin(coords, 500);
  if(!oldCv){
    oldCv = document.createElement("canvas");
    oldCv.style.cssText = "width:100%;height:100%;display:block";
    wrap.insertBefore(oldCv, wrap.firstChild);
  }
  if(hint) hint.textContent = "轨迹回放";
  var W = 1280, H = 720;
  if(oldCv.width !== W){ oldCv.width = W; oldCv.height = H; }
  var ctx = oldCv.getContext("2d");

  var lats = coords.map(function(c){ return c[0]; });
  var lngs = coords.map(function(c){ return c[1]; });
  var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
  var minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
  var pad = 70;

  /* Web Mercator 投影：选 zoom 使轨迹铺满画布（留 pad），轨迹与瓦片底图严格对齐 */
  function bboxAt(z2){
    var a = rkMerc(minLng, minLat, z2), b = rkMerc(maxLng, maxLat, z2);
    return { x0:a[0], x1:b[0], y0:b[1], y1:a[1], w:Math.max(b[0]-a[0], 1e-6), h:Math.max(a[1]-b[1], 1e-6) };
  }
  var z = RK_BASE_Z, bb = bboxAt(z);
  while(z < RK_Z_MAX && (bb.w < (W - 2*pad)*0.6 || bb.h < (H - 2*pad)*0.6)){ z++; bb = bboxAt(z); }
  while(z > RK_Z_MIN && (bb.w > W - 2*pad || bb.h > H - 2*pad)){ z--; bb = bboxAt(z); }

  var cx = (bb.x0 + bb.x1)/2, cy = (bb.y0 + bb.y1)/2;
  var pts = coords.map(function(c){
    var p = rkMerc(c[1], c[0], z);
    return [ p[0] - cx + W/2, p[1] - cy + H/2 ];
  });

  var cum = [0], i;
  for(i = 1; i < pts.length; i++){
    var dx = pts[i][0] - pts[i-1][0], dy = pts[i][1] - pts[i-1][1];
    cum.push(cum[i-1] + Math.sqrt(dx*dx + dy*dy));
  }
  var total = cum[cum.length - 1] || 1;
  var col = rkTrackColor(a.type);

  /* 瓦片底图背景（离屏 canvas，跟随系统默认明暗），动画帧先铺背景再画轨迹 */
  var bgCv = document.createElement("canvas");
  bgCv.width = W; bgCv.height = H;
  var bgCtx = bgCv.getContext("2d");
  var bgStyle = rkActBgStyle();
  bgCtx.fillStyle = bgStyle.bg;
  bgCtx.fillRect(0, 0, W, H);
  rkActLoadBg(bgCtx, z, cx - W/2, cy - H/2, W, H, bgStyle);

  function draw(prog){
    var d = prog * total, j = 0;
    while(j < cum.length - 1 && cum[j+1] < d) j++;
    var seg = (cum[j+1] - cum[j]) || 1;
    var f = (d - cum[j]) / seg;
    var curX = pts[j][0] + (pts[j+1][0] - pts[j][0]) * f;
    var curY = pts[j][1] + (pts[j+1][1] - pts[j][1]) * f;

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bgCv, 0, 0);
    ctx.lineCap = "round"; ctx.lineJoin = "round";

    ctx.strokeStyle = "rgba(148,163,184,.32)";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for(var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.stroke();

    ctx.strokeStyle = col;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for(var k2 = 1; k2 <= j; k2++) ctx.lineTo(pts[k2][0], pts[k2][1]);
    ctx.lineTo(curX, curY);
    ctx.stroke();

    ctx.fillStyle = "#34d399";
    ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 6, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.3)";
    ctx.beginPath(); ctx.arc(curX, curY, 14, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(curX, curY, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(curX, curY, 3, 0, Math.PI*2); ctx.fill();
  }

  rkActStop();
  var t0 = null;
  function tick(ts){
    if(rkActAnim === null) return;
    if(t0 === null) t0 = ts;
    var prog = ((ts - t0) / 1000) / RK_ACT_DUR;
    if(prog >= 1){ t0 = ts; prog = 0; }   /* 循环播放 */
    draw(prog);
    rkActAnim = requestAnimationFrame(tick);
  }
  rkActAnim = requestAnimationFrame(tick);
}

/* ---- 轨迹地图（MapCN / CARTO 免费瓦片，零外链手写渲染，无需 token） ---- */
/* 未选中轨迹按类型配色（与 RK_*_PAL 首色一致，弱化显示） */
function rkTrackColor(type){
  if(type === "Run") return "#fb923c";
  if(type === "Ride") return "#60a5fa";
  return "#c084fc";
}
/* 提取所有可绘制轨迹（verify 可测）：有 summary_polyline 且解码成功的活动 */
function rkMapTracks(acts){
  var out = [];
  (acts||[]).forEach(function(a){
    if(!a || !a.poly) return;
    var coords = rkDecodePolyline(a.poly);
    if(!coords || !coords.length) return;
    out.push({ id:a.id, date:a.date||"", name:a.name||"", dist:a.dist||0, type:a.type||"Run", coords:coords });
  });
  return out;
}
function rkMapStyle(){
  var i = (rkMapStyleIdx() + 1) % RK_STYLES.length;
  try{ localStorage.setItem(RK_STYLE_KEY, String(i)); }catch(e){}
  rkShowMap(rkState.selId);
}
/* 全量渲染所有轨迹；id 命中时该条高亮（其余轨迹弱化保留） */
function rkShowMap(id){
  var a = null;
  (rkActs||[]).forEach(function(x){ if(x.id === id) a = x; });
  rkState.selId = (a && id) ? id : 0;
  var sec = rkEl("rkMapSec"), box = rkEl("rkMapBox"), ti = rkEl("rkMapTitle");
  if(!sec || !box) return;
  sec.style.display = "block";
  var tracks = rkMapTracks(rkActs);
  if(!tracks.length){
    ti.textContent = "";
    box.innerHTML = "<div class=\"rk-map-hint\"><div class=\"rk-mh-t\">暂无轨迹数据</div><div>所有活动都没有可绘制的 summary_polyline。</div></div>";
    return;
  }
  if(a){
    ti.textContent = ((a.date||"").slice(0,10) + " · ") + (a.name || rkTitleFor(a)) + " · " + (a.dist/1000).toFixed(2) + " km · 共 " + tracks.length + " 条轨迹";
  } else {
    ti.textContent = "全部 " + tracks.length + " 条轨迹 · 已聚焦最热点区域（点击 ⤢ 查看全貌）";
  }
  /* phase1：垫底 PNG（OSM 瓦片底图 + 全量轨迹，running 仓库预渲染产物）立即显示，
     位图秒显不卡；矢量层就绪后无缝切换 —— img onload 门控（缓存命中/无 img 时同步渲染）。
     视角元数据 fetch 成功后作为矢量层初始视角，与 PNG 完全一致（零跳动） */
  box.innerHTML = "<div class=\"rk-tilemap\" id=\"rkMapCanvas\">"
    + "<img class=\"rk-tm-pv\" src=\"" + RK_PV_URL + "\" alt=\"轨迹全貌预览\" decoding=\"async\">"
    + "<div class=\"rk-tm-loading\">轨迹矢量层构建中…</div></div>";
  var cnv = rkEl("rkMapCanvas");
  var img = (cnv && cnv.querySelector) ? cnv.querySelector(".rk-tm-pv") : null;
  var once = false;
  function go(){
    if(once) return;
    once = true;
    rkFetchMeta(function(mv){ rkMapInit(cnv, tracks, rkMapStyleIdx(), a ? a.id : 0, mv); });
  }
  if(!img) go();                                   /* 无 img（旧浏览器/测试环境）→ 同步渲染矢量层 */
  else if(img.complete && img.naturalWidth > 0) go();  /* 已缓存 → 垫底已显示，立即接矢量层 */
  else { img.onload = go; img.onerror = go; }      /* 网络加载 → 就绪后再接矢量层 */
}
/* 读取垫底 PNG 的视角元数据（cx/cy 为 z13 世界像素中心，z 为 zoom）；
   成功回调 meta 对象；无 fetch（旧浏览器/测试环境）/失败回调 null */
function rkFetchMeta(cb){
  var m = null, done = false;
  function fin(){ if(!done){ done = true; cb(m); } }
  if(!window.fetch){ fin(); return; }
  fetch(RK_META_URL)
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(j){
      if(j && typeof j.cx === "number" && typeof j.cy === "number" && typeof j.z === "number") m = j;
    })
    .catch(function(){})
    .then(fin);
}
/* Web Mercator 投影（verify 可测）：经纬度 <-> 世界像素（256*2^z 见方） */
function rkMerc(lng, lat, z){
  var n = RK_TILE * Math.pow(2, z);
  var x = (lng + 180) / 360 * n;
  var s = Math.sin(lat * Math.PI / 180);
  var y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
  return [x, y];
}
function rkMercInv(x, y, z){
  var n = RK_TILE * Math.pow(2, z);
  var lng = x / n * 360 - 180;
  var lat = 180 / Math.PI * (2 * Math.atan(Math.exp((0.5 - y / n) * 2 * Math.PI)) - Math.PI / 2);
  return [lat, lng];
}
/* 等步长抽稀：保留首尾，均匀采样至多 max 点（verify 可测；全量渲染数千条轨迹时控制 SVG 体积） */
function rkThin(pts, max){
  max = Math.max(2, max || 0);
  if(!pts || pts.length <= max) return pts;
  var step = (pts.length - 1) / (max - 1);
  var out = [];
  for(var i = 0; i < max; i++) out.push(pts[Math.round(i * step)]);
  return out;
}
/* 热点视角（verify 可测）：对全部轨迹点做网格密度统计，返回最密集区域的中心与缩放级别。
   用于默认视角——数千条轨迹时全量 fit 会缩得很小，热点视角直接放大展示轨迹最集中的区域。 */
function rkHotSpot(tracks){
  if(!tracks || !tracks.length) return null;
  var ZB = 13, gs = RK_TILE / 2; /* 基准投影 zoom 与网格边长（半块瓦片） */
  var pts = [];
  tracks.forEach(function(t){
    rkThin(t.coords, 60).forEach(function(c){ pts.push(rkMerc(c[1], c[0], ZB)); });
  });
  if(!pts.length) return null;
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach(function(p){
    if(p[0] < x0) x0 = p[0]; if(p[1] < y0) y0 = p[1];
    if(p[0] > x1) x1 = p[0]; if(p[1] > y1) y1 = p[1];
  });
  if(x1 - x0 < 1 || y1 - y0 < 1) return null;
  var cols = Math.max(1, Math.ceil((x1 - x0) / gs)), rows = Math.max(1, Math.ceil((y1 - y0) / gs));
  if(cols > 256){ gs = (x1 - x0) / 256; cols = 256; }
  if(rows > 256){ gs = (y1 - y0) / 256; rows = 256; }
  var grid = [], i;
  for(i = 0; i < cols * rows; i++) grid.push(0);
  pts.forEach(function(p){
    var c = Math.min(cols - 1, Math.floor((p[0] - x0) / gs));
    var r = Math.min(rows - 1, Math.floor((p[1] - y0) / gs));
    grid[r * cols + c]++;
  });
  var mi = 0;
  for(i = 1; i < grid.length; i++) if(grid[i] > grid[mi]) mi = i;
  var mc = mi % cols, mr = Math.floor(mi / cols), maxN = grid[mi] || 1;
  /* 3x3 邻域加权中心（权重=格计数，只取 ≥35% 峰值的格） */
  var wc = 0, wr = 0, wn = 0, dr, dc, c2, r2;
  for(dr = -1; dr <= 1; dr++) for(dc = -1; dc <= 1; dc++){
    c2 = mc + dc; r2 = mr + dr;
    if(c2 < 0 || r2 < 0 || c2 >= cols || r2 >= rows) continue;
    var n = grid[r2 * cols + c2];
    if(n < maxN * 0.35) continue;
    wc += (c2 + 0.5) * gs * n; wr += (r2 + 0.5) * gs * n; wn += n;
  }
  var cx = x0 + wc / wn, cy = y0 + wr / wn;
  /* 热点范围：计数 ≥50% 峰值的格 bbox */
  var hx0 = Infinity, hy0 = Infinity, hx1 = -Infinity, hy1 = -Infinity;
  for(r2 = 0; r2 < rows; r2++) for(c2 = 0; c2 < cols; c2++){
    if(grid[r2 * cols + c2] >= maxN * 0.5){
      if(x0 + c2 * gs < hx0) hx0 = x0 + c2 * gs;
      if(x0 + (c2 + 1) * gs > hx1) hx1 = x0 + (c2 + 1) * gs;
      if(y0 + r2 * gs < hy0) hy0 = y0 + r2 * gs;
      if(y0 + (r2 + 1) * gs > hy1) hy1 = y0 + (r2 + 1) * gs;
    }
  }
  if(hx1 <= hx0 || hy1 <= hy0){ hx0 = cx - gs; hx1 = cx + gs; hy0 = cy - gs; hy1 = cy + gs; }
  /* 热点 bbox 放大到约 60% 视野；wpx/hpx 从 ZB 换算到目标 zoom 的像素 */
  var z = ZB, W = 640, H = 420, pad = 60;
  var wpx = (hx1 - hx0) * Math.pow(2, z - ZB), hpx = (hy1 - hy0) * Math.pow(2, z - ZB);
  while(z < RK_Z_MAX && (wpx < (W - 2 * pad) * 0.6 || hpx < (H - 2 * pad) * 0.6)){ z++; wpx *= 2; hpx *= 2; }
  while(z > RK_Z_MIN && (wpx > W - 2 * pad || hpx > H - 2 * pad)){ z--; wpx /= 2; hpx /= 2; }
  return { cx: cx, cy: cy, z: Math.max(RK_Z_MIN, Math.min(RK_Z_MAX, z)) };
}
function rkMapInit(container, tracks, styleIdx, selId, metaView){
  if(!container || !tracks || !tracks.length) return;
  var S = {
    z: 14, cx: 0, cy: 0, tracks: [],
    style: rkResolveStyle(styleIdx),
    container: container, W: 640, H: 420,
    ox0: 0, oy0: 0,
    selId: selId || 0,
    prep: 0,                   /* 视图预备（fit/热点设定中），避免中途 render 重置 */
    fit: { k: 0, ok: false },  /* fit 完成时的缩放 k（供扩展） */
    k: 1,                      /* 世界像素(z13) → 当前 zoom 像素 倍数 = 2^(z-RK_BASE_Z) */
    ready: false, svgEl: null, tilesEl: null, zoomEl: null
  };
  S.tracks = tracks.map(function(t){
    return { id:t.id, type:t.type||"Run", sel:!!selId && t.id === selId, coords:t.coords, pts:[] };
  });
  /* 固定基准投影：全部轨迹只在 RK_BASE_Z(13) 世界像素投影一次，缩放/平移仅改 viewBox
     矩阵，零重投影 —— 消除旧架构「每次缩放全量重投影卡顿」。
     另做投影抽稀：非选中轨迹抽稀到 RK_THIN_MAX 点（降 SVG 重光栅化成本），
     选中轨迹保留全量（单条放大查看精度不损） */
  S.tracks.forEach(function(t){
    var coords = t.sel ? t.coords : rkThin(t.coords, RK_THIN_MAX);
    t.pts = coords.map(function(c){ var p = rkMerc(c[1], c[0], RK_BASE_Z); return [p[0], p[1]]; });
  });
  function rect(){
    try{
      var r = container.getBoundingClientRect();
      S.W = r.width || 640; S.H = r.height || 420;
    }catch(e){}
  }
  function setZoom(nz){
    S.z = Math.max(RK_Z_MIN, Math.min(RK_Z_MAX, nz));
    S.k = Math.pow(2, S.z - RK_BASE_Z);
  }
  function bbox(){
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    S.tracks.forEach(function(t){
      t.pts.forEach(function(p){
        if(p[0] < x0) x0 = p[0]; if(p[1] < y0) y0 = p[1];
        if(p[0] > x1) x1 = p[0]; if(p[1] > y1) y1 = p[1];
      });
    });
    return [x0, y0, x1, y1];
  }
  function tileUrl(tx, ty){
    var n = Math.pow(2, S.z);
    var wx = ((tx % n) + n) % n;
    var u = S.style.url.replace("{z}", S.z).replace("{x}", wx).replace("{y}", ty);
    if(u.indexOf("{s}") >= 0) u = u.replace("{s}", "abcd"[(wx + ty + S.z) % 4]);
    return u;
  }
  function finishPrepare(){
    S.prep = 0;
    S.fit = { k: S.k, ok: true };
  }
  /* 视口四角（z13 世界像素）→ viewBox 参数 */
  function viewBoxArgs(){
    var k = S.k;
    var vw = S.W / k, vh = S.H / k;
    return [S.cx - vw/2, S.cy - vh/2, vw, vh];
  }
  /* 瓦片层 HTML（z 级世界像素，随 zoom 变化，数量少 ~20 块，重建便宜） */
  function tilesHTML(vx0, vy0){
    var k = S.k;
    var zx0 = vx0 * k, zy0 = vy0 * k;
    var tx0 = Math.floor(zx0 / RK_TILE), ty0 = Math.floor(zy0 / RK_TILE);
    var tx1 = Math.floor((zx0 + S.W) / RK_TILE), ty1 = Math.floor((zy0 + S.H) / RK_TILE);
    S.ox0 = zx0 - tx0 * RK_TILE; S.oy0 = zy0 - ty0 * RK_TILE;
    var h = '<div class="rk-tm-tiles" style="transform:translate(' + (-S.ox0).toFixed(1) + 'px,' + (-S.oy0).toFixed(1) + 'px)">';
    for(var ty = ty0; ty <= ty1; ty++){
      for(var tx = tx0; tx <= tx1; tx++){
        h += '<div class="rk-tm-tile" style="left:' + ((tx - tx0) * RK_TILE) + 'px;top:' + ((ty - ty0) * RK_TILE) + 'px;background-image:url(' + tileUrl(tx, ty) + ')"></div>';
      }
    }
    return h + '</div>';
  }
  /* 矢量层 SVG HTML：坐标直接写 z13 世界像素，viewBox 矩阵完成缩放/平移（仅构建一次） */
  function svgHTML(vx0, vy0, vw, vh){
    var k = S.k;
    var swN = (1.6 / k).toFixed(2), swH = (3.5 / k).toFixed(2);  /* 线宽反算：屏幕像素/k，任意缩放屏幕恒 1.6/3.5px */
    var rDot = (5 / k).toFixed(1), rRing = (1.5 / k).toFixed(2);
    var h = '<svg class="rk-tm-svg" width="' + S.W + '" height="' + S.H + '" viewBox="' + vx0 + ' ' + vy0 + ' ' + vw + ' ' + vh + '">';
    var selT = null;
    S.tracks.forEach(function(t){
      if(!t.pts.length) return;
      var pl = t.pts.map(function(p){ return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
      if(t.sel){
        selT = t;
        h += '<polyline data-id="' + t.id + '" points="' + pl + '" fill="none" stroke="#f97316" stroke-width="' + swH + '" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>';
      } else {
        h += '<polyline data-id="' + t.id + '" points="' + pl + '" fill="none" stroke="' + rkTrackColor(t.type) + '" stroke-width="' + swN + '" stroke-linecap="round" stroke-linejoin="round" opacity="0.38"/>';
      }
    });
    if(selT && selT.pts.length){
      var s0 = selT.pts[0], s1 = selT.pts[selT.pts.length - 1];
      h += '<circle data-s0="' + selT.id + '" cx="' + s0[0].toFixed(1) + '" cy="' + s0[1].toFixed(1) + '" r="' + rDot + '" fill="#22c55e" stroke="#fff" stroke-width="' + rRing + '"/>';
      h += '<circle data-s1="' + selT.id + '" cx="' + s1[0].toFixed(1) + '" cy="' + s1[1].toFixed(1) + '" r="' + rDot + '" fill="#ef4444" stroke="#fff" stroke-width="' + rRing + '"/>';
    }
    return h + '</svg>';
  }
  function ctrlHTML(){
    return '<div class="rk-tm-ctrl">'
      + '<button class="rk-tm-btn rk-tm-style" onclick="rkMapStyle()" title="切换底图样式：浅色 / 明亮 / 暗色"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 20l-6-2V4l6 2 6-2 6 2v14l-6-2-6 2z"/><path d="M9 4v16M15 6v16"/></svg></button>'
      + '<button class="rk-tm-btn" title="放大">+</button>'
      + '<button class="rk-tm-btn" title="缩小">−</button>'
      + '<button class="rk-tm-btn" title="适应轨迹">⤢</button>'
      + '</div>'
      + '<div class="rk-tm-zoom" id="rkTmZoom">z' + S.z + ' · ' + S.style.n + '</div>'
      + '<div class="rk-tm-attr">© OpenStreetMap contributors © CARTO</div>';
  }
  /* 缩放/平移：仅更新 viewBox 矩阵 + 线宽反算（SVG 内容零重建，345K 点不重绘） */
  function refreshView(){
    var vb = viewBoxArgs();
    if(S.svgEl){
      S.svgEl.setAttribute("viewBox", vb[0] + " " + vb[1] + " " + vb[2] + " " + vb[3]);
      S.svgEl.style.transform = "";
      if(S.tilesEl){ S.tilesEl.outerHTML = tilesHTML(vb[0], vb[1]); S.tilesEl = container.querySelector(".rk-tm-tiles"); }
      if(S.zoomEl) S.zoomEl.textContent = "z" + S.z + " · " + S.style.n;
      updateStrokeWidths();
    }
  }
  /* 缩放后线宽反算更新：每条轨迹一个属性（~百条，毫秒级） */
  function updateStrokeWidths(){
    if(!S.svgEl) return;
    var k = S.k;
    var swN = (1.6 / k).toFixed(2), swH = (3.5 / k).toFixed(2);
    var rDot = (5 / k).toFixed(1), rRing = (1.5 / k).toFixed(2);
    S.tracks.forEach(function(t){
      if(!t.pts.length) return;
      if(t._el) t._el.setAttribute("stroke-width", t.sel ? swH : swN);
      if(t.sel){
        if(t._s0){ t._s0.setAttribute("r", rDot); t._s0.setAttribute("stroke-width", rRing); }
        if(t._s1){ t._s1.setAttribute("r", rDot); t._s1.setAttribute("stroke-width", rRing); }
      }
    });
  }
  function render(){
    rect();
    if(!S.ready){
      var vb = viewBoxArgs();
      container.innerHTML = tilesHTML(vb[0], vb[1]) + svgHTML(vb[0], vb[1], vb[2], vb[3]) + ctrlHTML();
      S.svgEl = container.querySelector(".rk-tm-svg");
      if(S.svgEl){
        S.tilesEl = container.querySelector(".rk-tm-tiles");
        S.zoomEl = container.querySelector("#rkTmZoom");
        /* 缓存 polyline 元素引用：后续缩放只 setAttribute，零重建 */
        S.tracks.forEach(function(t){
          if(!t.pts.length) return;
          t._el = S.svgEl.querySelector('[data-id="' + t.id + '"]');
          if(t.sel){
            t._s0 = S.svgEl.querySelector('[data-s0="' + t.id + '"]');
            t._s1 = S.svgEl.querySelector('[data-s1="' + t.id + '"]');
          }
        });
      }
      S.ready = true;
      updateStrokeWidths();
    } else {
      refreshView();
    }
    container.style.cursor = "grab";
  }
  /* 缩放过渡动画：旧内容（瓦片 + SVG）整体 scale(f) 绕锚点（will-change:transform
     走 GPU 合成，动画期间不重光栅化 345K 点，丝滑），过渡结束 settle() 应用真实
     viewBox + 重建瓦片。scale 归 1 时与新 viewBox 渲染结果一致（数学等价），零跳变。
     连续快速缩放时 zoomBy 先 settle 结算到当前 zoom，再从干净状态起新动画，
     避免 transform 叠加错乱 */
  var zoomAnimTimer = null;
  function settle(){
    if(zoomAnimTimer){ clearTimeout(zoomAnimTimer); zoomAnimTimer = null; }
    if(S.svgEl){ S.svgEl.style.transition = "none"; S.svgEl.style.transform = ""; S.svgEl.style.transformOrigin = ""; }
    if(S.tilesEl){ S.tilesEl.style.transition = "none"; S.tilesEl.style.transform = ""; S.tilesEl.style.transformOrigin = ""; }
    refreshView();
  }
  function animateZoom(ox, oy, f){
    if(!S.ready || !S.svgEl){ render(); return; }
    var svg = S.svgEl, tiles = S.tilesEl;
    svg.style.transition = "transform 0.2s ease-out";
    svg.style.transformOrigin = ox + "px " + oy + "px";
    svg.style.transform = "scale(" + f + ")";
    if(tiles){
      tiles.style.transition = "transform 0.2s ease-out";
      tiles.style.transformOrigin = ox + "px " + oy + "px";
      tiles.style.transform = "translate(" + (-S.ox0).toFixed(1) + "px," + (-S.oy0).toFixed(1) + "px) scale(" + f + ")";
    }
    zoomAnimTimer = setTimeout(settle, 210);
  }
  function zoomBy(d, mx, my){
    var nz = Math.max(RK_Z_MIN, Math.min(RK_Z_MAX, S.z + d));
    if(nz === S.z) return;
    if(mx == null){ mx = S.W/2; my = S.H/2; }
    if(zoomAnimTimer) settle();   /* 有未完成动画 → 先结算到当前 zoom，再起新动画 */
    var oldZ = S.z;
    /* 锚点 = 鼠标位置的 z13 世界像素，缩放前后保持不变：
       要求 cx' - W/(2k') + mx/k' = wx → cx' = wx + (S.W/2 - mx)/k'
       旧实现 cx' = wx - mx/k' 漏了 +S.W/(2k')，锚点偏移约半屏，滚轮缩放"找不到位置" */
    var wx = S.cx - S.W/(2*S.k) + mx / S.k;
    var wy = S.cy - S.H/(2*S.k) + my / S.k;
    setZoom(nz);
    S.cx = wx + (S.W/2 - mx) / S.k;
    S.cy = wy + (S.H/2 - my) / S.k;
    animateZoom(mx, my, Math.pow(2, nz - oldZ));
  }
  function fit(){
    rect();
    S.prep = 1;
    var b = bbox(), pad = 70;   /* bbox 为 z13 世界像素，不随 zoom 变，只需算一次 */
    function wpx(){ return (b[2]-b[0]) * S.k; }   /* 换算当前 zoom 的视口像素 */
    function hpx(){ return (b[3]-b[1]) * S.k; }
    setZoom(14);
    while(S.z > RK_Z_MIN && (wpx() > S.W - 2*pad || hpx() > S.H - 2*pad)){ S.z--; setZoom(S.z); }
    while(S.z < RK_Z_MAX && wpx() < (S.W - 2*pad) * 0.55 && hpx() < (S.H - 2*pad) * 0.55){ S.z++; setZoom(S.z); }
    S.cx = (b[0]+b[2])/2; S.cy = (b[1]+b[3])/2;
    finishPrepare();
    render();
  }
  /* 拖拽平移（document 级成对监听，松手即清理，无泄漏）
     拖动中视觉反馈：瓦片层 translate(-ox0+dx, -oy0+dy)、SVG 层 translate(dx, dy)，
     两者增量同为 (+dx,+dy)——内容跟随鼠标右移，与 S.cx 递减、松手 render 后 viewBox
     左移等价，故拖动全程路径与底图零脱离、松手无跳变。
     注意：SVG 层绝不能写成 translate(-dx,-dy)（与瓦片反向，一拖即脱离）。 */
  var drag = null;
  function onMove(e){
    if(!drag) return;
    var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    S.cx = drag.cx - dx / S.k; S.cy = drag.cy - dy / S.k;   /* 屏幕像素 → z13 世界像素 */
    var tiles = container.querySelector(".rk-tm-tiles"), svg = container.querySelector(".rk-tm-svg");
    if(tiles && svg){
      var nx = S.ox0 - dx, ny = S.oy0 - dy;
      tiles.style.transform = "translate(" + (-nx).toFixed(1) + "px," + (-ny).toFixed(1) + "px)";
      svg.style.transform = "translate(" + (dx).toFixed(1) + "px," + (dy).toFixed(1) + "px)";
    }
  }
  function onUp(){
    if(!drag) return;
    drag = null;
    container.style.cursor = "grab";
    render();
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  }
  container.addEventListener("mousedown", function(e){
    if(e.target && e.target.className === "rk-tm-btn") return;
    if(zoomAnimTimer) settle();   /* 缩放动画未结束时按下 → 先结算，避免拖拽与 scale 叠加 */
    drag = { sx:e.clientX, sy:e.clientY, cx:S.cx, cy:S.cy };
    container.style.cursor = "grabbing";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    e.preventDefault();
  });
  /* 触摸：单指拖动（移动端） */
  container.addEventListener("touchstart", function(e){
    if(e.touches.length === 1 && !(e.target && e.target.className === "rk-tm-btn")){
      if(zoomAnimTimer) settle();   /* 同上：先结算缩放动画 */
      var t = e.touches[0];
      drag = { sx:t.clientX, sy:t.clientY, cx:S.cx, cy:S.cy };
      e.preventDefault();
    }
  }, { passive:false });
  container.addEventListener("touchmove", function(e){
    if(!drag || e.touches.length !== 1) return;
    var t = e.touches[0];
    var dx = t.clientX - drag.sx, dy = t.clientY - drag.sy;
    S.cx = drag.cx - dx / S.k; S.cy = drag.cy - dy / S.k;
    var tiles = container.querySelector(".rk-tm-tiles"), svg = container.querySelector(".rk-tm-svg");
    if(tiles && svg){
      tiles.style.transform = "translate(" + (-(S.ox0 - dx)).toFixed(1) + "px," + (-(S.oy0 - dy)).toFixed(1) + "px)";
      svg.style.transform = "translate(" + (dx).toFixed(1) + "px," + (dy).toFixed(1) + "px)";
    }
    e.preventDefault();
  }, { passive:false });
  container.addEventListener("touchend", function(){
    if(!drag) return;
    drag = null;
    render();
  });
  /* 滚轮 / 双击 / 控制按钮 */
  /* 滚轮缩放灵敏度：触控板/高精度滚轮一次手势会拆成大量小 deltaY 事件，
     直接按事件缩放一次会跳 N 级（找不到位置）。累积 deltaY 到阈值 120
     （标准一格）才缩放 1 级，手势间隔超 400ms 重置累积，单次手势限幅 3 级 */
  var wheelAcc = 0, wheelAt = 0;
  container.addEventListener("wheel", function(e){
    e.preventDefault();
    var r = container.getBoundingClientRect();
    var now = Date.now();
    if(now - wheelAt > 400) wheelAcc = 0;
    wheelAt = now;
    wheelAcc += e.deltaY;
    var d = 0;
    while(wheelAcc <= -120){ wheelAcc += 120; d++; }   /* 向上滚=放大 */
    while(wheelAcc >= 120){ wheelAcc -= 120; d--; }    /* 向下滚=缩小 */
    if(d) zoomBy(Math.max(-3, Math.min(3, d)), e.clientX - r.left, e.clientY - r.top);
  }, { passive:false });
  container.addEventListener("dblclick", function(e){
    var r = container.getBoundingClientRect();
    zoomBy(1, e.clientX - r.left, e.clientY - r.top);
  });
  container.addEventListener("click", function(e){
    var btn = e.target;
    if(!btn || btn.className !== "rk-tm-btn") return;
    var c = container.querySelectorAll(".rk-tm-btn");
    var idx = Array.prototype.indexOf.call(c, btn);
    /* 按钮顺序：0=样式切换（className 为两段被上面拦截）、1=放大、2=缩小、3=适应轨迹 */
    if(idx === 1) zoomBy(1);        /* 默认锚点 S.W/2,S.H/2 = 图片中心 */
    else if(idx === 2) zoomBy(-1);
    else if(idx === 3) fit();
  });
  /* 默认视角固定规格：z=8（与 running 仓库 activities.preview.png 生成规格一致，
     长宽 640:360（16:9）固定、z8 固定浅色）。cx/cy 为 z13 世界像素中心（与 zoom 无关），
     中心优先用垫底 PNG 视角元数据（热点中心，PNG 与矢量层切换零跳动）；
     无元数据（离线/旧环境）回退热点聚焦（全量模式）或全量 fit（选中模式） */
  var mv = metaView || null, HP_Z = 8;
  if(mv){
    rect(); S.prep = 1; setZoom(HP_Z); S.cx = mv.cx; S.cy = mv.cy; finishPrepare(); render();
  } else {
    var hp = (!selId) ? rkHotSpot(tracks) : null;
    if(hp){
      rect(); S.prep = 1; setZoom(HP_Z); S.cx = hp.cx; S.cy = hp.cy; finishPrepare(); render();
    } else {
      fit();
    }
  }
}

/* ---- 数据加载 ---- */
function rkFetch(){
  rkBar("正在加载数据…");
  var d = rkEl("rkDot"); if(d) d.className = "dot";
  function viaFetch(url){
    return fetch(url).then(function(res){
      if(!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    });
  }
  if(window.caches){
    caches.open(RK_CACHE).then(function(c){
      return c.match(RK_URL).then(function(r){
        if(r) return r.text();
        return viaFetch(RK_URL).then(function(txt){
          c.put(RK_URL, new Response(txt));
          return txt;
        });
      });
    }).then(rkOnData).catch(function(e){ rkOnErr(e); });
  } else {
    viaFetch(RK_URL).then(rkOnData).catch(rkOnErr);
  }
}
function rkOnData(text){
  try{
    rkActs = rkParse(text);
    window.rkActs = rkActs; /* 挂全局便于控制台调试与外部脚本访问 */
    if(!rkActs.length) throw new Error("数据为空");
    rkBar("数据已加载：" + rkComma(rkActs.length) + " 条记录（直连 running 仓库 preview，本地零存储）", "ok");
    var curYr = String(new Date().getFullYear());
    rkState.year = rkYears(rkActs).indexOf(curYr) >= 0 ? curYr : (rkYears(rkActs)[0] || curYr); // 默认当年（2026）；数据无当年则回退最新年份
    rkState.listYear = "all"; rkState.listN = 30;
    rkRenderAll();
  }catch(e){ rkOnErr(e); }
}
function rkOnErr(e){
  rkActs = null;
  rkBar("数据加载失败：" + esc(e && e.message ? e.message : e) + " — 可稍后重试", "err");
  var body = rkEl("rkBody");
  if(body) body.innerHTML = "<div class=\"rk-empty\">无法连接数据源（raw.githubusercontent.com）。请检查网络后点击「刷新数据」重试。</div>";
}
function rkRenderAll(){
  rkRenderStats();
  rkRenderHeatTabs();
  rkRenderTrend();
  rkRenderPbs();
  rkRenderListTools();
  rkShowMap(rkState.selId);  /* 全量渲染所有轨迹；有选中则高亮 */
}
function rkRefresh(){ rkFetch(); }
function rkLoad(){
  if(!rkActs) rkFetch();
  else { rkBar("数据已就绪（缓存）", "ok"); rkRenderAll(); }
}

