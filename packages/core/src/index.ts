// @hanafuda/core — 统一导出
export { CardCategory, Month } from './cards/index.js';
export type { HanafudaCard, HanafudaDeck } from './cards/index.js';
export { ALL_CARDS, getCard, createFullDeck, shuffleDeck, groupByMonth, groupByCategory, countByCategory, validateDeck } from './cards/index.js';

export { YakuType } from './rules/types.js';
export type { YakuResult, ScoreResult } from './rules/types.js';
export { checkAllYaku, checkLights, checkStrips, checkSeeds, checkWaste, checkSpecial as checkSpecialYaku } from './rules/yaku.js';

export { calculateScore, formatScoreResult } from './scoring/calculator.js';

export { GamePhase } from './state/types.js';
export type { GameState, PlayerState, KoiKoiConfig, PlayResult } from './state/types.js';
export { initGame, deal, checkSpecial, playCard, drawCard, checkDrawMatch, checkYaku, callKoiKoi, endRound, nextPlayer, serializeState } from './state/engine.js';
export { initHachiHachi, dealHachiHachi, checkSpecialHachiHachi, checkYakuHachiHachi, endRoundHachiHachi } from './state/engine.js';
