# 对战管理 — 游戏设计文档

> 合并了原匹配系统 + 对战管理 + 回合控制
> 校验日期：2026-04-27

## 概述

- **系统名称**：对战管理 (Battle Manager)
- **所属层级**：Core
- **优先级**：P1
- **设计目标**：管理房间创建/加入、回合控制、玩家超时、状态同步。
  对上连接网络通信层，下管理游戏状态机。

## 系统架构

```
┌──────────────────────────────────────────────┐
│                 对战管理器                     │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ 房间管理  │  │ 回合控制  │  │ 玩家同步    │ │
│  └──────────┘  └──────────┘  └────────────┘ │
│         │             │              │       │
│         └──────┬──────┴──────┬───────┘       │
│                ▼             ▼               │
│  ┌──────────────────────────────────────┐    │
│  │           游戏状态管理                │    │
│  │      (game-state.md 已定义)          │    │
│  └──────────────────────────────────────┘    │
└──────────────────┬───────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │   网络通信层       │
         │  (network.md)     │
         └───────────────────┘
```

## 房间管理

### 房间生命周期

```
[创建] ──→ [等待加入] ──→ [准备] ──→ [游戏中] ──→ [结算] ──→ [解散/再开]
              ↑                                        │
              │                                   [回到等待]
```

### 房间数据结构

```typescript
interface Room {
  id: string;              // 6 位数字房间号
  hostId: string;          // 房主
  players: RoomPlayer[];
  mode: 'koi_koi' | 'hachi_hachi';
  settings: RoomSettings;
  gameState: GameState | null; // 游戏中时不为 null
  status: RoomStatus;
  createdAt: number;
  maxIdleTime: number;     // 最大空闲时间（分钟），超时自动解散
}

enum RoomStatus {
  Waiting = 'waiting',     // 等待玩家加入
  Ready = 'ready',         // 所有玩家准备就绪，即将开始
  Playing = 'playing',     // 游戏中
  Paused = 'paused',       // 暂停（有人断线）
  Finished = 'finished',   // 结算中
}

interface RoomPlayer {
  id: string;              // 玩家唯一 ID（微信 openid）
  nickname: string;
  avatar: string;
  isReady: boolean;
  isConnected: boolean;
  lastActiveTime: number;  // 最后活跃时间
  seatIndex: number;       // 座位号（0=亲，1=子）
}

interface RoomSettings {
  mode: 'koi_koi' | 'hachi_hachi';
  targetScore: number;     // 默认 7
  turnTimeLimit: number;   // 回合限时（秒），0=不限
}
```

### 房间操作流程

#### 创建房间

```
玩家 A:
  1. 选择模式（Koi-Koi 两人）
  2. 调用 createRoom()
  3. 服务端生成 6 位房间号
  4. 返回房间信息 + 分享数据
  5. 玩家 A 进入等待状态
```

```typescript
function createRoom(host: PlayerInfo, settings: RoomSettings): Room {
  return {
    id: generateRoomId(),    // 6 位数字
    hostId: host.id,
    players: [{
      id: host.id,
      nickname: host.nickname,
      avatar: host.avatar,
      isReady: true,          // 房主自动准备
      isConnected: true,
      lastActiveTime: Date.now(),
      seatIndex: 0,
    }],
    mode: settings.mode,
    settings,
    gameState: null,
    status: RoomStatus.Waiting,
    createdAt: Date.now(),
    maxIdleTime: 30,
  };
}
```

#### 加入房间

```
玩家 B:
  1. 收到分享/输入房间号
  2. 调用 joinRoom(roomId)
  3. 服务端验证房间状态
  4. 加入成功 → 通知房主
  5. 人数满 → 房间状态变为 Ready
```

```typescript
function joinRoom(room: Room, player: PlayerInfo): Room | Error {
  if (room.status !== RoomStatus.Waiting) {
    return new Error('房间不在等待状态');
  }
  if (room.players.length >= getMaxPlayers(room.mode)) {
    return new Error('房间已满');
  }
  
  return {
    ...room,
    players: [...room.players, {
      id: player.id,
      nickname: player.nickname,
      avatar: player.avatar,
      isReady: true,
      isConnected: true,
      lastActiveTime: Date.now(),
      seatIndex: room.players.length,
    }],
    status: room.players.length + 1 >= getMaxPlayers(room.mode)
      ? RoomStatus.Ready
      : RoomStatus.Waiting,
  };
}
```

#### 离开房间

```typescript
function leaveRoom(room: Room, playerId: string): { room: Room | null; notification: string } {
  const remaining = room.players.filter(p => p.id !== playerId);
  
  if (remaining.length === 0) {
    return { room: null, notification: '房间已解散' };
  }
  
  if (room.hostId === playerId) {
    // 房主离开 → 新房主
    const newHost = remaining[0];
    return {
      room: {
        ...room,
        hostId: newHost.id,
        players: remaining.map((p, i) => ({ ...p, seatIndex: i })),
      },
      notification: '房主已离开，你成为新房主',
    };
  }
  
  return {
    room: {
      ...room,
      players: remaining.map((p, i) => ({ ...p, seatIndex: i })),
      status: RoomStatus.Waiting, // 人数不足 → 回到等待
    },
    notification: '对手已离开',
  };
}
```

## 回合控制

### 超时机制

> **✅ 已确认（2026-04-27）**：MVP 不做回合限时，改用空闲心跳检测（90s 无操作自动判负）

```typescript
interface IdleTimer {
  lastActiveTime: number;     // 最后活跃时间
  idleLimit: number;          // 空闲上限（毫秒），默认 90000
  checkInterval: NodeJS.Timeout | null;
}

function startIdleCheck(playerId: string, onTimeout: () => void): IdleTimer {
  const idleLimit = 90 * 1000; // 90 秒
  
  const checkInterval = setInterval(() => {
    const player = getPlayer(playerId);
    if (!player || !player.isConnected) return;
    
    const idleTime = Date.now() - player.lastActiveTime;
    if (idleTime > idleLimit) {
      onTimeout(); // 90 秒无操作 → 自动判负
    }
  }, 10 * 1000); // 每 10 秒检查一次
  
  return { lastActiveTime: Date.now(), idleLimit, checkInterval };
}

function recordPlayerAction(playerId: string): void {
  const player = getPlayer(playerId);
  if (player) {
    player.lastActiveTime = Date.now(); // 重置空闲计时
  }
}
```

> **设计理由**：花札是思考型卡牌游戏，限时易误伤新手。MVP 优先跑通核心循环（匹配→出牌→Koi→结算）。后期可加可选倒计时配置。
```

### 玩家断线处理

```typescript
function handleDisconnect(room: Room, playerId: string): Room {
  const updatedPlayers = room.players.map(p =>
    p.id === playerId ? { ...p, isConnected: false, lastActiveTime: Date.now() } : p
  );
  
  let newStatus = room.status;
  if (room.status === RoomStatus.Playing) {
    newStatus = RoomStatus.Paused; // 游戏中断线 → 暂停
  }
  
  return {
    ...room,
    players: updatedPlayers,
    status: newStatus,
  };
}

function handleReconnect(room: Room, playerId: string): Room {
  const updatedPlayers = room.players.map(p =>
    p.id === playerId ? { ...p, isConnected: true, lastActiveTime: Date.now() } : p
  );
  
  // 检查是否超过断线容忍时间
  const disconnectedPlayer = updatedPlayers.find(p => p.id === playerId);
  const disconnectDuration = (Date.now() - disconnectedPlayer!.lastActiveTime) / 1000;
  
  if (disconnectDuration > 120) {
    // 超过 2 分钟 → 判定断线玩家输
    return handleTimeoutLoss(room, playerId);
  }
  
  return {
    ...room,
    players: updatedPlayers,
    status: RoomStatus.Playing, // 恢复游戏
  };
}
```

## 状态同步策略

### 消息推送模型

```
服务端状态变更 → 推送给所有玩家

推送类型：
1. 全量推送（初始/重连）：发送完整 GameState
2. 增量推送（每步操作）：只发送变更部分
```

```typescript
interface StateDelta {
  type: 'delta' | 'full';
  seq: number;
  changes: Partial<GameState>;
  timestamp: number;
}

// 增量推送示例：出牌后
function createPlayCardDelta(
  seq: number,
  playerIndex: number,
  cardId: number,
  matched: boolean,
  matchedCards: number[],
  newField: number[],
  nextPlayer: number
): StateDelta {
  return {
    type: 'delta',
    seq,
    changes: {
      hands: { [playerIndex]: 'needs_full' }, // 手牌需要全量
      field: newField,
      captured: 'needs_full',
      currentPlayerIndex: nextPlayer,
      lastActionSeq: seq,
    },
    timestamp: Date.now(),
  };
}
```

### 客户端状态管理

```typescript
class ClientGameState {
  private state: GameState;
  private pendingActions: PendingAction[] = [];
  private lastServerSeq: number = 0;

  // 乐观更新
  optimisticPlay(cardId: number): void {
    const newState = playCard(this.state, this.myIndex, cardId);
    this.pendingActions.push({
      cardId,
      seq: this.generateSeq(),
      timestamp: Date.now(),
    });
    this.state = newState;
    this.notifyUI();
  }

  // 服务端权威确认
  onServerUpdate(delta: StateDelta): void {
    if (delta.type === 'full') {
      this.state = delta.changes as GameState;
      this.pendingActions = [];
    } else {
      // 增量更新：先确认乐观操作是否匹配
      this.confirmPendingActions(delta.seq);
      // 应用增量
      this.applyDelta(delta.changes);
    }
    this.lastServerSeq = delta.seq;
    this.notifyUI();
  }

  // 回滚不匹配的乐观操作
  confirmPendingActions(serverSeq: number): void {
    const confirmed = this.pendingActions.filter(a => a.seq <= serverSeq);
    const unconfirmed = this.pendingActions.filter(a => a.seq > serverSeq);
    
    if (unconfirmed.length > 0) {
      // 有未确认的操作 → 需要回滚
      this.rollback(unconfirmed);
    }
    this.pendingActions = unconfirmed;
  }
}
```

## 消息流时序

### 正常游戏流程

```
玩家 A                服务端                玩家 B
  │                    │                     │
  │  ─ play_card ────→ │                     │
  │                    │                     │
  │                    │  ─ card_played ────→│  (广播)
  │  ← card_played ──  │                     │
  │                    │                     │
  │                    │  (自动翻山札)        │
  │  ← card_drawn ───  │  ← card_drawn ─────│
  │                    │                     │
  │                    │  (役判定)            │
  │  ← yaku_result ──  │  ← yaku_result ────│
  │                    │                     │
  │  ── koi_koi ────→ │                     │
  │                    │                     │
  │                    │  ─ next_turn ──────→│
  │  ← next_turn ────  │                     │
```

### 断线重连流程

```
玩家 A                服务端                玩家 B
  │ (断线)             │                     │
  │                    │                     │
  │  ─ reconnect ────→ │                     │
  │                    │                     │
  │  ← game_state ───  │  (全量状态)          │
  │                    │                     │
  │  (同步状态)         │                     │
  │                    │                     │
  │  ─ ready ────────→ │                     │
  │                    │                     │
  │  ← resume ───────  │                     │
```

## 异常处理

| 异常 | 处理方式 |
|------|----------|
| 玩家断线 < 30 秒 | 暂停，等待重连 |
| 玩家断线 30s-120s | 自动重连 |
| 玩家断线 > 120s | 判定断线方输 |
| 消息乱序 | 服务端拒绝，要求客户端同步最新状态 |
| 消息重复 | 通过 seq 去重 |
| 非法操作 | 服务端返回 error，客户端回滚 |
| 双方同时断开 | 房间进入暂停状态，保存进度 |

## 核心接口

```typescript
interface BattleManager {
  // 房间
  createRoom(host: PlayerInfo, settings: RoomSettings): Promise<Room>;
  joinRoom(roomId: string, player: PlayerInfo): Promise<Room>;
  leaveRoom(roomId: string, playerId: string): Promise<void>;
  getRoom(roomId: string): Promise<Room>;
  
  // 游戏控制
  startGame(roomId: string): Promise<GameState>;
  playCard(roomId: string, playerIndex: number, cardId: number): Promise<GameState>;
  callKoiKoi(roomId: string): Promise<GameState>;
  endRound(roomId: string): Promise<GameState>;
  
  // 断线
  handleDisconnect(playerId: string): Promise<void>;
  handleReconnect(roomId: string, playerId: string): Promise<ReconnectResult>;
  
  // 事件
  onStateChange(roomId: string, handler: (state: GameState) => void): void;
  onPlayerJoin(roomId: string, handler: (player: RoomPlayer) => void): void;
  onPlayerLeave(roomId: string, handler: (player: RoomPlayer) => void): void;
}

interface ReconnectResult {
  state: GameState;
  reconnectSuccess: boolean;
  message: string;
}
```

## 测试要点

- [ ] 创建房间返回正确的 6 位房间号
- [ ] 两人加入后房间状态变为 Ready
- [ ] 房间满后拒绝新玩家
- [ ] 房主离开后正确转移房主
- [ ] 出牌消息正确广播给双方
- [ ] 断线 30 秒内重连恢复游戏
- [ ] 断线超过 2 分钟判定输
- [ ] 消息乱序时服务端拒绝
- [ ] 消息重复时去重
- [ ] 超时自动出牌/判负
- [ ] 双方同时断开后恢复

## 与系统索引的关联

| 依赖系统 | 交互方式 | 数据流向 |
|----------|----------|----------|
| 网络通信层 | 通过 NetworkManager 收发房间/游戏消息 | 网络 ↔ 对战管理 |
| 游戏状态管理 | 创建/更新/查询 GameState | 对战管理 ↔ 状态管理 |
| 游戏规则引擎 | 调用役判定、匹配逻辑 | 对战管理 → 规则引擎 |
| UI/牌桌渲染 | 推送状态变更给 UI | 对战管理 → UI |

## TBD — 待确认

- [x] 回合限时：MVP 不做，改用 90s 空闲心跳 ✅
- [x] 断线超时阈值：30s 重连窗口 / 120s 判负 ✅
- [ ] 是否需要"投降"功能
- [ ] 是否需要"观战"模式

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-04-27 | 初始版本，合并匹配+对战+回合控制 |
