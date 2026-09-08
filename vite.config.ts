/// <reference types="vitest" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { qwikVite, type QwikViteOptions } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { staticAdapter } from '@builder.io/qwik-city/adapters/static/vite';

export default defineConfig(({ isSsrBuild }) => {
  // SSG（SSR 构建）需要客户端构建产物中的 manifest —— 尤其是 symbol→chunk 的 `mapping`，
  // 否则 Qwik 在预渲染期无法解析任何组件符号，整页只会渲染出空壳（q:container="paused"）。
  //
  // qwikVite 默认靠两次构建之间的临时文件（<tmpdir>/vite-plugin-qwik-q-manifest*.json）传递
  // manifest，但该临时文件在本机环境下未被正确写出，导致 SSR 侧 manifestInput 为空、渲染全空。
  // 因此这里显式从客户端构建产物（app/dist/q-manifest.json，含完整 mapping）读取并注入。
  const qwikViteOptions: QwikViteOptions = {};
  if (isSsrBuild) {
    const manifestPath = resolve(process.cwd(), 'app/dist/q-manifest.json');
    try {
      qwikViteOptions.ssr = {
        manifestInput: JSON.parse(readFileSync(manifestPath, 'utf-8')),
      };
    } catch (e) {
      console.warn('[vite] 未找到客户端 manifest，SSG 可能渲染空壳：', e);
    }
  }

  return {
    // 关键：Vite root 指向 app/，与旧站（仓库根 index.html）彻底隔离。
    root: 'app',
    plugins: [
      qwikCity(),
      qwikVite(qwikViteOptions),
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
    // root 已指向 app/，include 相对 app 目录解析
    test: {
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      environment: 'node',
    },
  };
});
