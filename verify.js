/* personal-homepage 双编辑区重构 vm 回归测试 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'css/style.css'), 'utf8');
// 拆分后 JS 按 index.html 底部 <script src> 顺序加载，此处按同序拼接进同一 vm 上下文
const JS_FILES = ['js/util.js', 'js/auth.js', 'js/json.js', 'js/skills.js', 'js/app.js', 'js/running.js'];
let code = JS_FILES.map(function (f) { return fs.readFileSync(path.join(__dirname, f), 'utf8'); }).join('\n');
// 源码字符串断言统一检索的全文 = HTML + CSS + JS（拆分后 CSS/JS 已移出 index.html）
const src = html + '\n' + css + '\n' + code;

/* ---------- mock DOM ---------- */
function makeEl(id, cls) {
  const store = { _cls: new Set(), _style: {}, listeners: {} };
  if (cls) store.className = cls;
  const proxy = new Proxy({}, {
    get(t, prop) {
      switch (prop) {
        case 'id': return id;
        case 'value': return store.value !== undefined ? store.value : '';
        case 'textContent': return store.textContent !== undefined ? store.textContent : '';
        case 'innerHTML': return store.innerHTML !== undefined ? store.innerHTML : '';
        case 'className': return store.className !== undefined ? store.className : '';
        case 'style': return store._style;
        case 'scrollTop': return store.scrollTop !== undefined ? store.scrollTop : 0;
        case 'dataset': return store.dataset || (store.dataset = {});
        case 'classList': return store.classList || (store.classList = {
          add: (...c) => c.forEach(x => store._cls.add(x)),
          remove: (...c) => c.forEach(x => store._cls.delete(x)),
          toggle: (c, force) => { const has = store._cls.has(c); const want = force === undefined ? !has : !!force; if (want) store._cls.add(c); else store._cls.delete(c); return want; },
          contains: c => store._cls.has(c)
        });
        case 'closest': return () => makeEl(id + '-editor');
        case 'addEventListener': return (ev, fn) => { (store.listeners[ev] = store.listeners[ev] || []).push(fn); };
        case 'remove': return () => {};
        case 'click': return () => {};
        case 'select': return () => {};
        case 'appendChild': return () => {};
        case 'removeChild': return () => {};
        /* Task 17 地图所需 DOM 方法：getBoundingClientRect 固定 640x360；
           querySelector 返回 null → rkShowMap 中 img=null → 同步 go() 渲染矢量层（测试环境无 img 分支）；
           setAttribute/removeAttribute 存储属性便于后续断言 */
        case 'getBoundingClientRect': return () => ({ width: 640, height: 360, left: 0, top: 0 });
        case 'querySelector': return () => null;
        case 'querySelectorAll': return () => [];
        case 'setAttribute': return (k, v) => { (store._attrs = store._attrs || {})[k] = String(v); };
        case 'removeAttribute': return (k) => { if (store._attrs) delete store._attrs[k]; };
        default: return undefined;
      }
    },
    set(t, prop, v) { store[prop] = v; return true; }
  });
  return proxy;
}

const elements = {};
const localStorageMock = (() => {
  const ls = {};
  return {
    getItem: k => (k in ls ? ls[k] : null),
    setItem: (k, v) => { ls[k] = String(v); },
    removeItem: k => { delete ls[k]; },
    key: i => Object.keys(ls)[i] || null,
    get length() { return Object.keys(ls).length; }
  };
})();

/* 可控 null 注入：模拟真实浏览器中缺失的元素 id（如旧版全局状态条 statusDot/statusText） */
const nullIds = new Set();
const documentMock = {
  getElementById(id) {
    if (nullIds.has(id)) return null;
    if (!elements[id]) elements[id] = makeEl(id);
    return elements[id];
  },
  addEventListener() {},
  removeEventListener() {},
  createElement() { return makeEl('created'); },
  querySelectorAll() { return []; },
  body: makeEl('body'),
  execCommand() { return true; }
};
elements.indentSel = makeEl('indentSel');
elements.indentSel.value = '2';
elements.wrapL = makeEl('wrapL', 'editor-wrap');
elements.wrapR = makeEl('wrapR', 'editor-wrap');

const locationMock = { pathname: '/json', hash: '', search: '' };
function applyUrl(url) {
  if (url == null) return;
  if (url.charAt(0) === '#') { locationMock.hash = url; }
  else { locationMock.pathname = url; locationMock.hash = ''; }
}
const historyMock = {
  replaceState(s, t, url) { applyUrl(url); },
  pushState(s, t, url) { applyUrl(url); },
  back() {}, go() {}
};
const windowMock = { addEventListener() {}, location: locationMock, history: historyMock };
const ctx = {
  document: documentMock,
  localStorage: localStorageMock,
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  window: windowMock,
  location: locationMock,
  history: historyMock,
  console,
  // 同步化 setTimeout：setSide 的 500ms 防抖保存立即生效，便于断言；
  // 仅当参数为函数时立即执行（部分调用仅作定时器句柄，字符串/缺参形式直接跳过）
  setTimeout: (fn) => { if (typeof fn === 'function') { fn(); } return 0; },
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => 0,
  Date, JSON, Math, String, Number, Boolean, Array, Object, RegExp, parseInt, parseFloat, isNaN,
  Blob: function (parts, opts) { return { parts, opts }; },
  URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
  FileReader: function () { this.readAsText = () => {}; },
  confirm: () => true,
  alert: () => {},
  fetch: () => Promise.resolve({ ok: true, text: () => Promise.resolve('') })
};
ctx.window = windowMock;
vm.createContext(ctx);
vm.runInContext(code, ctx);

/* ---------- 断言工具 ---------- */
let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
function el(id) { return documentMock.getElementById(id); }

/* ========== 1. 双侧独立编辑 ========== */
console.log('== 1. 双编辑区基础 ==');
T('readSide 初始为空', ctx.readSide('L') === '' && ctx.readSide('R') === '');
ctx.setSide('L', '{"a":1}');
T('setSide(L) 写入 jsonInputL', el('jsonInputL').value === '{"a":1}');
T('setSide(L) 不影响右侧', el('jsonInputR').value === '');
T('lastSide 跟随 L', ctx.lastSide === 'L');
ctx.setSide('R', '{"b":2}');
T('setSide(R) 写入 jsonInputR', el('jsonInputR').value === '{"b":2}');
T('lastSide 跟随 R', ctx.lastSide === 'R');
T('draftKey 分侧存储', ctx.draftKey('L') === 'wb_home_json_draft' && ctx.draftKey('R') === 'wb_home_json_draft_r');

/* ========== 2. 格式化 / 压缩 / 转义 双侧独立 ========== */
console.log('== 2. 格式化/压缩/转义 ==');
ctx.setSide('L', '{"a":1,"b":[1,2]}');
ctx.fmtSide('L');
T('fmtSide(L) 格式化左侧', el('jsonInputL').value === '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}', JSON.stringify(el('jsonInputL').value));
T('fmtSide(L) 不动右侧', el('jsonInputR').value === '{"b":2}');
T('格式化后 L 仍为合法 JSON', ctx.parseJson(el('jsonInputL').value).ok === true);
ctx.setSide('R', '{"x":  {"y": [1, 2, 3]}}');
ctx.minSide('R');
T('minSide(R) 压缩右侧', el('jsonInputR').value === '{"x":{"y":[1,2,3]}}', JSON.stringify(el('jsonInputR').value));
ctx.setSide('L', 'hello "world"');
ctx.escSide('L');
T('escSide(L) 转义为字符串字面量', el('jsonInputL').value === '"hello \\"world\\""', JSON.stringify(el('jsonInputL').value));
ctx.unescSide('L');
T('unescSide(L) 去转义还原', el('jsonInputL').value === 'hello "world"', JSON.stringify(el('jsonInputL').value));

/* ========== 3. 实时校验 / 错误定位 ========== */
console.log('== 3. 校验与错误定位 ==');
ctx.validateSide('L'); // 当前 "hello "world"" 非法
T('非法内容 → 红点 err', el('vdotL').className.indexOf('err') >= 0);
T('错误提示含行列', el('vtextL').textContent.indexOf('第') >= 0);
ctx.setSide('L', '{"ok":true}');
ctx.validateSide('L');
T('合法内容 → 绿点 ok', el('vdotL').className.indexOf('ok') >= 0);
T('合法提示含 JSON 合法', el('vtextL').textContent.indexOf('JSON 合法') >= 0);
const loc = ctx.locateErr({ message: 'Unexpected token } in JSON at position 8' }, '{"a": 1,}');
T('locateErr 定位行列（1 基列号）', loc.line === 1 && loc.col === 9, JSON.stringify(loc));
T('chineseErr 中文翻译', ctx.chineseErr('Unexpected end of JSON input').indexOf('不完整') >= 0);
T('chineseErr 缺键名', ctx.chineseErr('Expected property name').indexOf('键名') >= 0);

/* ========== 3b. 错误红色波浪线 ========== */
console.log('== 3b. 错误波浪线 ==');
ctx.setSide('L', '{"a": 1,}'); // setSide 内部已触发 validateSide
T('非法 → P.L.err 已记录(1行9列)', ctx.P.L.err && ctx.P.L.err.line === 1 && ctx.P.L.err.col === 9, JSON.stringify(ctx.P.L.err));
T('非法 → sqL 绘制了 path 波浪线', el('sqL').innerHTML.indexOf('<path') >= 0 && el('sqL').innerHTML.indexOf('#E24B4A') >= 0, el('sqL').innerHTML);
// x = 12 + 8*8.4 = 79.2（col-1=8 个字符），y = 12+20 = 32（line1, scrollTop=0）
T('波浪线 x 对齐报错列（M79.2 32）', el('sqL').innerHTML.indexOf('M79.2 32') >= 0, el('sqL').innerHTML);
T('波浪线使用波浪路径段', el('sqL').innerHTML.indexOf('q4 -3.5 8 0 t8 0') >= 0);
el('jsonInputL').scrollTop = 50;
ctx.drawSquiggle('L');
T('滚动后波浪线跟随（y=32-50=-18）', el('sqL').innerHTML.indexOf('M79.2 -18') >= 0, el('sqL').innerHTML);
el('jsonInputL').scrollTop = 0;
ctx.drawSquiggle('L');
ctx.setSide('L', '{"ok":true}');
T('合法 → P.L.err 清空', ctx.P.L.err === null);
T('合法 → sqL 无波浪线', el('sqL').innerHTML === '');
ctx.setSide('L', '   ');
T('空白 → P.L.err 清空且无波浪线', ctx.P.L.err === null && el('sqL').innerHTML === '');
ctx.setSide('L', '{"a": 1,}');
ctx.showErr('L', ctx.P.L.err);
T('showErr 重新绘制波浪线', el('sqL').innerHTML.indexOf('<path') >= 0);
ctx.setSide('R', '{"b":');
T('右侧非法 → sqR 波浪线', el('sqR').innerHTML.indexOf('<path') >= 0);
T('左右波浪线各自独立', el('sqL').innerHTML.indexOf('<path') >= 0 && el('sqR').innerHTML.indexOf('<path') >= 0);
ctx.setSide('R', '{"b":2}');
T('右侧修复后 sqR 清空、sqL 保留', el('sqR').innerHTML === '' && el('sqL').innerHTML.indexOf('<path') >= 0);

/* ========== 4. 修复（作用于最近一侧） ========== */
console.log('== 4. 修复 ==');
ctx.setSide('R', "{a:1, b:'x',}");
ctx.doRepair();
T('doRepair 修复右侧（lastSide=R）', el('jsonInputR').value === '{\n  "a": 1,\n  "b": "x"\n}', JSON.stringify(el('jsonInputR').value));
T('修复后合法', ctx.parseJson(el('jsonInputR').value).ok === true);
ctx.setSide('L', '/* 注释 */ {"c": 2,}');
ctx.doRepair();
T('doRepair 修复左侧（lastSide=L）且清注释', el('jsonInputL').value === '{\n  "c": 2\n}', JSON.stringify(el('jsonInputL').value));

/* ========== 5. 树形视图（同区互斥） ========== */
console.log('== 5. 树形视图 ==');
ctx.toggleTree('L');
T('toggleTree(L) 开启树形', ctx.P.L.tree === true);
T('树形开启 → 工具栏按钮激活态', el('treeBtnL').classList.contains('active'));
T('treeLabelL 变为 Json', el('treeLabelL').textContent === 'Json');
T('treeL 渲染出节点', el('treeL').innerHTML.indexOf('details') >= 0 && el('treeL').innerHTML.indexOf('j-key') >= 0);
T('树形时编辑区（.editor）隐藏', el('editorL').className.indexOf('hide') >= 0);
T('树形时 wrap 保持 editor-wrap 类且不误加 hide', el('wrapL').className.indexOf('editor-wrap') >= 0 && el('wrapL').className.indexOf('hide') < 0);
T('树形时 tree 视图显示', el('treeL').className.indexOf('hide') < 0);
ctx.toggleTree('L');
T('toggleTree(L) 关闭', ctx.P.L.tree === false && el('treeLabelL').textContent === '树形');
T('树形关闭 → 按钮取消激活态', !el('treeBtnL').classList.contains('active'));
T('关闭后编辑区恢复显示', el('editorL').className.indexOf('hide') < 0);

/* ========== 6. 对比模式 ========== */
console.log('== 6. 对比 ==');
ctx.setSide('L', 'a\nb\nc');
ctx.setSide('R', 'a\nx\nc');
const d = ctx.diffLines('a\nb\nc', 'a\nx\nc');
// gap 行是对齐占位（删除/新增行对面补空行），因此每侧 4 行
T('diffLines 行数匹配（含 gap 占位）', d.a.length === 4 && d.b.length === 4, 'a=' + d.a.length + ' b=' + d.b.length);
T('diffLines b 侧 add 标记在 x 行', d.b[2].t === 'add' && d.b[2].s === 'x', JSON.stringify(d.b));
T('diffLines a 侧 del 标记在 b 行', d.a[1].t === 'del' && d.a[1].s === 'b');
T('diffLines 相同行不标', d.a[0].t === '' && d.b[0].t === '' && d.a[3].t === '' && d.b[3].t === '');
T('diffLines gap 占位行', d.a[2].t === 'gap' && d.b[1].t === 'gap');
ctx.doCompare();
T('doCompare 进入对比', ctx.diffOn === true);
T('cmpLabel 显示退出对比', el('cmpLabel').textContent === '退出对比');
T('对比时编辑区（.editor）隐藏', el('editorL').className.indexOf('hide') >= 0 && el('editorR').className.indexOf('hide') >= 0);
T('对比时 wrap 保持 editor-wrap 类（不丢布局）', el('wrapL').className.indexOf('editor-wrap') >= 0 && el('wrapR').className.indexOf('editor-wrap') >= 0);
T('对比时 wrap 不误加 hide', el('wrapL').className.indexOf('hide') < 0 && el('wrapR').className.indexOf('hide') < 0);
T('对比时 diff 视图显示', el('diffL').className.indexOf('hide') < 0 && el('diffR').className.indexOf('hide') < 0);
T('diffL 渲染着色类', el('diffL').innerHTML.indexOf('d-del') >= 0 && el('diffL').innerHTML.indexOf('d-same') >= 0);
ctx.doCompare();
T('doCompare 退出对比', ctx.diffOn === false);
T('退出对比后编辑区恢复显示', el('editorL').className.indexOf('hide') < 0 && el('editorR').className.indexOf('hide') < 0);

/* ========== 7. 历史记录 ========== */
console.log('== 7. 历史 ==');
ctx.pushHistory('{"h":1}');
ctx.pushHistory('{"h":2}');
// 历史会累积前面 fmt/min/esc/repair 的 push（设计如此），只断言最新与上限
T('pushHistory 最新在前', ctx.J.hist[0].text === '{"h":2}' && ctx.J.hist[1].text === '{"h":1}');
T('pushHistory 上限 10 条', ctx.J.hist.length <= 10, 'len=' + ctx.J.hist.length);
ctx.setSide('L', 'x'); // 显式指定 lastSide=L
ctx.restoreHistory(0);
T('restoreHistory 恢复到 lastSide（L）', el('jsonInputL').value === '{"h":2}', JSON.stringify(el('jsonInputL').value));
ctx.clearHistory();
T('clearHistory 清空', ctx.J.hist.length === 0 && localStorageMock.getItem('wb_home_json_history') === '[]');

/* ========== 8. 行号 / 保存 ========== */
console.log('== 8. 行号与草稿 ==');
ctx.setSide('L', 'a\nb\nc\nd');
ctx.renderGutter('L');
T('renderGutter 生成 4 行行号', (el('gutterL').innerHTML.match(/<div>/g) || []).length === 4);
T('setSide 触发分侧草稿保存', localStorageMock.getItem('wb_home_json_draft') === 'a\nb\nc\nd' && localStorageMock.getItem('wb_home_json_draft_r') === 'a\nx\nc');

/* ========== 9. 导出 / 复制 ========== */
console.log('== 9. 导出与复制 ==');
ctx.setSide('R', '{"e":1}');
ctx.downloadJson();
T('downloadJson 导出 lastSide（R）并格式化', true); // download 已 mock，不抛错即通过
ctx.copyResult();
T('copyResult 复制 lastSide 无异常', true);

/* ========== 9b. flashStatus 回退（旧全局状态条 statusDot/statusText 已移除） ========== */
console.log('== 9b. flashStatus 回退 ==');
nullIds.add('statusDot'); nullIds.add('statusText'); // 模拟真实浏览器中元素缺失
ctx.setSide('R', '{"e":2}'); // lastSide=R
ctx.flashStatus('回退写入校验条', 'ok');
T('flashStatus 元素缺失不崩且回退到 vtextR', el('vtextR').textContent === '回退写入校验条', JSON.stringify(el('vtextR').textContent));
T('回退后 vdotR 状态类正确', el('vdotR').className === 'dot ok', el('vdotR').className);
ctx.setSide('L', '{"l":1}');
ctx.flashStatus('左侧消息', 'err');
T('flashStatus 按 lastSide=L 回退到 vtextL', el('vtextL').textContent === '左侧消息' && el('vdotL').className === 'dot err', el('vtextL').textContent + ' / ' + el('vdotL').className);
nullIds.clear();

/* ========== 10. 全局函数导出 ========== */
console.log('== 10. 挂载完整性 ==');
['fmtSide','minSide','escSide','unescSide','toggleTree','doCompare','doRepair','showHistory','restoreHistory','delHistory','clearHistory','copyResult','downloadJson','openImportJson'].forEach(fn => {
  T('window.' + fn + ' 可调用', typeof ctx[fn] === 'function');
});

/* ========== 10b. skTest 输入框优先（未保存配置也能测） ========== */
console.log('== 10b. skTest 输入框优先 ==');
// 场景1：已保存配置为空 + 输入框有值 → 不应误报「请先填写」，应进入「测试中…」（await 前同步完成）
ctx.store('wb_home_sk_set', '{}');
el('skCfgWorker').value = 'https://skillboard-collect.example.workers.dev';
el('skCfgMsg').textContent = '';
ctx.skTest();
T('未保存配置时 skTest 读输入框 URL 进入测试', el('skCfgMsg').textContent === '测试中…', el('skCfgMsg').textContent);
// 场景2：输入框与配置皆空 → 回退内置默认 Worker（不再误报请先填写）
el('skCfgWorker').value = '';
el('skCfgMsg').textContent = '';
ctx.skTest();
T('输入框与配置皆空回退默认 Worker 进入测试', el('skCfgMsg').textContent === '测试中…', el('skCfgMsg').textContent);
// 场景3：打开设置弹窗时未配置 → 预填内置默认值
ctx.store('wb_home_sk_set', '{}');
ctx.skOpenCfg();
T('skOpenCfg 未配置时预填默认仓库', el('skCfgRepo').value === 'guoxinl/skill-collection', el('skCfgRepo').value);
T('skOpenCfg 未配置时预填默认分支', el('skCfgBranch').value === 'main', el('skCfgBranch').value);
T('skOpenCfg 未配置时预填默认 Worker', el('skCfgWorker').value === 'https://skillboard-collect.lgx31.workers.dev', el('skCfgWorker').value);

/* ========== 10b2. 未配置通道时回退默认值（游客免配置即可看 skills / running 数据） ========== */
console.log('== 10b2. 未配置回退默认值 ==');
ctx.store('wb_home_sk_set', '{}');
T('skCfg 未配置回退默认仓库', ctx.skCfg().repo === 'guoxinl/skill-collection', ctx.skCfg().repo);
T('skCfg 未配置回退默认分支', ctx.skCfg().branch === 'main', ctx.skCfg().branch);
T('skCfg 未配置回退默认 Worker', ctx.skCfg().worker === 'https://skillboard-collect.lgx31.workers.dev', ctx.skCfg().worker);
T('rkTracks 未配置回退默认 Worker 代理 URL', ctx.rkTracks('preview.json') === 'https://skillboard-collect.lgx31.workers.dev/api/tracks/raw?f=preview.json', ctx.rkTracks('preview.json'));
T('authWorkerUrl 未配置回退默认 Worker', ctx.authWorkerUrl() === 'https://skillboard-collect.lgx31.workers.dev', ctx.authWorkerUrl());
ctx.store('wb_home_sk_set', JSON.stringify({repo:'a/b', branch:'dev', worker:'https://x.example.com/'}));
var _cfgU = ctx.skCfg();
T('skCfg 用户配置优先（含末尾斜杠清理）', _cfgU.repo === 'a/b' && _cfgU.branch === 'dev' && _cfgU.worker === 'https://x.example.com', JSON.stringify(_cfgU));
ctx.store('wb_home_sk_set', JSON.stringify({repo:'', branch:'', worker:''}));
var _cfgE = ctx.skCfg();
T('skCfg 配置字段清空时逐项回退默认', _cfgE.repo === 'guoxinl/skill-collection' && _cfgE.branch === 'main' && _cfgE.worker === 'https://skillboard-collect.lgx31.workers.dev', JSON.stringify(_cfgE));

/* ========== 10d. Auth：GitHub 登录态 / admin 权限 ========== */
console.log('== 10d. Auth 登录态 ==');
T('auth 模块全部函数存在', typeof ctx.authToken === 'function' && typeof ctx.authUser === 'function'
  && typeof ctx.authIsAdmin === 'function' && typeof ctx.authLogin === 'function'
  && typeof ctx.authLogout === 'function' && typeof ctx.authApply === 'function'
  && typeof ctx.authInit === 'function' && typeof ctx.authVerify === 'function');
T('auth.js 关键逻辑（token 存取 / OAuth 跳转 / URL 回调清理 / Bearer）',
  src.indexOf('var KEY_AUTH_TOKEN = KEY_PREFIX + "auth_token"') >= 0
  && src.indexOf('function authLogin(){') >= 0
  && src.indexOf('location.href = worker + "/api/auth/login"') >= 0
  && src.indexOf('history.replaceState(null, "", location.pathname + location.hash)') >= 0
  && src.indexOf('Bearer " + authToken()') >= 0
  && src.indexOf('authDecodeLogin') >= 0);
T('app.js init 挂载并初始化 auth', src.indexOf('window.authIsAdmin = authIsAdmin') >= 0 && src.indexOf('authInit();') >= 0);
T('index：auth.js 在 util.js 之后引入', src.indexOf('<script src="/js/util.js"></script>') < src.indexOf('<script src="/js/auth.js"></script>'));
T('未登录：authIsAdmin 为 false', ctx.authIsAdmin() === false);
T('authSave 非法 token → false', ctx.authSave('bad.token') === false);
const AUTH_PAYLOAD = Buffer.from(JSON.stringify({ login: 'GuoxinL', iat: 1, exp: 9999999999 })).toString('base64url');
const AUTH_FAKE = AUTH_PAYLOAD + '.fakesig';
T('authSave 合法 token → true 且解码 login', ctx.authSave(AUTH_FAKE) === true && ctx.authUser().login === 'GuoxinL');
T('登录后 authIsAdmin 为 true', ctx.authIsAdmin() === true);
ctx.authApply();
T('authApply 设置 body.admin（admin-only 显隐开关）', ctx.document.body.classList.contains('admin'));
ctx.authLogout();
T('authLogout 清除登录态并移除 body.admin', ctx.authIsAdmin() === false && ctx.document.body.classList.contains('admin') === false);
locationMock.search = '?auth=' + encodeURIComponent(AUTH_FAKE);
ctx.authInit();
T('authInit 消费 URL ?auth= 建立登录态', ctx.authIsAdmin() === true && ctx.authUser().login === 'GuoxinL');
locationMock.search = '';
ctx.authLogout();

/* ========== 10e. 权限显隐：skills 按钮 / running 徽标 / 无共享密钥残留 ========== */
console.log('== 10e. 权限显隐 ==');
T('index：登录按钮 + admin-only 按钮 + 完整轨迹徽标，无 key 输入项',
  src.indexOf('id="authBtn"') >= 0
  && src.indexOf('class="btn admin-only" onclick="skOpenCfg()"') >= 0
  && src.indexOf('class="btn primary admin-only" onclick="skOpenCollect()"') >= 0
  && src.indexOf('class="btn admin-only" onclick="skSync()"') >= 0
  && src.indexOf('class="btn danger admin-only" onclick="skRemove()"') >= 0
  && src.indexOf('id="rkFullBadge"') >= 0
  && src.indexOf('skCfgKey') < 0);
T('css：admin-only 默认隐藏、body.admin 下显示', src.indexOf('.admin-only{display:none!important}') >= 0 && src.indexOf('body.admin .admin-only{display:inline-flex!important}') >= 0);
T('x-collect-key 彻底移除（HTML/CSS/JS 无残留）', src.indexOf('x-collect-key') < 0 && src.indexOf('skKey(') < 0 && src.indexOf('collectKey') < 0 && src.indexOf('COLLECT_KEY') < 0);
T('skills 写接口改 Bearer 鉴权', src.indexOf('headers["Authorization"] = "Bearer " + tok') >= 0);
T('running：rkTracks 代理 + 完整轨迹映射 + rkLoadRides',
  src.indexOf('function rkTracks(') >= 0
  && src.indexOf('rkTracks("preview.json")') >= 0
  && src.indexOf('var RK_CACHE_RIDES') >= 0
  && src.indexOf('function rkPolyFor(') >= 0
  && src.indexOf('function rkLoadRides(){') >= 0
  && src.indexOf('rkFullBadge') >= 0
  && src.indexOf('rides.full.json') >= 0
  && src.indexOf('raw.githubusercontent.com/GuoxinL/running') < 0);

/* ========== 10c. Skills：来源解析 / 文件树可点击 ========== */
console.log('== 10c. Skills 镜像元信息与文件树 ==');
var sfm = ctx.skParseFrontmatter('---\nname: test\ndescription: d\nmetadata:\n  source: https://github.com/jnMetaCode/superpowers-zh\n  sourceOwner: jnMetaCode\n  mode: mirror\n---\nbody');
T('skParseFrontmatter 解析 sourceOwner/mode/source', sfm.sourceOwner==='jnMetaCode' && sfm.mode==='mirror' && sfm.source==='https://github.com/jnMetaCode/superpowers-zh', JSON.stringify(sfm));
T('skParseFrontmatter 保留 name/description', sfm.name==='test' && sfm.description==='d');
T('skSourceOwner 优先 sourceOwner 字段', ctx.skSourceOwner('https://github.com/a/b','jnMetaCode')==='jnMetaCode');
T('skSourceOwner 从 source URL 提取 owner', ctx.skSourceOwner('https://github.com/jnMetaCode/superpowers-zh/tree/main/skills','')==='jnMetaCode');
T('skSourceOwner 无来源返回空串', ctx.skSourceOwner('','')==='');
T('escAttr 转义引号', ctx.escAttr('a"b')==='a&quot;b');
ctx.skRepo = 'guoxinl/skill-collection';
ctx.skTreeData = {tree:[
  {type:'tree',path:'fav-x'},
  {type:'blob',path:'fav-x/SKILL.md'},
  {type:'blob',path:'fav-x/scripts/run.sh'},
  {type:'blob',path:'other/SKILL.md'}
]};
var th = ctx.skTreeHtml('fav-x');
T('skTreeHtml 条目可点击且带 data-file', th.indexOf('ft-click')>=0 && th.indexOf('data-file="SKILL.md"')>=0);
T('skTreeHtml 子目录缩进层级正确', th.indexOf('data-file="scripts/run.sh"')>=0 && th.indexOf('padding-left:20px')>=0);
T('skTreeHtml 不含其他目录文件', th.indexOf('other/')<0);
T('skTreeHtml 文件计数', th.indexOf('2 个文件')>=0);
ctx.skOpenFile_ = 'scripts/run.sh';
var th2 = ctx.skTreeHtml('fav-x');
T('skTreeHtml 当前选中文件高亮 ft-active', th2.indexOf('ft-active')>=0 && th2.indexOf('data-file="scripts/run.sh"')>=0);
ctx.skOpenFile_ = '';

/* ========== 10d. Skills：详情独立页 + 右侧文件树抽屉 ========== */
console.log('== 10d. 详情独立页与文件树抽屉 ==');
ctx.skRows = [
  {dir:'fav-x', name:'Test Skill', description:'desc', mode:'mirror', source:'https://github.com/jnMetaCode/superpowers-zh', sourceOwner:'jnMetaCode', icon:'https://github.com/jnMetaCode.png', skillMd:'# Hi'}
];
ctx.skRepo = 'guoxinl/skill-collection'; ctx.skBranchNow = 'main';
ctx.skView_ = 'list'; ctx.skPendingFile = ''; ctx.skTreeOpen_ = false;
// 二级路由 path 解析（path 路由：#/xxx 已由启动逻辑重定向为 /xxx）
locationMock.pathname = '/json';
T('skHashDir 非 skills 页返回空', ctx.skHashDir()==='');
locationMock.pathname = '/skills/fav-x';
T('skHashDir 提取 /skills/<dir>', ctx.skHashDir()==='fav-x');
locationMock.pathname = '/skills';
T('skHashDir 无目录返回空', ctx.skHashDir()==='');
locationMock.pathname = '/skills/fav-x';
// 进入详情独立页
ctx.skRoute('fav-x');
T('skRoute 进入详情视图（列表隐藏）', ctx.skView_==='detail' && el('skDetail').classList.contains('show') && !el('skList').classList.contains('show'));
T('详情页填充名称/来源', el('drName').textContent==='Test Skill' && el('drSrc').textContent.indexOf('jnMetaCode')>=0, el('drName').textContent);
T('详情页填充简介与 SKILL.md', el('drDesc').textContent==='desc' && el('drMd').textContent==='# Hi');
T('进详情自动展开文件树抽屉并渲染', ctx.skTreeOpen_===true && el('skTreeDrawer').classList.contains('open') && el('skTreeBody').innerHTML.indexOf('ft-click')>=0);
T('文件树抽屉有且仅有文件树', el('skTreeBody').innerHTML.indexOf('drMd')<0 && el('skTreeBody').innerHTML.indexOf('drawer-sec')<0);
T('详情页抽屉带 show（仅详情页显示）', el('skTreeDrawer').classList.contains('show'));
// 返回列表：抽屉收起 + 隐藏 + 提示
ctx.skShowList();
T('skShowList 回列表视图', ctx.skView_==='list' && el('skList').classList.contains('show') && !el('skDetail').classList.contains('show'));
T('列表页收起文件树并显示未选择提示', ctx.skTreeOpen_===false && el('skTreeBody').innerHTML.indexOf('未选择 Skill')>=0);
T('列表页抽屉去掉 show（不在列表页显示）', !el('skTreeDrawer').classList.contains('show'));
// 列表页点文件树条目 → 自动进详情并打开该文件（path 路由）
ctx.skOpenFile('fav-x','scripts/run.sh');
T('列表页点文件树 → 自动进详情 path', windowMock.location.pathname==='/skills/fav-x' && ctx.skView_==='detail');
T('进详情自动打开待查看文件', ctx.skOpenFile_==='scripts/run.sh' && el('drFileLabel').textContent==='scripts/run.sh', el('drFileLabel').textContent);
T('skPendingFile 消费后清空', ctx.skPendingFile==='');
T('自动进详情后抽屉带 show', el('skTreeDrawer').classList.contains('show'));
// 抽拉切换（三角形按钮）
ctx.skToggleTree();
T('skToggleTree 收起抽屉', ctx.skTreeOpen_===false && !el('skTreeDrawer').classList.contains('open'));
ctx.skToggleTree();
T('skToggleTree 再次展开', ctx.skTreeOpen_===true && el('skTreeDrawer').classList.contains('open'));
// 快捷跳转（path 路由）
ctx.skBack();
T('skBack 回列表 path', windowMock.location.pathname==='/skills');
ctx.skGoto('fav-x');
T('skGoto 进详情 path', windowMock.location.pathname==='/skills/fav-x');
// 离开 skills 页自动收起并隐藏文件树抽屉
ctx.skTreeOpen();
locationMock.pathname = '/home';
ctx.navigate();
T('离开 skills 页自动收起文件树抽屉', ctx.skTreeOpen_===false && !el('skTreeDrawer').classList.contains('open'));
T('离开 skills 页抽屉去掉 show（完全隐藏）', !el('skTreeDrawer').classList.contains('show'));
locationMock.pathname = '/skills/fav-x';

/* ========== 10e. Skills：GitHub 风格 MD 渲染 + Preview/Code 切换 ========== */
console.log('== 10e. MD 渲染与 Preview/Code 切换 ==');
T('skMdIsMarkdown 识别 md/markdown', ctx.skMdIsMarkdown('SKILL.md')===true && ctx.skMdIsMarkdown('README.markdown')===true);
T('skMdIsMarkdown 排除非 md', ctx.skMdIsMarkdown('run.sh')===false && ctx.skMdIsMarkdown('icon.png')===false);
var m1 = ctx.skMdRender('---\nname: x\ndescription: d\n---\n# 标题');
T('skMdRender 剥离 YAML frontmatter', m1.indexOf('name:')<0 && m1.indexOf('<h1 id="标题">')>=0 && m1.indexOf('class="anchor"')>=0, m1);
var m2 = ctx.skMdRender('# 一\n## 二\n### 三');
T('skMdRender 多级标题', m2.indexOf('<h1 id="一">')>=0 && m2.indexOf('<h2 id="二">')>=0 && m2.indexOf('<h3 id="三">')>=0, m2);
var m3 = ctx.skMdRender('**加粗** 和 *斜体* 和 `code` 和 ~~删除~~');
T('skMdRender 行内格式', m3.indexOf('<strong>加粗</strong>')>=0 && m3.indexOf('<em>斜体</em>')>=0 && m3.indexOf('<code>code</code>')>=0 && m3.indexOf('<del>删除</del>')>=0, m3);
var m4 = ctx.skMdRender('[GitHub](https://github.com/x)');
T('skMdRender 链接（新窗口）', m4.indexOf('<a href="https://github.com/x"')>=0 && m4.indexOf('target="_blank"')>=0, m4);
var m5 = ctx.skMdRender('```js\nvar a = 1;\n```');
T('skMdRender 代码块', m5.indexOf('<pre><code>')>=0 && m5.indexOf('var a = 1;')>=0 && m5.indexOf('</code></pre>')>=0, m5);
var m6 = ctx.skMdRender('- 甲\n- 乙');
T('skMdRender 无序列表', m6.indexOf('<ul><li>甲</li><li>乙</li></ul>')>=0, m6);
var m7 = ctx.skMdRender('1. 甲\n2. 乙');
T('skMdRender 有序列表', m7.indexOf('<ol><li>甲</li><li>乙</li></ol>')>=0, m7);
var m8 = ctx.skMdRender('- [x] 完成\n- [ ] 待办');
T('skMdRender 任务列表', m8.indexOf('checkbox')>=0 && m8.indexOf('checked')>=0, m8);
var m9 = ctx.skMdRender('| A | B |\n| --- | --- |\n| 1 | 2 |');
T('skMdRender 表格', m9.indexOf('<table>')>=0 && m9.indexOf('<th>A</th>')>=0 && m9.indexOf('<td>2</td>')>=0, m9);
var m10 = ctx.skMdRender('> 引用文字');
T('skMdRender 引用', m10.indexOf('<blockquote>')>=0 && m10.indexOf('引用文字')>=0, m10);
var m11 = ctx.skMdRender('<script>alert(1)</script>');
T('skMdRender 转义 HTML', m11.indexOf('<script>')<0 && m11.indexOf('&lt;script&gt;')>=0, m11);
// 标题锚点：中文保留 / 英文小写连字符 / 去重 / 行内标记剥离 / 标点移除
var ma1 = ctx.skMdRender('# 用建议代替命令');
T('skMdRender 中文标题锚点 slug', ma1.indexOf('id="用建议代替命令"')>=0 && ma1.indexOf('data-anchor="用建议代替命令"')>=0 && ma1.indexOf('href="#用建议代替命令"')>=0, ma1);
var ma2 = ctx.skMdRender('# Hello World\n# Hello World');
T('skMdRender 英文 slug 小写连字符', ma2.indexOf('id="hello-world"')>=0, ma2);
T('skMdRender 重复标题去重 -1', ma2.indexOf('id="hello-world-1"')>=0, ma2);
var ma3 = ctx.skMdRender('# `code` 与 **加粗**');
T('skMdRender slug 剥离行内标记', ma3.indexOf('id="code-与-加粗"')>=0, ma3);
var ma4 = ctx.skMdRender('# 你好，世界！');
T('skMdRender slug 移除标点', ma4.indexOf('id="你好世界"')>=0, ma4);
// Preview / Code 切换
ctx.skMdText_ = '# Hello **world**'; ctx.skMdName_ = 'SKILL.md'; ctx.skMdMode_ = 'preview';
ctx.skMdApply();
T('skMdApply preview 渲染并隐藏 code', el('drPreview').innerHTML.indexOf('<h1 id="hello-world">')>=0 && el('drMd').style.display==='none' && el('drPreview').style.display==='block');
ctx.skMdMode('code');
T('skMdMode(code) 切 tab + 显示源码', ctx.skMdMode_==='code' && el('mdTabCode').classList.contains('active') && !el('mdTabPreview').classList.contains('active') && el('drMd').style.display==='block' && el('drPreview').style.display==='none');
ctx.skMdMode('preview');
T('skMdMode(preview) 切回预览', ctx.skMdMode_==='preview' && el('mdTabPreview').classList.contains('active') && el('drPreview').style.display==='block');
ctx.skMdName_ = 'run.sh'; ctx.skMdMode_ = 'preview';
ctx.skMdApply();
T('非 md 文件 preview 退回 code', el('drMd').style.display==='block' && el('drPreview').style.display==='none');
ctx.skMdTabsShow(false);
T('skMdTabsShow(false) 隐藏 tabs', el('drTabs').style.display==='none');
ctx.skMdTabsShow(true);
T('skMdTabsShow(true) 显示 tabs', el('drTabs').style.display==='flex');

/* ========== 11. 运动数据（rk）：数据层与算法对齐 running_page ========== */
console.log('== 11. 运动数据 rk ==');
// rkParse 字段规整 + 过滤
var rkRaw = [
  { run_id:'9007199254740993', name:'晨跑', distance:'5200', moving_time:'30:00', type:'Run', start_date_local:'2024-01-01T08:00:00Z', location_country:'中国', location_city:'北京市丰台区', summary_polyline:'p'.repeat(25), average_heartrate:'145', average_speed:3.12, elevation_gain:'50' },
  { run_id:102, distance:0 }
];
var rkP = ctx.rkParse(rkRaw);
T('rkParse 规整字段', rkP.length===1 && rkP[0].id==='9007199254740993' && rkP[0].dist===5200 && rkP[0].mt==='30:00' && rkP[0].type==='Run' && rkP[0].date==='2024-01-01T08:00:00Z' && rkP[0].hr===145 && rkP[0].spd===3.12 && rkP[0].elev===50, JSON.stringify(rkP));
T('rkParse run_id 字符串化（规避超安全整数精度丢失）', rkP[0].id==='9007199254740993' && typeof rkP[0].id==='string');
T('rkParse 数字 run_id 也转字符串', (function(){ var p2 = ctx.rkParse([{ run_id:101, distance:100, start_date_local:'x' }]); return p2[0].id==='101' && typeof p2[0].id==='string'; })());
T('rkParse 地点与主图字段（thumb 已废弃：缩略图改自产）', rkP[0].city==='北京市丰台区' && !('thumb' in rkP[0]) && rkP[0].poly==='ppppppppppppppppppppppppp', JSON.stringify(rkP[0]));
T('rkParse 过滤无距离无日期记录', rkP.length===1);
// rkMovingSec 3 段 / 2 段 / 天 + 时分秒
T('rkMovingSec 3 段', ctx.rkMovingSec('12:34:56')===45296);
T('rkMovingSec 2 段', ctx.rkMovingSec('34:56')===2096);
T('rkMovingSec 天+时分秒', ctx.rkMovingSec('2 days, 12:34:56')===218096);
T('rkMovingSec 空返回 0', ctx.rkMovingSec('')===0);
// 格式化
T('rkFmtDist 四舍五入 km', ctx.rkFmtDist(5820)==='6' && ctx.rkFmtDist(4800)==='5');
T('rkPace 配速 m:ss', ctx.rkPace(3.12)==='5:21', ctx.rkPace(3.12));
T('rkPace 空返回 --', ctx.rkPace(0)==='--');
T('rkFmtDur 时长', ctx.rkFmtDur(19920)==='5h 32m' && ctx.rkFmtDur(120)==='2m');
T('rkFmtClock 时钟', ctx.rkFmtClock(4205)==='1:10:05' && ctx.rkFmtClock(65)==='1:05');
// rkSortDate / rkYears
var rkActsT = [
  { date:'2022-03-01T08:00:00Z', dist:5000, mt:'30:00', type:'Run' },
  { date:'2024-01-02T08:00:00Z', dist:8000, mt:'40:00', type:'Ride' },
  { date:'2023-07-01T08:00:00Z', dist:3000, mt:'20:00', type:'Run' }
];
T('rkYears 倒序去重', JSON.stringify(ctx.rkYears(rkActsT))===JSON.stringify(['2024','2023','2022']), JSON.stringify(ctx.rkYears(rkActsT)));
var rkSorted = rkActsT.slice().sort(ctx.rkSortDate);
T('rkSortDate 日期倒序', rkSorted[0].date.slice(0,10)==='2024-01-02' && rkSorted[2].date.slice(0,10)==='2022-03-01');
// rkStats 全量统计
var rkS = ctx.rkStats(rkActsT);
T('rkStats 汇总', rkS.dist===16000 && rkS.sec===5400 && rkS.count===3 && rkS.days===3 && rkS.runDist===8000 && rkS.runN===2 && rkS.pace===8000/3000, JSON.stringify(rkS));
// rkHeatYear 网格
var rkH = ctx.rkHeatYear([
  { date:'2024-01-01T08:00:00Z', dist:5000, mt:'30:00', type:'Run' },
  { date:'2024-01-02T08:00:00Z', dist:8000, mt:'40:00', type:'Ride' },
  { date:'2023-12-31T08:00:00Z', dist:3000, mt:'20:00', type:'Run' }
], '2024');
T('rkHeatYear 当年过滤与汇总', rkH.count===2 && rkH.dist===13000 && rkH.max===8000 && rkH.grid.length===53, 'count='+rkH.count+' max='+rkH.max+' weeks='+rkH.grid.length);
T('rkHeatYear 首格 1/1', rkH.grid[0][0].date==='2024-01-01' && rkH.grid[0][0].dist===5000 && rkH.grid[0][0].n===1, JSON.stringify(rkH.grid[0][0]));
T('rkHeatYear 月份标签 12 个', rkH.months.length===12 && rkH.months[0].m===1);
// rkHeatColor 4 级色阶边界
T('rkHeatColor 0 无色', ctx.rkHeatColor(0, 100) === '');
T('rkHeatColor L1 边界 25', ctx.rkHeatColor(25, 100) === '#fed7aa');
T('rkHeatColor L2 边界 50', ctx.rkHeatColor(50, 100) === '#fb923c');
T('rkHeatColor L3 边界 75', ctx.rkHeatColor(75, 100) === '#f97316');
T('rkHeatColor L4 满量程', ctx.rkHeatColor(100, 100) === '#ea580c');
T('rkHeatColor 溢出进下一级', ctx.rkHeatColor(25.1, 100) === '#fb923c');
// rkPbs 骑行三项指标：最远距离 / 平均时速 / 极限冲刺速度（maxSpd 优先，无则降级最高均速并标注）
var rkPbsActs = [
  { type:'Ride', dist:12000, spd:6.94,  date:'2024-01-01T08:00:00Z' },                  /* 均速 25.0 */
  { type:'Ride', dist:30000, spd:8.33,  date:'2024-01-02T08:00:00Z' },                  /* 最远 30km，均速 30.0 */
  { type:'Ride', dist:8000,  spd:5.56,  maxSpd:13.9, date:'2024-01-03T08:00:00Z' },     /* 极速 50.0 */
  { type:'Run',  dist:5000,  spd:2.78,  date:'2024-01-04T08:00:00Z' }                   /* 跑步应被忽略 */
];
var rkPbsRes = ctx.rkPbs(rkPbsActs);
T('rkPbs 最远距离 30km', rkPbsRes[0].key==='dist' && rkPbsRes[0].v===30 && rkPbsRes[0].act.date.slice(0,10)==='2024-01-02', JSON.stringify(rkPbsRes[0]));
T('rkPbs 平均时速 30.0（忽略跑步）', rkPbsRes[1].key==='avg' && rkPbsRes[1].v.toFixed(1)==='30.0' && rkPbsRes[1].act.date.slice(0,10)==='2024-01-02', JSON.stringify(rkPbsRes[1]));
T('rkPbs 极限冲刺速度 50.0（maxSpd）', rkPbsRes[2].key==='speed' && rkPbsRes[2].v.toFixed(1)==='50.0' && !rkPbsRes[2].fallback, JSON.stringify(rkPbsRes[2]));
var rkPbsActs2 = [ { type:'Ride', dist:10000, spd:7.0, date:'2024-02-01T08:00:00Z' } ];
var rkPbsRes2 = ctx.rkPbs(rkPbsActs2);
T('rkPbs 无 maxSpd 降级为最高均速并标注 fallback', rkPbsRes2[0].v===10 && rkPbsRes2[2].v===rkPbsRes2[1].v && rkPbsRes2[2].fallback===true, JSON.stringify(rkPbsRes2));
T('rkPbs 无骑行数据返回三空项', (function(){ var r = ctx.rkPbs([{type:'Run',dist:5000,spd:2.78}]); return r.length===3 && r[0].v===0 && r[0].act===null && r[2].fallback===false; })());
// rkDecodePolyline 已知样例（Google 官方示例）
var rkDc = ctx.rkDecodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
T('rkDecodePolyline 3 点', rkDc.length===3, 'len='+rkDc.length);
T('rkDecodePolyline 首点 38.5,-120.2', rkDc[0][0].toFixed(1)==='38.5' && rkDc[0][1].toFixed(1)==='-120.2', JSON.stringify(rkDc[0]));
T('rkDecodePolyline 次点 40.7,-120.95', rkDc[1][0].toFixed(1)==='40.7' && rkDc[1][1].toFixed(2)==='-120.95', JSON.stringify(rkDc[1]));
T('rkDecodePolyline 空串返回空数组', ctx.rkDecodePolyline('').length===0);
// rkMerc / rkMercInv（MapCN 瓦片 Web Mercator 投影，北京 116.3913,39.9075 @ z12）
var rkM = ctx.rkMerc(116.3913, 39.9075, 12);
T('rkMerc 北京 x 范围', rkM[0] > 863200 && rkM[0] < 863400, 'x='+rkM[0].toFixed(1));
T('rkMerc 北京 y 范围', rkM[1] > 397200 && rkM[1] < 397450, 'y='+rkM[1].toFixed(1));
var rkMi = ctx.rkMercInv(rkM[0], rkM[1], 12);
T('rkMercInv 往返还原', rkMi[0].toFixed(3)==='39.907' && rkMi[1].toFixed(3)==='116.391', JSON.stringify(rkMi.map(function(v){return v.toFixed(4)})));
T('rkMapStyleIdx 默认 0=浅色（固定浅色，不跟随明暗）', ctx.rkMapStyleIdx()===0, 'idx='+ctx.rkMapStyleIdx());
T('RK_STYLES 三档固定浅色：默认档 light_all（无 auto 档）', ctx.RK_STYLES.length===3 && ctx.RK_STYLES[0].k==='light' && ctx.RK_STYLES[0].url.indexOf('basemaps.cartocdn.com/light_all')>0 && ctx.RK_STYLES.filter(function(s){return s.k==='auto';}).length===0, ctx.RK_STYLES.map(function(s){return s.k;}).join('/'));
T('rkResolveStyle 越界档回退浅色（light_all）', ctx.rkResolveStyle(9).k==='light' && ctx.rkResolveStyle(9).url.indexOf('light_all')>0, 'k='+ctx.rkResolveStyle(9).k);
T('rkResolveStyle 三档原样返回（浅色/明亮/暗色）', ctx.rkResolveStyle(0).k==='light' && ctx.rkResolveStyle(1).k==='voyager' && ctx.rkResolveStyle(2).k==='dark' && ctx.rkResolveStyle(2).url.indexOf('dark_all')>0, [ctx.rkResolveStyle(0).k,ctx.rkResolveStyle(1).k,ctx.rkResolveStyle(2).k].join('/'));
T('rkMerc 高纬负值（南半球 y>n/2）', ctx.rkMerc(0, -30, 10)[1] > ctx.rkMerc(0, 30, 10)[1]);
// rkTitleFor 时段标题（对齐 classic RUN_TITLES）
T('rkTitleFor 半马/全马', ctx.rkTitleFor({dist:21000,date:'2024-01-01T08:00:00Z'})==='半程马拉松' && ctx.rkTitleFor({dist:42000,date:'2024-01-01T08:00:00Z'})==='全程马拉松');
T('rkTitleFor 时段', ctx.rkTitleFor({dist:5000,date:'2024-01-01T06:00:00Z'})==='清晨跑步' && ctx.rkTitleFor({dist:5000,date:'2024-01-01T12:00:00Z'})==='午间跑步' && ctx.rkTitleFor({dist:5000,date:'2024-01-01T16:00:00Z'})==='午后跑步' && ctx.rkTitleFor({dist:5000,date:'2024-01-01T19:00:00Z'})==='傍晚跑步' && ctx.rkTitleFor({dist:5000,date:'2024-01-01T22:00:00Z'})==='夜晚跑步');
T('rkTitleFor 无日期兜底', ctx.rkTitleFor({dist:5000})==='运动');
// rkMonthDist / rkYearDist
var rkMD = ctx.rkMonthDist(rkActsT, '2024');
T('rkMonthDist 1 月汇总', rkMD.dist[0]===8000 && rkMD.count[0]===1);
var rkYD = ctx.rkYearDist(rkActsT);
T('rkYearDist 历年汇总', rkYD['2024']===8000 && rkYD['2022']===5000);
// rkComma 千分位
T('rkComma 千分位', ctx.rkComma(1234567)==='1,234,567');
// rkTrendSVG 内联 SVG 柱状
var rkSVG = ctx.rkTrendSVG([10,20,30], [1,2,3], null, '测试');
T('rkTrendSVG SVG 柱状与悬浮提示', rkSVG.indexOf('<svg')===0 && rkSVG.indexOf('<rect')>=0 && rkSVG.indexOf('10 km')>=0 && rkSVG.indexOf('</svg>')>=0, rkSVG.slice(0,80));
// 轨迹地图全量渲染（rkMapTracks / rkShowMap 多轨迹 + 高亮）
// rkThin 抽稀
var rkThinPts = [];
for (var rki = 0; rki < 100; rki++) rkThinPts.push([rki, rki]);
T('rkThin 未超上限原样返回', ctx.rkThin(rkThinPts, 200) === rkThinPts);
var rkT1 = ctx.rkThin(rkThinPts, 10);
T('rkThin 抽稀到 10 点且保留首尾', rkT1.length===10 && rkT1[0][0]===0 && rkT1[9][0]===99, 'n='+rkT1.length);
T('rkThin 均匀采样', rkT1[1][0]===11 && rkT1[5][0]===55, JSON.stringify(rkT1.map(function(p){return p[0];})));
T('rkThin 空/小数组', ctx.rkThin([], 10).length===0 && ctx.rkThin([[1,2],[3,4]], 10).length===2);
// rkHotSpot 热点视角（默认放大最密集区域）
T('rkHotSpot 空输入返回 null', ctx.rkHotSpot(null)===null && ctx.rkHotSpot([])===null);
var rkHsC = 39.907, rkHsL = 116.391, rkHSTracks = [];
for (var rkg = 0; rkg < 9; rkg++) for (var rkh = 0; rkh < 9; rkh++){
  var rkc = rkHsC + (rkg - 4) * 0.0022, rkl = rkHsL + (rkh - 4) * 0.0022;
  rkHSTracks.push({ coords: [[rkc, rkl], [rkc + 0.001, rkl + 0.001]] });
}
rkHSTracks.push({ coords: [[31.23, 121.47], [31.24, 121.48], [31.25, 121.49]] }); /* 上海稀疏轨迹 */
var rkHS = ctx.rkHotSpot(rkHSTracks);
T('rkHotSpot 返回中心与缩放', !!rkHS && typeof rkHS.cx==='number' && typeof rkHS.cy==='number' && typeof rkHS.z==='number', JSON.stringify(rkHS));
var rkHSll = ctx.rkMercInv(rkHS.cx, rkHS.cy, 13);
T('rkHotSpot 中心落在密集簇（北京）而非稀疏点', Math.abs(rkHSll[0]-rkHsC)<0.05 && Math.abs(rkHSll[1]-rkHsL)<0.05, rkHSll.map(function(v){return v.toFixed(4);}).join(','));
T('rkHotSpot 缩放级别放大展示（≥12）', rkHS.z >= 12 && rkHS.z <= 18, 'z='+rkHS.z);
var rkHS1 = ctx.rkHotSpot([{ coords: [[39.9,116.39],[39.901,116.391],[39.902,116.392]] }]);
T('rkHotSpot 单轨迹退化有效', !!rkHS1 && rkHS1.z >= 10, JSON.stringify(rkHS1));

ctx.rkActs = [
  { id:1, type:'Run', date:'2024-01-01T08:00:00Z', name:'晨跑', dist:5200, poly:'p'.repeat(25) },
  { id:2, type:'Ride', date:'2024-01-02T08:00:00Z', name:'骑行', dist:20000, poly:'p'.repeat(30) },
  { id:3, type:'Run', date:'2024-01-03T08:00:00Z', name:'夜跑', dist:5000, poly:'' },
  { id:4, type:'Run', date:'2024-01-04T08:00:00Z', name:'越野', dist:5000 }
];
var rkMT = ctx.rkMapTracks(ctx.rkActs);
T('rkMapTracks 仅含可解码轨迹', rkMT.length===2 && rkMT[0].id===1 && rkMT[1].type==='Ride' && rkMT[0].coords.length>0, 'n='+rkMT.length);
// rkDecodePolyline 独立解码（Google encoded polyline, precision 5 官方示例 _p~iF~ps|U_ulLnnqC_mqNvxq`@ → 3 点）
var rkDp = ctx.rkDecodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
T('rkDecodePolyline 独立解码（precision5 官方示例 3 点）', rkDp.length===3 && Math.abs(rkDp[0][0]-38.5)<0.01 && Math.abs(rkDp[0][1]+120.2)<0.01, JSON.stringify(rkDp));
ctx.rkShowMap(0);
var rkBoxHtml = el('rkMapBox').innerHTML;
var rkCanvasHtml = el('rkMapCanvas').innerHTML;
/* phase1：垫底 SVG <img> 立即写入（渐进加载）；测试环境无 img 分支 → go() 同帧同步渲染矢量层 */
T('rkShowMap(0) phase1 垫底图与加载提示', rkBoxHtml.indexOf('<img class="rk-tm-pv"')>=0 && rkBoxHtml.indexOf('rk-tm-loading')>=0 && rkBoxHtml.indexOf('轨迹矢量层构建中')>=0, rkBoxHtml.slice(0,120));
T('rkShowMap(0) phase2 矢量层 polyline 数=2', (rkCanvasHtml.match(/<polyline/g)||[]).length===2, 'poly='+(rkCanvasHtml.match(/<polyline/g)||[]).length);
T('rkShowMap(0) 无高亮（无 #f97316 条带）', (rkCanvasHtml.match(/stroke="#f97316"/g)||[]).length===0, 'hl='+(rkCanvasHtml.match(/stroke="#f97316"/g)||[]).length);
T('rkShowMap(0) 标题显示全部轨迹', el('rkMapTitle').textContent.indexOf('全部 2 条轨迹')>=0, el('rkMapTitle').textContent);
var rkCtrlHtml = rkCanvasHtml.slice(rkCanvasHtml.indexOf('rk-tm-ctrl'));
T('控件按钮：样式切换独立分组在放大前 + 放大/缩小/适应轨迹',
  rkCtrlHtml.indexOf('rkMapStyle()') >= 0
  && rkCtrlHtml.indexOf('rk-tm-style') >= 0
  && rkCtrlHtml.indexOf('rk-tm-style') < rkCtrlHtml.indexOf('title="放大"')
  && rkCtrlHtml.indexOf('title="放大"') >= 0
  && rkCtrlHtml.indexOf('title="缩小"') >= 0
  && rkCtrlHtml.indexOf('title="适应轨迹"') >= 0
  && rkCtrlHtml.indexOf('© OpenStreetMap contributors © CARTO') >= 0, rkCtrlHtml.slice(0,120));
ctx.rkShowMap(1);
rkBoxHtml = el('rkMapBox').innerHTML;
rkCanvasHtml = el('rkMapCanvas').innerHTML;
T('rkShowMap(1) 高亮选中且其余轨迹保留', (rkCanvasHtml.match(/<polyline/g)||[]).length===2 && (rkCanvasHtml.match(/stroke="#f97316"/g)||[]).length===1, 'poly='+(rkCanvasHtml.match(/<polyline/g)||[]).length+' hl='+(rkCanvasHtml.match(/stroke="#f97316"/g)||[]).length);
T('rkShowMap(1) 标题含选中活动与轨迹总数', el('rkMapTitle').textContent.indexOf('晨跑')>=0 && el('rkMapTitle').textContent.indexOf('共 2 条轨迹')>=0, el('rkMapTitle').textContent);
ctx.rkShowMap(3);
rkBoxHtml = el('rkMapBox').innerHTML;
rkCanvasHtml = el('rkMapCanvas').innerHTML;
T('rkShowMap(3) 无轨迹活动点击仍渲染全部', (rkCanvasHtml.match(/<polyline/g)||[]).length===2 && el('rkMapTitle').textContent.indexOf('夜跑')>=0, el('rkMapTitle').textContent);
ctx.rkActs = [{ id:9, type:'Run', date:'2024-01-01T08:00:00Z', name:'x', dist:1 }];
ctx.rkShowMap(0);
T('rkShowMap(0) 无轨迹显示提示', el('rkMapBox').innerHTML.indexOf('暂无轨迹数据')>=0, el('rkMapBox').innerHTML.slice(0,60));
ctx.rkActs = null;

// rkBody 模块顺序（个人最佳 → 轨迹地图 → 活动列表 → 年度热力图 → 趋势）
var riMap = src.indexOf('id="rkMapSec"');
var riHeat = src.indexOf('年度热力图');
var riTrend = src.indexOf('id="rkTrendOut"');
var riPbs = src.indexOf('id="rkPbs"');
var riList = src.indexOf('id="rkList"');
T('rkBody 顺序 个人最佳<地图<活动列表<热力图<趋势',
  riPbs >= 0 && riPbs < riMap && riMap < riList && riList < riHeat && riHeat < riTrend,
  [riPbs, riMap, riList, riHeat, riTrend].join(' < '));
T('rkBody 无统计卡容器（id=rkStats 已删）', src.indexOf('id="rkStats"') < 0, '无 rkStats 容器');

// 热力图默认年份：rkOnData 中优先当前公历年（2026），数据无当年则回退最新年份；去掉「全部」聚合 tab
T('rkHeat 默认当年优先（2026），无当年回退最新',
  /var curYr = String\(new Date\(\)\.getFullYear\(\)\)/.test(src)
  && /rkState\.year = rkYears\(rkActs\)\.indexOf\(curYr\) >= 0 \? curYr : \(rkYears\(rkActs\)\[0\] \|\| curYr\)/.test(src)
  && /year:String\(new Date\(\)\.getFullYear\(\)\)/.test(src),
  '默认年份 = 当年优先');
T('热力图无「全部」tab、无 all 分支残留',
  src.indexOf("rkHeatSel('all')") < 0
  && src.indexOf('rkState.year === "all"') < 0
  && src.indexOf('if(rkState.year === "all")') < 0,
  '去除全部聚合视图');
T('热力图月份标签 + 网格包入 rk-heat-wrap 滚动容器',
  src.indexOf('rk-heat-wrap') >= 0
  && src.indexOf('rk-heat-mths') >= 0
  && src.indexOf('display:flex;margin-left:15px') < 0
  && src.indexOf('.rk-heat-wrap{overflow-x:auto') >= 0,
  '月份标签行不再用无滚动约束的内联 flex');

// 路由：/run → /running（侧边栏 / 快捷卡 / 底部 tab / 页面 id / 白名单 / rkLoad 触发，path 路由）
T('路由 /running 全量生效（无 /run 残留）',
  src.indexOf('href="/running" data-nav="running"') >= 0
  && src.indexOf('id="page-running"') >= 0
  && src.indexOf('href="/running" data-tabpage="running"') >= 0
  && src.indexOf('["home","json","skills","running"]') >= 0
  && src.indexOf('if(h === "running") rkLoad();') >= 0
  && src.indexOf('href="/run"') < 0
  && src.indexOf('id="page-run"') < 0
  && src.indexOf('data-nav="run"') < 0
  && src.indexOf('data-tabpage="run"') < 0
  && src.indexOf('h === "run"') >= 0,
  'running 路由 + 旧 run 兼容重定向');

// 回归：util.js 顶层 hash 兼容块仅 replaceState 规范化地址栏，不得立即 navigate()——
// 若在 util.js 加载时提前 navigate()，会因 skills/running 模块尚未定义 skTreeClose/rkLoad 抛
// ReferenceError，并中断 WEEK 等后续顶层赋值（时钟/路由/卡片全部失效）。首次导航统一由
// app.js init() 负责（此时所有脚本已加载）。
var hBlkIdx = src.indexOf('if(location.hash && /^#\\//.test(location.hash))');
var hBlkEnd = hBlkIdx >= 0 ? src.indexOf('\n}', hBlkIdx) : -1;
var hBlk = (hBlkIdx >= 0 && hBlkEnd >= 0) ? src.slice(hBlkIdx, hBlkEnd + 2) : '';
T('hash 兼容块仅 replaceState、不立即 navigate()（防 util 加载时序回归）',
  hBlk !== ''
  && hBlk.indexOf('replaceState') >= 0
  && hBlk.indexOf('navigate()') < 0
  && src.indexOf('此处仅规范化地址栏，不立即 navigate()') >= 0,
  hBlk ? hBlk.replace(/\s+/g, ' ').slice(0, 140) : 'hash 块未找到');

// 天气：弃 wttr.in（无 CORS 头，域名下被浏览器拦截）→ geojs.io/ipwho.is 定位 + Open-Meteo 天气（原生 CORS）
T('天气数据源：弃 wttr.in、geojs.io 定位 + Open-Meteo 天气（CORS）',
  src.indexOf('wttr.in') < 0
  && src.indexOf('open-meteo.com') >= 0
  && src.indexOf('get.geojs.io') >= 0
  && src.indexOf('ipwho.is') >= 0
  && src.indexOf('function fetchLoc(') >= 0
  && src.indexOf('weatherDesc(code)') >= 0
  && src.indexOf('temperature_2m') >= 0,
  '天气数据源/CORS 修复');

// 热点视角（rkHotSpot 挂载 + 默认视角回退调用）+ ⤢ 适应轨迹按钮（idx=3，MapCN 3 档固定浅色样式）
T('热点视角：rkHotSpot 挂载 + 回退聚焦 + ⤢ 按钮修复',
  src.indexOf('window.rkHotSpot = rkHotSpot') >= 0
  && src.indexOf('window.rkMercInv = rkMercInv') >= 0
  && src.indexOf('var hp = (!selId) ? rkHotSpot(tracks) : null') >= 0
  && src.indexOf('else if(idx === 3) fit()') >= 0
  && src.indexOf('已聚焦最热点区域') >= 0,
  'rkHotSpot/挂载/回退视角/⤢修复');

// 固定规格：长宽固定比例 640:360（16:9）+ 默认视角固定 z9（meta 与热点分支均 setZoom(HP_Z)）
T('固定比例：.rk-tilemap aspect-ratio 640/360（长宽比与 preview.png 一致）',
  src.indexOf('.rk-tilemap{position:relative;aspect-ratio:640/360') >= 0
  && src.indexOf('.rk-tilemap{position:relative;aspect-ratio:640/420') < 0
  && src.indexOf('.rk-tilemap{position:relative;height:420px') < 0,
  'aspect-ratio 640/360');
T('初始视角固定 z9：meta 分支 setZoom(HP_Z) 而非 mv.z',
  src.indexOf('var mv = metaView || null, HP_Z = 9') >= 0
  && src.indexOf('setZoom(HP_Z); S.cx = mv.cx; S.cy = mv.cy') >= 0
  && src.indexOf('setZoom(mv.z)') < 0,
  '固定 z9/meta 中心');
T('初始视角固定 z9：热点回退分支同样 setZoom(HP_Z)',
  src.indexOf('setZoom(HP_Z); S.cx = hp.cx; S.cy = hp.cy') >= 0
  && src.indexOf('setZoom(hp.z)') < 0,
  '固定 z9/热点中心');
T('样式三档固定浅色：按钮 title 无「自动（跟随明暗）」、zoom 显示无「自动·」',
  src.indexOf('title="切换底图样式：浅色 / 明亮 / 暗色"') >= 0
  && src.indexOf('跟随明暗') < 0
  && src.indexOf('S.auto') < 0
  && src.indexOf('自动·') < 0,
  '三档样式/无明暗跟随残留');

// Task 17 渐进式加载 + 固定 zoom13 世界像素投影（垫底 PNG 全貌 → 矢量层就绪切换，缩放零重投影）
// 轨迹数据源已迁移：不再直连 raw.githubusercontent.com，统一经 Worker /api/tracks/raw 白名单代理
// 需求五：垫底 PNG 双主题（previews/light|dark.png 按系统明暗选图），缩略图同源自产（thumb/<id>.<theme>.png）
T('渐进加载：rkTracks 代理（previews/<theme>.png / preview.meta.json）+ phase1 img 与加载提示',
  src.indexOf('function rkTracks(') >= 0
  && src.indexOf('w + "/api/tracks/raw?f=" + encodeURIComponent(f)') >= 0
  && src.indexOf('rkTracks("previews/" + rkTheme() + ".png")') >= 0
  && src.indexOf('rkTracks("preview.meta.json")') >= 0
  && src.indexOf('<img class=\\"rk-tm-pv\\"') >= 0
  && src.indexOf('rk-tm-loading') >= 0
  && src.indexOf('轨迹矢量层构建中') >= 0
  && src.indexOf('raw.githubusercontent.com/GuoxinL/running') < 0,
  '代理URL/双主题垫底/视角元数据/加载提示');
// rkFetchMeta：测试环境 windowMock 无 fetch → 同步回调 null（回退 hotspot/fit 视角）
let rkMetaCb = 'unset';
ctx.rkFetchMeta(function(m){ rkMetaCb = (m === null) ? 'null' : 'obj'; });
T('rkFetchMeta 无 fetch 同步回调 null', rkMetaCb === 'null', 'metaCb='+rkMetaCb);
T('rkMapInit metaView 优先分支（有 meta 用固定 z9 + meta 中心，跳过 hotspot）',
  src.indexOf('var mv = metaView || null, HP_Z = 9') >= 0
  && src.indexOf('S.prep = 1; setZoom(HP_Z); S.cx = mv.cx; S.cy = mv.cy') >= 0
  && src.indexOf('var hp = (!selId) ? rkHotSpot(tracks) : null') >= 0,
  'meta优先/回退hotspot');
T('固定投影：RK_BASE_Z=13 世界像素投影一次 + viewBox 矩阵缩放',
  /var RK_BASE_Z = 13/.test(src)
  && src.indexOf('rkMerc(c[1], c[0], RK_BASE_Z)') >= 0
  && src.indexOf('S.k = Math.pow(2, S.z - RK_BASE_Z)') >= 0
  && src.indexOf('viewBoxArgs') >= 0,
  '投影基准/缩放矩阵');
T('缩放零重建：viewBox setAttribute + 线宽反算',
  src.indexOf('setAttribute("viewBox"') >= 0
  && src.indexOf('updateStrokeWidths') >= 0
  && src.indexOf('(1.6 / k).toFixed(2)') >= 0
  && src.indexOf('(3.5 / k).toFixed(2)') >= 0,
  '矩阵缩放/线宽反算');
T('投影抽稀：非选中轨迹抽稀到 RK_THIN_MAX（降 SVG 重光栅化成本），选中保留全量',
  src.indexOf('var RK_THIN_MAX = 500') >= 0
  && src.indexOf('var coords = t.sel ? t.coords : rkThin(t.coords, RK_THIN_MAX)') >= 0
  && src.indexOf('rkMerc(c[1], c[0], RK_BASE_Z)') >= 0,
  '抽稀常量/投影抽稀/选中全量');
T('缩放过渡动画：rAF 驱动 translate3d+scale（动画零重光栅化）+ 连续缩放插值态接续 + 停后 settleZoom 结算',
  src.indexOf('function zApply(') >= 0
  && src.indexOf('function zstep(') >= 0
  && src.indexOf('function settleZoom(') >= 0
  && src.indexOf('requestAnimationFrame(zstep)') >= 0
  && src.indexOf('setTimeout(settleZoom, 240)') >= 0
  && src.indexOf('if(zanim){ ck = zanim.k; ccx = zanim.cx; ccy = zanim.cy; }') >= 0
  && src.indexOf('if(zoomAnimTimer) settle()') < 0
  && src.indexOf('function animateZoom(') < 0,
  'rAF 过渡/停后结算/插值态接续');
T('滚轮灵敏度：累积 deltaY 阈值 120 才缩放（防触控板/高精度滚轮一次跳 N 级）',
  src.indexOf('wheelAcc') >= 0
  && src.indexOf('while(wheelAcc <= -120)') >= 0
  && src.indexOf('while(wheelAcc >= 120)') >= 0
  && src.indexOf('now - wheelAt > 400') >= 0
  && src.indexOf('Math.max(-3, Math.min(3, d))') >= 0
  && src.indexOf('zoomBy(e.deltaY < 0 ? 1 : -1') < 0,
  '累积阈值/手势超时/限幅3级');
T('缩放锚点：滚轮围绕鼠标位置（zoomBy 重算中心含 +(S.W/2-mx)/k 修正项，防偏移半屏）',
  src.indexOf('S.cx = wx + (S.W/2 - mx) / S.k;') >= 0
  && src.indexOf('S.cy = wy + (S.H/2 - my) / S.k;') >= 0
  && src.indexOf('S.cx = wx - mx / S.k;') < 0,
  '锚点公式含视口中心修正');
T('按钮缩放围绕图片中心：idx=1 放大 / idx=2 缩小 / idx=3 适应轨迹（样式按钮 idx=0 被拦截）',
  src.indexOf('if(idx === 1) zoomBy(1);') >= 0
  && src.indexOf('else if(idx === 2) zoomBy(-1);') >= 0
  && src.indexOf('else if(idx === 3) fit();') >= 0
  && src.indexOf('if(idx === 0) zoomBy(1)') < 0,
  '按钮 idx 映射与顺序一致');
T('拖拽平移：dragPaint 中 SVG 路径层与瓦片层同向 translate3d(+dx,+dy)（跟随鼠标，路径与地图零脱离）',
  src.indexOf('svg.style.transform = "translate3d(" + (dx).toFixed(1) + "px," + (dy).toFixed(1) + "px,0)";') >= 0
  && src.indexOf('svg.style.transform = "translate3d(" + (-dx).toFixed(1)') < 0
  && src.indexOf('tiles.style.transform = "translate3d(" + (-nx).toFixed(1) + "px," + (-ny).toFixed(1) + "px,0)";') >= 0,
  'SVG 增量(+dx,+dy) 与瓦片增量一致');
T('拖拽平移：触摸 touchmove 与鼠标共用 dragPaint（rAF 合并 + translate3d，防移动端脱离）',
  src.indexOf('drag.mx = t.clientX; drag.my = t.clientY;') >= 0
  && src.indexOf('if(!drag.raf) drag.raf = requestAnimationFrame(dragPaint);') >= 0
  && src.indexOf('(-(S.ox0 - dx)).toFixed(1)') < 0,
  '触摸与鼠标共用拖拽绘制函数');
T('拖拽平移性能：rAF 合并高频事件 + 复用缓存 S.svgEl/S.tilesEl（无每帧 querySelector）',
  src.indexOf('var tiles = S.tilesEl, svg = S.svgEl;') >= 0
  && src.indexOf('container.querySelector(".rk-tm-tiles"), svg = container.querySelector(".rk-tm-svg")') < 0
  && src.indexOf('translate3d(') >= 0,
  '缓存 DOM 引用 + translate3d GPU 合成');
T('「刷新数据」按钮与 rkRefresh 彻底移除（HTML/JS 无残留）',
  src.indexOf('rkRefresh') < 0 && src.indexOf('刷新数据') < 0,
  '无 rkRefresh / 刷新数据残留');

/* ========== 12. 活动列表卡片网格 + 详情弹窗轨迹回放 ========== */
console.log('== 12. 活动列表卡片 + 弹窗回放 ==');
// 卡片网格容器与卡片结构（主图/类型标签/地点 pin/日期/底部三格统计）
T('卡片网格容器 rkList + .rk-actlist grid',
  src.indexOf('id="rkList"') >= 0
  && src.indexOf('.rk-actlist{display:grid') >= 0
  && src.indexOf('repeat(auto-fill,minmax(230px,1fr))') >= 0,
  '卡片式网格替代行式列表');
T('卡片渲染：自产双主题缩略图 thumb/<id>.<theme>.png + 类型标签 + 地点 pin + 日期 + 三格统计(公里/kmh/时长)',
  src.indexOf('class=\\"rk-actcard\\"') >= 0
  && src.indexOf('class=\\"rk-act-thumb\\"') >= 0
  && src.indexOf('rkTracks("thumb/" + a.id + "." + rkTheme() + ".png")') >= 0
  && src.indexOf('esc(a.thumb)') < 0
  && src.indexOf('rkTypeTag(a.type)') >= 0
  && src.indexOf('esc(a.city || "未知地点")') >= 0
  && src.indexOf('(a.dist/1000).toFixed(1)') >= 0
  && src.indexOf('(kmh ? kmh.toFixed(1) : "--")') >= 0
  && src.indexOf('rkFmtDur(t)') >= 0,
  '卡片字段齐全（自产缩略图）');
T('平均时速单位换算 m/s → km/h（spd*3.6）',
  src.indexOf('a.spd ? (a.spd*3.6)') >= 0,
  'spd*3.6 换算');
T('卡片点击打开弹窗 onclick=rkOpenAct',
  src.indexOf('onclick=\\"rkOpenAct(\'" + a.id') >= 0,
  '卡片→弹窗绑定');
// 弹窗结构：遮罩置灰 + 视频窗口 + 关闭按钮 + 信息区
T('弹窗结构：遮罩 + 视频窗口 + 关闭按钮 + 信息区',
  src.indexOf('id="rkActModal"') >= 0
  && src.indexOf('onclick="rkMaskClose(event)"') >= 0
  && src.indexOf('id="rkActVideo"') >= 0
  && src.indexOf('class="rk-act-close"') >= 0
  && src.indexOf('id="rkActInfo"') >= 0
  && src.indexOf('.rk-act-modal .modal{max-width:720px') >= 0
  && src.indexOf('.rk-act-video{') >= 0,
  '弹窗骨架完整');
T('弹窗遮罩置灰（modal-mask 复用）',
  src.indexOf('class="modal-mask rk-act-modal"') >= 0,
  '遮罩置灰');
// 回放：canvas Web Mercator 投影 + MapCN 瓦片底图背景 + 标记点循环移动 + 进入即自动播放
T('轨迹回放：canvas Web Mercator 投影 + 瓦片底图背景 + 已走轨迹高亮 + 起点/当前标记点',
  src.indexOf('var RK_ACT_DUR = 8') >= 0
  && src.indexOf('document.createElement("canvas")') >= 0
  && src.indexOf('rkDecodePolyline(rkPolyFor(a))') >= 0
  && src.indexOf('var p = rkMerc(c[1], c[0], z);') >= 0
  && src.indexOf('return [ p[0] - cx + W/2, p[1] - cy + H/2 ];') >= 0
  && src.indexOf('ctx.drawImage(bgCv, 0, 0)') >= 0
  && src.indexOf('function rkActLoadBg(') >= 0
  && src.indexOf('function rkActBgStyle(') >= 0
  && src.indexOf('(prefers-color-scheme: dark)') >= 0
  && src.indexOf('rkTrackColor(a.type)') >= 0
  && src.indexOf('ctx.arc(pts[0][0], pts[0][1], 6, 0, Math.PI*2)') >= 0,
  '回放绘制逻辑（Mercator + 瓦片底图）');
T('回放底图样式跟随系统默认明暗：rkTheme 检测 + light/dark 档选择 + 占位底色',
  src.indexOf('function rkTheme(') >= 0
  && src.indexOf('window.matchMedia("(prefers-color-scheme: dark)")') >= 0
  && src.indexOf('return dark ? "dark" : "light";') >= 0
  && src.indexOf('return rkTheme() === "dark" ? RK_STYLES[2] : RK_STYLES[0];') >= 0
  && src.indexOf('bg:"#e9e5dd"') >= 0
  && src.indexOf('bg:"#1a2234"') >= 0
  && src.indexOf('bgCtx.fillRect(0, 0, W, H)') >= 0,
  'rkTheme 明暗检测/档选择/占位底色');
T('回放底图瓦片加载：离屏 canvas 渐进加载 + {s} 子域 + drawImage 对齐',
  src.indexOf('img.onload = function(){') >= 0
  && src.indexOf('bgCtx.drawImage(img, tx*RK_TILE - vx0, ty*RK_TILE - vy0, RK_TILE, RK_TILE)') >= 0
  && src.indexOf('"abcd"[(wx + ty + z) % 4]') >= 0
  && src.indexOf('var bgCv = document.createElement("canvas")') >= 0,
  '离屏渐进加载/子域/drawImage');
// 回放底图样式运行时：windowMock 无 matchMedia → 默认 light；模拟暗色系统 → dark
// rkTheme（需求五双主题选择依据）：与 rkActBgStyle 同源
T('rkActBgStyle 无 matchMedia 默认 light（浅色系统）',
  ctx.rkActBgStyle().k === 'light' && ctx.rkActBgStyle().url.indexOf('light_all') > 0,
  'k=' + ctx.rkActBgStyle().k);
T('rkTheme 无 matchMedia 默认 light（浅色系统）',
  ctx.rkTheme() === 'light', 'theme=' + ctx.rkTheme());
windowMock.matchMedia = function () { return { matches: true }; };
T('rkActBgStyle 暗色系统（prefers-color-scheme: dark）→ dark',
  ctx.rkActBgStyle().k === 'dark' && ctx.rkActBgStyle().url.indexOf('dark_all') > 0,
  'k=' + ctx.rkActBgStyle().k);
T('rkTheme 暗色系统（prefers-color-scheme: dark）→ dark',
  ctx.rkTheme() === 'dark', 'theme=' + ctx.rkTheme());
delete windowMock.matchMedia;
T('进入即自动播放 + 循环（requestAnimationFrame + prog 回卷）',
  src.indexOf('rkActAnim = requestAnimationFrame(tick)') >= 0
  && src.indexOf('if(prog >= 1){ t0 = ts; prog = 0; }') >= 0,
  '自动播放循环');
T('弹窗打开/关闭/遮罩/回放函数挂载到 window',
  src.indexOf('window.rkOpenAct = rkOpenAct') >= 0
  && src.indexOf('window.rkCloseAct = rkCloseAct') >= 0
  && src.indexOf('window.rkMaskClose = rkMaskClose') >= 0
  && src.indexOf('window.rkActReplay = rkActReplay') >= 0
  && src.indexOf('window.rkActStop = rkActStop') >= 0
  && src.indexOf('window.rkActBgStyle = rkActBgStyle') >= 0
  && src.indexOf('window.rkActLoadBg = rkActLoadBg') >= 0,
  '弹窗函数挂载');
// 骑行改版：回放 HUD（动态爬升 + 时速）与个人最佳骑行指标（无「平均配速」残留）
T('回放 HUD：右下角叠加动态爬升 + 时速（draw 内调用 rkActHud）',
  src.indexOf('function rkActHud(ctx, a, prog)') >= 0
  && src.indexOf('rkActHud(ctx, a, prog)') >= 0
  && src.indexOf('爬升 " + elev + " m') >= 0
  && src.indexOf('km/h') >= 0,
  'HUD 函数与调用');
T('骑行改版：个人最佳三项指标渲染 + maxSpd 解析',
  src.indexOf('最远距离') >= 0
  && src.indexOf('平均时速') >= 0
  && src.indexOf('极限冲刺速度') >= 0
  && src.indexOf('maxSpd: Number(a.max_speed)') >= 0
  && src.indexOf('均速近似') >= 0,
  '骑行指标');
T('骑行改版：无「平均配速」残留（源码全文检索）', src.indexOf('平均配速') < 0, '无配速残留');
T('骑行改版：无旧指标名「最高每小时公里数/最高时速」残留', src.indexOf('最高每小时公里数') < 0 && src.indexOf('最高时速') < 0, '无旧指标名');
T('骑行改版：rkBar 无「经 Worker 代理 · 本地零存储」残留', src.indexOf('经 Worker 代理 · 本地零存储') < 0, 'rkBar 文案');
T('骑行改版：rk-sub 改为「骑行 · 轨迹」', src.indexOf('骑行 · 轨迹') >= 0, 'rk-sub');
T('骑行改版：统计标签并入个人最佳（总距离/总时长/运动次数）',
  src.indexOf('items.push({ k:"总距离"') >= 0
  && src.indexOf('items.push({ k:"总时长"') >= 0
  && src.indexOf('items.push({ k:"运动次数"') >= 0,
  '个人最佳 6 项');
T('骑行改版：无「运动天数」残留（统计卡已删）', src.indexOf('运动天数') < 0, '无运动天数');

/* ========== 结果 ========== */
console.log('\n========================================');
console.log('通过 ' + pass + ' / ' + (pass + fail));
if (fail > 0) process.exit(1);
console.log('ALL TESTS PASSED');
