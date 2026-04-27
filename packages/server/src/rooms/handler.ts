/**
 * Socket.io 事件处理器
 * 来源：design/gdd/network.md
 */

import { Server, Socket } from 'socket.io';
import {
  playCard, drawCard, checkDrawMatch, checkYaku,
  callKoiKoi, endRound, nextPlayer, GamePhase,
  serializeState,
  checkYakuHachiHachi, endRoundHachiHachi,
} from '@hanafuda/core';
import {
  createRoom, joinRoom, leaveRoom, startGame,
  getRoom, updateGameState, cleanupEmptyRooms,
} from './manager.js';

// 使用 any 类型绕过严格的 Socket.io 类型检查
type AnySocket = Socket<any, any, any, any>;

export function setupSocketHandlers(io: Server): void {
  // 定时清理空房间
  setInterval(cleanupEmptyRooms, 60000);

  io.on('connection', (socket: AnySocket) => {
    const nickname = socket.handshake.auth.nickname || '玩家';
    const avatar = socket.handshake.auth.avatar || '';
    const playerId = socket.id;

    console.log(`[连接] ${nickname} (${playerId})`);

    let currentRoomId: string | null = null;

    // === 房间事件 ===

    socket.on('create_room', (data?: { mode?: string }) => {
      const mode = data?.mode === 'hachi_hachi' ? 'hachi_hachi' : 'koi_koi';
      const targetScore = mode === 'hachi_hachi' ? 30 : 7;
      const room = createRoom({ id: playerId, nickname, avatar }, mode, targetScore);
      currentRoomId = room.id;
      socket.join(room.id);
      socket.emit('room_created', { room });
      console.log(`[创建房间] ${room.id} 模式=${mode}`);
    });

    socket.on('join_room', (roomId: string) => {
      const result = joinRoom(roomId, { id: playerId, nickname, avatar });
      if (result.error) {
        socket.emit('error', { message: result.error });
        return;
      }
      currentRoomId = roomId;
      socket.join(roomId);
      socket.emit('room_joined', { room: result.room });
      socket.to(roomId).emit('player_joined', { room: result.room });
      console.log(`[加入房间] ${roomId}`);
    });

    socket.on('leave_room', () => {
      if (currentRoomId) {
        leaveRoom(currentRoomId, playerId);
        socket.to(currentRoomId).emit('player_left', { playerId });
        socket.leave(currentRoomId);
        currentRoomId = null;
      }
    });

    socket.on('start_game', () => {
      if (!currentRoomId) return;
      const result = startGame(currentRoomId);
      if (result.error) {
        socket.emit('error', { message: result.error });
        return;
      }
      io.to(currentRoomId).emit('game_start', { state: serializeState(result.gameState) });
      console.log(`[开始游戏] ${currentRoomId}`);
    });

    // === 游戏事件 ===

    socket.on('play_card', (cardId: number) => {
      if (!currentRoomId) return;
      const room = getRoom(currentRoomId);
      if (!room?.gameState) return;

      const state = room.gameState;
      const playerIndex = state.players.findIndex(p => p.id === playerId);
      if (playerIndex < 0) return;

      try {
        // 1. 出牌 + 匹配
        let result = playCard(state, playerIndex, cardId);

        // 2. 翻山札
        let drawResult = drawCard(result.state);

        // 3. 翻牌匹配
        let matchResult = checkDrawMatch(drawResult.state);

        // 4. 役判定（区分模式）
        let yakuResult;
        if (state.mode === 'hachi_hachi') {
          yakuResult = checkYakuHachiHachi(matchResult.state);

          // Hachi-Hachi：山札耗尽 → 结算
          if (yakuResult.state.phase === GamePhase.RoundEnd) {
            const roundResult = endRoundHachiHachi(yakuResult.state);
            updateGameState(currentRoomId!, roundResult);
            const gameOver = roundResult.phase === GamePhase.GameEnd;

            io.to(currentRoomId).emit('round_end', {
              state: serializeState(roundResult),
              roundScores: roundResult.roundScores,
              totalScores: roundResult.totalScores,
              gameOver,
            });

            if (gameOver) {
              const winnerIdx = roundResult.totalScores.indexOf(Math.max(...roundResult.totalScores));
              io.to(currentRoomId).emit('game_end', {
                winner: roundResult.players[winnerIdx],
                totalScores: roundResult.totalScores,
              });
            }
            return;
          }

          updateGameState(currentRoomId!, yakuResult.state);
          io.to(currentRoomId).emit('state_update', {
            action: 'play_card',
            state: serializeState(yakuResult.state),
          });
          return;
        }

        // Koi-Koi 流程
        yakuResult = checkYaku(matchResult.state);
        updateGameState(currentRoomId!, yakuResult.state);

        io.to(currentRoomId).emit('state_update', {
          action: 'play_card',
          state: serializeState(yakuResult.state),
        });

        if (yakuResult.yakuFound) {
          const currentId = state.players[state.currentPlayerIndex]?.id;
          const targetSocket = [...io.sockets.sockets.values()].find(s => s.id === currentId);
          targetSocket?.emit('yaku_found', { yaku: yakuResult.state._currentYaku });
        }
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
      }
    });

    socket.on('koi_koi', () => {
      if (!currentRoomId) return;
      const room = getRoom(currentRoomId);
      if (!room?.gameState) return;

      // Hachi-Hachi 无 Koi 机制
      if (room.mode === 'hachi_hachi') {
        socket.emit('error', { message: '三人模式不支持 Koi' });
        return;
      }

      const newState = callKoiKoi(room.gameState);
      const next = nextPlayer(newState);
      updateGameState(currentRoomId, next);

      io.to(currentRoomId).emit('state_update', {
        action: 'koi_koi',
        state: serializeState(next),
        koiCount: newState.koiKoiCount,
      });
    });

    socket.on('end_round', () => {
      if (!currentRoomId) return;
      const room = getRoom(currentRoomId);
      if (!room?.gameState) return;

      const newState = endRound(room.gameState);
      updateGameState(currentRoomId, newState);

      const gameOver = newState.phase === GamePhase.GameEnd;

      io.to(currentRoomId).emit('round_end', {
        state: serializeState(newState),
        roundScores: newState.roundScores,
        totalScores: newState.totalScores,
        gameOver,
      });

      if (gameOver) {
        const winnerIdx = newState.totalScores[0] >= newState.targetScore ? 0 : 1;
        io.to(currentRoomId).emit('game_end', {
          winner: newState.players[winnerIdx],
          totalScores: newState.totalScores,
        });
      }
    });

    // === 断线 ===

    socket.on('disconnect', () => {
      console.log(`[断开] ${nickname} (${playerId})`);
      if (currentRoomId) {
        leaveRoom(currentRoomId, playerId);
        socket.to(currentRoomId).emit('player_disconnected', { playerId });
      }
    });

    socket.on('reconnect', () => {
      if (currentRoomId) {
        const room = getRoom(currentRoomId);
        if (room?.gameState) {
          socket.emit('state_update', {
            action: 'reconnect',
            state: serializeState(room.gameState),
          });
        }
      }
    });
  });
}
