/**
 * 农历 / 黄历封装层，统一封装 lunar-typescript，向 UI 暴露稳定结构。
 *
 * 不手写农历算法（1900–2100 推算复杂且易错），直接用社区成熟库 lunar-typescript。
 * 该库为纯日期计算，无浏览器全局依赖，可同时用于 SSG 预渲染（服务端）与客户端。
 */
import { Solar } from 'lunar-typescript';

export interface LunarInfo {
  /** 农历月（汉字，如 正 / 二 / 腊 / 闰二） */
  monthCn: string;
  /** 农历日（汉字，如 初一 / 十五 / 廿三） */
  dayCn: string;
  /** 完整农历日期文本，如「正月初一」「闰二月初五」 */
  lunarText: string;
  /** 年干支，如 丙午 */
  yearGanZhi: string;
  /** 生肖，如 马 */
  animal: string;
  /** 月干支 */
  monthGanZhi: string;
  /** 日干支 */
  dayGanZhi: string;
  /** 节气名（非节气日为空串） */
  solarTerm: string;
  /** 宜 */
  yi: string[];
  /** 忌 */
  ji: string[];
  /** 节日（农历 + 公历，合并去重） */
  festivals: string[];
}

function getSolarFestivals(solar: Solar): string[] {
  const fn = (solar as unknown as { getFestivals?: () => string[] }).getFestivals;
  return typeof fn === 'function' ? fn.call(solar) : [];
}

/** 由公历年月日（月为 1-based）取农历 / 黄历信息。 */
export function getLunarInfo(y: number, m: number, d: number): LunarInfo {
  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();

  const monthCn = lunar.getMonthInChinese();
  const dayCn = lunar.getDayInChinese();

  const lunarFest = lunar.getFestivals();
  const solarFest = getSolarFestivals(solar);
  const festivals = Array.from(new Set([...lunarFest, ...solarFest]));

  return {
    monthCn,
    dayCn,
    lunarText: `${monthCn}月${dayCn}`,
    yearGanZhi: lunar.getYearInGanZhi(),
    animal: lunar.getYearShengXiao(),
    monthGanZhi: lunar.getMonthInGanZhi(),
    dayGanZhi: lunar.getDayInGanZhi(),
    solarTerm: lunar.getJieQi(),
    yi: lunar.getDayYi(),
    ji: lunar.getDayJi(),
    festivals,
  };
}
