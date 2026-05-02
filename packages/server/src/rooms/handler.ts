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

type AnySocket = Socket<any, any, any, any>;

export function setupSocketHandlers(io: Server): void {
  setInterval(cleanupEmptyRooms, 60000);

  io.on('connection', (socket: AnySocket) => {
    const nickname = socket.handshake.auth.nickname || '玩家';
    const avatar = socket.handshake.auth.avatar || '';
    const playerId = socket.id;

    console.log(`[连接] ${nickname} (${playerId})`);
    let currentRoomId: string | null = null;

    socket.on('create_room', (data?: { mode?: string }) => {
      const mode = data?.mode === 'hachi_hachi' ? 'hachi_hachi' : 'koi_koi';
      const targetScore = mode === 'hachi_hachi' ? 30 : 7;
      const room = createRoom({ id: playerId, nickname, avatar }, mode, targetScore);
      currentRoomId = room.id;
      socket.join(room.id);
      // 返回自己的座位号 0
      socket.emit('room_created', { room, mySeatIndex: 0 });
      console.log(`[创建房间] ${room.id} Seat=0`);
    });

    socket.on('join_room', (roomId: string) => {
      const result = joinRoom(roomId, { id: playerId, nickname, avatar });
      if (result.error) {
        socket.emit('error', { message: result.error });
        return;
      }
      currentRoomId = roomId;
      socket.join(roomId);
      socket.to(roomId).emit('player_joined', { room: result.room });
      
      // 返回自己的座位号 (当前人数-1)
      const myIndex = result.room.players.length - 1;
      socket.emit('room_joined', { room: result.room, mySeatIndex: myIndex });
      console.log(`[加入房间] ${roomId}, SeatIndex: ${myIndex}`);
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

    socket.on('play_card', (cardId: number) => {
      if (!currentRoomId) return;
      const room = getRoom(currentRoomId);
      if (!room?.gameState) return;

      const state = room.gameState;
      const playerIndex = state.players.findIndex(p => p.id === playerId);
      if (playerIndex < 0) return;

      try {
        let result = playCard(state, playerIndex, cardId);
        let drawResult = drawCard(result.state);
        let matchResult = checkDrawMatch(drawResult.state);

        if (state.mode === 'hachi_hachi') {
          let yakuResult = checkYakuHachiHachi(matchResult.state);
          if (yakuResult.state.phase === GamePhase.RoundEnd) {
            const roundResult = endRoundHachiHachi(yakuResult.state);
            updateGameState(currentRoomId!, roundResult);
            io.to(currentRoomId).emit('round_end', {
              state: serializeState(roundResult),
              roundScores: roundResult.roundScores,
              totalScores: roundResult.totalScores,
              gameOver: roundResult.phase === GamePhase.GameEnd,
            });
            if (roundResult.phase === GamePhase.GameEnd) {
               const winnerIdx = roundResult.totalScores.indexOf(Math.max(...roundResult.totalScores));
               io.to(currentRoomId).emit('game_end', { winner: roundResult.players[winnerIdx], totalScores: roundResult.totalScores });
            }
            return;
          }
          const nextState = nextPlayer(yakuResult.state);
          updateGameState(currentRoomId!, nextState);
          io.to(currentRoomId).emit('state_update', { action: 'play_card', state: serializeState(nextState) });
          return;
        }

        let yakuResult = checkYaku(matchResult.state);
        if (yakuResult.yakuFound) {
          updateGameState(currentRoomId!, yakuResult.state);
          io.to(currentRoomId).emit('state_update', { action: 'play_card', state: serializeState(yakuResult.state) });
          const currentId = state.players[state.currentPlayerIndex]?.id;
          const targetSocket = [...io.sockets.sockets.values()].find(s => s.id === currentId);
          // 单独发送役列表（不要从 state 取，因为_serializeState 会移除_currentYaku）
          targetSocket?.emit('yaku_found', { 
            yaku: yakuResult.state._currentYaku?.map((y: any) => ({ 
              label: y.label, 
              points: y.points 
            }))
          });
        } else {
          const nextState = nextPlayer(yakuResult.state);
          updateGameState(currentRoomId!, nextState);
          io.to(currentRoomId).emit('state_update', { action: 'play_card', state: serializeState(nextState) });
        }
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
      }
    });

    socket.on('koi_koi', () => {
      if (!currentRoomId) return;
      const room = getRoom(currentRoomId);
      if (!room?.gameState) return;
      if (room.mode === 'hachi_hachi') {
        socket.emit('error', { message: '三人模式不支持 Koi' });
        return;
      }
      const newState = callKoiKoi(room.gameState);
      const next = nextPlayer(newState);
      updateGameState(currentRoomId, next);
      io.to(currentRoomId).emit('state_update', { action: 'koi_koi', state: serializeState(next), koiCount: newState.koiKoiCount });
    });

    socket.on('end_round', () => {
      if (!currentRoomId) return;
      const room = getRoom(currentRoomId);
      if (!room?.gameState) return;
      const newState = endRound(room.gameState);
      updateGameState(currentRoomId, newState);
      const gameOver = newState.phase === GamePhase.GameEnd;
      io.to(currentRoomId).emit('round_end', { state: serializeState(newState), roundScores: newState.roundScores, totalScores: newState.totalScores, gameOver });
      if (gameOver) {
        const winnerIdx = newState.totalScores[0] >= newState.targetScore ? 0 : 1;
        io.to(currentRoomId).emit('game_end', { winner: newState.players[winnerIdx], totalScores: newState.totalScores });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[断开] ${nickname} (${playerId})`);
      if (currentRoomId) {
        leaveRoom(currentRoomId, playerId);
        socket.to(currentRoomId).emit('player_disconnected', { playerId });
      }
    });
    
    socket.on('reconnect', () => {
       // TODO: 重连逻辑
    });
  });
}