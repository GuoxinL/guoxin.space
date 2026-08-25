"use strict";
/* ================= JSON 工具：双编辑区 ================= */
var P = { L:{text:"", tree:false}, R:{text:"", tree:false} };
var diffOn = false;      /* 对比模式（双侧同时进入/退出） */
var lastSide = "L";      /* 最近操作的一侧：修复 / 历史恢复 / 导出 / 复制 的目标 */
var saveTimer = {}, valTimer = {};
var KEY_DRAFT_R = KEY_PREFIX + "json_draft_r";

function inputEl(side){ return $(side==="R" ? "jsonInputR" : "jsonInputL"); }
function gutterEl(side){ return $(side==="R" ? "gutterR" : "gutterL"); }
function treeEl(side){ return $(side==="R" ? "treeR" : "treeL"); }
function diffEl(side){ return $(side==="R" ? "diffR" : "diffL"); }
function vdotEl(side){ return $(side==="R" ? "vdotR" : "vdotL"); }
function vtextEl(side){ return $(side==="R" ? "vtextR" : "vtextL"); }
function treeLabel(side){ return $(side==="R" ? "treeLabelR" : "treeLabelL"); }
function sideName(side){ return side==="R" ? "右侧" : "左侧"; }
function draftKey(side){ return side==="R" ? KEY_DRAFT_R : KEY_DRAFT; }

function readSide(side){ return inputEl(side) ? inputEl(side).value : ""; }
function renderGutter(side){
  var inp = inputEl(side), gut = gutterEl(side);
  if(!inp || !gut) return;
  var lines = inp.value.split("\n").length;
  var h="";
  for(var i=1;i<=lines;i++) h += "<div>"+i+"</div>";
  gut.innerHTML = h;
  gut.scrollTop = inp.scrollTop;
}
function setSide(side, t){
  lastSide = side;
  inputEl(side).value = t;
  P[side].text = t;
  renderGutter(side);
  scheduleSave(side);
  validateSide(side);
  updateToolBtns(side);
}
function scheduleSave(side){
  clearTimeout(saveTimer[side]);
  saveTimer[side] = setTimeout(function(){ store(draftKey(side), inputEl(side).value); }, 500);
}
function pushHistory(text){
  if(!text || !text.trim()) return;
  try{ J.hist = JSON.parse(load(KEY_HIST)||"[]"); }catch(e){ J.hist=[]; }
  var last = J.hist[0] && J.hist[0].text;
  if(last === text) return;
  J.hist.unshift({t:Date.now(), text:text});
  if(J.hist.length > 10) J.hist.length = 10;
  store(KEY_HIST, JSON.stringify(J.hist));
}

/* ================= JSON 解析与错误定位 ================= */
function chineseErr(msg){
  var m = String(msg);
  if(m.indexOf("Unexpected token")>=0) return "语法错误：出现意外的符号";
  if(m.indexOf("Unexpected end of JSON input")>=0 || m.indexOf("end of data")>=0) return "JSON 不完整：内容意外结束";
  if(m.indexOf("Expected property name")>=0) return "缺少键名（键名需用双引号包裹）";
  if(m.indexOf("Expected ',' or '}'")>=0) return "缺少逗号或右花括号";
  if(m.indexOf("Expected ':'")>=0) return "缺少冒号";
  if(m.indexOf("Unexpected number")>=0) return "数字格式错误";
  if(m.indexOf("Unexpected string")>=0) return "字符串格式错误";
  if(m.indexOf("Bad control character")>=0) return "包含非法控制字符（需转义）";
  if(m.indexOf("Invalid number")>=0) return "非法数字";
  if(m.indexOf("Invalid string")>=0) return "非法字符串（字符串未闭合）";
  if(m.indexOf("Unexpected non-whitespace character")>=0) return "存在非空白非法字符";
  if(m.indexOf("not valid JSON")>=0) return "不是合法的 JSON";
  return "JSON 解析失败："+m;
}
function locateErr(e, raw){
  var m = String(e.message);
  var pos = -1, mm;
  mm = m.match(/position\s+(\d+)/);
  if(mm) pos = parseInt(mm[1],10);
  mm = m.match(/line\s+(\d+)\s+column\s+(\d+)/);
  if(mm) return {line:parseInt(mm[1],10), col:parseInt(mm[2],10), msg:chineseErr(m)};
  if(pos>=0){
    var upTo = raw.slice(0, pos);
    var line = upTo.split("\n").length;
    var col = pos - upTo.lastIndexOf("\n");
    return {line:line, col:col, msg:chineseErr(m)};
  }
  return {line:1, col:1, msg:chineseErr(m)};
}
function gotoLine(side, line){
  var inp = inputEl(side);
  if(!inp) return;
  var lh = 24, pad = 12;
  inp.scrollTop = Math.max(0, (line-1)*lh - pad*2);
}
function parseJson(raw){
  try{ return {ok:true, val:JSON.parse(raw)}; }
  catch(e){ return {ok:false, err:locateErr(e, raw)}; }
}

/* ================= 多语言解析 / 序列化 ================= */
/* 每侧语言：json / json5 / yaml / toml / xml；默认 json（元素缺失或为空时回退） */
function langOf(side){
  var el = $("langSel"+side);
  var v = el && el.value ? el.value : "";
  if(v !== "json" && v !== "json5" && v !== "yaml" && v !== "toml" && v !== "xml") return "json";
  return v;
}
/* 切换语言即自动转换：按旧语言解析 → 转 JSON 中间态 → 按新语言序列化写回 */
function changeLang(side, sel){
  if(!sel) sel = $("langSel"+side);
  var oldLang = sel.getAttribute("data-cur") || "json";
  var newLang = sel.value;
  sel.setAttribute("data-cur", newLang);
  if(oldLang === newLang) return;
  var raw = readSide(side);
  if(!raw.trim()){
    /* 空内容仅记录语言 */
    flashStatus(sideName(side)+"语言已切换为 "+newLang.toUpperCase()+"（内容为空）","ok");
    return;
  }
  var p = parseByLang(raw, oldLang);
  if(!p.ok){
    /* 按旧语言解析失败：回退语言，避免破坏内容 */
    sel.value = oldLang;
    sel.setAttribute("data-cur", oldLang);
    updateToolBtns(side); /* 语言回退后刷新按钮显隐 */
    flashStatus(sideName(side)+"内容不是 "+oldLang.toUpperCase()+"，已保持原语言："+p.err.message,"err");
    return;
  }
  var out;
  try{
    out = dumpByLang(p.val, newLang, false);
  }catch(e){
    sel.value = oldLang;
    sel.setAttribute("data-cur", oldLang);
    updateToolBtns(side);
    flashStatus(sideName(side)+"转换为 "+newLang.toUpperCase()+" 失败："+e.message+"，已保持原语言","err");
    return;
  }
  pushHistory(raw);
  setSide(side, out);
  /* 内容已变：退出 JSONPath / 树形视图回到编辑视图 */
  P[side].jp = false;
  P[side].tree = false;
  applyView(side);
  flashStatus(sideName(side)+"已自动转换 "+oldLang.toUpperCase()+" → "+newLang.toUpperCase(),"ok");
}
function fmtIndent(){
  var v = $("indentSel").value;
  return v === "tab" ? "\t" : new Array(parseInt(v,10)+1).join(" ");
}
/* 将文本按语言解析为 JS 对象；返回 {ok, val, err} */
function parseByLang(raw, lang){
  try{
    if(lang === "json" || lang === "json5"){
      var s = raw;
      if(lang === "json5"){
        s = s.replace(/^\uFEFF/, "");
        s = s.replace(/\/\*[\s\S]*?\*\//g, function(m){ return m.replace(/[^\n]/g," "); });
        s = s.replace(/(^|[^:])\/\/[^\n]*/g, function(m, p){ return p + m.slice(1).replace(/[^\n]/g," "); });
        s = s.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3');
        s = s.replace(/,\s*([}\]])/g, "$1");
        s = s.replace(/'/g, '"');
      }
      return {ok:true, val: JSON.parse(s)};
    }
    if(lang === "yaml"){
      if(!window.LIBS || !window.LIBS.yaml) throw new Error("YAML 库未就绪");
      return {ok:true, val: window.LIBS.yaml.load(raw)};
    }
    if(lang === "toml"){
      if(!window.LIBS || !window.LIBS.tomlParse) throw new Error("TOML 库未就绪");
      return {ok:true, val: window.LIBS.tomlParse(raw)};
    }
    if(lang === "xml"){
      if(!window.LIBS || !window.LIBS.XMLParser) throw new Error("XML 库未就绪");
      var parser = new window.LIBS.XMLParser({}, { ignoreAttributes:false, attributeNamePrefix:"@_" });
      var xmlVal = parser.parse(raw);
      /* fxp 对纯文本/无标签内容返回空对象 {}：视为非法 XML 文档，避免误转 */
      if(xmlVal === null || typeof xmlVal !== "object" || Object.keys(xmlVal).length === 0) throw new Error("内容不是合法 XML 文档");
      return {ok:true, val: xmlVal};
    }
  }catch(e){ return {ok:false, err:e}; }
  return {ok:false, err:new Error("未知语言 "+lang)};
}
/* 将 JS 对象按语言序列化；compact=true 为紧凑格式 */
function dumpByLang(val, lang, compact){
  var ind = fmtIndent();
  if(lang === "json" || lang === "json5"){
    return JSON.stringify(val, null, compact ? 0 : ind);
  }
  if(lang === "yaml"){
    if(!window.LIBS || !window.LIBS.yaml) throw new Error("YAML 库未就绪");
    return window.LIBS.yaml.dump(val, { indent: ind === "\t" ? 2 : ind.length });
  }
  if(lang === "toml"){
    if(!window.LIBS || !window.LIBS.tomlStringify) throw new Error("TOML 库未就绪");
    var t = window.LIBS.tomlStringify(val);
    return Array.isArray(t) ? t.join("\n") : String(t);
  }
  if(lang === "xml"){
    if(!window.LIBS || !window.LIBS.XMLBuilder) throw new Error("XML 库未就绪");
    var builder = new window.LIBS.XMLBuilder({ format: !compact, indentBy: ind === "\t" ? "\t" : ind });
    return builder.build(val);
  }
  return JSON.stringify(val, null, compact ? 0 : ind);
}

/* ================= JSON 工具：格式化 / 压缩 / 转义 / 去转义 ================= */
function fmtSide(side){
  var lang = langOf(side);
  var raw = readSide(side);
  if(!raw.trim()){ flashStatus(sideName(side)+"内容为空，无法格式化","err"); return; }
  pushHistory(raw);
  var p = parseByLang(raw, lang);
  if(!p.ok){ showErr(side, {line:1, col:1, msg: lang+" 解析失败："+p.err.message}); return; }
  var out = dumpByLang(p.val, lang, false);
  setSide(side, out);
  flashStatus(sideName(side)+"格式化成功（"+lang+"）· 已展开为 "+out.split("\n").length+" 行", "ok");
}
function minSide(side){
  var lang = langOf(side);
  var raw = readSide(side);
  if(!raw.trim()){ flashStatus(sideName(side)+"内容为空，无法压缩","err"); return; }
  pushHistory(raw);
  var p = parseByLang(raw, lang);
  if(!p.ok){ showErr(side, {line:1, col:1, msg: lang+" 解析失败："+p.err.message}); return; }
  var out = dumpByLang(p.val, lang, true);
  setSide(side, out);
  flashStatus(sideName(side)+"压缩成功（"+lang+"）· 原 "+raw.length+" 字符 → "+out.length+" 字符", "ok");
}
function escSide(side){
  var raw = readSide(side);
  if(!raw.trim()){ flashStatus(sideName(side)+"内容为空，无法转义","err"); return; }
  pushHistory(raw);
  var out = JSON.stringify(raw);
  setSide(side, out);
  flashStatus("已转义为 JSON 字符串 · "+raw.length+" 字符 → "+out.length+" 字符","ok");
}
function unescSide(side){
  var raw = readSide(side);
  if(!raw.trim()){ flashStatus(sideName(side)+"内容为空，无法去转义","err"); return; }
  pushHistory(raw);
  var p = parseJson(raw);
  if(!p.ok){ showErr(side, p.err); return; }
  if(typeof p.val !== "string"){ flashStatus("当前内容不是 JSON 字符串，无法去转义（转义结果形如 \"...\"）","err"); return; }
  setSide(side, p.val);
  flashStatus("已去转义还原为原始文本 · "+raw.length+" 字符 → "+p.val.length+" 字符","ok");
}
/* 按钮按能力显隐：转义 / 去转义 / 压缩
   - 内容为空 → 三个按钮全部隐藏
   - 内容是合法 JSON 字符串字面量（已转义）→ 显示「去转义」，隐藏「转义」
   - 否则 → 显示「转义」，隐藏「去转义」
   - 内容可被当前语言解析 → 显示「压缩」；否则隐藏 */
function updateToolBtns(side){
  var escBtn = $("escBtn"+side), unescBtn = $("unescBtn"+side), minBtn = $("minBtn"+side);
  if(!escBtn || !unescBtn || !minBtn) return;
  var raw = readSide(side);
  if(!raw.trim()){
    escBtn.style.display = "none";
    unescBtn.style.display = "none";
    minBtn.style.display = "none";
    return;
  }
  var p = parseJson(raw);
  var isEscaped = p.ok && typeof p.val === "string";
  escBtn.style.display = isEscaped ? "none" : "";
  unescBtn.style.display = isEscaped ? "" : "none";
  var pp = parseByLang(raw, langOf(side));
  minBtn.style.display = pp.ok ? "" : "none";
}
function showErr(side, err){
  P[side].err = err;
  var dot = vdotEl(side), txt = vtextEl(side);
  if(dot) dot.className = "dot err";
  if(txt) txt.textContent = "✖ "+err.msg+"（第 "+err.line+" 行，第 "+err.col+" 列）";
  flashStatus(sideName(side)+"校验失败 · "+err.msg, "err");
  gotoLine(side, err.line); /* 先滚动，波浪线按滚动后的位置绘制 */
  drawSquiggle(side);
}

/* ================= 实时校验（输入停顿后自动执行） ================= */
function squiggleEl(side){ return $(side==="R" ? "sqR" : "sqL"); }
function drawSquiggle(side){
  var sq = squiggleEl(side), inp = inputEl(side);
  if(!sq || !inp){ if(sq) sq.innerHTML=""; return; }
  var err = P[side].err;
  if(!err){ sq.innerHTML=""; return; }
  var line = Math.max(err.line, 1), col = Math.max(err.col, 1);
  var lineText = readSide(side).split("\n")[line-1] || "";
  var upTo = lineText.slice(0, col-1);
  var charW = 8.4; /* 14px 等宽字体 ≈ 0.6em */
  var x = 12; /* textarea padding-left */
  for(var i=0;i<upTo.length;i++) x += (upTo.charAt(i)==="\t" ? 2 : 1) * charW;
  /* SVG 相对编辑器固定定位：视觉 y = 内容坐标 − scrollTop */
  var y = 12 + (line-1)*24 + 20 - inp.scrollTop;
  var d = "M"+x.toFixed(1)+" "+y;
  for(var c=0;c<5;c++) d += " q4 -3.5 8 0 t8 0";
  sq.innerHTML = '<path d="'+d+'" fill="none" stroke="#E24B4A" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>';
}
function validateSide(side){
  var raw = readSide(side);
  var dot = vdotEl(side), txt = vtextEl(side);
  if(!raw.trim()){
    P[side].err = null; drawSquiggle(side);
    if(dot) dot.className = "dot wait";
    if(txt) txt.textContent = "就绪 · 输入后实时校验";
    return;
  }
  var lang = langOf(side);
  var p = parseByLang(raw, lang);
  if(p.ok){
    P[side].err = null; drawSquiggle(side);
    if(dot) dot.className = "dot ok";
    if(txt) txt.textContent = "✓ "+lang.toUpperCase()+" 合法 · 共 "+(raw.split("\n").length)+" 行";
  }else{
    /* JSON/JSON5 保留精确行列定位；其他语言用通用错误信息 */
    var err;
    if(lang === "json" || lang === "json5"){
      err = locateErr(p.err, raw);
      err.msg = lang+" 解析失败："+err.msg;
    }else{
      err = {line:1, col:1, msg: lang+" 解析失败："+p.err.message};
    }
    P[side].err = err;
    drawSquiggle(side);
    if(dot) dot.className = "dot err";
    if(txt) txt.textContent = "✖ "+err.msg+"（第 "+err.line+" 行，第 "+err.col+" 列）";
  }
}

/* ================= 修复（作用于最近操作的一侧） ================= */
function doRepair(){
  var side = lastSide;
  var raw = readSide(side);
  if(!raw.trim()){ flashStatus("内容为空","err"); return; }
  pushHistory(raw);
  var s = raw.replace(/^\uFEFF/, "");
  s = s.replace(/\/\*[\s\S]*?\*\//g, function(m){ return m.replace(/[^\n]/g," "); });
  s = s.replace(/(^|[^:])\/\/[^\n]*/g, function(m, p){ return p + m.slice(1).replace(/[^\n]/g," "); });
  s = s.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3');
  s = s.replace(/,\s*([}\]])/g, "$1");
  s = s.replace(/'/g, '"');
  var p = parseJson(s);
  if(p.ok){
    setSide(side, JSON.stringify(p.val, null, fmtIndent()));
    flashStatus("修复成功 · 常见错误已自动处理（"+sideName(side)+"）","ok");
  }else{
    showErr(side, p.err);
    flashStatus("无法自动修复 · "+p.err.msg+"（第 "+p.err.line+" 行）","err");
  }
}

/* ================= 树形（与编辑区同区互斥切换） ================= */
function leafHtml(v){
  if(v === null) return '<span class="j-null">null</span>';
  var t = typeof v;
  if(t === "string") return '<span class="j-str">"'+esc(v)+'"</span>';
  if(t === "number") return '<span class="j-num">'+esc(String(v))+'</span>';
  if(t === "boolean") return '<span class="j-bool">'+v+'</span>';
  return '<span class="j-null">'+esc(String(v))+'</span>';
}
function nodeHtml(val, key, depth){
  var isArr = Array.isArray(val);
  var entries;
  if(isArr){
    entries = val.map(function(v,i){
      var inner = (v!==null && typeof v==="object") ? nodeHtml(v, null, depth+1) : leafHtml(v);
      return "<li>["+i+"]: "+inner+"</li>";
    }).join("");
  }else{
    entries = Object.keys(val).map(function(k){
      var v = val[k];
      var inner = (v!==null && typeof v==="object") ? nodeHtml(v, k, depth+1) : leafHtml(v);
      return "<li><span class=\"j-key\">"+esc(k)+"</span>: "+inner+"</li>";
    }).join("");
  }
  var label = (key!==null ? "<span class=\"j-key\">"+esc(key)+"</span>: " : "") +
    (isArr ? '<span class="j-meta">Array ['+val.length+']</span>' : 'Object {'+Object.keys(val).length+'}');
  var open = depth < 2 ? " open" : "";
  return "<details"+open+"><summary>"+label+"</summary><div style=\"margin-left:4px\"><ul style=\"list-style:none\">"+entries+"</ul></div></details>";
}
function renderTree(side){
  var raw = readSide(side);
  var out = treeEl(side);
  if(!raw.trim()){ out.innerHTML = '<div class="empty">内容为空</div>'; return; }
  var p = parseByLang(raw, langOf(side));
  if(!p.ok){ out.innerHTML = '<div class="empty">'+esc(langOf(side)+" 解析失败："+p.err.message)+'</div>'; return; }
  out.innerHTML = nodeHtml(p.val, "root", 0);
}
/* 视图互斥：diff 优先 → 树形 → 编辑区 */
function applyView(side){
  var ed = editorEl(side), tv = treeEl(side), dv = diffEl(side), jv = jpEl(side);
  var showJp = !!P[side].jp;
  var showTree = !showJp && !diffOn && P[side].tree;
  var showDiff = !showJp && diffOn;
  if(ed) ed.className = "editor view-edit" + (showTree || showDiff || showJp ? " hide" : "");
  if(tv) tv.className = "view tree-view" + (showTree ? "" : " hide");
  if(dv) dv.className = "view diff-view" + (showDiff ? "" : " hide");
  if(jv) jv.className = "view jp-view" + (showJp ? "" : " hide");
  var lbl = treeLabel(side);
  if(lbl) lbl.textContent = showTree ? "Json" : "树形";
  var btn = treeBtn(side);
  if(btn) btn.classList.toggle("primary", showTree);
}
function editorEl(side){ return $(side==="R" ? "editorR" : "editorL"); }
function treeBtn(side){ return $(side==="R" ? "treeBtnR" : "treeBtnL"); }
function jpEl(side){ return $(side==="R" ? "jpR" : "jpL"); }
function toggleTree(side){
  P[side].tree = !P[side].tree;
  if(P[side].tree) P[side].jp = false;
  var btn = $("treeBtn"+side);
  if(btn) btn.classList.toggle("active", P[side].tree);
  applyView(side);
  if(P[side].tree) renderTree(side);
}

/* ================= 对比（左右编辑区内联着色显示差异） ================= */
function diffLines(aText, bText){
  var a = aText.replace(/\r/g,"").split("\n");
  var b = bText.replace(/\r/g,"").split("\n");
  var n=a.length, m=b.length, dp=null;
  if(n*m <= 400000){
    dp = new Array(n+1);
    for(var i=0;i<=n;i++) dp[i]=new Array(m+1).fill(0);
    for(i=n-1;i>=0;i--) for(var j=m-1;j>=0;j--)
      dp[i][j] = a[i]===b[j] ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j], dp[i][j+1]);
  }
  var outA=[], outB=[], x=0, y=0;
  while(x<n && y<m){
    if(dp && a[x]===b[y]){ outA.push({t:"",s:a[x]}); outB.push({t:"",s:b[y]}); x++; y++; }
    else if(dp && dp[x+1][y] >= dp[x][y+1]){ outA.push({t:"del",s:a[x]}); outB.push({t:"gap",s:""}); x++; }
    else if(dp){ outA.push({t:"gap",s:""}); outB.push({t:"add",s:b[y]}); y++; }
    else{
      if(a[x]===b[y]){ outA.push({t:"",s:a[x]}); outB.push({t:"",s:b[y]}); }
      else{ outA.push({t:"del",s:a[x]}); outB.push({t:"add",s:b[y]}); }
      x++; y++;
    }
  }
  while(x<n){ outA.push({t:"del",s:a[x]}); outB.push({t:"gap",s:""}); x++; }
  while(y<m){ outA.push({t:"gap",s:""}); outB.push({t:"add",s:b[y]}); y++; }
  return {a:outA, b:outB};
}
function renderDiff(){
  var d = diffLines(readSide("L"), readSide("R"));
  var htmlA = d.a.map(function(r){
    var cls = r.t==="del" ? "d-del" : (r.t==="gap" ? "d-gap" : "d-same");
    return '<div class="d-line '+cls+'">'+esc(r.s||" ")+'</div>';
  }).join("");
  var htmlB = d.b.map(function(r){
    var cls = r.t==="add" ? "d-add" : (r.t==="gap" ? "d-gap" : "d-same");
    return '<div class="d-line '+cls+'">'+esc(r.s||" ")+'</div>';
  }).join("");
  diffEl("L").innerHTML = htmlA || '<div class="diff-empty">两段内容完全相同</div>';
  diffEl("R").innerHTML = htmlB || '<div class="diff-empty">两段内容完全相同</div>';
}
function doCompare(){
  diffOn = !diffOn;
  if(diffOn) renderDiff();
  applyView("L");
  applyView("R");
  var lbl = $("cmpLabel");
  if(lbl) lbl.textContent = diffOn ? "退出对比" : "对比";
  var btn = $("btnCmp");
  if(btn) btn.classList.toggle("primary", diffOn);
  flashStatus(diffOn ? "已进入对比模式：红=左侧独有 · 绿=右侧新增" : "已退出对比模式","ok");
}

/* ================= 历史（弹层） ================= */
function renderHistory(){
  var out = $("histOut");
  try{ J.hist = JSON.parse(load(KEY_HIST)||"[]"); }catch(e){ J.hist=[]; }
  if(!J.hist.length){ out.innerHTML = '<div class="empty">暂无历史记录<br>格式化 / 压缩 / 转义 / 去转义 / 修复等操作后会自动保存</div>'; return; }
  var html = J.hist.map(function(h,idx){
    var prev = h.text.replace(/\s+/g," ").slice(0,60);
    return '<div class="hist-item"><div class="hist-prev" onclick="restoreHistory('+idx+')" title="点击恢复到最近操作的一侧">'+esc(prev)+'</div><div class="hist-time">'+fmtTime(h.t)+'</div><button class="hist-del" onclick="delHistory('+idx+')" title="删除">×</button></div>';
  }).join("");
  out.innerHTML = html;
}
function showHistory(){
  renderHistory();
  $("histModal").classList.add("show");
}
function closeHist(){ $("histModal").classList.remove("show"); }
function restoreHistory(idx){
  var item = J.hist[idx];
  if(!item) return;
  setSide(lastSide, item.text);
  flashStatus("已恢复到"+sideName(lastSide)+"编辑区 · "+fmtTime(item.t),"ok");
  closeHist();
}
function delHistory(idx){
  J.hist.splice(idx,1);
  store(KEY_HIST, JSON.stringify(J.hist));
  renderHistory();
}
function clearHistory(){
  if(!confirm("确定清空全部历史记录？")) return;
  J.hist=[]; store(KEY_HIST,"[]"); renderHistory();
}

/* ================= 导入 / 导出 ================= */
function openImportJson(){ $("fileImport").click(); }
$("fileImport").addEventListener("change", function(e){
  var f = e.target.files[0];
  if(!f) return;
  var r = new FileReader();
  r.onload = function(){ setSide("L", String(r.result)); flashStatus("已导入 "+f.name+"（左侧编辑区）","ok"); };
  r.readAsText(f, "utf-8");
  e.target.value="";
});
function downloadJson(){
  var side = lastSide;
  var raw = readSide(side);
  if(!raw.trim()){ flashStatus(sideName(side)+"内容为空，无法导出","err"); return; }
  var p = parseJson(raw);
  if(p.ok) raw = JSON.stringify(p.val, null, 2);
  download("export_"+nowStr()+".json", raw, "application/json");
}
function copyResult(){
  var txt = readSide(lastSide);
  if(!txt.trim()){ flashStatus("无可复制内容","err"); return; }
  copyText(txt);
}

/* ================= JSONPath 查询（左右各一栏，结果高亮展示在本侧） ================= */
/* 对本侧数据（任意语言先转 JSON 对象）跑 JSONPath，结果高亮渲染到本侧 jp 视图 */
function runJsonPath(side){
  if(side !== "L" && side !== "R") side = "L";
  if(!window.LIBS || !window.LIBS.JSONPath){ flashStatus("JSONPath 库未就绪，请稍候重试","err"); return; }
  var expr = $("jpInput"+side) ? $("jpInput"+side).value.trim() : "";
  if(!expr){ flashStatus("请输入 JSONPath 表达式","err"); return; }
  var raw = readSide(side);
  var p = parseByLang(raw, langOf(side));
  if(!p.ok){ flashStatus(sideName(side)+"解析失败，无法查询："+p.err.message,"err"); return; }
  var res;
  try{
    res = window.LIBS.JSONPath({ path: expr, json: p.val, resultType: "all" });
  }catch(e){ flashStatus("JSONPath 语法错误："+e.message,"err"); return; }
  if(!res || !res.length){ flashStatus("未匹配到任何节点","ok"); return; }
  var html = "";
  for(var i=0;i<res.length;i++){
    var item = res[i];
    var pathStr = jpPrettifyPath(item.path || "$");
    html += '<div class="jp-hit"><div class="jp-path">'+esc(pathStr)+'</div>'+
            '<pre class="jp-val">'+jpHighlight(item.value)+'</pre></div>';
  }
  var box = jpEl(side);
  if(box){
    box.innerHTML = '<div class="jp-head">JSONPath 命中 '+res.length+' 项 · 已自动将本侧「'+
      langOf(side).toUpperCase()+'」转为 JSON 后查询</div>'+html;
  }
  P[side].jp = true;
  P[side].tree = false;
  applyView(side);
  flashStatus(sideName(side)+" JSONPath 查询完成 · 命中 "+res.length+" 项","ok");
}
function clearJsonPath(side){
  if(side !== "L" && side !== "R") side = "L";
  var inp = $("jpInput"+side); if(inp) inp.value = "";
  P[side].jp = false;
  applyView(side);
  flashStatus("已退出"+sideName(side)+" JSONPath 视图","ok");
}
/* JSON 语法着色 + 命中黄底（用于 jp 结果展示） */
function jpPrettifyPath(p){
  if(typeof p !== "string" || !p) return "$";
  /* jsonpath-plus 路径形如 $['store']['book'][0]['title']
     → 字符串键转 .key，数字索引 [0] 保留 → $.store.book[0].title */
  return p
    .replace(/\['([^']+)'\]/g, ".$1")
    .replace(/\["([^"]+)"\]/g, ".$1");
}
function jpHighlight(val){
  var json = JSON.stringify(val, null, 2);
  if(json === undefined) return "";
  json = esc(json);
  json = json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function(m){
    var cls = "j-num";
    if(/^"/.test(m)){ cls = /:$/.test(m) ? "j-key" : "j-str"; }
    else if(/true|false/.test(m)) cls = "j-bool";
    else if(/null/.test(m)) cls = "j-null";
    return '<span class="'+cls+'">'+m+'</span>';
  });
  return json;
}
/* ================= 编辑区事件 ================= */
function bindEditor(side){
  var inp = inputEl(side);
  var draft = load(draftKey(side));
  inp.value = (draft!==null && draft.trim()) ? draft : (side==="L" ? SAMPLE : SAMPLE_B);
  renderGutter(side);
  inp.addEventListener("input", function(){
    lastSide = side;
    P[side].text = inp.value;
    renderGutter(side);
    drawSquiggle(side); /* 内容变化立即按新内容重绘（位置随光标行内容变化） */
    scheduleSave(side);
    updateToolBtns(side); /* 输入即刷新按钮显隐（不等 500ms 防抖） */
    clearTimeout(valTimer[side]);
    valTimer[side] = setTimeout(function(){ validateSide(side); }, 500);
  });
  inp.addEventListener("scroll", function(){
    gutterEl(side).scrollTop = inp.scrollTop;
    drawSquiggle(side); /* 滚动时波浪线跟随文字 */
  });
  // 拖拽导入
  var editor = inp.closest(".editor");
  ["dragover","dragenter"].forEach(function(ev){
    editor.addEventListener(ev, function(e){ e.preventDefault(); editor.style.outline="2px solid var(--primary)"; });
  });
  ["dragleave","drop"].forEach(function(ev){
    editor.addEventListener(ev, function(e){
      e.preventDefault();
      editor.style.outline="none";
    });
  });
  editor.addEventListener("drop", function(e){
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if(!f) return;
    var r = new FileReader();
    r.onload = function(){ setSide(side, String(r.result)); flashStatus("已拖入导入 "+f.name+"（"+sideName(side)+"）","ok"); };
    r.readAsText(f, "utf-8");
  });
}
function initEditor(){
  bindEditor("L");
  bindEditor("R");
  validateSide("L");
  validateSide("R");
  updateToolBtns("L");
  updateToolBtns("R");
  applyView("L");
  applyView("R");
}
