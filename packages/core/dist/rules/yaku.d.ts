/**
 * 役判定引擎
 * 来源：design/gdd/rule-engine.md (v1.0) + design/gdd/scoring.md (v0.1)
 * 已确认：
 *   - 赤短 = [1,2,3]月短册
 *   - 青短 = [6,7,9]月短册
 *   - 呑み/花见酒/月见酒 互斥
 *   - 猪鹿蝶 = 6月蝶 + 7月猪 + 10月鹿
 */
import { HanafudaCard } from '../cards/types.js';
import { YakuResult } from './types.js';
/** 检查光牌役 */
export declare function checkLights(captured: HanafudaCard[]): YakuResult | null;
/** 检查短册役 */
export declare function checkStrips(captured: HanafudaCard[]): YakuResult[];
/** 检查种牌役 */
export declare function checkSeeds(captured: HanafudaCard[]): YakuResult[];
/** 检查カ斯役 */
export declare function checkWaste(captured: HanafudaCard[]): YakuResult | null;
/** 检查特殊役（呑み/花见酒/月见酒）— 三者互斥 */
export declare function checkSpecial(captured: HanafudaCard[]): YakuResult | null;
/** 判定所有役 */
export declare function checkAllYaku(captured: HanafudaCard[]): YakuResult[];
