"use strict";
/**
 * 游戏状态管理 — 类型定义
 * 来源：design/gdd/game-state.md (v0.1) + design/gdd/battle.md (v0.1)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamePhase = void 0;
var GamePhase;
(function (GamePhase) {
    GamePhase["Lobby"] = "lobby";
    GamePhase["Dealing"] = "dealing";
    GamePhase["CheckSpecial"] = "check_special";
    GamePhase["Redeal"] = "redeal";
    GamePhase["PlayerTurn"] = "player_turn";
    GamePhase["MatchCheck"] = "match_check";
    GamePhase["DrawCard"] = "draw_card";
    GamePhase["DrawMatch"] = "draw_match";
    GamePhase["YakuCheck"] = "yaku_check";
    GamePhase["KoiDecision"] = "koi_decision";
    GamePhase["KoiActive"] = "koi_active";
    GamePhase["NextPlayer"] = "next_player";
    GamePhase["RoundEnd"] = "round_end";
    GamePhase["GameEnd"] = "game_end";
})(GamePhase || (exports.GamePhase = GamePhase = {}));
