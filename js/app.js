"use strict";
/* ================= 初始化 ================= */
var SAMPLE = JSON.stringify({
  "姓名": "示例用户",
  "角色": "后端开发",
  "技能": ["Go", "区块链", "DID"],
  "工作": {"公司": "腾讯", "部门": "ChainWeaver", "在职": true},
  "本周目标": [
    {"事项": "完成 DID 同步服务测试", "状态": "进行中"},
    {"事项": "更新协议文档", "状态": "待办"}
  ]
}, null, 2);
var SAMPLE_B = JSON.stringify({
  "姓名": "示例用户",
  "角色": "后端开发",
  "技能": ["Go", "区块链", "DID", "SM2"],
  "工作": {"公司": "腾讯", "部门": "ChainWeaver", "在职": true},
  "本周目标": [
    {"事项": "完成 DID 同步服务测试", "状态": "完成"},
    {"事项": "更新协议文档", "状态": "进行中"},
    {"事项": "设计 httptest 工具", "状态": "待办"}
  ]
}, null, 2);

function skStickySync(){
  var head = document.querySelector('.sk-detail-head');
  var sec = document.querySelector('.sk-sec-sticky');
  var headH = head ? head.offsetHeight : 0;
  var secH = sec ? sec.offsetHeight : 0;
  document.documentElement.style.setProperty('--skHeadH', headH + 'px');
  document.documentElement.style.setProperty('--skScrollPad', (headH + secH + 8) + 'px');
}
function init(){
  var t = load(KEY_THEME) || "light";
  applyTheme(t);
  renderClock();
  loadWeather(false);
  initEditor();
  navigate();
  setInterval(function(){ loadWeather(false); }, 30*60*1000);
  $("histModal").addEventListener("click", function(e){ if(e.target === this) closeHist(); });
  window.loadWeather = loadWeather;
  window.toggleTheme = toggleTheme;
  window.exportBackup = exportBackup;
  window.openImport = openImport;
  window.fmtSide = fmtSide; window.minSide = minSide; window.escSide = escSide; window.unescSide = unescSide;
  window.toggleTree = toggleTree; window.doCompare = doCompare; window.doRepair = doRepair;
  window.showHistory = showHistory; window.closeHist = closeHist;
  window.renderHistory = renderHistory; window.restoreHistory = restoreHistory; window.delHistory = delHistory; window.clearHistory = clearHistory;
  window.copyResult = copyResult; window.copyText = copyText; window.downloadJson = downloadJson;
  window.openImportJson = openImportJson;
  window.skLoad = skLoad; window.skGoto = skGoto; window.skBack = skBack;
  window.skOpenFile = skOpenFile; window.skToggleTree = skToggleTree;
  window.skShowDetail = skShowDetail; window.skShowList = skShowList;
  window.skMdMode = skMdMode;
  window.skOpenCollect = skOpenCollect; window.skCloseCollect = skCloseCollect;
  window.skCollect = skCollect; window.skRemove = skRemove; window.skSync = skSync;
  window.skOpenCfg = skOpenCfg; window.skCloseCfg = skCloseCfg;
  window.skSaveCfg = skSaveCfg; window.skTest = skTest;
  skAnchorBind();
  skStickySync();
  if(window.ResizeObserver){
    var skRo = new ResizeObserver(skStickySync);
    var _skH = document.querySelector('.sk-detail-head');
    var _skS = document.querySelector('.sk-sec-sticky');
    if(_skH) skRo.observe(_skH);
    if(_skS) skRo.observe(_skS);
  }
  skLoad();
  window.rkLoad = rkLoad; window.rkFetch = rkFetch; window.rkRefresh = rkRefresh;
  window.rkRenderAll = rkRenderAll; window.rkMapStyle = rkMapStyle;
  window.rkMapStyleIdx = rkMapStyleIdx; window.rkResolveStyle = rkResolveStyle;
  window.rkHeatSel = rkHeatSel; window.rkTrendMode = rkTrendMode;
  window.rkListSel = rkListSel; window.rkMore = rkMore; window.rkShowMap = rkShowMap;
  window.rkOpenAct = rkOpenAct; window.rkCloseAct = rkCloseAct; window.rkMaskClose = rkMaskClose;
  window.rkActInfo = rkActInfo; window.rkActReplay = rkActReplay; window.rkActStop = rkActStop;
  window.rkActBgStyle = rkActBgStyle; window.rkActLoadBg = rkActLoadBg;
  window.rkHotSpot = rkHotSpot; window.rkMapTracks = rkMapTracks;
  window.rkMerc = rkMerc; window.rkMercInv = rkMercInv;
  window.rkDecodePolyline = rkDecodePolyline; window.rkThin = rkThin;
}
document.addEventListener("DOMContentLoaded", init);
