import { describe, it, expect, beforeAll } from 'vitest';
import {
  createRoom, joinRoom, leaveRoom, startGame, getRoom, getRoomCount, cleanupEmptyRooms,
} from '../src/rooms/manager.js';
import {
  initGame, deal, checkSpecial, playCard, drawCard,
  checkDrawMatch, checkYaku, callKoiKoi, endRound, nextPlayer,
  GamePhase, CardCategory, ALL_CARDS, calculateScore,
} from '@hanafuda/core';

describe('房间管理', () => {
  beforeAll(cleanupEmptyRooms);

  it('创建房间', () => {
    const room = createRoom({ id: 'p1', nickname: 'Alice', avatar: '' });
    expect(room.id).toMatch(/^\d{6}$/);
    expect(room.hostId).toBe('p1');
    expect(room.players).toHaveLength(1);
    expect(room.status).toBe('waiting');
  });

  it('加入房间', () => {
    const host = createRoom({ id: 'host1', nickname: 'Host', avatar: '' });
    const result = joinRoom(host.id, { id: 'guest1', nickname: 'Guest', avatar: '' });
    expect(result.error).toBeUndefined();
    expect(result.room.players).toHaveLength(2);
    expect(result.room.status).toBe('playing');
  });

  it('房间满', () => {
    const host = createRoom({ id: 'h2', nickname: 'H', avatar: '' });
    joinRoom(host.id, { id: 'g2', nickname: 'G', avatar: '' });
    const result = joinRoom(host.id, { id: 'g3', nickname: 'G3', avatar: '' });
    // 2人满后状态变为 playing，所以第三个加入者看到的是"不在等待状态"
    expect(result.error).toBeDefined();
  });

  it('房间不存在', () => {
    const result = joinRoom('999999', { id: 'x', nickname: 'X', avatar: '' });
    expect(result.error).toBe('房间不存在');
  });

  it('离开房间 - 房主离开', () => {
    const host = createRoom({ id: 'h3', nickname: 'H', avatar: '' });
    joinRoom(host.id, { id: 'g4', nickname: 'G', avatar: '' });
    const result = leaveRoom(host.id, 'h3');
    expect(result.room).not.toBeNull();
    expect(result.room!.hostId).toBe('g4');
  });

  it('离开房间 - 所有人离开', () => {
    const room = createRoom({ id: 'solo', nickname: 'Solo', avatar: '' });
    const result = leaveRoom(room.id, 'solo');
    expect(result.room).toBeNull();
  });
});

describe('游戏流程 E2E', () => {
  it('完整一局：创建 → 加入 → 开始 → 出牌', () => {
    // 1. 创建房间
    const room = createRoom({ id: 'e2e_p0', nickname: 'Player0', avatar: '' });

    // 2. 加入房间
    const joinResult = joinRoom(room.id, { id: 'e2e_p1', nickname: 'Player1', avatar: '' });
    expect(joinResult.error).toBeUndefined();

    // 3. 开始游戏
    const startResult = startGame(room.id);
    expect(startResult.error).toBeUndefined();
    expect(startResult.gameState.phase).toBe(GamePhase.PlayerTurn);
    expect(startResult.gameState.hands[0]).toHaveLength(8);
    expect(startResult.gameState.hands[1]).toHaveLength(8);
    expect(startResult.gameState.field).toHaveLength(8);
    expect(startResult.gameState.deck).toHaveLength(24);
  });
});

describe('完整出牌流程', () => {
  it('出牌 → 翻牌 → 役判定', () => {
    // 手动构造一个确定性状态来测试完整流程
    let state = initGame('p0', 'P0', 'p1', 'P1');
    state = deal(state);
    state = checkSpecial(state);
    expect(state.phase === GamePhase.PlayerTurn || state.phase === GamePhase.Redeal || state.phase === GamePhase.GameEnd).toBe(true);

    if (state.phase !== GamePhase.PlayerTurn) return; // 跳过特殊开局

    const playerIndex = state.currentPlayerIndex;

    // 出牌
    const cardId = state.hands[playerIndex][0];
    let result = playCard(state, playerIndex, cardId);
    expect(result.state.hands[playerIndex]).toHaveLength(7);

    // 翻山札
    let drawResult = drawCard(result.state);

    // 翻牌匹配
    let matchResult = checkDrawMatch(drawResult.state);

    // 役判定
    let yakuResult = checkYaku(matchResult.state);

    // 验证状态推进
    expect([GamePhase.NextPlayer, GamePhase.KoiDecision, GamePhase.RoundEnd] as GamePhase[]).toContain(yakuResult.state.phase);
  });
});

describe('Koi 流程', () => {
  it('喊 Koi → 继续游戏', () => {
    let state = initGame('p0', 'P0', 'p1', 'P1');
    state = deal(state);
    state.phase = GamePhase.KoiDecision;
    state._currentYaku = [{ type: 'three_lights' as any, points: 6, cards: [], label: '三光' }];

    const newState = callKoiKoi(state);
    expect(newState.koiKoiCount).toBe(1);
    expect(newState.koiKoiCaller).toBe(state.currentPlayerIndex);
    expect(newState.koiKoiActive).toBe(true);

    const next = nextPlayer(newState);
    expect(next.phase).toBe(GamePhase.PlayerTurn);
  });
});

describe('计分', () => {
  it('三光 6分', () => {
    // 三光 = 不含小野道风的 3 张光（1月鹤、3月幕、8月月）
    const lights = ALL_CARDS.filter(c => c.category === CardCategory.Light && [1, 3, 8].includes(c.month));
    expect(lights).toHaveLength(3);
    const result = calculateScore(lights, 0, false, true);
    expect(result.baseScore).toBe(6);
    expect(result.finalScore).toBe(6);
  });

  it('五光 10分 × 2 = 20分（Koi 1次）', () => {
    const lights = ALL_CARDS.filter(c => c.category === CardCategory.Light);
    const result = calculateScore(lights, 1, true, true);
    expect(result.baseScore).toBe(10);
    expect(result.koiMultiplier).toBe(2);
    expect(result.finalScore).toBe(20);
  });

  it('猪鹿蝶 5分', () => {
    const cards = ALL_CARDS.filter(c => c.category === CardCategory.Seed && [6, 7, 10].includes(c.month));
    const result = calculateScore(cards, 0, false, true);
    expect(result.baseScore).toBe(5);
  });

  it('Koi 输了得 0 分', () => {
    const lights = ALL_CARDS.filter(c => c.category === CardCategory.Light);
    const result = calculateScore(lights, 1, true, false);
    expect(result.finalScore).toBe(0);
  });
});
