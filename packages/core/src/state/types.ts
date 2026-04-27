/**
 * 游戏状态管理 — 类型定义
 * 来源：design/gdd/game-state.md (v0.1) + design/gdd/battle.md (v0.1)
 */

import { HanafudaCard } from '../cards/types.js';

export enum GamePhase {
  Lobby = 'lobby',
  Dealing = 'dealing',
  CheckSpecial = 'check_special',
  Redeal = 'redeal',
  PlayerTurn = 'player_turn',
  MatchCheck = 'match_check',
  DrawCard = 'draw_card',
  DrawMatch = 'draw_match',
  YakuCheck = 'yaku_check',
  KoiDecision = 'koi_decision',
  KoiActive = 'koi_active',
  NextPlayer = 'next_player',
  RoundEnd = 'round_end',
  GameEnd = 'game_end',
}

export interface PlayerState {
  id: string;
  nickname: string;
  isReady: boolean;
  isConnected: boolean;
  isDealer: boolean;
}

export interface GameState {
  phase: GamePhase;
  mode: 'koi_koi' | 'hachi_hachi';
  round: number;
  players: PlayerState[];
  currentPlayerIndex: number;
  deck: number[];              // 山札剩余牌 ID
  field: number[];             // 场牌 ID
  hands: number[][];           // 手牌 ID [p0[], p1[]]
  captured: number[][];        // 收集牌 ID [p0[], p1[]]
  roundScores: number[];       // 当前局得分
  totalScores: number[];       // 累计总分
  targetScore: number;         // 目标分数（默认 7）
  koiKoiCount: number;
  koiKoiCaller: number | null;
  koiKoiActive: boolean;
  specialResult: {
    type: 'te_shi' | 'field_four';
    winner: number | null;
    score: number;
  } | null;
  lastActionSeq: number;
  _drawnCard?: number;         // 临时：翻出的牌
  _currentYaku?: import('../rules/types.js').YakuResult[]; // 临时：当前役
}

export interface KoiKoiConfig {
  targetScore: number;
  koiMultiplier: boolean;
  koiRisk: 'caller_zero';
  hanamiTsukimiMerge: boolean;
}

export interface PlayResult {
  state: GameState;
  yakuFound: boolean;
  matched: boolean;
  matchedCards: number[];
  nextPlayer: number;
}
