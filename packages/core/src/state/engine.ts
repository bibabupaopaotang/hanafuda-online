/**
 * 游戏状态机 + 核心逻辑
 * 来源：design/gdd/game-state.md + design/gdd/battle.md
 * 支持：Koi-Koi（两人） + Hachi-Hachi（三人）
 */

import { ALL_CARDS, shuffleDeck } from '../cards/index.js';
import { calculateScore } from '../scoring/calculator.js';
import { checkAllYaku } from '../rules/yaku.js';
import { GamePhase, GameState, PlayerState, PlayResult, KoiKoiConfig } from './types.js';

const DEFAULT_CONFIG: KoiKoiConfig = {
  targetScore: 7,
  koiMultiplier: true,
  koiRisk: 'caller_zero',
  hanamiTsukimiMerge: true,
};

// ==================== Koi-Koi 两人模式 ====================

export function initGame(
  player0Id: string, player0Name: string,
  player1Id: string, player1Name: string,
  config: Partial<KoiKoiConfig> = {}
): GameState {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  return {
    phase: GamePhase.Lobby,
    mode: 'koi_koi',
    round: 1,
    players: [
      { id: player0Id, nickname: player0Name, isReady: true, isConnected: true, isDealer: true },
      { id: player1Id, nickname: player1Name, isReady: true, isConnected: true, isDealer: false },
    ],
    currentPlayerIndex: 0,
    deck: [],
    field: [],
    hands: [[], []],
    captured: [[], []],
    roundScores: [0, 0],
    totalScores: [0, 0],
    targetScore: cfg.targetScore,
    koiKoiCount: 0,
    koiKoiCaller: null,
    koiKoiActive: false,
    specialResult: null,
    lastActionSeq: 0,
  };
}

/** 发牌（手八の场八） */
export function deal(state: GameState): GameState {
  const deck = shuffleDeck([...ALL_CARDS]);
  const hands: number[][] = [[], []];
  const field: number[] = [];

  for (let i = 0; i < 8; i++) {
    hands[0].push(deck.pop()!.id);
    hands[1].push(deck.pop()!.id);
  }
  for (let i = 0; i < 8; i++) {
    field.push(deck.pop()!.id);
  }

  return {
    ...state,
    phase: GamePhase.Dealing,
    deck: deck.map(c => c.id),
    field,
    hands,
    captured: [[], []],
    roundScores: [0, 0],
    koiKoiCount: 0,
    koiKoiCaller: null,
    koiKoiActive: false,
    specialResult: null,
  };
}

/** 特殊开局检查 */
export function checkSpecial(state: GameState): GameState {
  const fieldMonths = state.field.map(id => ALL_CARDS[id].month);
  const fieldCounts = countOccurrences(fieldMonths);
  for (const count of Object.values(fieldCounts)) {
    if (count === 4) {
      return { ...state, phase: GamePhase.Redeal, specialResult: { type: 'field_four', winner: null, score: 0 } };
    }
  }

  const playerCount = state.players.length;
  for (let p = 0; p < playerCount; p++) {
    const handMonths = state.hands[p].map(id => ALL_CARDS[id].month);
    const handCounts = countOccurrences(handMonths);
    for (const count of Object.values(handCounts)) {
      if (count === 4) {
        return { ...state, phase: GamePhase.GameEnd, specialResult: { type: 'te_shi', winner: p, score: 6 } };
      }
    }
  }

  return { ...state, phase: GamePhase.PlayerTurn };
}

/** 玩家出牌 */
export function playCard(state: GameState, playerIndex: number, cardId: number): PlayResult {
  if (playerIndex !== state.currentPlayerIndex) throw new Error('不是当前玩家的回合');
  if (!state.hands[playerIndex].includes(cardId)) throw new Error('手牌中没有这张牌');

  const card = ALL_CARDS[cardId];
  const matched = state.field.filter(id => ALL_CARDS[id].month === card.month);

  let newCaptured = state.captured.map(a => [...a]);
  let newField: number[];
  const newHands = state.hands.map(a => [...a]);

  if (matched.length > 0) {
    newCaptured[playerIndex].push(cardId, ...matched);
    newField = state.field.filter(id => !matched.includes(id));
  } else {
    newField = [...state.field, cardId];
  }
  newHands[playerIndex] = newHands[playerIndex].filter(id => id !== cardId);

  return {
    state: {
      ...state,
      phase: GamePhase.MatchCheck,
      hands: newHands,
      field: newField,
      captured: newCaptured,
      lastActionSeq: state.lastActionSeq + 1,
    },
    yakuFound: false,
    matched: matched.length > 0,
    matchedCards: matched,
    nextPlayer: playerIndex,
  };
}

/** 翻山札 */
export function drawCard(state: GameState): PlayResult {
  if (state.deck.length === 0) {
    return { state: { ...state, phase: GamePhase.RoundEnd }, yakuFound: false, matched: false, matchedCards: [], nextPlayer: state.currentPlayerIndex };
  }

  const drawnCard = state.deck[state.deck.length - 1];
  const newDeck = state.deck.slice(0, -1);

  return {
    state: { ...state, phase: GamePhase.DrawCard, deck: newDeck, _drawnCard: drawnCard, lastActionSeq: state.lastActionSeq + 1 },
    yakuFound: false,
    matched: false,
    matchedCards: [],
    nextPlayer: state.currentPlayerIndex,
  };
}

/** 翻牌匹配 */
export function checkDrawMatch(state: GameState): PlayResult {
  const drawnCard = state._drawnCard!;
  const card = ALL_CARDS[drawnCard];
  const matched = state.field.filter(id => ALL_CARDS[id].month === card.month);

  let newCaptured = state.captured.map(a => [...a]);
  let newField: number[];
  const player = state.currentPlayerIndex;

  if (matched.length > 0) {
    newCaptured[player].push(drawnCard, ...matched);
    newField = state.field.filter(id => !matched.includes(id));
  } else {
    newField = [...state.field, drawnCard];
  }

  return {
    state: { ...state, phase: GamePhase.DrawMatch, field: newField, captured: newCaptured, lastActionSeq: state.lastActionSeq + 1 },
    yakuFound: false,
    matched: matched.length > 0,
    matchedCards: matched,
    nextPlayer: player,
  };
}

/** 役判定 */
export function checkYaku(state: GameState): PlayResult {
  const capturedIds = state.captured[state.currentPlayerIndex];
  const capturedCards = capturedIds.map(id => ALL_CARDS[id]);
  const yakuResults = checkAllYaku(capturedCards);

  if (yakuResults.length === 0) {
    return { state: { ...state, phase: GamePhase.NextPlayer }, yakuFound: false, matched: false, matchedCards: [], nextPlayer: state.currentPlayerIndex };
  }

  return {
    state: { ...state, phase: GamePhase.KoiDecision, _currentYaku: yakuResults, lastActionSeq: state.lastActionSeq + 1 },
    yakuFound: true,
    matched: false,
    matchedCards: [],
    nextPlayer: state.currentPlayerIndex,
  };
}

/** 喊 Koi */
export function callKoiKoi(state: GameState): GameState {
  return {
    ...state,
    phase: GamePhase.KoiActive,
    koiKoiCount: state.koiKoiCount + 1,
    koiKoiCaller: state.currentPlayerIndex,
    koiKoiActive: true,
    lastActionSeq: state.lastActionSeq + 1,
  };
}

/** 结束本局 */
export function endRound(state: GameState): GameState {
  const player = state.currentPlayerIndex;
  const capturedCards = state.captured[player].map(id => ALL_CARDS[id]);

  const scoreResult = calculateScore(
    capturedCards,
    state.koiKoiCount,
    state.koiKoiCaller === player,
    true
  );

  const newTotalScores = [...state.totalScores];
  newTotalScores[player] += scoreResult.finalScore;

  if (state.koiKoiCaller !== null && state.koiKoiCaller !== player) {
    // 喊 Koi 的人输了 → 0 分（已不加）
  }

  const winner = newTotalScores.findIndex(s => s >= state.targetScore);

  return {
    ...state,
    phase: winner >= 0 ? GamePhase.GameEnd : GamePhase.RoundEnd,
    roundScores: [player === 0 ? scoreResult.finalScore : 0, player === 1 ? scoreResult.finalScore : 0],
    totalScores: newTotalScores,
    lastActionSeq: state.lastActionSeq + 1,
  };
}

/** 换人（含手牌补充） */
export function nextPlayer(state: GameState): GameState {
  const playerCount = state.players.length;

  // 检查是否所有玩家手牌都为空
  const allEmpty = state.players.every((_, i) => state.hands[i].length === 0);

  if (allEmpty) {
    if (state.deck.length === 0) {
      // 山札也空 → 回合结束
      return { ...state, phase: GamePhase.RoundEnd };
    }

    // 山札有牌 → 补充手牌，平均分配
    const newHands = state.hands.map(() => [] as number[]);
    const newDeck = [...state.deck];
    const perPlayer = Math.min(8, Math.floor(newDeck.length / playerCount));

    for (let i = 0; i < playerCount; i++) {
      for (let j = 0; j < perPlayer; j++) {
        newHands[i].push(newDeck.pop()!);
      }
    }

    return {
      ...state,
      phase: GamePhase.PlayerTurn,
      currentPlayerIndex: 0, // 重新从亲家开始
      hands: newHands,
      deck: newDeck,
      lastActionSeq: state.lastActionSeq + 1,
    };
  }

  const nextIndex = (state.currentPlayerIndex + 1) % playerCount;
  return {
    ...state,
    phase: GamePhase.PlayerTurn,
    currentPlayerIndex: nextIndex,
    lastActionSeq: state.lastActionSeq + 1,
  };
}

// ==================== Hachi-Hachi 三人模式 ====================

export function initHachiHachi(
  p0Id: string, p0Name: string,
  p1Id: string, p1Name: string,
  p2Id: string, p2Name: string,
  targetScore = 30
): GameState {
  return {
    phase: GamePhase.Lobby,
    mode: 'hachi_hachi',
    round: 1,
    players: [
      { id: p0Id, nickname: p0Name, isReady: true, isConnected: true, isDealer: true },
      { id: p1Id, nickname: p1Name, isReady: true, isConnected: true, isDealer: false },
      { id: p2Id, nickname: p2Name, isReady: true, isConnected: true, isDealer: false },
    ],
    currentPlayerIndex: 0,
    deck: [],
    field: [],
    hands: [[], [], []],
    captured: [[], [], []],
    roundScores: [0, 0, 0],
    totalScores: [0, 0, 0],
    targetScore,
    koiKoiCount: 0,
    koiKoiCaller: null,
    koiKoiActive: false,
    specialResult: null,
    lastActionSeq: 0,
  };
}

/** Hachi-Hachi 发牌：亲 9→弃1 + 两家各 8 + 场 8 + 山 16 */
export function dealHachiHachi(state: GameState): GameState {
  const deck = shuffleDeck([...ALL_CARDS]);
  const hands: number[][] = [[], [], []];
  const field: number[] = [];

  // 亲先拿 9 张
  for (let i = 0; i < 9; i++) hands[0].push(deck.pop()!.id);
  // 子 B 8 张
  for (let i = 0; i < 8; i++) hands[1].push(deck.pop()!.id);
  // 子 C 8 张
  for (let i = 0; i < 8; i++) hands[2].push(deck.pop()!.id);
  // 场牌 8 张
  for (let i = 0; i < 8; i++) field.push(deck.pop()!.id);

  // 亲弃 1 张到场（MVP 简化：自动弃最后一张）
  field.push(hands[0].pop()!);

  return {
    ...state,
    phase: GamePhase.Dealing,
    deck: deck.map(c => c.id),
    field,
    hands,
    captured: [[], [], []],
    roundScores: [0, 0, 0],
    koiKoiCount: 0,
    koiKoiCaller: null,
    koiKoiActive: false,
    specialResult: null,
  };
}

/** Hachi-Hachi 特殊开局检查（手四得 4 分，局继续） */
export function checkSpecialHachiHachi(state: GameState): GameState {
  const fieldMonths = state.field.map(id => ALL_CARDS[id].month);
  const fieldCounts = countOccurrences(fieldMonths);
  for (const count of Object.values(fieldCounts)) {
    if (count === 4) {
      return { ...state, phase: GamePhase.Redeal, specialResult: { type: 'field_four', winner: null, score: 0 } };
    }
  }

  const playerCount = state.players.length;
  for (let p = 0; p < playerCount; p++) {
    const handMonths = state.hands[p].map(id => ALL_CARDS[id].month);
    const handCounts = countOccurrences(handMonths);
    for (const count of Object.values(handCounts)) {
      if (count === 4) {
        state.totalScores[p] += 4;
        return { ...state, phase: GamePhase.PlayerTurn, specialResult: { type: 'te_shi', winner: p, score: 4 } };
      }
    }
  }

  return { ...state, phase: GamePhase.PlayerTurn };
}

/** Hachi-Hachi 役判定（无 Koi，山札耗尽后结算） */
export function checkYakuHachiHachi(state: GameState): PlayResult {
  const player = state.currentPlayerIndex;
  const capturedIds = state.captured[player];
  const capturedCards = capturedIds.map(id => ALL_CARDS[id]);
  const yakuResults = checkAllYaku(capturedCards);

  // 手牌耗尽 + 山札耗尽 → 结算
  if (state.hands[player].length === 0 && state.deck.length === 0) {
    return { state: { ...state, phase: GamePhase.RoundEnd, _currentYaku: yakuResults }, yakuFound: true, matched: false, matchedCards: [], nextPlayer: player };
  }

  return { state: { ...state, phase: GamePhase.NextPlayer }, yakuFound: false, matched: false, matchedCards: [], nextPlayer: player };
}

/** Hachi-Hachi 结算（山札耗尽后三方同时结算） */
export function endRoundHachiHachi(state: GameState): GameState {
  const playerCount = state.players.length;
  const newTotalScores = [...state.totalScores];
  const roundScores = new Array(playerCount).fill(0);

  for (let p = 0; p < playerCount; p++) {
    const capturedCards = state.captured[p].map(id => ALL_CARDS[id]);
    const yakuResults = checkAllYaku(capturedCards);
    const score = yakuResults.reduce((sum, y) => sum + y.points, 0);
    roundScores[p] = score;
    newTotalScores[p] += score;
  }

  const winner = newTotalScores.findIndex(s => s >= state.targetScore);

  return {
    ...state,
    phase: winner >= 0 ? GamePhase.GameEnd : GamePhase.RoundEnd,
    roundScores,
    totalScores: newTotalScores,
    lastActionSeq: state.lastActionSeq + 1,
  };
}

// ==================== 辅助 ====================

function countOccurrences(arr: number[]): Record<number, number> {
  const map: Record<number, number> = {};
  for (const v of arr) map[v] = (map[v] || 0) + 1;
  return map;
}

export function serializeState(state: GameState): Omit<GameState, '_drawnCard' | '_currentYaku'> {
  const { _drawnCard, _currentYaku, ...rest } = state;
  return rest;
}
