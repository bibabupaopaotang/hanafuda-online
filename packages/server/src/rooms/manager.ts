/**
 * 房间管理
 * 来源：design/gdd/battle.md (v0.1)
 */

import {
  initGame, initHachiHachi, GameState, GamePhase,
  deal, dealHachiHachi, checkSpecial, checkSpecialHachiHachi,
  nextPlayer,
} from '@hanafuda/core';

export interface RoomPlayer {
  id: string;
  nickname: string;
  avatar: string;
  isReady: boolean;
  isConnected: boolean;
  seatIndex: number;
  lastActiveTime: number;
}

export interface Room {
  id: string;
  hostId: string;
  players: RoomPlayer[];
  mode: 'koi_koi' | 'hachi_hachi';
  gameState: GameState | null;
  status: 'waiting' | 'playing' | 'paused' | 'finished';
  createdAt: number;
  settings: {
    targetScore: number;
  };
}

// 内存存储（MVP 阶段，后续换 Redis）
const rooms = new Map<string, Room>();

/** 生成 6 位房间号 */
function generateRoomId(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** 创建房间 */
export function createRoom(
  host: { id: string; nickname: string; avatar: string },
  mode: 'koi_koi' | 'hachi_hachi' = 'koi_koi',
  targetScore: number = mode === 'hachi_hachi' ? 30 : 7
): Room {
  let id: string;
  do {
    id = generateRoomId();
  } while (rooms.has(id));

  const room: Room = {
    id,
    hostId: host.id,
    players: [{
      id: host.id,
      nickname: host.nickname,
      avatar: host.avatar,
      isReady: true,
      isConnected: true,
      seatIndex: 0,
      lastActiveTime: Date.now(),
    }],
    mode,
    gameState: null,
    status: 'waiting',
    createdAt: Date.now(),
    settings: { targetScore },
  };
  rooms.set(id, room);
  return room;
}

/** 加入房间 */
export function joinRoom(roomId: string, player: { id: string; nickname: string; avatar: string }): { room: Room; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { room: null as any, error: '房间不存在' };
  if (room.status !== 'waiting') return { room, error: '房间不在等待状态' };
  const maxPlayers = room.mode === 'hachi_hachi' ? 3 : 2;
  if (room.players.length >= maxPlayers) return { room, error: '房间已满' };
  if (room.players.some(p => p.id === player.id)) return { room, error: '你已在房间中' };

  room.players.push({
    id: player.id,
    nickname: player.nickname,
    avatar: player.avatar,
    isReady: true,
    isConnected: true,
    seatIndex: room.players.length,
    lastActiveTime: Date.now(),
  });

  if (room.players.length >= maxPlayers) {
    room.status = 'playing';
  }

  return { room };
}

/** 离开房间 */
export function leaveRoom(roomId: string, playerId: string): { room: Room | null } {
  const room = rooms.get(roomId);
  if (!room) return { room: null };

  room.players = room.players.filter(p => p.id !== playerId);

  if (room.players.length === 0) {
    rooms.delete(roomId);
    return { room: null };
  }

  // 房主离开 → 新房主
  if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
    room.players[0].seatIndex = 0;
  }

  room.status = 'waiting';
  return { room };
}

/** 开始游戏 */
export function startGame(roomId: string): { gameState: GameState; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { gameState: null as any, error: '房间不存在' };

  let state: GameState;

  if (room.mode === 'hachi_hachi') {
    // === 三人模式 ===
    if (room.players.length < 3) return { gameState: null as any, error: '三人模式需要 3 人' };
    const [p0, p1, p2] = room.players;

    state = initHachiHachi(p0.id, p0.nickname, p1.id, p1.nickname, p2.id, p2.nickname, room.settings.targetScore);
    state = dealHachiHachi(state);
    state.phase = GamePhase.CheckSpecial;
    state = checkSpecialHachiHachi(state);
  } else {
    // === 两人模式 ===
    if (room.players.length < 2) return { gameState: null as any, error: '人数不足' };
    const [p0, p1] = room.players;

    state = initGame(p0.id, p0.nickname, p1.id, p1.nickname, {
      targetScore: room.settings.targetScore,
    });
    state = deal(state);
    state.phase = GamePhase.CheckSpecial;
    state = checkSpecial(state);
  }

  if (state.phase === GamePhase.PlayerTurn) {
    state = nextPlayer(state);
    state.phase = GamePhase.PlayerTurn;
  }

  room.gameState = state;
  room.status = 'playing';

  return { gameState: state };
}

/** 获取房间 */
export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

/** 更新游戏状态 */
export function updateGameState(roomId: string, state: GameState): void {
  const room = rooms.get(roomId);
  if (room) room.gameState = state;
}

/** 房间数量 */
export function getRoomCount(): number {
  return rooms.size;
}

/** 清理空房间 */
export function cleanupEmptyRooms(): void {
  for (const [id, room] of rooms) {
    if (room.players.length === 0) {
      rooms.delete(id);
    }
  }
}
