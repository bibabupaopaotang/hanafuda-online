/**
 * 牌面数据 — 48 张花札牌的完整定义
 * 来源：design/gdd/card-data.md (v1.0)
 * 校验：光5 + 种9 + 短册10 + カス24 = 48 ✓
 */
import { CardCategory, HanafudaCard, HanafudaDeck } from './types.js';
export declare const ALL_CARDS: HanafudaCard[];
/** 获取牌的浅拷贝 */
export declare function getCard(id: number): HanafudaCard;
/** 获取完整牌组的浅拷贝 */
export declare function createFullDeck(): HanafudaDeck;
/** Fisher-Yates 洗牌 */
export declare function shuffleDeck(deck: HanafudaDeck): HanafudaDeck;
/** 按月份分组 */
export declare function groupByMonth(cards: HanafudaCard[]): Map<number, HanafudaCard[]>;
/** 按类别分组 */
export declare function groupByCategory(cards: HanafudaCard[]): Map<CardCategory, HanafudaCard[]>;
/** 统计类别数量 */
export declare function countByCategory(cards: HanafudaCard[]): {
    light: number;
    seed: number;
    strip: number;
    waste: number;
};
/** 校验牌组完整性 */
export declare function validateDeck(deck: HanafudaDeck): string[];
