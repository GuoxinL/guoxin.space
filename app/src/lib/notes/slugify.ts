/**
 * 标题 → 锚点 slug（中文友好，对齐 plan §7 heading 备注）。
 * 与 Obsidian/微信式锚点同构：保留 CJK 字母与数字，空白转连字符，小写。
 */

export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    // 保留字母（含 CJK）、数字、连字符、下划线；丢弃标点
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** 在一组标题文本上批量生成去重 slug（同名追加 -2 / -3 …）。 */
export function dedupHeadingSlugs(texts: string[]): string[] {
  const used = new Map<string, number>();
  return texts.map((t) => {
    const base = slugifyHeading(t) || 'section';
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  });
}
