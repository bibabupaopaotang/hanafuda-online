/**
 * 计分系统
 * 来源：design/gdd/scoring.md (v0.1)
 */
import { HanafudaCard } from '../cards/types.js';
import { ScoreResult } from '../rules/types.js';
/**
 * 计算得分
 * @param captured 玩家收集的牌
 * @param koiCount Koi 次数
 * @param isKoiCaller 是否为喊 Koi 的玩家
 * @param isWinner 是否为赢家（先结束的一方）
 */
export declare function calculateScore(captured: HanafudaCard[], koiCount: number, isKoiCaller: boolean, isWinner: boolean): ScoreResult;
/** 格式化计分结果（用于 UI 展示） */
export declare function formatScoreResult(result: ScoreResult): string;
