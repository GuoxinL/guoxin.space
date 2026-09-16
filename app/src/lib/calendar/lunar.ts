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
  /** 冲煞，如「冲猪煞东」（getDayChong 地支 + getDaySha 方位） */
  chongSha: string;
  /** 喜神方位，如「喜神东南」（getDayPositionXi 八卦 → 方位） */
  xiPosition: string;
}

/** 地支 → 生肖 */
const BRANCH_TO_ANIMAL: Record<string, string> = {
  子: '鼠', 丑: '牛', 寅: '虎', 卯: '兔', 辰: '龙', 巳: '蛇',
  午: '马', 未: '羊', 申: '猴', 酉: '鸡', 戌: '狗', 亥: '猪',
};
/** 八卦方位 →  compass 方位 */
const BAGUA_TO_DIR: Record<string, string> = {
  坎: '北', 离: '南', 震: '东', 兑: '西',
  巽: '东南', 乾: '西北', 艮: '东北', 坤: '西南',
};

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

  const chong = BRANCH_TO_ANIMAL[lunar.getDayChong()] ?? lunar.getDayChong();
  const sha = lunar.getDaySha();
  const xiBranch = lunar.getDayPositionXi();
  const xiDir = BAGUA_TO_DIR[xiBranch] ?? xiBranch;

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
    chongSha: chong && sha ? `冲${chong}煞${sha}` : '',
    xiPosition: xiDir ? `喜神${xiDir}` : '',
  };
}
