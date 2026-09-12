import { describe, it, expect, beforeAll } from 'vitest';
import { createDOM } from '@builder.io/qwik/testing';
import { JsonTree } from './JsonTree';

/**
 * 树形视图 JSONPath 命中高亮冒烟测试（纯渲染，无需构建）。
 * 验证：命中节点带 jp-hl 类、未命中节点不带、命中节点的祖先自动展开。
 */
describe('JsonTree JSONPath 命中高亮', () => {
  let screen: any;

  beforeAll(async () => {
    const dom = await createDOM();
    screen = dom.screen;
    const data = {
      name: 'guoxin',
      roles: { admin: true, scopes: ['read', 'write'] },
      tags: ['a', 'b'],
    };
    // 只命中深层节点（roles.admin 与 tags[0]），用于验证祖先自动展开
    await dom.render(
      <JsonTree
        val={data}
        name="root"
        depth={0}
        path="$"
        hlPaths={["$['roles']['admin']", "$['tags'][0]"]}
      />,
    );
  });

  it('命中节点带 jp-hl 类', () => {
    const hit = screen.querySelectorAll('.jt-node.jp-hl, .jt-leaf.jp-hl');
    expect(hit.length).toBeGreaterThan(0);
  });

  it('命中节点的祖先自动展开（roles 容器节点 open）', () => {
    const roles = Array.from(screen.querySelectorAll('.jt-node')).find((n: any) =>
      n.querySelector('.j-key')?.textContent?.startsWith('roles'),
    ) as any;
    expect(roles).toBeTruthy();
    expect(roles.hasAttribute('open')).toBe(true);
  });

  it('未命中节点无 jp-hl', () => {
    const nameLeaf = Array.from(screen.querySelectorAll('.jt-leaf')).find((n: any) =>
      n.querySelector('.j-key')?.textContent?.startsWith('name'),
    ) as any;
    expect(nameLeaf).toBeTruthy();
    expect(nameLeaf.className).not.toContain('jp-hl');
  });

  it('命中路径与树节点路径一致：tags[0] 叶子高亮', () => {
    const tag0 = Array.from(screen.querySelectorAll('.jt-leaf.jp-hl')).find((n: any) =>
      n.querySelector('.j-str')?.textContent === '"a"',
    ) as any;
    expect(tag0).toBeTruthy();
    expect(tag0.className).toContain('jp-hl');
  });
});
