/**
 * RunningPage 页面级自动化测试（覆盖所有用户可见功能）。
 *
 * 使用 @builder.io/qwik/testing 的 createDOM()（自带 domino 隔离 DOM）+ userEvent()
 * 经 Qwik 的 on: 上下文派发 onClick$/onChange$ 监听器，驱动真实组件渲染与交互。
 * 无需额外安装 jsdom。fetch / localStorage / matchMedia / canvas / rAF 均以轻量垫片模拟。
 *
 * 注意：
 * - Qwik 的 onClick$/onChange$ 走 Qwik 运行时（on: 上下文），必须用 userEvent() 触发；
 *   直接 dispatchEvent(new Event()) 不会命中（且 domino 的 win.Event 不是构造函数）。
 * - 地图预览图的 load、window 的 themechange 是「原生」监听（非 Qwik），分别用
 *   img.onload 直接调用、以及直接调用已导出的 rkApplyThemeChange() 验证（domino 的
 *   window.dispatchEvent 不存在）。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createDOM } from '@builder.io/qwik/testing';
import { RunningPage } from './RunningPage';
import { rkApplyThemeChange } from '../../lib/running';

/* 生成 40 条跨年份的活动，保证「加载更多」(30→40) 与年份过滤可测；统一带 polyline 以便缩略图/地图/回放均有数据。 */
const POLY = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
function makeActs(n: number): Record<string, unknown>[] {
  const years = [2024, 2025, 2026];
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < n; i++) {
    const y = years[i % years.length];
    const mo = (i % 12) + 1;
    const day = (i % 27) + 1;
    out.push({
      run_id: 1000 + i,
      name: `Act ${i}`,
      distance: 5000 + i * 100,
      moving_time: '0:25:00',
      type: i % 2 ? 'Ride' : 'Run',
      subtype: i % 2 ? 'Ride' : '',
      start_date_local: `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}T08:00:00Z`,
      summary_polyline: POLY,
      average_heartrate: 140 + (i % 20),
      average_speed: 3 + (i % 5),
      max_speed: 8 + (i % 6),
      elevation_gain: 30 + i,
      location_city: 'Beijing',
    });
  }
  return out;
}

const ACTS = makeActs(40);
const META = { cx: 116.4, cy: 39.9, z: 13 };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function settle(pred: () => boolean, timeout = 6000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (pred()) return true;
    await wait(50);
  }
  return pred();
}

describe('RunningPage 页面功能（全部用户可见功能）', () => {
  let screen: any;
  let doc: any;
  let win: any;
  let userEvent: any;

  beforeAll(async () => {
    // 轻量全局垫片（domino 不提供的部分）
    const mem = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => mem.set(k, String(v)),
      removeItem: (k: string) => mem.delete(k),
      clear: () => mem.clear(),
    };
    (globalThis as any).fetch = vi.fn(async (url: string) => {
      const f = new URL(url).searchParams.get('f') || '';
      if (f === 'preview.json') return { ok: true, status: 200, text: async () => JSON.stringify(ACTS), json: async () => ACTS };
      if (f === 'preview.meta.json') return { ok: true, status: 200, text: async () => JSON.stringify(META), json: async () => META };
      if (f === 'rides.full.json') return { ok: false, status: 401, json: async () => null };
      return { ok: true, status: 200, text: async () => '', json: async () => ({}) };
    });
    (globalThis as any).requestAnimationFrame = () => 1;
    (globalThis as any).cancelAnimationFrame = () => {};

    const dom = await createDOM();
    screen = dom.screen;
    userEvent = dom.userEvent;
    doc = screen.ownerDocument;
    win = doc.defaultView;
    // domino 缺 Element.append/prepend/replaceChildren —— Qwik 渲染错误浮层时用到，补上否则真实错误被吞
    const elProto = Object.getPrototypeOf(doc.createElement('div'));
    const patch = (name: string, fn: any) => {
      if (typeof (elProto as any)[name] !== 'function') (elProto as any)[name] = fn;
    };
    patch('append', function (this: any, ...nodes: any[]) {
      for (const n of nodes) this.appendChild(typeof n === 'string' ? doc.createTextNode(n) : n);
    });
    patch('prepend', function (this: any, ...nodes: any[]) {
      for (const n of nodes) this.insertBefore(typeof n === 'string' ? doc.createTextNode(n) : n, this.firstChild);
    });
    patch('replaceChildren', function (this: any, ...nodes: any[]) {
      while (this.firstChild) this.removeChild(this.firstChild);
      for (const n of nodes) this.appendChild(typeof n === 'string' ? doc.createTextNode(n) : n);
    });
    // 让应用代码里的 document/window/location 全局可用
    (globalThis as any).document = doc;
    (globalThis as any).window = win;
    // domino 的 window.location 返回 URL 对象（不抛）；补一个裸 location 供 authInit 等读取
    (globalThis as any).location = win.location;
    win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    // 地图预览用 <img> 创建；domino 不真正加载，测试里手动触发 img.onload
    win.Image = class {
      onload: any = null;
      onerror: any = null;
      src = '';
    };
    (globalThis as any).Image = win.Image; // rkActLoadBg 用裸 Image
    // canvas 2d 上下文 stub（通用 Proxy：方法调用与属性读取都返回自身，杜绝链式调用抛错）
    const ctxStub: any = new Proxy(function () {}, {
      get: () => ctxStub,
      set: () => true,
      apply: () => ctxStub,
    });
    const origCreate = doc.createElement.bind(doc);
    doc.createElement = (tag: string) => {
      const el = origCreate(tag);
      // domino 缺 Element.append/prepend/replaceChildren —— Qwik 渲染错误浮层时用到；给每个元素都注入，
      // 这样任务抛错时浮层能渲染，真实错误留在 .error 节点里可被测试读取。
      const ep = (el as any);
      if (typeof ep.append !== 'function') {
        ep.append = (...nodes: any[]) => {
          for (const n of nodes) ep.appendChild(typeof n === 'string' ? doc.createTextNode(n) : n);
        };
      }
      if (typeof ep.prepend !== 'function') {
        ep.prepend = (...nodes: any[]) => {
          for (const n of nodes) ep.insertBefore(typeof n === 'string' ? doc.createTextNode(n) : n, ep.firstChild);
        };
      }
      if (typeof ep.replaceChildren !== 'function') {
        ep.replaceChildren = (...nodes: any[]) => {
          while (ep.firstChild) ep.removeChild(ep.firstChild);
          for (const n of nodes) ep.appendChild(typeof n === 'string' ? doc.createTextNode(n) : n);
        };
      }
      if (String(tag).toLowerCase() === 'canvas') {
        // domino 的 HTMLCanvasElement.getContext 是只读访问器，直接赋值会抛；用 defineProperty 在实例上遮蔽
        try {
          Object.defineProperty(el, 'getContext', { value: () => ctxStub, configurable: true, writable: true });
        } catch {
          /* ignore */
        }
        try {
          (el as any).width = 0;
          (el as any).height = 0;
        } catch {
          /* ignore */
        }
      }
      return el;
    };

    await dom.render(<RunningPage />);
    // domino 无「页面可见」概念，useVisibleTask$（数据加载）需平台 flush 才执行；
    // 在 host 上反复派发无害 click 触发 flush，直到状态栏出现「数据已加载」为止
    for (let i = 0; i < 12; i++) {
      await userEvent(screen, 'click');
      await wait(200);
      if (screen.querySelector('.rk-bar-text')?.textContent?.includes('数据已加载')) break;
    }
    // 兜底等待首批数据加载完成
    await settle(() => {
      const t = screen.querySelector('.rk-bar-text');
      return !!t && t.textContent.includes('数据已加载');
    }, 8000);
  });

  it('#20 数据加载与状态栏', async () => {
    const ok = await settle(() => {
      const t = screen.querySelector('.rk-bar-text');
      return !!t && t.textContent.includes('数据已加载');
    });
    expect(ok).toBe(true);
    const dot = screen.querySelector('.dot');
    expect(dot.className).toContain('ok');
    const text = screen.querySelector('.rk-bar-text').textContent;
    expect(text).toContain(String(ACTS.length));
  });

  it('#21 统计总览卡片', async () => {
    await settle(() => screen.querySelector('.rk-section-h'));
    const sections = Array.from(screen.querySelectorAll('.rk-section'));
    const stats = sections.find((s: any) => s.querySelector('.rk-section-h')?.textContent === '运动总览');
    expect(stats).toBeTruthy();
    const cards = stats.querySelectorAll('.rk-pb-item');
    expect(cards.length).toBe(5);
    const keys = Array.from(cards).map((c: any) => c.querySelector('.rk-pb-k').textContent);
    expect(keys).toEqual(['总距离', '总时长', '运动次数', '活跃天数', '累计爬升']);
  });

  it('#22 年度热力图（年份 tab 切换）', async () => {
    const tabs = Array.from(screen.querySelectorAll('.rk-tab')) as any[];
    const yearTabs = tabs.filter((t) => /^\d{4}$/.test(t.textContent));
    expect(yearTabs.length).toBeGreaterThan(1);
    const activeBefore = screen.querySelector('.rk-tab.active')?.textContent;
    const target = yearTabs.find((t) => t.textContent !== activeBefore);
    await userEvent(target, 'click', { target });
    await wait(150);
    const activeAfter = screen.querySelector('.rk-tab.active')?.textContent;
    expect(activeAfter).toBe(target.textContent);
    expect(activeAfter).not.toBe(activeBefore);
    expect(screen.querySelector('.rk-heat-wrap-host')).toBeTruthy();
  });

  it('#23 跑量趋势图（按月 / 历年）', async () => {
    const yearly = Array.from(screen.querySelectorAll('.rk-tab')).find((t: any) => t.textContent === '历年');
    await userEvent(yearly, 'click', { target: yearly });
    await wait(150);
    const svg = screen.querySelector('.rk-trend');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('aria-label')).toContain('历年跑量');
    // 切回按月
    const monthly = Array.from(screen.querySelectorAll('.rk-tab')).find((t: any) => t.textContent === '按月');
    await userEvent(monthly, 'click', { target: monthly });
    await wait(100);
    expect(screen.querySelector('.rk-trend').getAttribute('aria-label')).toContain('各月跑量');
  });

  it('#24 个人最佳 / 总览', async () => {
    const sections = Array.from(screen.querySelectorAll('.rk-section'));
    const pb = sections.find((s: any) => s.querySelector('.rk-section-h')?.textContent === '个人最佳 / 总览');
    expect(pb).toBeTruthy();
    expect(pb.querySelectorAll('.rk-pb-item').length).toBe(6);
  });

  it('#25 活动列表（加载更多 + 年份过滤）', async () => {
    expect(screen.querySelectorAll('.rk-actcard').length).toBe(30);
    const more = screen.querySelector('.rk-more');
    expect(more).toBeTruthy();
    await userEvent(more, 'click', { target: more });
    await wait(150);
    expect(screen.querySelectorAll('.rk-actcard').length).toBe(ACTS.length);
    expect(screen.querySelector('.rk-more')).toBeFalsy();
    // 年份过滤
    const sel = screen.querySelector('.rk-list-tools select');
    sel.value = '2026';
    await userEvent(sel, 'change', { target: sel });
    await wait(150);
    const expected = ACTS.filter((a) => String(a.start_date_local).startsWith('2026')).length;
    expect(screen.querySelectorAll('.rk-actcard').length).toBe(expected);
  });

  it('#26 轨迹地图（瓦片 + 矢量层 + 控制按钮）', async () => {
    await settle(() => screen.querySelector('.rk-tilemap'));
    const pv = screen.querySelector('.rk-tm-pv') as any;
    expect(pv).toBeTruthy();
    // domino 不会真正加载预览 PNG，手动触发 onload -> fetchMeta().then(go) -> rkMapInit 出图
    if (typeof pv.onload === 'function') pv.onload({});
    await settle(() => (screen.querySelectorAll('.rk-tm-tile').length || 0) > 0, 4000);
    expect(screen.querySelectorAll('.rk-tm-tile').length).toBeGreaterThan(0);
    expect(screen.querySelector('.rk-tm-svg')).toBeTruthy(); // 矢量层容器
    expect(screen.querySelectorAll('.rk-tm-btn').length).toBe(4);
  });

  it('#27 轨迹回放弹窗 + 主题联动', async () => {
    const card = screen.querySelector('.rk-actcard');
    await userEvent(card, 'click', { target: card });
    await settle(() => screen.querySelector('.rk-act-modal'));
    const modal = screen.querySelector('.rk-act-modal');
    expect(modal).toBeTruthy();
    await settle(() => modal.querySelector('canvas'));
    expect(modal.querySelector('canvas')).toBeTruthy();
    expect(modal.querySelector('.rk-act-info')).toBeTruthy();
    // 关闭
    const close = screen.querySelector('.rk-act-close');
    await userEvent(close, 'click', { target: close });
    await wait(150);
    expect(screen.querySelector('.rk-act-modal')).toBeFalsy();

    // 主题联动：light -> dark 切换缩略图 src（rkApplyThemeChange 即为组件 themechange 监听所调用）。
    // domino 的 body.dataset 不可写，改用 matchMedia 模拟暗色（与 rkTheme() 兜底逻辑一致）
    const thumb = screen.querySelector('.rk-act-thumb img') as any;
    expect(thumb.getAttribute('src')).toContain('.light.png');
    const prevMM = win.matchMedia;
    win.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    rkApplyThemeChange();
    const thumb2 = screen.querySelector('.rk-act-thumb img') as any;
    expect(thumb2.getAttribute('src')).toContain('.dark.png');
    win.matchMedia = prevMM;
  });
});
