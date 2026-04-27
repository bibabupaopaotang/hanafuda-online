/**
 * 牌面数据 — 48 张花札牌的完整定义
 * 来源：design/gdd/card-data.md (v1.0)
 * 校验：光5 + 种9 + 短册10 + カス24 = 48 ✓
 */

import { CardCategory, HanafudaCard, HanafudaDeck, Month } from './types.js';

export const ALL_CARDS: HanafudaCard[] = [
  // === 1月 松 ===
  { id: 0,  month: 1, category: CardCategory.Light,  name: '松に鶴',       pointLabel: 20 },
  { id: 1,  month: 1, category: CardCategory.Strip,  name: '赤短(松)',     pointLabel: 5  },
  { id: 2,  month: 1, category: CardCategory.Seed,   name: '松に小鳥',     pointLabel: 10 },
  { id: 3,  month: 1, category: CardCategory.Waste,  name: '松のみ',       pointLabel: 1  },

  // === 2月 梅 ===
  { id: 4,  month: 2, category: CardCategory.Seed,   name: '梅に鴬',       pointLabel: 10 },
  { id: 5,  month: 2, category: CardCategory.Strip,  name: '赤短(梅)',     pointLabel: 5  },
  { id: 6,  month: 2, category: CardCategory.Waste,  name: '梅のみ',       pointLabel: 1  },
  { id: 7,  month: 2, category: CardCategory.Waste,  name: '梅のみ',       pointLabel: 1  },

  // === 3月 桜 ===
  { id: 8,  month: 3, category: CardCategory.Light,  name: '桜に幕',       pointLabel: 20 },
  { id: 9,  month: 3, category: CardCategory.Strip,  name: '赤短(桜)',     pointLabel: 5  },
  { id: 10, month: 3, category: CardCategory.Waste,  name: '桜のみ',       pointLabel: 1  },
  { id: 11, month: 3, category: CardCategory.Waste,  name: '桜のみ',       pointLabel: 1  },

  // === 4月 藤 ===
  { id: 12, month: 4, category: CardCategory.Strip,  name: '紫短(藤)',     pointLabel: 5  },
  { id: 13, month: 4, category: CardCategory.Seed,   name: '藤に燕',       pointLabel: 10 },
  { id: 14, month: 4, category: CardCategory.Waste,  name: '藤のみ',       pointLabel: 1  },
  { id: 15, month: 4, category: CardCategory.Waste,  name: '藤のみ',       pointLabel: 1  },

  // === 5月 菖蒲 ===
  { id: 16, month: 5, category: CardCategory.Strip,  name: '青短(菖蒲)',   pointLabel: 5  },
  { id: 17, month: 5, category: CardCategory.Seed,   name: '菖蒲に八橋',   pointLabel: 10 },
  { id: 18, month: 5, category: CardCategory.Waste,  name: '菖蒲のみ',     pointLabel: 1  },
  { id: 19, month: 5, category: CardCategory.Waste,  name: '菖蒲のみ',     pointLabel: 1  },

  // === 6月 牡丹 ===
  { id: 20, month: 6, category: CardCategory.Strip,  name: '青短(牡丹)',   pointLabel: 5  },
  { id: 21, month: 6, category: CardCategory.Seed,   name: '牡丹に蝶',     pointLabel: 10 },
  { id: 22, month: 6, category: CardCategory.Waste,  name: '牡丹のみ',     pointLabel: 1  },
  { id: 23, month: 6, category: CardCategory.Waste,  name: '牡丹のみ',     pointLabel: 1  },

  // === 7月 萩 ===
  { id: 24, month: 7, category: CardCategory.Strip,  name: '青短(萩)',     pointLabel: 5  },
  { id: 25, month: 7, category: CardCategory.Seed,   name: '萩に猪',       pointLabel: 10 },
  { id: 26, month: 7, category: CardCategory.Waste,  name: '萩のみ',       pointLabel: 1  },
  { id: 27, month: 7, category: CardCategory.Waste,  name: '萩のみ',       pointLabel: 1  },

  // === 8月 芒 ===
  { id: 28, month: 8, category: CardCategory.Light,  name: '芒に月',       pointLabel: 20 },
  { id: 29, month: 8, category: CardCategory.Strip,  name: '青短(芒)',     pointLabel: 5  },
  { id: 30, month: 8, category: CardCategory.Seed,   name: '芒に雁',       pointLabel: 10 },
  { id: 31, month: 8, category: CardCategory.Waste,  name: '芒のみ',       pointLabel: 1  },

  // === 9月 菊 ===
  { id: 32, month: 9, category: CardCategory.Strip,  name: '青短(菊)',     pointLabel: 5  },
  { id: 33, month: 9, category: CardCategory.Seed,   name: '菊に盃',       pointLabel: 10 },
  { id: 34, month: 9, category: CardCategory.Waste,  name: '菊のみ',       pointLabel: 1  },
  { id: 35, month: 9, category: CardCategory.Waste,  name: '菊のみ',       pointLabel: 1  },

  // === 10月 紅葉 ===
  { id: 36, month: 10, category: CardCategory.Strip, name: '青短(楓)',     pointLabel: 5  },
  { id: 37, month: 10, category: CardCategory.Seed,  name: '紅葉に鹿',     pointLabel: 10 },
  { id: 38, month: 10, category: CardCategory.Waste, name: '紅葉のみ',     pointLabel: 1  },
  { id: 39, month: 10, category: CardCategory.Waste, name: '紅葉のみ',     pointLabel: 1  },

  // === 11月 柳 ===
  { id: 40, month: 11, category: CardCategory.Light, name: '柳に小野道風', pointLabel: 20 },
  { id: 41, month: 11, category: CardCategory.Waste, name: '柳に雨',       pointLabel: 1  },
  { id: 42, month: 11, category: CardCategory.Waste, name: '柳のみ',       pointLabel: 1  },
  { id: 43, month: 11, category: CardCategory.Waste, name: '柳のみ',       pointLabel: 1  },

  // === 12月 桐 ===
  { id: 44, month: 12, category: CardCategory.Light, name: '桐に鳳凰',     pointLabel: 20 },
  { id: 45, month: 12, category: CardCategory.Waste, name: '桐のみ',       pointLabel: 1  },
  { id: 46, month: 12, category: CardCategory.Waste, name: '桐のみ',       pointLabel: 1  },
  { id: 47, month: 12, category: CardCategory.Waste, name: '桐のみ',       pointLabel: 1  },
];

/** 获取牌的浅拷贝 */
export function getCard(id: number): HanafudaCard {
  const card = ALL_CARDS[id];
  if (!card) throw new Error(`Card id ${id} not found`);
  return { ...card };
}

/** 获取完整牌组的浅拷贝 */
export function createFullDeck(): HanafudaDeck {
  return ALL_CARDS.map(c => ({ ...c }));
}

/** Fisher-Yates 洗牌 */
export function shuffleDeck(deck: HanafudaDeck): HanafudaDeck {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** 按月份分组 */
export function groupByMonth(cards: HanafudaCard[]): Map<number, HanafudaCard[]> {
  const map = new Map<number, HanafudaCard[]>();
  for (const card of cards) {
    if (!map.has(card.month)) map.set(card.month, []);
    map.get(card.month)!.push(card);
  }
  return map;
}

/** 按类别分组 */
export function groupByCategory(cards: HanafudaCard[]): Map<CardCategory, HanafudaCard[]> {
  const map = new Map<CardCategory, HanafudaCard[]>();
  for (const card of cards) {
    if (!map.has(card.category)) map.set(card.category, []);
    map.get(card.category)!.push(card);
  }
  return map;
}

/** 统计类别数量 */
export function countByCategory(cards: HanafudaCard[]): {
  light: number; seed: number; strip: number; waste: number;
} {
  const result = { light: 0, seed: 0, strip: 0, waste: 0 };
  for (const card of cards) {
    switch (card.category) {
      case CardCategory.Light: result.light++; break;
      case CardCategory.Seed: result.seed++; break;
      case CardCategory.Strip: result.strip++; break;
      case CardCategory.Waste: result.waste++; break;
    }
  }
  return result;
}

/** 校验牌组完整性 */
export function validateDeck(deck: HanafudaDeck): string[] {
  const errors: string[] = [];

  if (deck.length !== 48) {
    errors.push(`牌组应有 48 张，实际 ${deck.length} 张`);
  }

  const ids = deck.map(c => c.id).sort((a, b) => a - b);
  for (let i = 0; i < 48; i++) {
    if (ids[i] !== i) {
      errors.push(`缺少或重复牌 ID: 期望 ${i}，实际 ${ids[i]}`);
      break;
    }
  }

  // 每月恰好 4 张
  const byMonth = groupByMonth(deck);
  for (let m = 1; m <= 12; m++) {
    const monthCards = byMonth.get(m) || [];
    if (monthCards.length !== 4) {
      errors.push(`${m}月应有 4 张牌，实际 ${monthCards.length} 张`);
    }
  }

  // 类别统计
  const counts = countByCategory(deck);
  if (counts.light !== 5) errors.push(`光牌应为 5 张，实际 ${counts.light} 张`);
  if (counts.seed !== 9) errors.push(`种牌应为 9 张，实际 ${counts.seed} 张`);
  if (counts.strip !== 10) errors.push(`短册应为 10 张，实际 ${counts.strip} 张`);
  if (counts.waste !== 24) errors.push(`カス应为 24 张，实际 ${counts.waste} 张`);

  return errors;
}
