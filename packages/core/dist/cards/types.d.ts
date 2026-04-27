/** 牌类别 */
export declare enum CardCategory {
    Light = "hikari",// 光 (5张)
    Seed = "tane",// 种 (9张)
    Strip = "tanzaku",// 短册 (10张)
    Waste = "kasu"
}
/** 月份/花名映射 */
export declare enum Month {
    January = 1,// 松 (Matsu)
    February = 2,// 梅 (Ume)
    March = 3,// 桜 (Sakura)
    April = 4,// 藤 (Fuji)
    May = 5,// 菖蒲 (Ayame)
    June = 6,// 牡丹 (Botan)
    July = 7,// 萩 (Hagi)
    August = 8,// 芒 (Susuki)
    September = 9,// 菊 (Kiku)
    October = 10,// 紅葉 (Momiji)
    November = 11,// 柳 (Yanagi)
    December = 12
}
/** 花札牌 */
export interface HanafudaCard {
    id: number;
    month: Month;
    category: CardCategory;
    name: string;
    pointLabel: number;
}
/** 完整牌组（48张） */
export type HanafudaDeck = HanafudaCard[];
/** 类别统计 */
export interface CategoryCount {
    light: number;
    seed: number;
    strip: number;
    waste: number;
}
