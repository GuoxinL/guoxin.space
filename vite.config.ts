import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { staticAdapter } from '@builder.io/qwik-city/adapters/static/vite';

/**
 * GitHub Pages 只出静态产物，必须使用 static adapter 做 SSG 预渲染。
 * 缺了它，`qwik build` 会产出需要 Node 服务端的 SSR 产物，Pages 上跑不起来。
 */
export default defineConfig(({ isSsrBuild }) => ({
  // 关键：Vite root 指向 app/，与旧站（仓库根 index.html）彻底隔离。
  // Qwik City 客户端构建强制以 Vite root 的 index.html 为入口，
  // 若 root 是仓库根，旧站 index.html 会被误当入口打进 dist。
  root: 'app',
  plugins: [
    qwikCity(),
    qwikVite(),
    tsconfigPaths(),
    staticAdapter({
      origin: 'https://guoxin.space',
    }),
  ],
  server: {
    port: 5173,
  },
  build: {
    // 静态预渲染（SSG）阶段需要显式声明 city plan 入口，
    // 客户端构建走 index.html 入口，两者不能混用。
    rollupOptions: isSsrBuild ? { input: ['@qwik-city-plan'] } : {},
  },
  preview: {
    headers: {
      'Cache-Control': 'public, max-age=600',
    },
  },
}));
