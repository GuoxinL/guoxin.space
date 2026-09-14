#!/usr/bin/env node
/**
 * GitHub Pages 语义模拟静态服务器（仅供 N-T00 spike 的 IT 使用）
 *
 * 与 `python3 -m http.server` 的关键差异：
 *   - 未知路径 → 返回 `404.html` 且 **HTTP 状态码 404**（复现 Pages 的 404 fallback）
 *   - 目录路径 → 尝试 `<path>/index.html`
 * 这样才能验证「中文深链是否由完整 Qwik 应用接管渲染」。
 *
 * 用法：node tools/serve-pages.mjs [port] [rootDir]
 *   port    默认 4322（避开 playwright 默认的 4321）
 *   rootDir 默认 app/dist
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const PORT = Number(process.argv[2] || 4322);
const ROOT = resolve(process.argv[3] || 'app/dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2',
};

/** 把 URL 路径解析到 ROOT 内的文件；越界返回 null。 */
function safeResolve(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  const rel = normalize(p).replace(/^(\.\.[/\\])+/, '');
  const abs = resolve(join(ROOT, rel));
  if (abs !== ROOT && !abs.startsWith(ROOT + sep)) return null;
  return abs;
}

async function isFile(abs) {
  try {
    const s = await stat(abs);
    return s.isFile();
  } catch {
    return false;
  }
}

async function serve(res, abs, code = 200) {
  const body = await readFile(abs);
  res.writeHead(code, {
    'Content-Type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const urlPath = req.url || '/';
  const target = safeResolve(urlPath);
  if (!target) {
    res.writeHead(400).end('bad request');
    return;
  }

  // 目录且不以 / 结尾 → 301 补尾斜杠（与 GitHub Pages 一致：/running → /running/）
  const pathOnly = urlPath.split('?')[0];
  const query = urlPath.slice(pathOnly.length);
  if (!pathOnly.endsWith('/') && (await isFile(join(target, 'index.html')))) {
    res.writeHead(301, { Location: pathOnly + '/' + query, 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  // 目录 → index.html
  let abs = target;
  if (urlPath.endsWith('/')) abs = join(target, 'index.html');

  if (await isFile(abs)) return void (await serve(res, abs, 200));

  // 非目录路径也允许补 index.html（/notes → /notes/index.html）
  const withIndex = join(target, 'index.html');
  if (await isFile(withIndex)) return void (await serve(res, withIndex, 200));

  // Pages 语义：未知路径 → 404.html + 状态码 404
  const nf = join(ROOT, '404.html');
  if (await isFile(nf)) return void (await serve(res, nf, 404));

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[serve-pages] http://127.0.0.1:${PORT} → ${ROOT}（404 fallback 已启用）`);
});
