import { describe, expect, it } from 'vitest';

import {
  jpComposePath,
  jpFindRanges,
  jpStripPrefixNoise,
  jpKeyNeedles,
  jpLeafKey,
  jpMergeRanges,
  jpNeedles,
  queryJsonPath,
  rangesToLines,
} from './jsonpath';

const SAMPLE = '{\n  "type": "cycling",\n  "km": 42\n}';
const SAMPLE_OBJ = '{\n  "name": "guoxin",\n  "roles": {\n    "admin": true\n  }\n}';

describe('jpNeedles', () => {
  it('JSON 下字符串同时给出带引号与裸值两种候选', () => {
    expect(jpNeedles('cycling', 'json')).toEqual(['"cycling"', 'cycling']);
  });

  it('YAML 下只用裸值', () => {
    expect(jpNeedles('cycling', 'yaml')).toEqual(['cycling']);
  });
});

describe('jpFindRanges', () => {
  it('找出所有出现位置', () => {
    expect(jpFindRanges('aXbXc', ['X'])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('跳过空候选', () => {
    expect(jpFindRanges('abc', [''])).toEqual([]);
  });
});

describe('jpMergeRanges', () => {
  it('合并重叠区间', () => {
    expect(
      jpMergeRanges([
        [0, 5],
        [3, 8],
        [10, 12],
      ])
    ).toEqual([
      [0, 8],
      [10, 12],
    ]);
  });

  it('空输入返回空数组', () => {
    expect(jpMergeRanges([])).toEqual([]);
  });
});

describe('queryJsonPath', () => {
  it('命中并在原文中定位高亮区间', () => {
    const r = queryJsonPath(SAMPLE, 'json', '$.type');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.count).toBe(1);
      // "cycling" 含引号，应定位到带引号片段
      const hit = r.ranges.find(([s, e]) => SAMPLE.slice(s, e) === '"cycling"');
      expect(hit).toBeDefined();
    }
  });

  it('返回命中路径（jsonpath-plus 风格），供树形视图按路径高亮', () => {
    const r = queryJsonPath(SAMPLE, 'json', '$.type');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.paths).toEqual(["$['type']"]);
  });

  it('对象值用末级键名在原文高亮（紧凑 JSON.stringify 无法命中美化文本）', () => {
    const r = queryJsonPath(SAMPLE_OBJ, 'json', '$.roles');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.count).toBe(1);
      expect(r.paths).toEqual(["$['roles']"]);
      // 应能定位到键 "roles"（而非去匹配整段对象文本）
      const hit = r.ranges.find(([s, e]) => SAMPLE_OBJ.slice(s, e) === '"roles"');
      expect(hit).toBeDefined();
    }
  });

  it('未命中时返回 0 项且无区间', () => {
    const r = queryJsonPath(SAMPLE, 'json', '$.notExist');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.count).toBe(0);
      expect(r.ranges).toEqual([]);
    }
  });

  it('表达式为空时给出提示', () => {
    const r = queryJsonPath(SAMPLE, 'json', '   ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.msg).toContain('请输入 JSONPath 表达式');
  });

  it('原文非法时提示解析失败', () => {
    const r = queryJsonPath('{bad json', 'json', '$.a');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.msg).toContain('解析失败');
  });

  it('支持从 YAML 转 JSON 后查询', () => {
    const r = queryJsonPath('type: cycling\nkm: 42\n', 'yaml', '$.type');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.count).toBe(1);
  });
});

describe('jpLeafKey / jpKeyNeedles', () => {
  it('从路径提取对象键名', () => {
    expect(jpLeafKey("$['roles']")).toBe('roles');
    expect(jpLeafKey("$['roles']['admin']")).toBe('admin');
  });
  it('数组下标返回 null（文本视图无对应键，树形仍按路径高亮）', () => {
    expect(jpLeafKey("$['tags'][0]")).toBeNull();
  });
  it('JSON 键名带引号、其他语言裸键', () => {
    expect(jpKeyNeedles('roles', 'json')).toEqual(['"roles"']);
    expect(jpKeyNeedles('roles', 'yaml')).toEqual(['roles']);
  });
});

describe('rangesToLines', () => {
  it('按行切分区间并换算为行内偏移', () => {
    const raw = 'abc\ndef\nghi';
    const lines = rangesToLines(raw, [
      [1, 3],
      [4, 7],
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0].line).toBe(0);
    expect(lines[0].segs).toEqual([[1, 3]]);
    expect(lines[1].segs).toEqual([[0, 3]]);
  });
});

describe('jpFindRanges（词边界，防误命中）', () => {
  it('非词边界：裸键命中 mytype / types 子串', () => {
    const raw = 'type: a\nmytype: b\ntypes: c';
    expect(jpFindRanges(raw, ['type'], false)).toHaveLength(3);
  });
  it('词边界：仅命中独立键 type，跳过 mytype / types', () => {
    const raw = 'type: a\nmytype: b\ntypes: c';
    expect(jpFindRanges(raw, ['type'], true)).toEqual([[0, 4]]);
  });
  it('JSON 引号键不受词边界影响', () => {
    const raw = '{"type":"a","mytype":"b"}';
    expect(jpFindRanges(raw, ['"type"'], false)).toHaveLength(1);
  });
});

describe('queryJsonPath（YAML 高亮不误命中同名子串）', () => {
  it('查询对象键 $.type 仅高亮独立键，不命中 mytype / types', () => {
    const raw = 'type:\n  a: 1\nmytype:\n  b: 2';
    const r = queryJsonPath(raw, 'yaml', '$.type');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.count).toBe(1);
      expect(r.ranges).toHaveLength(1);
      expect(raw.slice(r.ranges[0][0], r.ranges[0][1])).toBe('type');
    }
  });
});

describe('jpStripPrefixNoise（前缀式输入框：剥误输入的 $ 与首个 .）', () => {
  it('旧式完整路径 $.a.b → a.b', () => {
    expect(jpStripPrefixNoise('$.a.b')).toBe('a.b');
  });
  it('保留递归下降：$..t → .t', () => {
    expect(jpStripPrefixNoise('$..t')).toBe('.t');
  });
  it('剥首个点：.n → n；保留双点 ..t → .t', () => {
    expect(jpStripPrefixNoise('.n')).toBe('n');
    expect(jpStripPrefixNoise('..t')).toBe('.t');
  });
  it('数组形态 [0] 原样保留', () => {
    expect(jpStripPrefixNoise('[0].t')).toBe('[0].t');
  });
  it('边界：空串与裸 $ → 空串', () => {
    expect(jpStripPrefixNoise('')).toBe('');
    expect(jpStripPrefixNoise('$')).toBe('');
  });
});

describe('jpComposePath（前缀式输入框：由值合成完整 JSONPath）', () => {
  it('普通成员路径接 $.', () => {
    expect(jpComposePath('a.b')).toBe('$.a.b');
    expect(jpComposePath('store.book[0]')).toBe('$.store.book[0]');
  });
  it('数组根形态 [ 开头接 $', () => {
    expect(jpComposePath('[0].t')).toBe('$[0].t');
  });
  it('点形态归一：.t → $.t；..t → $..t', () => {
    expect(jpComposePath('.t')).toBe('$.t');
    expect(jpComposePath('..t')).toBe('$..t');
  });
  it('空值 / 仅一个点 → 空串（视为未输入）', () => {
    expect(jpComposePath('')).toBe('');
    expect(jpComposePath('.')).toBe('');
  });
  it('回归：组合表达式可被 queryJsonPath 执行', () => {
    const r = queryJsonPath(SAMPLE, 'json', jpComposePath('type'));
    if (!r.ok) throw new Error(r.msg);
    expect(r.count).toBe(1);
  });
});
