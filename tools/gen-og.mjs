/**
 * N-T28 OG 图生成（构建期辅助脚本）。
 *
 * 纯 CSR 站点爬虫不执行 JS，真实 OG 抓取需回到 per-route SSG（见计划 R-1 / §12.4）；
 * 此处生成静态 SVG OG 图，配合详情页运行时注入 <meta og:image> 演示完整管线，
 * 输出到 app/public/og/<slug>.svg（构建期由 Vite 拷贝到 dist）。
 *
 * demo 阶段硬编码两篇示例文章；生产应改为读取数仓 posts.json 批量生成。
 * 运行：node tools/gen-og.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'app', 'public', 'og');

// demo 阶段硬编码；生产应改为读取数仓 posts.json
const ARTICLES = [
  { slug: 'Markdown 全功能示例', title: 'Markdown 全功能示例', desc: '一篇覆盖写作模块计划支持的全部 Markdown 功能的示例文章。' },
  { slug: 'Qwik 与 SSR 笔记', title: 'Qwik 与 SSR 笔记', desc: '一篇演示反链（backlinks）的短示例文章。' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svg(a) {
  const desc = a.desc.length > 30 ? a.desc.slice(0, 30) + '…' : a.desc;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0F0F1A"/>
  <rect x="0" y="0" width="14" height="630" fill="#A053FE"/>
  <text x="80" y="170" font-family="-apple-system, system-ui, sans-serif" font-size="32" fill="#9AA0B5">guoxin.space · 笔记</text>
  <text x="80" y="300" font-family="-apple-system, system-ui, sans-serif" font-size="74" font-weight="700" fill="#FFFFFF">${esc(a.title)}</text>
  <text x="80" y="400" font-family="-apple-system, system-ui, sans-serif" font-size="34" fill="#C8CBD8">${esc(desc)}</text>
  <text x="80" y="560" font-family="-apple-system, system-ui, sans-serif" font-size="28" fill="#A053FE">guoxin.space</text>
</svg>`;
}

mkdirSync(OUT, { recursive: true });
for (const a of ARTICLES) {
  const file = a.slug.replace(/ /g, '_') + '.svg';
  writeFileSync(join(OUT, file), svg(a), 'utf8');
  console.log('wrote', file);
}
