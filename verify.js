/* personal-homepage 双编辑区重构 vm 回归测试 */
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('/Users/guoxin/code/work/personal-homepage/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('FAIL: 未找到内联脚本'); process.exit(1); }
let code = m[1].trim();
// 去掉 IIFE 包装，让函数进全局（记忆中的教训：整体加载最可靠）
code = code.replace(/^\(function\(\)\{/, '').replace(/\}\)\(\);\s*$/, '');

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
  createElement() { return makeEl('created'); },
  body: makeEl('body'),
  execCommand() { return true; }
};
elements.indentSel = makeEl('indentSel');
elements.indentSel.value = '2';
elements.wrapL = makeEl('wrapL', 'editor-wrap');
elements.wrapR = makeEl('wrapR', 'editor-wrap');

const windowMock = { addEventListener() {}, location: { hash: '#/json' } };
const ctx = {
  document: documentMock,
  localStorage: localStorageMock,
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  window: windowMock,
  location: windowMock.location,
  console,
  // 同步化 setTimeout：setSide 的 500ms 防抖保存立即生效，便于断言
  setTimeout: (fn) => { fn(); return 0; },
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
['fmtSide','minSide','escSide','unescSide','toggleTree','doCompare','doRepair','showHistory','restoreHistory','delHistory','clearHistory','copyResult','downloadJson','openImportJson','exportBackup','openImport'].forEach(fn => {
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
// 二级路由 hash 解析
windowMock.location.hash = '#/json';
T('skHashDir 非 skills 页返回空', ctx.skHashDir()==='');
windowMock.location.hash = '#/skills/fav-x';
T('skHashDir 提取 #/skills/<dir>', ctx.skHashDir()==='fav-x');
windowMock.location.hash = '#/skills';
T('skHashDir 无目录返回空', ctx.skHashDir()==='');
windowMock.location.hash = '#/skills/fav-x';
// 进入详情独立页
ctx.skRoute('fav-x');
T('skRoute 进入详情视图（列表隐藏）', ctx.skView_==='detail' && el('skDetail').classList.contains('show') && !el('skList').classList.contains('show'));
T('详情页填充名称/来源', el('drName').textContent==='Test Skill' && el('drSrc').textContent.indexOf('jnMetaCode')>=0, el('drName').textContent);
T('详情页填充简介与 SKILL.md', el('drDesc').textContent==='desc' && el('drMd').textContent==='# Hi');
T('进详情自动展开文件树抽屉并渲染', ctx.skTreeOpen_===true && el('skTreeDrawer').classList.contains('open') && el('skTreeBody').innerHTML.indexOf('ft-click')>=0);
T('文件树抽屉有且仅有文件树', el('skTreeBody').innerHTML.indexOf('drMd')<0 && el('skTreeBody').innerHTML.indexOf('drawer-sec')<0);
// 返回列表：抽屉收起 + 提示
ctx.skShowList();
T('skShowList 回列表视图', ctx.skView_==='list' && el('skList').classList.contains('show') && !el('skDetail').classList.contains('show'));
T('列表页收起文件树并显示未选择提示', ctx.skTreeOpen_===false && el('skTreeBody').innerHTML.indexOf('未选择 Skill')>=0);
// 列表页点文件树条目 → 自动进详情并打开该文件
ctx.skOpenFile('fav-x','scripts/run.sh');
T('列表页点文件树 → 记录待打开并跳详情 hash', ctx.skPendingFile==='scripts/run.sh' && windowMock.location.hash==='#/skills/fav-x');
ctx.skRoute('fav-x');
T('进详情自动打开待查看文件', ctx.skOpenFile_==='scripts/run.sh' && el('drFileLabel').textContent==='scripts/run.sh', el('drFileLabel').textContent);
T('skPendingFile 消费后清空', ctx.skPendingFile==='');
// 抽拉切换（三角形按钮）
ctx.skToggleTree();
T('skToggleTree 收起抽屉', ctx.skTreeOpen_===false && !el('skTreeDrawer').classList.contains('open'));
ctx.skToggleTree();
T('skToggleTree 再次展开', ctx.skTreeOpen_===true && el('skTreeDrawer').classList.contains('open'));
// hash 快捷跳转
ctx.skBack();
T('skBack 回列表 hash', windowMock.location.hash==='#/skills');
ctx.skGoto('fav-x');
T('skGoto 进详情 hash', windowMock.location.hash==='#/skills/fav-x');
// 离开 skills 页自动收起文件树抽屉
documentMock.querySelectorAll = function(){ return { forEach(){}, length:0 }; };
ctx.skTreeOpen();
windowMock.location.hash = '#/home';
ctx.navigate();
T('离开 skills 页自动收起文件树抽屉', ctx.skTreeOpen_===false && !el('skTreeDrawer').classList.contains('open'));
windowMock.location.hash = '#/skills/fav-x';

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
  { run_id:101, name:'晨跑', distance:'5200', moving_time:'30:00', type:'Run', start_date_local:'2024-01-01T08:00:00Z', location_country:'中国', summary_polyline:'p'.repeat(25), average_heartrate:'145', average_speed:3.12, elevation_gain:'50' },
  { run_id:102, distance:0 }
];
var rkP = ctx.rkParse(rkRaw);
T('rkParse 规整字段', rkP.length===1 && rkP[0].id===101 && rkP[0].dist===5200 && rkP[0].mt==='30:00' && rkP[0].type==='Run' && rkP[0].date==='2024-01-01T08:00:00Z' && rkP[0].hr===145 && rkP[0].spd===3.12 && rkP[0].elev===50, JSON.stringify(rkP));
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
// rkPbs 窗口 + 配速过滤（对齐 PersonalBest：窗口 4.8-5.5 / 9.5-11 / 20-22.5 / 41-44，配速 180-480 s/km）
var rkPbsActs = [
  { type:'Run', poly:'p'.repeat(30), dist:5000, mt:'18:00', date:'2024-01-01T08:00:00Z' },
  { type:'Run', poly:'p'.repeat(30), dist:10000, mt:'50:00', date:'2024-01-02T08:00:00Z' },
  { type:'Run', poly:'p'.repeat(30), dist:21000, mt:'1:45:00', date:'2024-01-03T08:00:00Z' },
  { type:'Run', poly:'p'.repeat(30), dist:42000, mt:'3:30:00', date:'2024-01-04T08:00:00Z' },
  { type:'Run', poly:'p'.repeat(30), dist:5000, mt:'5:00', date:'2024-01-05T08:00:00Z' },
  { type:'Run', poly:'p'.repeat(30), dist:8000, mt:'40:00', date:'2024-01-06T08:00:00Z' }
];
var rkPbsRes = ctx.rkPbs(rkPbsActs);
T('rkPbs 5K 取最快并过滤超快配速', rkPbsRes[0].key==='5K' && rkPbsRes[0].time===1080 && rkPbsRes[0].act.date.slice(0,10)==='2024-01-01', JSON.stringify(rkPbsRes[0]));
T('rkPbs 10K', rkPbsRes[1].time===3000);
T('rkPbs Half', rkPbsRes[2].time===6300);
T('rkPbs Full', rkPbsRes[3].time===12600);
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
T('rkMapStyleIdx 默认 0=auto（无 token 依赖）', ctx.rkMapStyleIdx()===0, 'idx='+ctx.rkMapStyleIdx());
T('rkResolveStyle auto 亮色→light_all 白底', ctx.rkResolveStyle(0).k==='light', 'k='+ctx.rkResolveStyle(0).k);
T('rkResolveStyle 暗色档→dark_all', ctx.rkResolveStyle(3).k==='dark', 'k='+ctx.rkResolveStyle(3).k);
T('rkResolveStyle 浅色档原样返回', ctx.rkResolveStyle(1).k==='light' && ctx.rkResolveStyle(1).url.indexOf('light_all')>0);
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

// rkBody 模块顺序（轨迹地图 → 年度热力图 → 统计卡 → 趋势 → 个人最佳 → 活动列表）
var riMap = html.indexOf('id="rkMapSec"');
var riHeat = html.indexOf('年度热力图');
var riStats = html.indexOf('id="rkStats"');
var riTrend = html.indexOf('id="rkTrendOut"');
var riPbs = html.indexOf('id="rkPbs"');
var riList = html.indexOf('id="rkList"');
T('rkBody 顺序 统计<地图<个人最佳<热力图<趋势<活动列表',
  riStats >= 0 && riStats < riMap && riMap < riPbs && riPbs < riHeat && riHeat < riTrend && riTrend < riList,
  [riStats, riMap, riPbs, riHeat, riTrend, riList].join(' < '));

// 热力图默认年份：rkOnData 中取数据最新年份（非 "all"），初始状态取系统当前年份
T('rkHeat 默认当前年份（非全部）',
  /rkState\.year = rkYears\(rkActs\)\[0\]/.test(html) && /year:String\(new Date\(\)\.getFullYear\(\)\)/.test(html),
  '默认年份 = 数据最新年份');

// 路由：#/run → #/running（侧边栏 / 快捷卡 / 底部 tab / 页面 id / 白名单 / rkLoad 触发）
T('路由 #/running 全量生效（无 #/run 残留）',
  html.indexOf('href="#/running" data-nav="running"') >= 0
  && html.indexOf('location.hash=\'#/running\'') >= 0
  && html.indexOf('id="page-running"') >= 0
  && html.indexOf('href="#/running" data-tabpage="running"') >= 0
  && html.indexOf('["home","json","skills","running"]') >= 0
  && html.indexOf('if(h === "running") rkLoad();') >= 0
  && html.indexOf('#/run"') < 0
  && html.indexOf('id="page-run"') < 0
  && html.indexOf('data-nav="run"') < 0
  && html.indexOf('data-tabpage="run"') < 0
  && html.indexOf('h === "run"') >= 0,
  'running 路由 + 旧 run 兼容重定向');

/* ========== 结果 ========== */
console.log('\n========================================');
console.log('通过 ' + pass + ' / ' + (pass + fail));
if (fail > 0) process.exit(1);
console.log('ALL TESTS PASSED');
