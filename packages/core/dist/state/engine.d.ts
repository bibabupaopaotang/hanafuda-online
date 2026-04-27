/**
 * 游戏状态机 + 核心逻辑
 * 来源：design/gdd/game-state.md (v0.1) + design/gdd/battle.md (v0.1)
 */
import { GameState, PlayResult, KoiKoiConfig } from './types.js';
/** 初始化游戏 */
export declare function initGame(player0Id: string, player0Name: string, player1Id: string, player1Name: string, config?: Partial<KoiKoiConfig>): GameState;
/** 发牌（手八の场八） */
export declare function deal(state: GameState): GameState;
/** 特殊开局检查 */
export declare function checkSpecial(state: GameState): GameState;
/** 玩家出牌 */
export declare function playCard(state: GameState, playerIndex: number, cardId: number): PlayResult;
/** 翻山札 */
export declare function drawCard(state: GameState): PlayResult;
/** 翻牌匹配 */
export declare function checkDrawMatch(state: GameState): PlayResult;
/** 役判定 */
export declare function checkYaku(state: GameState): PlayResult;
/** 喊 Koi */
export declare function callKoiKoi(state: GameState): GameState;
/** 结束本局 */
export declare function endRound(state: GameState): GameState;
/** 换人 */
export declare function nextPlayer(state: GameState): GameState;
/** 序列化状态（用于网络传输/重连） */
export declare function serializeState(state: GameState): Omit<GameState, '_drawnCard' | '_currentYaku'>;
