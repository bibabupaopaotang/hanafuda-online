/**
 * 役判定引擎
 * 来源：design/gdd/rule-engine.md (v1.0) + design/gdd/scoring.md (v0.1)
 * 已确认：
 *   - 赤短 = [1,2,3]月短册
 *   - 青短 = [6,7,9]月短册
 *   - 呑み/花见酒/月见酒 互斥
 *   - 猪鹿蝶 = 6月蝶 + 7月猪 + 10月鹿
 */

import { CardCategory, HanafudaCard, Month } from '../cards/types.js';
import { YakuResult, YakuType } from './types.js';

/** 检查光牌役 */
export function checkLights(captured: HanafudaCard[]): YakuResult | null {
  const lights = captured.filter(c => c.category === CardCategory.Light);
  const hasOno = lights.some(c => c.month === Month.November);

  if (lights.length === 5) {
    return { type: YakuType.FiveLights, points: 10, cards: [...lights], label: '五光' };
  }
  if (lights.length === 4) {
    if (hasOno) {
      return { type: YakuType.RainFourLights, points: 7, cards: [...lights], label: '雨四光' };
    }
    return { type: YakuType.FourLights, points: 8, cards: [...lights], label: '四光' };
  }
  if (lights.length === 3 && !hasOno) {
    return { type: YakuType.ThreeLights, points: 6, cards: [...lights], label: '三光' };
  }
  return null;
}

/** 检查短册役 */
export function checkStrips(captured: HanafudaCard[]): YakuResult[] {
  const results: YakuResult[] = [];
  const strips = captured.filter(c => c.category === CardCategory.Strip);

  // 赤短：1月 + 2月 + 3月
  const akaStrips = strips.filter(c => [Month.January, Month.February, Month.March].includes(c.month));
  if (akaStrips.length === 3) {
    results.push({ type: YakuType.RedStrips, points: 5, cards: [...akaStrips], label: '赤短' });
  }

  // 青短：6月 + 7月 + 9月
  const aoStrips = strips.filter(c => [Month.June, Month.July, Month.September].includes(c.month));
  if (aoStrips.length === 3) {
    results.push({ type: YakuType.BlueStrips, points: 5, cards: [...aoStrips], label: '青短' });
  }

  // 短册累计役（5 张起）
  if (strips.length >= 5) {
    const points = strips.length - 4;
    results.push({
      type: `strips_${strips.length}` as YakuType,
      points,
      cards: [...strips],
      label: `短册×${strips.length}`,
    });
  }

  return results;
}

/** 检查种牌役 */
export function checkSeeds(captured: HanafudaCard[]): YakuResult[] {
  const results: YakuResult[] = [];
  const seeds = captured.filter(c => c.category === CardCategory.Seed);

  // 猪鹿蝶：7月猪 + 10月鹿 + 6月蝶
  const hasBoar = seeds.some(c => c.month === Month.July);
  const hasDeer = seeds.some(c => c.month === Month.October);
  const hasButterfly = seeds.some(c => c.month === Month.June);

  if (hasBoar && hasDeer && hasButterfly) {
    const iscCards = seeds.filter(c => [Month.June, Month.July, Month.October].includes(c.month));
    results.push({ type: YakuType.BoarDeerButterfly, points: 5, cards: iscCards, label: '猪鹿蝶' });
  }

  // 种牌累计役（5 张起）
  if (seeds.length >= 5) {
    const points = seeds.length - 4;
    results.push({
      type: `seeds_${seeds.length}` as YakuType,
      points,
      cards: [...seeds],
      label: `种×${seeds.length}`,
    });
  }

  return results;
}

/** 检查カ斯役 */
export function checkWaste(captured: HanafudaCard[]): YakuResult | null {
  const wastes = captured.filter(c => c.category === CardCategory.Waste);
  if (wastes.length < 10) return null;

  const points = wastes.length - 9;
  return {
    type: `waste_${wastes.length}` as YakuType,
    points,
    cards: [...wastes],
    label: `カス×${wastes.length}`,
  };
}

/** 检查特殊役（呑み/花见酒/月见酒）— 三者互斥 */
export function checkSpecial(captured: HanafudaCard[]): YakuResult | null {
  const hasMarchLight = captured.some(c => c.category === CardCategory.Light && c.month === Month.March);
  const hasAugustLight = captured.some(c => c.category === CardCategory.Light && c.month === Month.August);
  const hasSepCup = captured.some(c => c.category === CardCategory.Seed && c.month === Month.September);

  if (hasMarchLight && hasAugustLight && hasSepCup) {
    return { type: YakuType.Nomu, points: 4, cards: [], label: '呑み' };
  }
  if (hasMarchLight && hasSepCup) {
    return { type: YakuType.FlowerSake, points: 3, cards: [], label: '花见酒' };
  }
  if (hasAugustLight && hasSepCup) {
    return { type: YakuType.MoonSake, points: 3, cards: [], label: '月见酒' };
  }
  return null;
}

/** 判定所有役 */
export function checkAllYaku(captured: HanafudaCard[]): YakuResult[] {
  const results: YakuResult[] = [];

  // 光牌役（互斥，最多一个）
  const lightResult = checkLights(captured);
  if (lightResult) results.push(lightResult);

  // 短册役（可叠加）
  results.push(...checkStrips(captured));

  // 种牌役（可叠加）
  results.push(...checkSeeds(captured));

  // カ斯役
  const wasteResult = checkWaste(captured);
  if (wasteResult) results.push(wasteResult);

  // 特殊役（互斥，最多一个）
  const specialResult = checkSpecial(captured);
  if (specialResult) results.push(specialResult);

  return results;
}
