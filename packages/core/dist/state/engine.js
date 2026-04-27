"use strict";
/**
 * 游戏状态机 + 核心逻辑
 * 来源：design/gdd/game-state.md (v0.1) + design/gdd/battle.md (v0.1)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initGame = initGame;
exports.deal = deal;
exports.checkSpecial = checkSpecial;
exports.playCard = playCard;
exports.drawCard = drawCard;
exports.checkDrawMatch = checkDrawMatch;
exports.checkYaku = checkYaku;
exports.callKoiKoi = callKoiKoi;
exports.endRound = endRound;
exports.nextPlayer = nextPlayer;
exports.serializeState = serializeState;
const index_js_1 = require("../cards/index.js");
const calculator_js_1 = require("../scoring/calculator.js");
const yaku_js_1 = require("../rules/yaku.js");
const types_js_1 = require("./types.js");
const DEFAULT_CONFIG = {
    targetScore: 7,
    koiMultiplier: true,
    koiRisk: 'caller_zero',
    hanamiTsukimiMerge: true,
};
/** 初始化游戏 */
function initGame(player0Id, player0Name, player1Id, player1Name, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    return {
        phase: types_js_1.GamePhase.Lobby,
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
function deal(state) {
    const deck = (0, index_js_1.shuffleDeck)([...index_js_1.ALL_CARDS]);
    const hands = [[], []];
    const field = [];
    // 先发手牌：每人 8 张，亲先拿
    for (let i = 0; i < 8; i++) {
        hands[0].push(deck.pop().id);
        hands[1].push(deck.pop().id);
    }
    // 再发场牌：8 张
    for (let i = 0; i < 8; i++) {
        field.push(deck.pop().id);
    }
    return {
        ...state,
        phase: types_js_1.GamePhase.Dealing,
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
function checkSpecial(state) {
    // 检查场牌四张同月 → 流局
    const fieldMonths = state.field.map(id => index_js_1.ALL_CARDS[id].month);
    const fieldCounts = countOccurrences(fieldMonths);
    for (const count of Object.values(fieldCounts)) {
        if (count === 4) {
            return { ...state, phase: types_js_1.GamePhase.Redeal, specialResult: { type: 'field_four', winner: null, score: 0 } };
        }
    }
    // 检查手四
    for (let p = 0; p < 2; p++) {
        const handMonths = state.hands[p].map(id => index_js_1.ALL_CARDS[id].month);
        const handCounts = countOccurrences(handMonths);
        for (const count of Object.values(handCounts)) {
            if (count === 4) {
                return { ...state, phase: types_js_1.GamePhase.GameEnd, specialResult: { type: 'te_shi', winner: p, score: 6 } };
            }
        }
    }
    return { ...state, phase: types_js_1.GamePhase.PlayerTurn };
}
/** 玩家出牌 */
function playCard(state, playerIndex, cardId) {
    if (playerIndex !== state.currentPlayerIndex)
        throw new Error('不是当前玩家的回合');
    if (!state.hands[playerIndex].includes(cardId))
        throw new Error('手牌中没有这张牌');
    const card = index_js_1.ALL_CARDS[cardId];
    const matched = state.field.filter(id => index_js_1.ALL_CARDS[id].month === card.month);
    let newCaptured = state.captured.map(a => [...a]);
    let newField;
    const newHands = state.hands.map(a => [...a]);
    if (matched.length > 0) {
        newCaptured[playerIndex].push(cardId, ...matched);
        newField = state.field.filter(id => !matched.includes(id));
    }
    else {
        newField = [...state.field, cardId];
    }
    newHands[playerIndex] = newHands[playerIndex].filter(id => id !== cardId);
    return {
        state: {
            ...state,
            phase: types_js_1.GamePhase.MatchCheck,
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
function drawCard(state) {
    if (state.deck.length === 0) {
        return { state: { ...state, phase: types_js_1.GamePhase.RoundEnd }, yakuFound: false, matched: false, matchedCards: [], nextPlayer: state.currentPlayerIndex };
    }
    const drawnCard = state.deck[state.deck.length - 1];
    const newDeck = state.deck.slice(0, -1);
    return {
        state: { ...state, phase: types_js_1.GamePhase.DrawCard, deck: newDeck, _drawnCard: drawnCard, lastActionSeq: state.lastActionSeq + 1 },
        yakuFound: false,
        matched: false,
        matchedCards: [],
        nextPlayer: state.currentPlayerIndex,
    };
}
/** 翻牌匹配 */
function checkDrawMatch(state) {
    const drawnCard = state._drawnCard;
    const card = index_js_1.ALL_CARDS[drawnCard];
    const matched = state.field.filter(id => index_js_1.ALL_CARDS[id].month === card.month);
    let newCaptured = state.captured.map(a => [...a]);
    let newField;
    const player = state.currentPlayerIndex;
    if (matched.length > 0) {
        newCaptured[player].push(drawnCard, ...matched);
        newField = state.field.filter(id => !matched.includes(id));
    }
    else {
        newField = [...state.field, drawnCard];
    }
    return {
        state: { ...state, phase: types_js_1.GamePhase.DrawMatch, field: newField, captured: newCaptured, lastActionSeq: state.lastActionSeq + 1 },
        yakuFound: false,
        matched: matched.length > 0,
        matchedCards: matched,
        nextPlayer: player,
    };
}
/** 役判定 */
function checkYaku(state) {
    const capturedIds = state.captured[state.currentPlayerIndex];
    const capturedCards = capturedIds.map(id => index_js_1.ALL_CARDS[id]);
    const yakuResults = (0, yaku_js_1.checkAllYaku)(capturedCards);
    if (yakuResults.length === 0) {
        return { state: { ...state, phase: types_js_1.GamePhase.NextPlayer }, yakuFound: false, matched: false, matchedCards: [], nextPlayer: state.currentPlayerIndex };
    }
    return {
        state: { ...state, phase: types_js_1.GamePhase.KoiDecision, _currentYaku: yakuResults, lastActionSeq: state.lastActionSeq + 1 },
        yakuFound: true,
        matched: false,
        matchedCards: [],
        nextPlayer: state.currentPlayerIndex,
    };
}
/** 喊 Koi */
function callKoiKoi(state) {
    return {
        ...state,
        phase: types_js_1.GamePhase.KoiActive,
        koiKoiCount: state.koiKoiCount + 1,
        koiKoiCaller: state.currentPlayerIndex,
        koiKoiActive: true,
        lastActionSeq: state.lastActionSeq + 1,
    };
}
/** 结束本局 */
function endRound(state) {
    const player = state.currentPlayerIndex;
    const opponent = 1 - player;
    const capturedCards = state.captured[player].map(id => index_js_1.ALL_CARDS[id]);
    const scoreResult = (0, calculator_js_1.calculateScore)(capturedCards, state.koiKoiCount, state.koiKoiCaller === player, true);
    const newTotalScores = [...state.totalScores];
    newTotalScores[player] += scoreResult.finalScore;
    // 喊 Koi 的人输了 → 0 分
    if (state.koiKoiCaller !== null && state.koiKoiCaller !== player) {
        // 对手得分已加上，喊 Koi 的人不得分
    }
    const winner = newTotalScores.findIndex(s => s >= state.targetScore);
    return {
        ...state,
        phase: winner >= 0 ? types_js_1.GamePhase.GameEnd : types_js_1.GamePhase.RoundEnd,
        roundScores: [player === 0 ? scoreResult.finalScore : 0, player === 1 ? scoreResult.finalScore : 0],
        totalScores: newTotalScores,
        lastActionSeq: state.lastActionSeq + 1,
    };
}
/** 换人 */
function nextPlayer(state) {
    const nextIndex = (state.currentPlayerIndex + 1) % 2;
    // 检查手牌是否耗尽
    if (state.hands[state.currentPlayerIndex].length === 0 && state.deck.length === 0) {
        return { ...state, phase: types_js_1.GamePhase.RoundEnd };
    }
    return {
        ...state,
        phase: types_js_1.GamePhase.PlayerTurn,
        currentPlayerIndex: nextIndex,
        lastActionSeq: state.lastActionSeq + 1,
    };
}
/** 辅助：计数 */
function countOccurrences(arr) {
    const map = {};
    for (const v of arr)
        map[v] = (map[v] || 0) + 1;
    return map;
}
/** 序列化状态（用于网络传输/重连） */
function serializeState(state) {
    const { _drawnCard, _currentYaku, ...rest } = state;
    return rest;
}
