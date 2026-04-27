import { describe, it, expect } from 'vitest';
import {
  ALL_CARDS, createFullDeck, shuffleDeck, validateDeck,
  countByCategory, CardCategory, Month,
  checkAllYaku, YakuType, calculateScore,
  initGame, deal, checkSpecial, playCard, drawCard,
  checkDrawMatch, checkYaku, callKoiKoi, endRound, nextPlayer,
  GamePhase,
} from '../src/index.js';

describe('牌组数据', () => {
  it('48 张牌', () => {
    expect(ALL_CARDS.length).toBe(48);
  });

  it('validateDeck 通过', () => {
    const errors = validateDeck(ALL_CARDS);
    expect(errors).toEqual([]);
  });

  it('类别统计正确', () => {
    const c = countByCategory(ALL_CARDS);
    expect(c.light).toBe(5);
    expect(c.seed).toBe(9);
    expect(c.strip).toBe(10);
    expect(c.waste).toBe(24);
  });

  it('洗牌后仍然是 48 张', () => {
    const deck = shuffleDeck(createFullDeck());
    expect(deck.length).toBe(48);
    expect(validateDeck(deck)).toEqual([]);
  });
});

describe('役判定', () => {
  it('五光', () => {
    const cards = ALL_CARDS.filter(c => c.category === CardCategory.Light);
    const yaku = checkAllYaku(cards);
    expect(yaku.some(y => y.type === YakuType.FiveLights)).toBe(true);
  });

  it('赤短', () => {
    const cards = ALL_CARDS.filter(c => c.category === CardCategory.Strip && [1, 2, 3].includes(c.month));
    const yaku = checkAllYaku(cards);
    expect(yaku.some(y => y.type === YakuType.RedStrips)).toBe(true);
  });

  it('青短', () => {
    const cards = ALL_CARDS.filter(c => c.category === CardCategory.Strip && [6, 7, 9].includes(c.month));
    const yaku = checkAllYaku(cards);
    expect(yaku.some(y => y.type === YakuType.BlueStrips)).toBe(true);
  });

  it('猪鹿蝶', () => {
    const cards = ALL_CARDS.filter(c => c.category === CardCategory.Seed && [6, 7, 10].includes(c.month));
    const yaku = checkAllYaku(cards);
    expect(yaku.some(y => y.type === YakuType.BoarDeerButterfly)).toBe(true);
  });

  it('呑み（含 3月光+8月光+9月杯）', () => {
    const marchLight = ALL_CARDS.find(c => c.category === CardCategory.Light && c.month === 3)!;
    const augLight = ALL_CARDS.find(c => c.category === CardCategory.Light && c.month === 8)!;
    const sepCup = ALL_CARDS.find(c => c.category === CardCategory.Seed && c.month === 9)!;
    const yaku = checkAllYaku([marchLight, augLight, sepCup]);
    expect(yaku.some(y => y.type === YakuType.Nomu)).toBe(true);
  });
});

describe('计分', () => {
  it('无 Koi 基础分', () => {
    const lights = ALL_CARDS.filter(c => c.category === CardCategory.Light);
    const result = calculateScore(lights, 0, false, true);
    expect(result.baseScore).toBe(10); // 五光
    expect(result.finalScore).toBe(10);
  });

  it('Koi 翻倍', () => {
    const lights = ALL_CARDS.filter(c => c.category === CardCategory.Light);
    const result = calculateScore(lights, 1, true, true);
    expect(result.koiMultiplier).toBe(2);
    expect(result.finalScore).toBe(20);
  });

  it('Koi 输了得 0 分', () => {
    const lights = ALL_CARDS.filter(c => c.category === CardCategory.Light);
    const result = calculateScore(lights, 1, true, false);
    expect(result.finalScore).toBe(0);
  });
});

describe('游戏流程', () => {
  it('初始化 + 发牌', () => {
    const state = initGame('p0', 'Player0', 'p1', 'Player1');
    expect(state.phase).toBe(GamePhase.Lobby);

    const dealt = deal(state);
    expect(dealt.hands[0].length).toBe(8);
    expect(dealt.hands[1].length).toBe(8);
    expect(dealt.field.length).toBe(8);
    expect(dealt.deck.length).toBe(24);
  });
});
