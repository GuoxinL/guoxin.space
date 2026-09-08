/**
 * SSG / SSR 入口。
 * GitHub Pages 只吃静态产物，构建时由 Qwik City static adapter 调用本文件预渲染。
 */
import { renderToStream, type RenderToStreamOptions } from '@builder.io/qwik/server';
import { manifest } from '@qwik-client-manifest';
import Root from './root';

export default function (opts: RenderToStreamOptions) {
  return renderToStream(Root, {
    manifest,
    ...opts,
    containerAttributes: {
      lang: 'zh-CN',
      ...opts.containerAttributes,
    },
  });
}
