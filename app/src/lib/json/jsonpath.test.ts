import { describe, expect, it } from 'vitest';

import {
  jpFindRanges,
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
