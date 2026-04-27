"use strict";
/**
 * 役判定引擎
 * 来源：design/gdd/rule-engine.md (v1.0) + design/gdd/scoring.md (v0.1)
 * 已确认：
 *   - 赤短 = [1,2,3]月短册
 *   - 青短 = [6,7,9]月短册
 *   - 呑み/花见酒/月见酒 互斥
 *   - 猪鹿蝶 = 6月蝶 + 7月猪 + 10月鹿
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkLights = checkLights;
exports.checkStrips = checkStrips;
exports.checkSeeds = checkSeeds;
exports.checkWaste = checkWaste;
exports.checkSpecial = checkSpecial;
exports.checkAllYaku = checkAllYaku;
const types_js_1 = require("../cards/types.js");
const types_js_2 = require("./types.js");
/** 检查光牌役 */
function checkLights(captured) {
    const lights = captured.filter(c => c.category === types_js_1.CardCategory.Light);
    const hasOno = lights.some(c => c.month === types_js_1.Month.November);
    if (lights.length === 5) {
        return { type: types_js_2.YakuType.FiveLights, points: 10, cards: [...lights], label: '五光' };
    }
    if (lights.length === 4) {
        if (hasOno) {
            return { type: types_js_2.YakuType.RainFourLights, points: 7, cards: [...lights], label: '雨四光' };
        }
        return { type: types_js_2.YakuType.FourLights, points: 8, cards: [...lights], label: '四光' };
    }
    if (lights.length === 3 && !hasOno) {
        return { type: types_js_2.YakuType.ThreeLights, points: 6, cards: [...lights], label: '三光' };
    }
    return null;
}
/** 检查短册役 */
function checkStrips(captured) {
    const results = [];
    const strips = captured.filter(c => c.category === types_js_1.CardCategory.Strip);
    // 赤短：1月 + 2月 + 3月
    const akaStrips = strips.filter(c => [types_js_1.Month.January, types_js_1.Month.February, types_js_1.Month.March].includes(c.month));
    if (akaStrips.length === 3) {
        results.push({ type: types_js_2.YakuType.RedStrips, points: 5, cards: [...akaStrips], label: '赤短' });
    }
    // 青短：6月 + 7月 + 9月
    const aoStrips = strips.filter(c => [types_js_1.Month.June, types_js_1.Month.July, types_js_1.Month.September].includes(c.month));
    if (aoStrips.length === 3) {
        results.push({ type: types_js_2.YakuType.BlueStrips, points: 5, cards: [...aoStrips], label: '青短' });
    }
    // 短册累计役（5 张起）
    if (strips.length >= 5) {
        const points = strips.length - 4;
        results.push({
            type: `strips_${strips.length}`,
            points,
            cards: [...strips],
            label: `短册×${strips.length}`,
        });
    }
    return results;
}
/** 检查种牌役 */
function checkSeeds(captured) {
    const results = [];
    const seeds = captured.filter(c => c.category === types_js_1.CardCategory.Seed);
    // 猪鹿蝶：7月猪 + 10月鹿 + 6月蝶
    const hasBoar = seeds.some(c => c.month === types_js_1.Month.July);
    const hasDeer = seeds.some(c => c.month === types_js_1.Month.October);
    const hasButterfly = seeds.some(c => c.month === types_js_1.Month.June);
    if (hasBoar && hasDeer && hasButterfly) {
        const iscCards = seeds.filter(c => [types_js_1.Month.June, types_js_1.Month.July, types_js_1.Month.October].includes(c.month));
        results.push({ type: types_js_2.YakuType.BoarDeerButterfly, points: 5, cards: iscCards, label: '猪鹿蝶' });
    }
    // 种牌累计役（5 张起）
    if (seeds.length >= 5) {
        const points = seeds.length - 4;
        results.push({
            type: `seeds_${seeds.length}`,
            points,
            cards: [...seeds],
            label: `种×${seeds.length}`,
        });
    }
    return results;
}
/** 检查カ斯役 */
function checkWaste(captured) {
    const wastes = captured.filter(c => c.category === types_js_1.CardCategory.Waste);
    if (wastes.length < 10)
        return null;
    const points = wastes.length - 9;
    return {
        type: `waste_${wastes.length}`,
        points,
        cards: [...wastes],
        label: `カス×${wastes.length}`,
    };
}
/** 检查特殊役（呑み/花见酒/月见酒）— 三者互斥 */
function checkSpecial(captured) {
    const hasMarchLight = captured.some(c => c.category === types_js_1.CardCategory.Light && c.month === types_js_1.Month.March);
    const hasAugustLight = captured.some(c => c.category === types_js_1.CardCategory.Light && c.month === types_js_1.Month.August);
    const hasSepCup = captured.some(c => c.category === types_js_1.CardCategory.Seed && c.month === types_js_1.Month.September);
    if (hasMarchLight && hasAugustLight && hasSepCup) {
        return { type: types_js_2.YakuType.Nomu, points: 4, cards: [], label: '呑み' };
    }
    if (hasMarchLight && hasSepCup) {
        return { type: types_js_2.YakuType.FlowerSake, points: 3, cards: [], label: '花见酒' };
    }
    if (hasAugustLight && hasSepCup) {
        return { type: types_js_2.YakuType.MoonSake, points: 3, cards: [], label: '月见酒' };
    }
    return null;
}
/** 判定所有役 */
function checkAllYaku(captured) {
    const results = [];
    // 光牌役（互斥，最多一个）
    const lightResult = checkLights(captured);
    if (lightResult)
        results.push(lightResult);
    // 短册役（可叠加）
    results.push(...checkStrips(captured));
    // 种牌役（可叠加）
    results.push(...checkSeeds(captured));
    // カ斯役
    const wasteResult = checkWaste(captured);
    if (wasteResult)
        results.push(wasteResult);
    // 特殊役（互斥，最多一个）
    const specialResult = checkSpecial(captured);
    if (specialResult)
        results.push(specialResult);
    return results;
}
