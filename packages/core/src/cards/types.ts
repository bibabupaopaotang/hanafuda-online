// ============================================================
// 牌面数据系统 — 类型定义
// 来源：design/gdd/card-data.md (v1.0)
// ============================================================

/** 牌类别 */
export enum CardCategory {
  Light = 'hikari',   // 光 (5张)
  Seed = 'tane',      // 种 (9张)
  Strip = 'tanzaku',  // 短册 (10张)
  Waste = 'kasu',     // カス (24张)
}

/** 月份/花名映射 */
export enum Month {
  January   = 1,   // 松 (Matsu)
  February  = 2,   // 梅 (Ume)
  March     = 3,   // 桜 (Sakura)
  April     = 4,   // 藤 (Fuji)
  May       = 5,   // 菖蒲 (Ayame)
  June      = 6,   // 牡丹 (Botan)
  July      = 7,   // 萩 (Hagi)
  August    = 8,   // 芒 (Susuki)
  September = 9,   // 菊 (Kiku)
  October   = 10,  // 紅葉 (Momiji)
  November  = 11,  // 柳 (Yanagi)
  December  = 12,  // 桐 (Kiri)
}

/** 花札牌 */
export interface HanafudaCard {
  id: number;           // 唯一ID (0-47)
  month: Month;         // 月份 (1-12)
  category: CardCategory; // 类别
  name: string;         // 牌面名称（日文）
  pointLabel: number;   // 分值标签 (20/10/5/1)
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
