"use strict";
/**
 * 计分系统
 * 来源：design/gdd/scoring.md (v0.1)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateScore = calculateScore;
exports.formatScoreResult = formatScoreResult;
const yaku_js_1 = require("../rules/yaku.js");
/**
 * 计算得分
 * @param captured 玩家收集的牌
 * @param koiCount Koi 次数
 * @param isKoiCaller 是否为喊 Koi 的玩家
 * @param isWinner 是否为赢家（先结束的一方）
 */
function calculateScore(captured, koiCount, isKoiCaller, isWinner) {
    // 1. 判定所有役
    const yakuList = (0, yaku_js_1.checkAllYaku)(captured);
    // 2. 基础分 = 所有役分数叠加
    const baseScore = yakuList.reduce((sum, y) => sum + y.points, 0);
    // 3. Koi 翻倍（仅当喊 Koi 的人赢了才翻倍）
    let koiMultiplier = 1;
    let finalScore = baseScore;
    if (koiCount > 0 && isKoiCaller && isWinner) {
        koiMultiplier = Math.pow(2, koiCount);
        finalScore = baseScore * koiMultiplier;
    }
    // 喊 Koi 的人输了 → 得 0 分
    if (koiCount > 0 && isKoiCaller && !isWinner) {
        finalScore = 0;
    }
    return {
        baseScore,
        yakuList,
        koiCount,
        koiMultiplier,
        finalScore,
        isKoiCallerWinner: isKoiCaller && isWinner,
    };
}
/** 格式化计分结果（用于 UI 展示） */
function formatScoreResult(result) {
    const lines = result.yakuList.map(y => `  ${y.label} × ${y.points}`);
    return [
        '=== 结算 ===',
        ...lines,
        '',
        `基础分: ${result.baseScore}`,
        `Koi 次数: ${result.koiCount}`,
        `翻倍: ×${result.koiMultiplier}`,
        `─────────────`,
        `最终得分: ${result.finalScore}`,
    ].join('\n');
}
