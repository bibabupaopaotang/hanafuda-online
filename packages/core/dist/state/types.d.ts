/**
 * 游戏状态管理 — 类型定义
 * 来源：design/gdd/game-state.md (v0.1) + design/gdd/battle.md (v0.1)
 */
export declare enum GamePhase {
    Lobby = "lobby",
    Dealing = "dealing",
    CheckSpecial = "check_special",
    Redeal = "redeal",
    PlayerTurn = "player_turn",
    MatchCheck = "match_check",
    DrawCard = "draw_card",
    DrawMatch = "draw_match",
    YakuCheck = "yaku_check",
    KoiDecision = "koi_decision",
    KoiActive = "koi_active",
    NextPlayer = "next_player",
    RoundEnd = "round_end",
    GameEnd = "game_end"
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
    deck: number[];
    field: number[];
    hands: number[][];
    captured: number[][];
    roundScores: number[];
    totalScores: number[];
    targetScore: number;
    koiKoiCount: number;
    koiKoiCaller: number | null;
    koiKoiActive: boolean;
    specialResult: {
        type: 'te_shi' | 'field_four';
        winner: number | null;
        score: number;
    } | null;
    lastActionSeq: number;
    _drawnCard?: number;
    _currentYaku?: import('../rules/types.js').YakuResult[];
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
