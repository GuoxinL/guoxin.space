/**
 * MdastRenderer —— mdast → Qwik 组件映射（唯一登记处，对齐 plan §7 白名单）。
 *
 * 未登记节点类型走 UnsupportedNode（可见标记），禁止在渲染器散落 switch 分支以外的新逻辑。
 * 代码高亮 / 公式渲染在客户端 useVisibleTask$ 中经 Prism / KaTeX 运行时增强（见 lib/notes/*）。
 */
import { component$, useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import type { MdNode } from '../../lib/notes/types';
import { slugifyHeading } from '../../lib/notes/slugify';
import { getKnownSlugs } from '../../lib/notes/source';
import { applyPrism } from '../../lib/notes/highlight';
import { renderMath } from '../../lib/notes/math';

function renderChildren(children?: MdNode[]) {
  return (children ?? []).map((c, i) => <NodeView key={i} node={c} />);
}

const Heading = component$<{ node: MdNode }>(({ node }) => {
  const text = (node.children ?? []).map((c) => c.value ?? '').join('');
  const id = slugifyHeading(text);
  const depth = Math.min(Math.max(node.depth ?? 2, 1), 4);
  const anchor = (
    <a class="md-anchor" href={`#${id}`} aria-label="复制锚点链接">
      #
    </a>
  );
  const kids = renderChildren(node.children);
  if (depth === 1) return <h1 id={id} class="md-h1">{kids}{anchor}</h1>;
  if (depth === 2) return <h2 id={id} class="md-h2">{kids}{anchor}</h2>;
  if (depth === 3) return <h3 id={id} class="md-h3">{kids}{anchor}</h3>;
  return <h4 id={id} class="md-h4">{kids}{anchor}</h4>;
});

const List = component$<{ node: MdNode }>(({ node }) =>
  node.ordered ? (
    <ol class="md-list md-list--ordered">{renderChildren(node.children)}</ol>
  ) : (
    <ul class="md-list">{renderChildren(node.children)}</ul>
  )
);

const ListItem = component$<{ node: MdNode }>(({ node }) => {
  if (node.checked === true || node.checked === false) {
    return (
      <li class="md-task">
        <input type="checkbox" checked={node.checked} disabled aria-label="任务项" />
        <span>{renderChildren(node.children)}</span>
      </li>
    );
  }
  return <li>{renderChildren(node.children)}</li>;
});

const Blockquote = component$<{ node: MdNode }>(({ node }) => {
  const callout = node.data?.callout as string | undefined;
  if (callout) {
    return (
      <blockquote class={`md-callout md-callout--${callout}`} data-callout={callout}>
        {renderChildren(node.children)}
      </blockquote>
    );
  }
  return <blockquote class="md-blockquote">{renderChildren(node.children)}</blockquote>;
});

const Table = component$<{ node: MdNode }>(({ node }) => (
  <div class="md-table-wrap">
    <table class="md-table">
      <tbody>{renderChildren(node.children)}</tbody>
    </table>
  </div>
));

const Image = component$<{ node: MdNode }>(({ node }) => (
  <img
    class="md-img"
    src={node.url}
    alt={node.alt ?? ''}
    title={node.title}
    loading="lazy"
  />
));

const WikiLink = component$<{ node: MdNode }>(({ node }) => {
  const target = (node.data?.target as string) ?? '';
  const alias = node.data?.alias as string | undefined;
  const permalink =
    (node.data?.permalink as string) ?? `/notes/${encodeURIComponent(target)}/`;
  const known = getKnownSlugs();
  const exists = (node.data?.exists as boolean | undefined) ?? known.has(target);
  const label = alias || node.children?.[0]?.value || target;
  return exists ? (
    <a class="md-wikilink" href={permalink}>
      {label}
    </a>
  ) : (
    <a class="md-wikilink md-wikilink--missing" href={permalink} title="尚未创建">
      {label}
    </a>
  );
});

const WikiEmbed = component$<{ node: MdNode }>(({ node }) => {
  const embed = node.data?.embedType as string | undefined;
  const src = node.data?.src as string | undefined;
  const alt = node.data?.alt as string | undefined;
  if (embed === 'image' && src) {
    return <img class="md-img md-embed" src={src} alt={alt ?? ''} loading="lazy" />;
  }
  return (
    <span class="md-unsupported" title="不支持的嵌入类型">
      ⚠ 未知嵌入：{String(embed ?? 'unknown')}
    </span>
  );
});

const FootnoteRef = component$<{ node: MdNode }>(({ node }) => {
  const fid = (node.data?.footnoteId as string) ?? `fn-${node.identifier ?? ''}`;
  return (
    <sup class="md-footnote-ref">
      <a id={`ref-${fid}`} href={`#${fid}`}>
        [{node.label ?? node.identifier ?? '?'}]
      </a>
    </sup>
  );
});

const FootnoteDef = component$<{ node: MdNode }>(({ node }) => {
  const fid = (node.data?.footnoteId as string) ?? `fn-${node.identifier ?? ''}`;
  return (
    <div class="md-footnote-def" id={fid}>
      <a href={`#ref-${fid}`}>↑</a> {renderChildren(node.children)}
    </div>
  );
});

const RawHtml = component$<{ node: MdNode }>(({ node }) => (
  <div class="md-html" dangerouslySetInnerHTML={node.value ?? ''} />
));

const CodeBlock = component$<{ node: MdNode }>(({ node }) => {
  const ref = useSignal<HTMLPreElement>();
  const copied = useSignal(false);
  const code = node.value ?? '';
  const lang = node.lang ?? '';
  const meta = (node.data?.codeMeta ?? {}) as {
    filename?: string;
    showLineNumbers?: boolean;
    highlightLines?: number[];
  };
  const lines = code.split('\n');
  const filename = meta.filename;
  const showLines = meta.showLineNumbers ?? false;

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (ref.value) void applyPrism(ref.value);
  });

  const copy = $(() => {
    navigator.clipboard?.writeText(code).then(() => {
      copied.value = true;
      setTimeout(() => (copied.value = false), 1500);
    });
  });

  return (
    <figure class="md-code" data-lang={lang}>
      {(filename || lang) && (
        <figcaption class="md-code-bar">
          <span class="md-code-file">{filename ?? lang}</span>
          <button type="button" class="md-code-copy" onClick$={copy} aria-label="复制代码">
            {copied.value ? '已复制' : '复制'}
          </button>
        </figcaption>
      )}
      <div class="md-code-body">
        {showLines && (
          <span class="md-code-gutter" aria-hidden="true">
            {lines.map((_, i) => (
              <span class="md-code-ln">{i + 1}</span>
            ))}
          </span>
        )}
        <pre ref={ref} class="md-pre">
          <code class={lang ? `language-${lang}` : undefined}>{code}</code>
        </pre>
      </div>
    </figure>
  );
});

const MathEl = component$<{ node: MdNode }>(({ node }) => {
  const ref = useSignal<HTMLElement>();
  const tex = node.value ?? '';
  const display = node.type === 'math';

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (ref.value) void renderMath(ref.value, tex, display);
  });

  return display ? (
    <div class="md-math md-math-block" ref={ref} data-tex={tex}>{`$$${tex}$$`}</div>
  ) : (
    <span class="md-math md-math-inline" ref={ref} data-tex={tex}>{`$${tex}$`}</span>
  );
});

const UnsupportedNode = component$<{ node: MdNode }>(({ node }) => (
  <span class="md-unsupported" title="未登记节点类型">
    ⚠ 不支持的节点：{node.type}
  </span>
));

const NodeView = component$<{ node: MdNode }>(({ node }) => {
  switch (node.type) {
    case 'root':
      return <>{renderChildren(node.children)}</>;
    case 'heading':
      return <Heading node={node} />;
    case 'paragraph':
      return <p class="md-p">{renderChildren(node.children)}</p>;
    case 'text':
      return <>{node.value ?? ''}</>;
    case 'strong':
      return <strong>{renderChildren(node.children)}</strong>;
    case 'emphasis':
      return <em>{renderChildren(node.children)}</em>;
    case 'delete':
      return <del>{renderChildren(node.children)}</del>;
    case 'inlineCode':
      return <code class="md-inline-code">{node.value ?? ''}</code>;
    case 'break':
      return <br />;
    case 'list':
      return <List node={node} />;
    case 'listItem':
      return <ListItem node={node} />;
    case 'blockquote':
      return <Blockquote node={node} />;
    case 'code':
      return <CodeBlock node={node} />;
    case 'table':
      return <Table node={node} />;
    case 'tableRow':
      return <tr class="md-tr">{renderChildren(node.children)}</tr>;
    case 'tableCell':
      return <td class="md-td">{renderChildren(node.children)}</td>;
    case 'thematicBreak':
      return <hr class="md-hr" />;
    case 'link': {
      const external = /^https?:/.test(node.url ?? '');
      return (
        <a
          class="md-link"
          href={node.url}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
        >
          {renderChildren(node.children)}
        </a>
      );
    }
    case 'image':
      return <Image node={node} />;
    case 'html':
      return <RawHtml node={node} />;
    case 'footnoteReference':
      return <FootnoteRef node={node} />;
    case 'footnoteDefinition':
      return <FootnoteDef node={node} />;
    case 'inlineMath':
    case 'math':
      return <MathEl node={node} />;
    case 'wikiLink':
      return <WikiLink node={node} />;
    case 'wikiEmbed':
      return <WikiEmbed node={node} />;
    default:
      return <UnsupportedNode node={node} />;
  }
});

export const MdastRenderer = component$<{ ast: MdNode }>(({ ast }) => {
  return <div class="md-body">{<NodeView node={ast} />}</div>;
});
