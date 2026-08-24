"use strict";
/* ================= Auth：GitHub OAuth 登录态 =================
   admin = 登录 GitHub 且 login === ADMIN_LOGIN（Worker 端判定）
   前端只做 UI 显隐（authIsAdmin），安全边界在 Worker。
   Worker URL 复用 Skills 通道配置 wb_home_sk_set.worker（同一 Cloudflare Worker）。 */
var KEY_AUTH_TOKEN = KEY_PREFIX + "auth_token";
var KEY_AUTH_USER  = KEY_PREFIX + "gh_user";

function authToken(){ return load(KEY_AUTH_TOKEN); }
function authUser(){
  try{ return JSON.parse(load(KEY_AUTH_USER) || "null"); }catch(e){ return null; }
}
function authIsAdmin(){ var u = authUser(); return !!(authToken() && u && u.login); }

/* Worker URL 复用 Skills 通道配置 wb_home_sk_set.worker（skCfg 未配置时回退内置默认 Worker） */
function authWorkerUrl(){ return skCfg().worker; }

/* 手写 base64 解码（vm 沙箱/旧浏览器无 atob 时也可用）；payload 为 ASCII JSON，无需 UTF-8 处理 */
var AUTH_B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function authB64Bytes(s){
  var out = [], acc = 0, bits = 0;
  for(var i = 0; i < s.length; i++){
    var c = s.charAt(i);
    if(c === "=") break;
    var n = AUTH_B64_CHARS.indexOf(c);
    if(n < 0) continue;
    acc = (acc << 6) | n; bits += 6;
    if(bits >= 8){ bits -= 8; out.push((acc >> bits) & 0xFF); }
  }
  return out;
}
function authDecodeLogin(token){
  try{
    var p = String(token).split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    while(p.length % 4) p += "=";
    var bytes = authB64Bytes(p), str = "";
    for(var i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return (JSON.parse(str).login) || "";
  }catch(e){ return ""; }
}

/* 发起 OAuth：跳 Worker /api/auth/login（Worker 生成 state 并 302 到 GitHub） */
function authLogin(){
  var worker = authWorkerUrl();
  if(!worker){ alert("未配置 Worker 写通道 · 请先在 Skills「通道设置」填写 Worker URL"); return; }
  location.href = worker + "/api/auth/login";
}
function authLogout(){
  remove(KEY_AUTH_TOKEN); remove(KEY_AUTH_USER);
  authApply();
}
/* 保存 token 并解码 login；token 非法返回 false */
function authSave(token){
  var login = authDecodeLogin(token);
  if(!login) return false;
  store(KEY_AUTH_TOKEN, token);
  store(KEY_AUTH_USER, JSON.stringify({ login: login }));
  return true;
}
/* 依据登录态刷新登录按钮与 body.admin 标记（控制 admin-only 元素显隐） */
function authApply(){
  var btn = $("authBtn");
  var u = authUser();
  var isAdmin = authIsAdmin();
  if(document.body && document.body.classList) document.body.classList.toggle("admin", isAdmin);
  if(!btn) return;
  if(isAdmin && u){
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span>' + esc(u.login) + '</span>';
    btn.title = "已登录 GitHub · 点击退出";
    btn.onclick = authLogout;
  } else {
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v14"/><path d="M6 12l6 6 6-6"/><path d="M4 21h16"/></svg><span>登录 GitHub</span>';
    btn.title = "登录 GitHub（站长功能）";
    btn.onclick = authLogin;
  }
}
/* 启动：消费 OAuth 回调结果（?auth=<token> / ?auth=denied）→ 清理地址栏 → 应用 UI → 静默校验 */
function authInit(){
  var q = {};
  try{
    var s = String(location.search || "").replace(/^\?/, "");
    if(s) s.split("&").forEach(function(kv){
      var i = kv.indexOf("=");
      if(i > 0) q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
    });
  }catch(e){}
  if("auth" in q){
    if(q.auth === "denied"){ remove(KEY_AUTH_TOKEN); remove(KEY_AUTH_USER); }
    else if(q.auth) authSave(q.auth);
    try{ history.replaceState(null, "", location.pathname + location.hash); }catch(e){}
  }
  authApply();
  if(authToken()) authVerify();
}
/* 静默校验 token 有效性：401 → 自动登出 */
function authVerify(){
  var worker = authWorkerUrl();
  if(!worker || !window.fetch) return;
  fetch(worker + "/api/auth/me", { headers: { "Authorization": "Bearer " + authToken() } })
    .then(function(res){ if(res.status === 401) authLogout(); })
    .catch(function(){});
}
