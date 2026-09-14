#!/usr/bin/env node
/**
 * 生成 SPA fallback 的 404.html（N-T00 spike 方案 A）
 *
 * 背景：Qwik City SSG 产出的 `404.html` 只是静态占位页（759B，不含 Qwik 应用），
 * GitHub Pages 对未知路径返回它 → 应用不启动 → 深链（如 `/notes/<中文标题>/`）失效。
 *
 * 做法：把 404.html 换成极简「引导页」——
 *   1) 把用户真正要访问的路径暂存进 sessionStorage
 *   2) 跳到**同一路由**下已预渲染的入口页（如 `/notes/测试笔记/` → `/notes/`）
 *   3) 由该页的应用读取暂存值，渲染对应内容并用 replaceState 把 URL 修正回原路径
 *
 * 为什么跳「同一路由」而不是首页首页：跨路由跳转会触发 Qwik City 客户端导航，
 * 而 Pages 对动态路由的 q-data.json 返回 404 会**中止 SPA 导航**。同一路由内仅
 * 切换组件状态，不涉及 q-data 请求。
 *
 * 用法：node tools/make-404-fallback.mjs [distDir]
 */
import { writeFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const DIST = resolve(process.argv[2] || 'app/dist');

const HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta http-equiv="Status" content="404">
<title>重定向中…</title>
<script>
(function () {
  var full = location.pathname + location.search + location.hash;
  try { sessionStorage.setItem('spaRedirect', full); } catch (e) {}
  var seg = (location.pathname.split('/')[1] || '').toLowerCase();
  var target = '/';
  if (seg === 'notes') target = '/notes/';
  else if (seg === 'skills') target = '/skills/';
  else if (seg === 'toolbox') target = '/toolbox/json/';
  else if (seg === 'running') target = '/running/';
  location.replace(target);
})();
</script>
</head>
<body></body>
</html>
`;

try {
  await access(DIST);
} catch {
  console.error('[make-404-fallback] 目录不存在：' + DIST + '（请先跑 vite build）');
  process.exit(1);
}

await writeFile(join(DIST, '404.html'), HTML, 'utf8');
console.log('[make-404-fallback] 已写入 SPA fallback → ' + join(DIST, '404.html'));
